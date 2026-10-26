import { getBrowserSupabaseClient } from '../lib/supabase'
import { ownStaffRoles } from '../lib/states'
import type { BrowserSupabaseClient } from '../lib/supabase'
import type { MembershipApplicationRow } from '../lib/types'

function appendText(parent: HTMLElement, tag: 'p' | 'h3' | 'span', text: string, className?: string): HTMLElement {
  const el = document.createElement(tag)
  el.textContent = text
  if (className) el.className = className
  parent.append(el)
  return el
}

function safePortfolio(raw: string | null): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch {
    return null
  }
}

function entry(app: MembershipApplicationRow, client: BrowserSupabaseClient, reload: () => Promise<void>): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'review-entry'
  appendText(item, 'h3', app.full_name, 'review-entry__title')
  appendText(item, 'p', app.email, 'states-status')
  appendText(item, 'p', app.practice, 'state-list-entry__description')
  if (app.location) appendText(item, 'p', app.location, 'states-status')
  if (app.statement) appendText(item, 'p', app.statement, 'state-list-entry__description')
  const link = safePortfolio(app.portfolio_url)
  if (link) {
    const p = document.createElement('p')
    p.className = 'states-status'
    const a = document.createElement('a')
    a.href = link
    a.textContent = 'WORK'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    p.append(a)
    item.append(p)
  }
  appendText(item, 'p', `${app.status.toUpperCase()} / ${new Date(app.created_at).toLocaleDateString()}`, 'states-status')
  const noteLabel = document.createElement('label')
  noteLabel.className = 'states-field-label'
  noteLabel.textContent = 'REVIEW NOTE (OPTIONAL)'
  const note = document.createElement('textarea')
  note.maxLength = 2000
  note.setAttribute('aria-label', 'Internal review note for ' + app.full_name)
  note.style.cssText = 'display:block;width:min(100%,540px);margin:20px 0 0;padding:8px 0;border:0;border-bottom:1px solid currentColor;border-radius:0;background:transparent;color:inherit;font:inherit;'
  item.append(noteLabel, note)
  const actions = document.createElement('div')
  actions.className = 'review-entry__actions'
  const feedback = appendText(item, 'p', '', 'states-status')
  feedback.setAttribute('role', 'status')
  for (const [decision, label] of [['accepted', 'ACCEPT'], ['waitlisted', 'WAITLIST'], ['declined', 'DECLINE']] as const) {
    if (app.status === 'waitlisted' && decision === 'waitlisted') continue
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'text-action'
    button.textContent = label
    button.addEventListener('click', async () => {
      const buttons = actions.querySelectorAll<HTMLButtonElement>('button')
      buttons.forEach((el) => el.disabled = true)
      feedback.textContent = 'Saving…'
      try {
        const { error } = await client.rpc('review_membership_application', {
          target_application_id: app.id,
          decision,
          reviewer_note: note.value || null,
        })
        if (error) throw error
        await reload()
      } catch {
        feedback.textContent = 'Decision could not be saved.'
        buttons.forEach((el) => el.disabled = false)
      }
    })
    actions.append(button)
  }
  item.append(actions)
  return item
}

export async function initAdmissionReview(): Promise<void> {
  const host = document.querySelector<HTMLElement>('[data-admission-review]')
  const access = host?.querySelector<HTMLElement>('[data-admission-access]')
  const workspace = host?.querySelector<HTMLElement>('[data-admission-workspace]')
  const list = host?.querySelector<HTMLOListElement>('[data-admission-list]')
  const empty = host?.querySelector<HTMLElement>('[data-admission-empty]')
  if (!access || !workspace || !list || !empty) return
  const client = getBrowserSupabaseClient()
  if (!client) {
    access.textContent = 'Admission review is unavailable.'
    return
  }

  try {
    const { data: { session } } = await client.auth.getSession()
    if (!session) {
      access.textContent = 'Sign in to review applications.'
      return
    }
    const roles = await ownStaffRoles(client, session.user.id)
    if (!roles.length) {
      access.textContent = 'Staff access required.'
      return
    }
    access.hidden = true
    workspace.hidden = false
    const reload = async (): Promise<void> => {
      const { data, error } = await client
        .from('membership_applications')
        .select('*')
        .in('status', ['submitted', 'waitlisted'])
        .order('created_at', { ascending: true })
      if (error) throw error
      list.replaceChildren()
      const applications = (data ?? []) as MembershipApplicationRow[]
      empty.hidden = applications.length > 0
      for (const app of applications) list.append(entry(app, client, reload))
    }
    await reload()
  } catch {
    access.hidden = false
    access.textContent = 'Admission review could not be loaded.'
    workspace.hidden = true
  }
}
