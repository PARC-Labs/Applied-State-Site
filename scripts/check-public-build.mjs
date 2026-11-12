import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findCompiledCredentialLeaks } from './lib/credential-scan.mjs'
import { findPrivateFixtureLeak, loadPrivateFixtureSentinels, readArtifactFiles } from './lib/fixture-sentinels.mjs'

const root = new URL('../', import.meta.url)
const dist = fileURLToPath(new URL('dist/', root))
if (!existsSync(dist)) throw new Error('dist/ is missing. Run npm run build first.')

const artifacts = readArtifactFiles(dist)
const allOutput = artifacts.map((file) => file.content).join('\n')
const required = ['index.html', 'as01/index.html', 'as02/index.html', 'as03/index.html', 'about/index.html', '404.html']
for (const file of required) {
  if (!existsSync(join(dist, file))) throw new Error(`Required institutional page missing: ${file}`)
}
const htmlPaths = artifacts.filter((file) => file.path.endsWith('.html')).map((file) => file.path.replaceAll('\\', '/'))
for (const file of htmlPaths) {
  const relative = file.startsWith(dist.replaceAll('\\', '/') + '/') ? file.slice(dist.length + 1) : file
  if (!required.includes(relative)) throw new Error(`Unexpected public route: ${relative}`)
}
for (const route of ['membership','signin','states','index','apply','applications']) {
  if (existsSync(join(dist, route, 'index.html'))) throw new Error(`Retired member route still emitted: ${route}`)
}
for (const [name, pattern] of [
  ['member runtime markup', /data-member-(?:slot|signin|workspace|visible|note|signout|email)/i],
  ['retired route links', /(?:href|action)=["'][^"']*\/(?:membership|signin|states|index|apply|applications)\/(?:[?#][^"']*)?["']/i],
]) {
  if (pattern.test(allOutput)) throw new Error(`Retired member UI detected: ${name}`)
}
const home = readFileSync(join(dist, 'index.html'), 'utf8')
if (/<script(?:\s|>)/i.test(home)) throw new Error('Institutional homepage must ship no client script.')
const headings = [...home.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
if (headings.length !== 1 || headings[0][1].replace(/<[^>]+>/g, '').trim() !== 'APPLIED STATE') {
  throw new Error('Homepage must have one APPLIED STATE heading.')
}
for (const name of ['as02','as03']) {
  const html = readFileSync(join(dist, name, 'index.html'), 'utf8')
  if (/<script(?:\s|>)/i.test(html)) throw new Error(`${name} must remain a static editorial page.`)
}
const fixtureSentinels = loadPrivateFixtureSentinels(fileURLToPath(new URL('supabase/tests/database/', root)))
const injectedSentinels = (process.env.LEAK_TEST_VALUES || '').split(',').map(s => s.trim()).filter(Boolean)
const leak = findPrivateFixtureLeak(artifacts, [...fixtureSentinels,...injectedSentinels])
if (leak) throw new Error(`Private fixture data leaked into ${leak.path}: ${leak.sentinel}`)
const credentialLeaks = findCompiledCredentialLeaks(allOutput)
if (credentialLeaks.length) throw new Error(`Privileged credentials leaked into dist/: ${credentialLeaks.join(', ')}`)

const configuredBase = (process.env.BASE_PATH || '/').trim()
if (!configuredBase.startsWith('/')) throw new Error('BASE_PATH must begin with /.')
const base = configuredBase === '/' ? '/' : `${configuredBase.replace(/\/+$/, '')}/`
if (base !== '/') {
  for (const file of artifacts.filter(x => x.path.endsWith('.html'))) {
    for (const match of file.content.matchAll(/(?:href|src|action)=["'](\/(?!\/)[^"']*)["']/gi)) {
      if (!match[1].startsWith(base)) throw new Error(`URL outside BASE_PATH in ${file.path}: ${match[1]}`)
    }
  }
}
console.log('Institutional routes, absence of retired member UI, and public artifact leakage checks passed.')
