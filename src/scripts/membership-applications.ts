import { getBrowserSupabaseClient } from '../lib/supabase'

export type ApplicationInput = {
  name: string
  email: string
  location: string
  practice: string
  portfolio: string
  statement: string
  subject: string
}

export function validateApplication(input: ApplicationInput): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 160) return 'Enter your name.'
  if (input.email.trim().length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) return 'Enter a valid email.'
  if (input.location.trim().length > 160) return 'Location is too long.'
  if (input.practice.trim().length < 10 || input.practice.trim().length > 2000) return 'Describe your practice or research.'
  if (input.portfolio.trim() && (!input.portfolio.trim().startsWith('https://') || input.portfolio.trim().length > 2048)) return 'Website URLs must use HTTPS.'
  if (input.statement.trim().length < 40 || input.statement.trim().length > 4000) return 'Include a short statement of at least 40 characters.'
  return null
}

export function initMembershipApplication(): void {
  const form = document.querySelector<HTMLFormElement>('[data-membership-application]')
  const status = document.querySelector<HTMLElement>('[data-application-status]')
  if (!form || !status) return

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(form)
    const value = (key: string) => String(values.get(key) ?? '')
    const input: ApplicationInput = {
      name: value('name'), email: value('email'), location: value('location'),
      practice: value('practice'), portfolio: value('portfolio'),
      statement: value('statement'), subject: value('subject'),
    }
    const invalid = validateApplication(input)
    if (invalid) {
      status.textContent = invalid
      return
    }
    const client = getBrowserSupabaseClient()
    if (!client) {
      status.textContent = 'Application submission is unavailable.'
      return
    }

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (button) button.disabled = true
    status.textContent = 'Submitting…'
    try {
      const { error } = await client.rpc('submit_membership_application', {
        p_name: input.name, p_email: input.email,
        p_practice: input.practice, p_location: input.location,
        p_portfolio_url: input.portfolio, p_statement: input.statement,
        p_honeypot: input.subject,
      })
      if (error) {
        status.textContent = 'Application could not be submitted. Please try again.'
      } else {
        form.reset()
        status.textContent = 'Application received. Applicants selected for the next stage will be contacted by email.'
      }
    } catch {
      status.textContent = 'Application could not be submitted. Please try again.'
    } finally {
      if (button) button.disabled = false
    }
  })
}
