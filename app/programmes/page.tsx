import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Programmes' }

export default function ProgrammesPage() {
  return (
    <section className="text-page">
      <h1>Programmes</h1>
      <div className="text-column">
        <p>
          Applied State develops temporary residencies, field programmes, research trips and site-specific projects.
        </p>
        <p>
          Selected programmes are application-based. Participation is limited and selection is based on the person, practice and context of each programme.
        </p>
        <p className="muted">No open programmes at present.</p>
      </div>
    </section>
  )
}
