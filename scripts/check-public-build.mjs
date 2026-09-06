import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findCompiledCredentialLeaks } from './lib/public-env-security.mjs'
import {
  findPrivateFixtureLeak,
  loadPrivateFixtureSentinels,
  readArtifactFiles,
} from './lib/fixture-sentinels.mjs'

const root = new URL('../', import.meta.url)
const dist = fileURLToPath(new URL('dist/', root))

if (!existsSync(dist)) {
  throw new Error('dist/ is missing. Run npm run build first.')
}

const artifactFiles = readArtifactFiles(dist)
const files = artifactFiles.map((file) => file.path)

function readBuiltRoute(relativePath) {
  return readFileSync(join(dist, relativePath), 'utf8')
}

function normalizeRenderedText(fragment) {
  return fragment
    .replace(/<!--(?:.|\n|\r)*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function openingTagsWithAttribute(html, tagName, attribute) {
  const pattern = new RegExp(
    `<${tagName}\\b(?=[^>]*\\b${attribute}(?:\\s*=|\\s|/?>))[^>]*>`,
    'gi',
  )
  return [...html.matchAll(pattern)].map((match) => match[0])
}

function elementContentsWithAttribute(html, attribute) {
  const pattern = new RegExp(
    `<([a-z][a-z0-9-]*)\\b(?=[^>]*\\b${attribute}(?:\\s*=|\\s|/?>))[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'gi',
  )
  return [...html.matchAll(pattern)].map((match) => match[2])
}

const publicRoutes = [
  'index.html',
  'as01/index.html',
  'as02/index.html',
  'as03/index.html',
  'about/index.html',
  'membership/index.html',
  'signin/index.html',
  '404.html',
]

const memberRoutes = [
  'states/index.html',
  'states/view/index.html',
  'index/index.html',
  'index/view/index.html',
  'index/review/index.html',
]

for (const file of [...publicRoutes, ...memberRoutes]) {
  if (!existsSync(join(dist, file))) {
    throw new Error(`Required static route is missing: ${file}`)
  }
}

const publicBuild = artifactFiles.map((file) => file.content).join('\n')

const configuredBase = (process.env.BASE_PATH || '/').trim()
if (!configuredBase.startsWith('/')) {
  throw new Error('BASE_PATH must begin with a forward slash.')
}
const expectedBase = configuredBase === '/'
  ? '/'
  : `${configuredBase.replace(/\/+$/, '')}/`

if (expectedBase !== '/') {
  for (const file of files.filter((file) => /\.html$/i.test(file))) {
    const html = readFileSync(file, 'utf8')
    for (const match of html.matchAll(/\b(?:href|src|action)=["'](\/(?!\/)[^"']*)["']/gi)) {
      if (!match[1].startsWith(expectedBase)) {
        throw new Error(
          `${file} contains a root-relative URL outside the configured base path: ${match[1]}`,
        )
      }
    }
  }

  const unbasedRuntimeRoute = new RegExp(
    `["'\\x60]/(?:_astro|about|as0[1-3]|index|membership|signin|states)/`,
  )
  if (unbasedRuntimeRoute.test(publicBuild)) {
    throw new Error('Compiled runtime contains an internal URL outside the configured base path.')
  }
}

const sentinels = [
  ...loadPrivateFixtureSentinels(fileURLToPath(new URL('supabase/tests/database/', root))),
  ...(process.env.LEAK_TEST_VALUES || '').split(',').map((value) => value.trim()).filter(Boolean),
]

const fixtureLeak = findPrivateFixtureLeak(artifactFiles, sentinels)
if (fixtureLeak) {
  throw new Error(`Private test value leaked into ${fixtureLeak.path}: ${fixtureLeak.sentinel}`)
}

const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['\"]?\S+/i,
  /SUPABASE_SECRET_KEY\s*[:=]\s*['\"]?\S+/i,
  /sb_secret_[A-Za-z0-9._-]{16,}/,
]

for (const pattern of secretPatterns) {
  if (pattern.test(publicBuild)) {
    throw new Error(`Secret value pattern leaked into dist/: ${pattern}`)
  }
}

const credentialLeaks = findCompiledCredentialLeaks(publicBuild)
if (credentialLeaks.length) {
  throw new Error(`Privileged credential material leaked into dist/: ${credentialLeaks.join(', ')}`)
}

const home = readBuiltRoute('index.html')
if (/<script(?:\s|>)/i.test(home)) {
  throw new Error('Homepage must not ship client-side JavaScript.')
}

const homeHeadings = [...home.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
if (homeHeadings.length !== 1 || normalizeRenderedText(homeHeadings[0][1]) !== 'APPLIED STATE') {
  throw new Error('Homepage must expose APPLIED STATE as its single semantic H1.')
}

const as01 = readBuiltRoute('as01/index.html')
const expectedAs01Slots = ['as01-film-001', 'as01-resource-001']
const actualAs01Slots = [...as01.matchAll(/data-member-slot="([^"]+)"/g)].map((match) => match[1]).sort()
if (JSON.stringify(actualAs01Slots) !== JSON.stringify([...expectedAs01Slots].sort())) {
  throw new Error('AS01 must contain exactly the approved opaque member slots.')
}
for (const slotKey of actualAs01Slots) {
  if (!/^as01-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slotKey)) {
    throw new Error(`AS01 contains a non-opaque member slot key: ${slotKey}`)
  }
}

for (const instance of ['as02', 'as03']) {
  const html = readBuiltRoute(`${instance}/index.html`)
  if (/<script(?:\s|>)/i.test(html) || /data-member-slot=/i.test(html)) {
    throw new Error(`${instance.toUpperCase()} must not ship the member runtime or member slots.`)
  }
  if (/members have access to additional material/i.test(html)) {
    throw new Error(`${instance.toUpperCase()} must not claim member material that is not authored.`)
  }
}

const signin = readBuiltRoute('signin/index.html')
const emailInput = openingTagsWithAttribute(signin, 'input', 'data-member-email')[0]
if (!emailInput) {
  throw new Error('Sign-in email input is missing from the static build.')
}
if (/\bname\s*=/i.test(emailInput) || /\bvalue\s*=/i.test(emailInput)) {
  throw new Error('Sign-in email input must not serialize or prepopulate an email in a static GET request.')
}

const emptyHydrationTargets = [
  'data-owned-states',
  'data-collaborative-states',
  'data-pending-invitations',
  'data-state-owner',
  'data-state-lifecycle',
  'data-state-description',
  'data-state-collaborators',
  'data-state-materials',
  'data-index-states',
  'data-submitted-states',
  'data-open-index-states',
]

for (const route of memberRoutes) {
  const html = readBuiltRoute(route)
  const robotsTag = openingTagsWithAttribute(html, 'meta', 'name').find((tag) =>
    /\bname\s*=\s*["']robots["']/i.test(tag),
  )

  if (!robotsTag || !/\bcontent\s*=\s*["'][^"']*\bnoindex\b[^"']*["']/i.test(robotsTag)) {
    throw new Error(`${route} must remain excluded from search indexing.`)
  }

  const workspaceTags = openingTagsWithAttribute(html, '[a-z][a-z0-9-]*', 'data-member-workspace')
  if (workspaceTags.length !== 1 || !/\bhidden(?:\s|=|>)/i.test(workspaceTags[0])) {
    throw new Error(`${route} must ship its member workspace hidden and fail closed.`)
  }

  const formControls = html.match(/<(?:input|textarea|select)\b[^>]*>/gi) || []
  for (const control of formControls) {
    if (/\bname\s*=/i.test(control)) {
      throw new Error(`${route} contains a named private form control that could serialize into a static GET URL.`)
    }
    if (/^<input\b/i.test(control) && /\bvalue\s*=/i.test(control)) {
      throw new Error(`${route} contains a prepopulated private input in the static artifact.`)
    }
  }

  for (const textarea of html.matchAll(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi)) {
    if (normalizeRenderedText(textarea[1])) {
      throw new Error(`${route} contains prepopulated private textarea content in the static artifact.`)
    }
  }

  if (/\bdata-(?:state|material|user)-id\s*=\s*["'][^"']+["']/i.test(html)) {
    throw new Error(`${route} contains a private record identifier in static HTML.`)
  }
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(html)) {
    throw new Error(`${route} contains an email address in static HTML.`)
  }

  for (const attribute of emptyHydrationTargets) {
    for (const contents of elementContentsWithAttribute(html, attribute)) {
      if (normalizeRenderedText(contents)) {
        throw new Error(`${route} contains pre-rendered private data in ${attribute}.`)
      }
    }
  }
}

console.log(
  `Public build verified: ${files.length} files, no private credentials/content, and all static route invariants hold.`,
)
