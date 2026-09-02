export function memberEmails() {
  return new Set(
    (process.env.APPLIED_STATE_MEMBER_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isMemberEmail(email: string | null | undefined) {
  if (!email) return false
  return memberEmails().has(email.trim().toLowerCase())
}

export function isMemberAllowlistConfigured() {
  return memberEmails().size > 0
}
