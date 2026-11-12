import assert from 'node:assert/strict'
import test from 'node:test'
import { findCompiledCredentialLeaks } from '../scripts/lib/credential-scan.mjs'

function jwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url')
  return `${header}.${payload}.signaturevalue`
}

test('compiled static artifacts reject privileged tokens and credentialed URLs', () => {
  const findings = findCompiledCredentialLeaks(`x=${jwt('service_role')}; y=https://user:password@example.test; z=sb_secret_ABCDEFGHIJKLMN`)
  assert.ok(findings.includes('JWT with privileged role service_role'))
  assert.ok(findings.includes('Credentialed URL'))
  assert.ok(findings.includes('Supabase secret key'))
})

test('anonymous JWT tokens and normal public links are not reported as secrets', () => {
  assert.deepEqual(findCompiledCredentialLeaks(`token=${jwt('anon')}; link=https://example.test/`), [])
})
