import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 && process.argv[modeIndex + 1] ? process.argv[modeIndex + 1] : 'production'
const names = new Set()

for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith('PUBLIC_') && typeof value === 'string' && value.trim()) names.add(name)
}

for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
  const path = resolve(file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)$/)
    if (match && match[2].trim() && match[2].trim() !== "''" && match[2].trim() !== '""') names.add(match[1])
  }
}

if (names.size > 0) {
  throw new Error(`Unsupported public client configuration for institution-only site: ${[...names].sort().join(', ')}. Remove retired member-service environment variables.`)
}
console.log(`Institutional static environment verified for ${mode}.`)
