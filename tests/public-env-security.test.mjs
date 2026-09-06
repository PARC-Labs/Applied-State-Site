import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertSafePublicEnvironment,
  findCompiledCredentialLeaks,
  isBrowserSafeSupabaseKey,
  legacyJwtRole,
  loadEffectiveEnvironment,
  parseDotenv,
  validateSupabaseProjectUrl,
} from '../scripts/lib/public-env-security.mjs'

function unsignedJwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url')
  return `${header}.${payload}.test-signature`
}

test('dotenv parsing keeps quoted comments and strips unquoted comments', () => {
  assert.deepEqual(
    parseDotenv('PUBLIC_A="value # kept"\nexport PUBLIC_B=value # removed\nINVALID LINE'),
    { PUBLIC_A: 'value # kept', PUBLIC_B: 'value' },
  )
})

test('environment loading follows Vite precedence and lets process values win', () => {
  const directory = mkdtempSync(join(tmpdir(), 'applied-state-env-'))
  try {
    writeFileSync(join(directory, '.env'), 'PUBLIC_VALUE=base\nPUBLIC_REFERENCE=$PUBLIC_VALUE')
    writeFileSync(join(directory, '.env.local'), 'PUBLIC_VALUE=local')
    writeFileSync(join(directory, '.env.production'), 'PUBLIC_VALUE=production')
    writeFileSync(join(directory, '.env.production.local'), 'PUBLIC_VALUE=production-local')

    assert.deepEqual(
      loadEffectiveEnvironment({ cwd: directory, mode: 'production', processEnv: {} }),
      { PUBLIC_VALUE: 'production-local', PUBLIC_REFERENCE: 'production-local' },
    )
    assert.equal(
      loadEffectiveEnvironment({
        cwd: directory,
        mode: 'production',
        processEnv: { PUBLIC_VALUE: 'process' },
      }).PUBLIC_VALUE,
      'process',
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Supabase project URLs reject remote HTTP and embedded credentials', () => {
  assert.equal(validateSupabaseProjectUrl('https://project.supabase.co').ok, true)
  assert.equal(validateSupabaseProjectUrl('http://127.0.0.1:54321').ok, true)
  assert.match(validateSupabaseProjectUrl('http://project.supabase.co').reason, /HTTPS/)
  assert.match(validateSupabaseProjectUrl('https://user:password@project.supabase.co').reason, /credentials/)
  assert.match(validateSupabaseProjectUrl('https://project.supabase.co/rest/v1').reason, /origin/)
})

test('only publishable keys and legacy anon JWTs are browser safe', () => {
  const anon = unsignedJwt('anon')
  const serviceRole = unsignedJwt('service_role')

  assert.equal(legacyJwtRole(anon), 'anon')
  assert.equal(isBrowserSafeSupabaseKey('sb_publishable_example'), true)
  assert.equal(isBrowserSafeSupabaseKey(anon), true)
  assert.equal(isBrowserSafeSupabaseKey('sb_secret_example'), false)
  assert.equal(isBrowserSafeSupabaseKey(serviceRole), false)
})

test('public environment validation allows disabled or safe config and rejects partial config', () => {
  assert.deepEqual(assertSafePublicEnvironment({}), { configured: false })
  assert.deepEqual(
    assertSafePublicEnvironment({
      PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    }),
    { configured: true, url: 'https://project.supabase.co', keyKind: 'publishable' },
  )
  assert.throws(
    () => assertSafePublicEnvironment({ PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }),
    /configure both/,
  )
})

test('public environment rejects a legacy service-role JWT without printing it', () => {
  const serviceRole = unsignedJwt('service_role')
  let message = ''

  try {
    assertSafePublicEnvironment({
      PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceRole,
    })
  } catch (error) {
    message = error.message
  }

  assert.match(message, /privileged credential/)
  assert.doesNotMatch(message, new RegExp(serviceRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('compiled-artifact scan decodes JWT roles and catches credentialed URLs', () => {
  const serviceRole = unsignedJwt('service_role')
  const findings = findCompiledCredentialLeaks(
    `const token="${serviceRole}"; const endpoint="https://user:pass@example.test";`,
  )

  assert.ok(findings.includes('JWT with privileged role service_role'))
  assert.ok(findings.includes('credentialed URL'))
  assert.deepEqual(findCompiledCredentialLeaks(`const key="${unsignedJwt('anon')}";`), [])
})
