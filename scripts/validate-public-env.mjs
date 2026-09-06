import { assertSafePublicEnvironment, loadEffectiveEnvironment } from './lib/public-env-security.mjs'

const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 && process.argv[modeIndex + 1] ? process.argv[modeIndex + 1] : 'production'
const environment = loadEffectiveEnvironment({ mode })
const result = assertSafePublicEnvironment(environment)

console.log(
  result.configured
    ? `Public environment verified for ${mode} (${result.keyKind} Supabase key).`
    : `Public environment verified for ${mode} (member services intentionally unconfigured).`,
)
