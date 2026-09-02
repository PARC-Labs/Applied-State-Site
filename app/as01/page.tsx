import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'AS01 — ARENA' }

const contributions = [
  ['01', 'ARENA', 'Applied State project', 'Public'],
  ['02', 'The constructed arena', 'Commissioned investigation', 'Public'],
  ['03', 'Artificial arenas', 'Research contribution', 'Members'],
  ['04', 'Natural arenas', 'Field / science contribution', 'Members'],
  ['05', 'Commission 01', 'Artist commission', 'Members'],
]

export default function ArenaPage() {
  return (
    <article className="page">
      <header className="page-head">
        <div className="kicker">AS01</div>
        <h1 className="page-title">ARENA</h1>
        <div className="page-meta">
          Research period 01. A bounded environment in which participants, constraints and outcomes become legible.
        </div>
      </header>

      <div className="section-label">
        <span>01</span>
        <span>Contributions</span>
      </div>

      <div className="contribution-list">
        {contributions.map(([number, title, type, access]) => (
          <div className="contribution" key={number}>
            <span>{number}</span>
            <span className="contribution-title">{title}</span>
            <span className="contribution-type">{type}</span>
            <span className="contribution-access">{access}</span>
          </div>
        ))}
      </div>
    </article>
  )
}
