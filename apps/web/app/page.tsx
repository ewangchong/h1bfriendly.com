import Link from 'next/link';
import type { Metadata } from 'next';
import HomeChatLauncher from './HomeChatLauncher';

export const metadata: Metadata = {
  title: 'H1B Finder: The AI Data Source for Your Career',
  description:
    'Grounded in 4M+ records from DOL FY2025. Bring verified H1B insights directly into your OpenClaw workspace.',
  keywords: ['h1b', 'h1b sponsor', 'h1b database', 'h1b jobs', 'h1b visa', 'openclaw', 'ai agent'],
  alternates: { canonical: '/' },
};

const cards = [
  {
    title: 'Top Sponsors',
    desc: 'See which employers file and approve the most H1B cases.',
    href: '/companies',
    low: false,
  },
  {
    title: 'Top Jobs',
    desc: 'Explore role-level demand and sponsorship signals by title.',
    href: '/titles',
    low: false,
  },
  {
    title: 'My Plan',
    desc: 'Generate a personalized H1B action plan based on your target role.',
    href: '/plan',
    low: true,
  },
  {
    title: 'AI Chat',
    desc: 'Ask natural-language questions and get fast, data-backed answers.',
    href: '/chat',
    low: false,
  },
  {
    title: 'Blog',
    desc: 'Read practical guides to use H1B data for smarter job decisions.',
    href: '/blog',
    low: false,
  },
] as const;

export default function HomePage() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px 52px' }}>
      <HomeChatLauncher />

      <section style={{ textAlign: 'center', padding: '32px 0 22px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(34px, 6vw, 62px)',
            letterSpacing: '-0.05em',
            fontWeight: 900,
            lineHeight: 1.05,
            background: 'linear-gradient(135deg, #0f172a 10%, #4f46e5 62%, #0ea5e9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          H1B Finder
        </h1>
        <p
          style={{
            margin: '14px auto 0',
            maxWidth: 760,
            color: '#52525b',
            lineHeight: 1.6,
            fontSize: 'clamp(17px, 2.4vw, 22px)',
            fontWeight: 500,
          }}
        >
          The AI data source for global H1B applicants. Powered by 4M+ public DOL records.
          Find signal, not noise.
        </p>

        <div
          style={{
            marginTop: 28,
            background: '#09090b',
            borderRadius: 20,
            padding: 20,
            textAlign: 'left',
            display: 'inline-block',
            width: '100%',
            maxWidth: 680,
            border: '1px solid #27272a',
          }}
        >
          <div style={{ color: '#a1a1aa', marginBottom: 6, fontFamily: 'monospace', fontSize: 13 }}>
            # Install skill in OpenClaw
          </div>
          <div style={{ color: '#818cf8', fontWeight: 800, fontFamily: 'monospace' }}>
            npx clawhub install h1b-finder
          </div>
          <div style={{ marginTop: 12, color: '#d4d4d8', fontStyle: 'italic', fontSize: 14 }}>
            "Which companies in Virginia sponsor Data Scientists over $150k?"
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 26,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{
              textDecoration: 'none',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: '18px 16px',
              background: c.low ? '#fafafa' : '#ffffff',
              opacity: c.low ? 0.85 : 1,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 17 }}>{c.title}</div>
            <div style={{ marginTop: 8, color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>{c.desc}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
