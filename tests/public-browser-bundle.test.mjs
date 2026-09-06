import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const sentinel = 'UNRELATED_PRIVATE_BROWSER_CONFIGURATION_SENTINEL'

test('prebuild rejects unsupported public configuration without printing its value', () => {
  assert.throws(
    () => execFileSync(process.execPath, ['scripts/validate-public-env.mjs'], {
      cwd: root,
      env: { ...process.env, PUBLIC_PRIVATE_SENTINEL: sentinel },
      stdio: 'pipe',
    }),
    (error) => {
      const output = error.stderr.toString()
      assert.match(output, /not an approved browser configuration field/)
      assert.ok(!output.includes(sentinel))
      return true
    },
  )
})

test('the real browser client bundles only its explicit public configuration fields', async () => {
  const values = {
    PUBLIC_SUPABASE_URL: 'https://browser-test.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_test',
    PUBLIC_PRIVATE_SENTINEL: sentinel,
  }
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  try {
    // Build the real client through Vite, deliberately bypassing prebuild to
    // prove that the runtime itself never captures the whole environment.
    const result = await build({
      root,
      configFile: false,
      envPrefix: 'PUBLIC_',
      logLevel: 'silent',
      build: {
        write: false,
        minify: false,
        lib: { entry: fileURLToPath(new URL('../src/lib/supabase.ts', import.meta.url)), formats: ['es'] },
        rollupOptions: { external: ['@supabase/supabase-js'] },
      },
    })
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output)
    const code = outputs.map((item) => item.type === 'chunk' ? item.code : String(item.source)).join('\n')
    assert.ok(code.includes(values.PUBLIC_SUPABASE_URL))
    assert.ok(code.includes(values.PUBLIC_SUPABASE_PUBLISHABLE_KEY))
    assert.ok(!code.includes(sentinel))
    assert.ok(!code.includes('PUBLIC_PRIVATE_SENTINEL'))
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
