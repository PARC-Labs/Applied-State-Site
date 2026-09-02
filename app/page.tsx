import Link from 'next/link'

const issues = [
  { number: 'AS01', title: 'ARENA', href: '/as01', status: 'CURRENT' },
  { number: 'AS02', title: '—', href: '/as02', status: 'FORTHCOMING' },
  { number: 'AS03', title: '—', href: '/as03', status: 'FORTHCOMING' },
]

export default function Home() {
  return (
    <section className="home">
      <p className="home-intro">
        Applied State is an independent art and research institution. Work is organised as numbered research periods.
      </p>

      <div className="issue-index" aria-label="Applied State research periods">
        {issues.map((issue) => (
          <Link className="issue-row" href={issue.href} key={issue.number}>
            <span className="issue-number">{issue.number}</span>
            <span>{issue.title}</span>
            <span className="issue-status">{issue.status}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
