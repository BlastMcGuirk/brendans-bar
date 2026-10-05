import type { ReactNode } from 'react'

function Brand({ eyebrow = 'EST. 2024' }: { eyebrow?: string }) {
  return (
    <a className="brand" href="/" aria-label="Brendan's Bar home">
      <span className="brand-mark" aria-hidden="true">B<span>·</span>B</span>
      <span className="brand-copy">
        <span className="brand-eyebrow">{eyebrow}</span>
        <span className="brand-name">BRENDAN’S BAR</span>
      </span>
    </a>
  )
}

function PageFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className={`page-shell ${className}`}>
      <header className="topbar">
        <Brand />
        <span className="topbar-note"><span className="live-dot" /> YOUR NEIGHBORHOOD BAR</span>
      </header>
      {children}
      <footer className="site-footer">
        <span>GOOD DRINKS. GOOD COMPANY.</span>
        <span>BRENDAN’S BAR <span className="footer-star">✳</span></span>
      </footer>
    </main>
  )
}

export default PageFrame
