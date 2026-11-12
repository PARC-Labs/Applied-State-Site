// Only the compiled output is public. Do not emit service-role keys, JWTs
// with privileged roles, or credential-bearing URLs in a static artifact.
function jwtRole(value) {
  try {
    const fields = value.split('.')
    if (fields.length !== 3) return null
    const payload = JSON.parse(Buffer.from(fields[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export function findCompiledCredentialLeaks(source) {
  const findings = new Set()
  if (/sb_secret_[A-Za-z0-9._-]{8,}/.test(source)) findings.add('Supabase secret key')
  if (/(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\s*[:=]\s*['"]?\S+/i.test(source)) {
    findings.add('Privileged key assignment')
  }
  if (/https?:\\?\/\\?\/[^\s/'"<>:]+:[^\s/'"<>@]+@/i.test(source)) findings.add('Credentialed URL')
  for (const match of source.matchAll(/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) {
    const role = jwtRole(match[0])
    if (role && role !== 'anon') findings.add(`JWT with privileged role ${role}`)
  }
  return [...findings]
}
