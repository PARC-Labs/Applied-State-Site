import type { Metadata } from 'next'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Member sign in' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const configured = isSupabaseConfigured()
  const sent = params.sent === '1'
  const error = typeof params.error === 'string' ? params.error : null

  return (
    <section className="text-page">
      <h1>Members</h1>
      <div className="text-column">
        <p>Enter the email address attached to your Applied State membership.</p>

        {configured ? (
          <form className="form" action="/api/auth/magic-link" method="post">
            <div className="form-row">
              <input
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Email"
                aria-label="Email address"
                required
              />
              <button className="button" type="submit">Send sign-in link</button>
            </div>
          </form>
        ) : (
          <p className="message">Member authentication is awaiting backend configuration.</p>
        )}

        {sent && <p className="message">If that address is an active member account, a sign-in link has been sent.</p>}
        {error && <p className="message error">Sign-in could not be completed. Request a new link.</p>}
      </div>
    </section>
  )
}
