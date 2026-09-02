import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Members' }
export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  if (!isSupabaseConfigured()) {
    redirect('/signin?error=not-configured')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (error || !claims?.sub) {
    redirect('/signin')
  }

  const { data: userData } = await supabase.auth.getUser()

  return (
    <section className="page">
      <header className="page-head">
        <div className="kicker">MEMBERS</div>
        <h1 className="page-title">INDEX</h1>
        <div className="page-meta">Authenticated Applied State research access.</div>
      </header>

      <div className="member-grid">
        <div className="member-panel">
          <h2>AS01 — ARENA</h2>
          <p>Research index and member material will appear here as AS01 develops.</p>
          <p className="muted">Current research period.</p>
        </div>
        <div className="member-panel">
          <h2>Account</h2>
          <p>{userData.user?.email ?? 'Active member'}</p>
          <form action="/api/auth/signout" method="post">
            <button className="button secondary" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </section>
  )
}
