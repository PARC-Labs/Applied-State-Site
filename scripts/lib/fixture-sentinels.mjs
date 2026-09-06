import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Select private payload columns, not shared vocabulary such as "private",
// "active", "AS01", or the public opaque slot keys. Read fixture values from
// their source so changing a SQL title or adding a Storage fixture cannot leave
// the artifact check searching an unrelated hand-maintained list.
const privateColumns = {
  'auth.users': ['id', 'email'],
  'public.profiles': ['id', 'handle', 'name', 'location', 'practice', 'website_url'],
  'public.states': ['id', 'owner_id', 'title', 'description'],
  'public.materials': ['id', 'created_by', 'title', 'body', 'url', 'storage_path'],
  'public.state_materials': ['state_id', 'material_id', 'added_by', 'annotation'],
  'public.state_collaborators': ['state_id', 'user_id', 'invited_by'],
  'public.as_member_resources': ['id', 'title', 'body', 'url', 'storage_path'],
  'storage.objects': ['id', 'name', 'owner_id'],
}

function literalValue(expression) {
  const match = expression.trim().match(/^'((?:[^']|'')*)'(?:\s*::\s*[a-z_][a-z0-9_.]*)?$/i)
  return match ? match[1].replaceAll("''", "'") : null
}

// Minimal VALUES reader: balances expression parentheses and respects escaped
// SQL quotes. It does not execute SQL or attempt to evaluate function calls.
function valueRows(source) {
  const rows = []
  let row = []
  let token = ''
  let depth = 0
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      token += char
      if (char === "'") {
        if (source[index + 1] === "'") token += source[++index]
        else quoted = false
      }
      continue
    }
    if (char === "'") {
      quoted = true
      token += char
    } else if (char === '(') {
      if (depth > 0) token += char
      depth += 1
    } else if (char === ')') {
      depth -= 1
      if (depth < 0) break
      if (depth === 0) {
        row.push(token.trim())
        rows.push(row)
        row = []
        token = ''
      } else token += char
    } else if (char === ',' && depth === 1) {
      row.push(token.trim())
      token = ''
    } else if (depth > 0) {
      token += char
    } else if (char === ';' || (char !== ',' && !/\s/.test(char))) {
      break
    }
  }
  return rows
}

export function extractPrivateFixtureSentinels(sql) {
  const sentinels = new Set()
  const inserts = /\binsert\s+into\s+((?:auth|public|storage)\.[a-z_]+)\s*\(([^)]+)\)\s*values\s*/gi

  for (const match of sql.matchAll(inserts)) {
    const selectedColumns = privateColumns[match[1].toLowerCase()]
    if (!selectedColumns) continue
    const columns = match[2].split(',').map((column) => column.trim().toLowerCase())
    for (const row of valueRows(sql.slice(match.index + match[0].length))) {
      for (const [index, column] of columns.entries()) {
        if (!selectedColumns.includes(column)) continue
        const value = literalValue(row[index] || '')
        if (value) sentinels.add(value)
      }
    }
  }

  // Also cover synthetic identifiers/URLs/emails introduced by an RPC or an
  // UPDATE later in the authorization tests rather than the initial INSERTs.
  for (const match of sql.matchAll(/'((?:[^']|'')*)'/g)) {
    const value = match[1].replaceAll("''", "'")
    if (
      /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value) &&
      value !== '00000000-0000-0000-0000-000000000000'
    ) sentinels.add(value)
    if (/^[^\s@]+@[^\s@]+\.test$/i.test(value)) sentinels.add(value)
    if (/^https?:\/\/[^\s/]+\.test(?:[/?#]|$)/i.test(value)) sentinels.add(value)
  }
  return [...sentinels]
}

export function loadPrivateFixtureSentinels(directory) {
  const sqlFiles = readdirSync(directory).filter((file) => file.endsWith('.sql'))
  if (!sqlFiles.length) throw new Error('No database fixture files found for the public artifact scan.')
  const sentinels = new Set(sqlFiles.flatMap((file) =>
    extractPrivateFixtureSentinels(readFileSync(join(directory, file), 'utf8')),
  ))
  if (!sentinels.size) throw new Error('Database fixtures yielded no private artifact sentinels.')
  return [...sentinels]
}

export function readArtifactFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) files.push(...readArtifactFiles(path))
    // Every emitted file is public, including SVG, extensionless files and
    // embedded metadata in binary assets. No extension filter is safe here.
    else files.push({ path, content: readFileSync(path).toString('utf8') })
  }
  return files
}

export function findPrivateFixtureLeak(files, sentinels) {
  for (const file of files) {
    for (const sentinel of sentinels) {
      if (file.content.includes(sentinel)) return { path: file.path, sentinel }
    }
  }
  return null
}
