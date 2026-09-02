import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Applied State',
    template: '%s — Applied State',
  },
  description: 'Applied State is an independent art and research institution.',
}

const nav = [
  ['AS01', '/as01'],
  ['AS02', '/as02'],
  ['AS03', '/as03'],
  ['Programmes', '/programmes'],
  ['Members', '/membership'],
]

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <Link className="wordmark" href="/" aria-label="Applied State home">
              APPLIED STATE
            </Link>
            <nav className="nav" aria-label="Primary navigation">
              {nav.map(([label, href]) => (
                <Link href={href} key={href}>
                  {label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <span>APPLIED STATE</span>
            <span>ART / RESEARCH</span>
          </footer>
        </div>
      </body>
    </html>
  )
}
