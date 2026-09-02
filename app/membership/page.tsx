import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Membership' }

export default function MembershipPage() {
  return (
    <section className="text-page">
      <h1>Membership</h1>
      <div className="text-column">
        <p>
          Membership supports Applied State and provides access to member research material, complete research periods and selected programme applications.
        </p>
        <p>
          Membership does not guarantee selection for residencies, field programmes or other limited opportunities.
        </p>
        <p className="muted">Membership is currently by invitation or approval.</p>
        <p><Link href="/signin">Member sign in →</Link></p>
      </div>
    </section>
  )
}
