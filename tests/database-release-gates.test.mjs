import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

for (const workflow of ['ci.yml', 'pages.yml']) {
  test(`${workflow} fails database lint on warnings and errors`, () => {
    const source = readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), 'utf8')
    const lintCommands = source.match(/^\s*run: supabase db lint[^\r\n]*/gm) ?? []
    assert.ok(lintCommands.length > 0, 'the workflow must run database lint')
    for (const command of lintCommands) {
      // --level only controls output. Without --fail-on the CLI exits zero
      // even when it finds SQL errors, allowing a broken release to proceed.
      assert.match(command, /--local\b/)
      assert.match(command, /--level warning\b/)
      assert.match(command, /--fail-on warning\s*$/)
    }
  })
}
