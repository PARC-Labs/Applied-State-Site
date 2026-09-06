import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  extractPrivateFixtureSentinels,
  findPrivateFixtureLeak,
  loadPrivateFixtureSentinels,
  readArtifactFiles,
} from '../scripts/lib/fixture-sentinels.mjs'

test('artifact sentinels are derived from actual private database fixtures', () => {
  const sentinels = loadPrivateFixtureSentinels(
    fileURLToPath(new URL('../supabase/tests/database/', import.meta.url)),
  )
  for (const expected of [
    'owner@example.test',
    'Owner private one',
    'Second private note',
    'Member-only body',
    'https://same.example.test/reference',
    '10000000-0000-4000-8000-000000000001',
  ]) assert.ok(sentinels.includes(expected), `Missing fixture sentinel: ${expected}`)
  for (const ordinaryValue of ['AS01', 'active', 'private', 'text', 'as01-active-test']) {
    assert.ok(!sentinels.includes(ordinaryValue), `Public/shared vocabulary is not a sentinel: ${ordinaryValue}`)
  }
})

test('fixture extraction handles escaped text, expression commas, and private Storage paths', () => {
  const sentinels = extractPrivateFixtureSentinels(`
    insert into public.states (id, title, description, visibility, created_at)
    values ('10000000-0000-4000-8000-000000000010', 'Owner''s title; still private',
      'A private, (parenthesized) note', 'private', coalesce(null, now()));
    insert into storage.objects (bucket_id, name, metadata)
    values ('member-assets', 'as01/private-fixture-film.mp4', '{}');
  `)
  assert.ok(sentinels.includes("Owner's title; still private"))
  assert.ok(sentinels.includes('A private, (parenthesized) note'))
  assert.ok(sentinels.includes('as01/private-fixture-film.mp4'))
  assert.ok(!sentinels.includes('member-assets'))
  assert.ok(!sentinels.includes('{}'))
})

for (const filename of ['leak.svg', 'member-payload', 'nested/leak.bin']) {
  test(`whole artifact scan rejects private fixture content in ${filename}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'applied-state-leakage-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    mkdirSync(join(directory, 'nested'))
    writeFileSync(join(directory, 'index.html'), '<h1>APPLIED STATE</h1>')
    writeFileSync(join(directory, filename), Buffer.concat([
      Buffer.from([0, 255, 0]),
      Buffer.from('Owner private one'),
      Buffer.from([0, 128, 0]),
    ]))
    const leak = findPrivateFixtureLeak(readArtifactFiles(directory), ['Owner private one'])
    assert.deepEqual(leak, { path: join(directory, filename), sentinel: 'Owner private one' })
  })
}

test('public content and opaque slots do not create fixture false positives', () => {
  const sentinels = loadPrivateFixtureSentinels(
    fileURLToPath(new URL('../supabase/tests/database/', import.meta.url)),
  )
  const files = [{
    path: 'as01/index.html',
    content: '<h1>AS01</h1><h2>ARENA</h2><div data-member-slot="as01-film-001"></div>private active text',
  }]
  assert.equal(findPrivateFixtureLeak(files, sentinels), null)
})
