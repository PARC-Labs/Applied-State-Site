import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC_PREFIX = 'PUBLIC_'
const ALLOWED_PUBLIC_NAMES = new Set(['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY'])
const PLACEHOLDER_URL = 'https://YOUR_PROJECT.supabase.co'
const PLACEHOLDER_KEY = 'sb_publishable_YOUR_KEY'

function decodeQuotedValue(value) {
  const quote = value[0]
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) return null

  const inner = value.slice(1, -1)
  if (quote === "'") return inner

  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

export function parseDotenv(source) {
  const parsed = {}

  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?$/)
    if (!match) continue

    const [, name, remainder = ''] = match
    const trimmed = remainder.trim()
    const quoted = trimmed ? decodeQuotedValue(trimmed) : null
    const value = quoted ?? trimmed.replace(/\s+#.*$/, '').trim()
    parsed[name] = value
  }

  return parsed
}

function expandEnvironment(values) {
  const expanded = {}
  const resolving = new Set()

  function resolve(name) {
    if (Object.hasOwn(expanded, name)) return expanded[name]
    if (!Object.hasOwn(values, name)) return ''
    if (resolving.has(name)) return values[name]

    resolving.add(name)
    const value = values[name].replace(/(?<!\\)\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g, (_, braced, plain) =>
      resolve(braced ?? plain),
    ).replace(/\\\$/g, '$')
    resolving.delete(name)
    expanded[name] = value
    return value
  }

  for (const name of Object.keys(values)) resolve(name)
  return expanded
}

/**
 * Load environment files in the same low-to-high precedence order used by Vite:
 * .env, .env.local, .env.[mode], .env.[mode].local. Existing process values win.
 */
export function loadEffectiveEnvironment({
  cwd = process.cwd(),
  mode = 'production',
  processEnv = process.env,
} = {}) {
  const values = {}
  const filenames = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]

  for (const filename of filenames) {
    const path = join(cwd, filename)
    if (!existsSync(path)) continue
    Object.assign(values, parseDotenv(readFileSync(path, 'utf8')))
  }

  for (const [name, value] of Object.entries(processEnv)) {
    if (typeof value === 'string') values[name] = value
  }

  return expandEnvironment(values)
}

export function legacyJwtRole(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export function isBrowserSafeSupabaseKey(key) {
  if (key.startsWith('sb_publishable_')) return true
  if (key.startsWith('sb_secret_')) return false
  return legacyJwtRole(key) === 'anon'
}

export function validateSupabaseProjectUrl(value) {
  try {
    const url = new URL(value)
    const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
    const safeProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && loopback)
    const originOnly = (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash

    if (!safeProtocol) return { ok: false, reason: 'must use HTTPS (HTTP is allowed only for loopback development)' }
    if (url.username || url.password) return { ok: false, reason: 'must not contain embedded credentials' }
    if (!originOnly) return { ok: false, reason: 'must be an origin without a path, query, or fragment' }

    return { ok: true, value: url.origin }
  } catch {
    return { ok: false, reason: 'must be a valid absolute URL' }
  }
}

function nonPlaceholder(value, placeholder) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed && trimmed !== placeholder ? trimmed : null
}

function privilegedPublicValue(value) {
  if (value.startsWith('sb_secret_')) return true
  const role = legacyJwtRole(value)
  return role !== null && role !== 'anon'
}

/**
 * Validate exactly the effective values Astro can expose to browser code.
 * Missing configuration is allowed so the public static site remains usable;
 * partial, unsafe, or privileged configuration is rejected before compilation.
 */
export function assertSafePublicEnvironment(environment) {
  for (const [name, rawValue] of Object.entries(environment)) {
    if (!name.startsWith(PUBLIC_PREFIX) || typeof rawValue !== 'string') continue
    if (privilegedPublicValue(rawValue.trim())) {
      throw new Error(`Public environment rejected: ${name} contains a privileged credential.`)
    }
    if (rawValue.trim() && !ALLOWED_PUBLIC_NAMES.has(name)) {
      throw new Error(`Public environment rejected: ${name} is not an approved browser configuration field.`)
    }
  }

  const rawUrl = nonPlaceholder(environment.PUBLIC_SUPABASE_URL, PLACEHOLDER_URL)
  const selectedKey = environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const rawKey = nonPlaceholder(selectedKey, PLACEHOLDER_KEY)

  if (!rawUrl && !rawKey) return { configured: false }
  if (!rawUrl || !rawKey) {
    throw new Error(
      'Public environment rejected: configure both PUBLIC_SUPABASE_URL and a browser-safe Supabase publishable/anon key, or neither.',
    )
  }

  const urlResult = validateSupabaseProjectUrl(rawUrl)
  if (!urlResult.ok) {
    throw new Error(`Public environment rejected: PUBLIC_SUPABASE_URL ${urlResult.reason}.`)
  }

  if (!isBrowserSafeSupabaseKey(rawKey)) {
    throw new Error(
      'Public environment rejected: PUBLIC_SUPABASE_PUBLISHABLE_KEY must be an sb_publishable_ key or a legacy JWT with role anon.',
    )
  }

  return { configured: true, url: urlResult.value, keyKind: rawKey.startsWith('sb_publishable_') ? 'publishable' : 'legacy-anon' }
}

export function findCompiledCredentialLeaks(text) {
  const findings = new Set()

  if (/sb_secret_[A-Za-z0-9._-]{8,}/.test(text)) findings.add('Supabase secret key')
  if (/SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\s*[:=]\s*['"]?\S+/i.test(text)) {
    findings.add('Supabase privileged-key assignment')
  }
  if (/https?:\\?\/\\?\/[^\s/'"<>:]+:[^\s/'"<>@]+@/i.test(text)) findings.add('credentialed URL')

  const jwtPattern = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
  for (const match of text.matchAll(jwtPattern)) {
    const role = legacyJwtRole(match[0])
    if (role && role !== 'anon') findings.add(`JWT with privileged role ${role}`)
  }

  return [...findings]
}
