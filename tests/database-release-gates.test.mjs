import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')

test('preserved Supabase backend still has a migration, lint and RLS check on backend changes', () => {
  const source = workflow('legacy-supabase.yml')
  assert.match(source, /supabase db start/)
  assert.match(source, /supabase db lint --local --level warning --fail-on warning/)
  assert.match(source, /supabase test db/)
  assert.match(source, /'supabase\/\*\*'/)
})

test('static institutional site release does not depend on a retired database', () => {
  for (const file of ['ci.yml', 'pages.yml']) {
    const source = workflow(file)
    assert.doesNotMatch(source, /supabase db start|supabase test db|supabase db lint/)
  }
  assert.match(workflow('pages.yml'), /needs: \[build\]/)
})
