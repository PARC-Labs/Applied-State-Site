import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'vite'

test('magic-link requests preserve invite-only privacy and report transport failures', async (t) => {
  const result = await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    define: {
      'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify('https://auth-test.supabase.co'),
      'import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_auth_test'),
      'import.meta.env.BASE_URL': JSON.stringify('/'),
    },
    plugins: [{
      name: 'fake-auth-client',
      enforce: 'pre',
      resolveId(id) { if (id === '@supabase/supabase-js') return '\0fake-auth-client' },
      load(id) {
        if (id === '\0fake-auth-client') {
          return `export const createClient = (...args) => {
            globalThis.__authClientArgs = args
            return globalThis.__authTestClient
          }`
        }
      },
    }],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL('../src/lib/supabase.ts', import.meta.url)), formats: ['es'] },
    },
  })
  const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output)
  const chunk = output.find((item) => item.type === 'chunk' && item.isEntry)
  assert.ok(chunk)
  const previousWindow = globalThis.window
  const previousClient = globalThis.__authTestClient
  const previousClientArgs = globalThis.__authClientArgs
  const requests = []
  let outcome = { error: null }
  globalThis.window = { location: { href: 'https://appliedstate.xyz/signin/?ignored=1' } }
  globalThis.__authTestClient = {
    auth: { async signInWithOtp(request) {
      requests.push(request)
      if (outcome instanceof Error) throw outcome
      return outcome
    } },
  }
  try {
    const { requestMagicLink, getBrowserSupabaseClient } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)
    assert.equal(getBrowserSupabaseClient(), globalThis.__authTestClient, 'Auth must be mocked before any request')
    assert.deepEqual(globalThis.__authClientArgs.slice(0, 2), [
      'https://auth-test.supabase.co',
      'sb_publishable_auth_test',
    ])
    assert.deepEqual(globalThis.__authClientArgs[2].auth, {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      persistSession: true,
    })
    await t.test('normalizes the address, disables signup and uses the production callback', async () => {
      assert.equal(await requestMagicLink('  MEMBER@EXAMPLE.TEST  '), 'accepted')
      assert.deepEqual(requests.at(-1), {
        email: 'member@example.test',
        options: { shouldCreateUser: false, emailRedirectTo: 'https://appliedstate.xyz/signin/' },
      })
    })
    await t.test('rejects invalid addresses before contacting Auth', async () => {
      const count = requests.length
      for (const email of ['', 'invalid', 'member @example.test', 'member\n@example.test']) {
        assert.equal(await requestMagicLink(email), 'invalid')
      }
      assert.equal(requests.length, count)
    })
    await t.test('reports SDK-returned network failures without an HTTP response', async () => {
      outcome = { error: { name: 'AuthRetryableFetchError', status: 0 } }
      assert.equal(await requestMagicLink('member@example.test'), 'unavailable')
    })
    await t.test('reports thrown transport failures', async () => {
      outcome = new TypeError('Failed to fetch')
      assert.equal(await requestMagicLink('member@example.test'), 'unavailable')
    })
    await t.test('keeps account, SMTP and rate-limit responses indistinguishable', async () => {
      for (const error of [
        null,
        { name: 'AuthApiError', code: 'user_not_found', status: 404 },
        { name: 'AuthApiError', code: 'signup_disabled', status: 422 },
        { name: 'AuthApiError', code: 'user_banned', status: 403 },
        { name: 'AuthApiError', code: 'email_address_not_authorized', status: 400 },
        { name: 'AuthApiError', code: 'over_email_send_rate_limit', status: 429 },
        { name: 'AuthRetryableFetchError', status: 500 },
        { name: 'AuthRetryableFetchError', status: 503 },
      ]) {
        outcome = { error }
        assert.equal(await requestMagicLink('member@example.test'), 'accepted')
      }
    })
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousClient === undefined) delete globalThis.__authTestClient
    else globalThis.__authTestClient = previousClient
    if (previousClientArgs === undefined) delete globalThis.__authClientArgs
    else globalThis.__authClientArgs = previousClientArgs
  }
})
