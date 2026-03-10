import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import Script from 'next/script';
import Link from 'next/link';
import TranslateToggle from './TranslateToggle';

const navLink: React.CSSProperties = {
  textDecoration: 'none',
  color: '#111',
  fontSize: 14,
  fontWeight: 600,
};

const navItems = [
  { href: '/companies', label: 'Top Sponsors', lowPriority: false },
  { href: '/titles', label: 'Top Jobs', lowPriority: false },
  { href: '/plan', label: 'My Plan', lowPriority: true },
  { href: '/chat', label: 'AI Chat', lowPriority: false },
  { href: '/blog', label: 'Blog', lowPriority: false },
] as const;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://h1bfinder.com'),
  title: {
    default: 'H1B Finder | Verified H1B Sponsors & Salaries',
    template: '%s | H1B Finder',
  },
  description:
    'Search 4M+ official H1B sponsorship records. Find H1B-friendly companies and salary data verified by H1B Finder.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'H1B Finder',
    description:
      'Search 4M+ official H1B sponsorship records. Find H1B-friendly companies and salary data verified by H1B Finder.',
    type: 'website',
    url: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Google tag (gtag.js) — hard coded */}
        <>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-L4D6N4ZFKW"
            strategy="afterInteractive"
          />
          <Script id="ga-gtag" strategy="afterInteractive">
            {`
      window.dataLayer = window.dataLayer || [];
      function gtag(){window.dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-L4D6N4ZFKW');
    `}
          </Script>
        </>

        <header className="header">

          <div className="header-inner">
            <Link href="/" style={{ fontWeight: 800, textDecoration: 'none', color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#4F46E5', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>H1</span>
              <span>H1B Finder</span>
            </Link>

            <nav className="nav-desktop">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...navLink,
                    opacity: item.lowPriority ? 0.72 : 1,
                    fontWeight: item.lowPriority ? 500 : 700,
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TranslateToggle />
              <div className="nav-mobile">
                <Link href="/blog" style={navLink}>
                  Blog
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="container">{children}</main>

        <footer style={{ marginTop: 24, borderTop: '1px solid #eee', background: '#0B1220', color: '#C9D1D9' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontWeight: 800, color: '#fff' }}>H1B Finder</div>
                <div style={{ marginTop: 6, color: '#9CA3AF' }}>
                  Find H1B sponsorship jobs and opportunities with companies that have a track record of sponsoring international talent.
                </div>
              </div>
              <div style={{ color: '#9CA3AF', flex: 1, minWidth: 300 }}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>Disclaimer</div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <p style={{ margin: '0 0 6px 0' }}>Data is sourced from the public disclosure files of the United States Department of Labor (DOL). This website is not affiliated with, endorsed by, or sponsored by the U.S. Government or the Department of Labor.</p>
                  <p style={{ margin: '0 0 6px 0' }}>All information is provided "as is" for informational purposes only. We make no representations or warranties regarding the accuracy or completeness of the data.</p>
                  <p style={{ margin: '0 0 6px 0' }}>An LCA filing does not represent an actual job opening or guarantee visa approval.</p>
                  <p style={{ margin: 0 }}>
                    This website is built with AI assistance. Found an issue or have suggestions? Please open an issue on GitHub:{' '}
                    <a href="https://github.com/ewangchong/h1bfinder.com" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>
                      github.com/ewangchong/h1bfinder.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, color: '#6B7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>© {new Date().getFullYear()} H1B Finder</div>
              <div>Contact: <a href="mailto:contact@h1bfinder.com" style={{ color: '#6B7280', textDecoration: 'underline' }}>contact@h1bfinder.com</a></div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
