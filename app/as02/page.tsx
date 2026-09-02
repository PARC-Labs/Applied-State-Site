import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'AS02' }

export default function AS02Page() {
  return (
    <article className="page">
      <header className="page-head">
        <div className="kicker">AS02</div>
        <h1 className="page-title">—</h1>
        <div className="page-meta">Forthcoming.</div>
      </header>
    </article>
  )
}
