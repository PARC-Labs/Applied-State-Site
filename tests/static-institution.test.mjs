import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const retired = [
  'src/pages/membership.astro', 'src/pages/signin.astro', 'src/pages/apply.astro',
  'src/pages/states/index.astro','src/pages/index/index.astro','src/pages/applications/review/index.astro',
  'src/components/MemberSlot.astro','src/lib/supabase.ts','src/scripts/member-runtime.ts',
]

test('public member routes and client runtimes are absent', () => {
  for (const path of retired) assert.equal(existsSync(new URL('../' + path, import.meta.url)), false, path)
  const footer = readFileSync(new URL('../src/components/SiteFooter.astro', import.meta.url), 'utf8')
  assert.doesNotMatch(footer, /membership|signin|states|applications|index\/review/i)
})

test('public environment does not accept retired browser credentials', () => {
  const sentinel = 'PRIVATE_VALUE_NEVER_PRINT_THIS'
  assert.throws(() => execFileSync(process.execPath, ['scripts/validate-public-env.mjs'], {
    cwd: root, env: { ...process.env, PUBLIC_SUPABASE_URL: sentinel }, stdio: 'pipe',
  }), (error) => {
    assert.match(error.stderr.toString(), /Unsupported public client configuration/)
    assert.doesNotMatch(error.stderr.toString(), new RegExp(sentinel))
    return true
  })
})

test('the Pages build does not configure the old member browser API', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
  assert.doesNotMatch(workflow, /PUBLIC_SUPABASE_URL|PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
})
