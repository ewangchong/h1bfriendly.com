import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Data-backed guides and analysis for H1B job seekers and sponsors.',
  alternates: { canonical: '/blog' },
};

const featuredTopics = [
  {
    title: 'Company Deep Dives',
    description: 'Break down whether a sponsor is truly dependable, not just noisy.',
    href: '/companies',
    accent: '#DBEAFE',
    tone: '#1D4ED8',
  },
  {
    title: 'Role Playbooks',
    description: 'Understand which titles are still attracting sustained H1B demand.',
    href: '/titles',
    accent: '#DCFCE7',
    tone: '#15803D',
  },
  {
    title: 'Search Strategy',
    description: 'Use public filing data to aim at sponsors with real historical intent.',
    href: '/',
    accent: '#FEF3C7',
    tone: '#B45309',
  },
] as const;

const posts = [
  {
    slug: '#',
    title: 'How to read H1B sponsor data without fooling yourself',
    description: 'Use filing counts, approval rates, and title-level trends without over-reading one noisy year.',
    status: 'Coming soon',
    category: 'Primer',
  },
  {
    slug: '#',
    title: 'Best H1B sponsors for software engineers',
    description: 'A ranked, data-backed look at which companies consistently sponsor software engineering roles.',
    status: 'Coming soon',
    category: 'Role Guide',
  },
  {
    slug: '#',
    title: 'Which states still have the strongest H1B demand',
    description: 'A state-by-state breakdown of sponsor concentration and role demand.',
    status: 'Coming soon',
    category: 'Market Map',
  },
  {
    slug: '#',
    title: 'How to tell whether a company files broadly or only for niche roles',
    description: 'A practical framework for separating broad-based sponsors from one-off outliers.',
    status: 'Queued',
    category: 'Company Guide',
  },
] as const;

export default function BlogPage() {
  return (
    <div>
      <section
        style={{
          padding: '20px 0 10px',
          display: 'grid',
          gap: 18,
        }}
      >
        <div
          style={{
            borderRadius: 24,
            padding: '28px 24px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #38BDF8 100%)',
            color: '#F8FAFC',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Blog
          </div>
          <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            H1B content that helps you search with data, not guesswork.
          </h1>
          <p style={{ margin: '14px 0 0', maxWidth: 760, color: 'rgba(248,250,252,0.85)', lineHeight: 1.7, fontSize: 16 }}>
            This section is where company deep dives, sponsor playbooks, and search strategy pieces will live. The goal is simple:
            make the product easier to understand, and make H1B job search decisions less fuzzy.
          </p>
          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/companies" style={primaryLink}>
              Explore Companies
            </Link>
            <Link href="/titles" style={secondaryLink}>
              Explore Titles
            </Link>
          </div>
        </div>

        <div className="blog-topics" style={{ display: 'grid', gap: 14 }}>
          {featuredTopics.map((topic) => (
            <Link
              key={topic.title}
              href={topic.href}
              style={{
                padding: 18,
                borderRadius: 18,
                textDecoration: 'none',
                background: '#fff',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: topic.accent,
                  color: topic.tone,
                  fontWeight: 900,
                }}
              >
                {topic.title[0]}
              </div>
              <div style={{ marginTop: 12, fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>{topic.title}</div>
              <p style={{ margin: '8px 0 0', color: '#5B6470', lineHeight: 1.6 }}>{topic.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280' }}>
              Planned Posts
            </div>
            <h2 style={{ margin: '8px 0 0', fontSize: 28, letterSpacing: '-0.03em' }}>What this section will publish first</h2>
          </div>
          <div style={{ color: '#6B7280', fontSize: 14, maxWidth: 420 }}>
            The first articles are focused on search intent: sponsor quality, role-level demand, and how to interpret H1B data without false confidence.
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {posts.map((post) => (
          <article
            key={post.title}
            style={{
              padding: 18,
              borderRadius: 18,
              border: '1px solid #E5E7EB',
              background: '#fff',
              boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: '#F3F4F6',
                      color: '#374151',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {post.category}
                  </span>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: '#EEF2FF',
                      color: '#3730A3',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {post.status}
                  </span>
                </div>
                <h2 style={{ margin: '12px 0 0', fontSize: 22, letterSpacing: '-0.02em' }}>{post.title}</h2>
              </div>
              <div style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 700 }}>Queued</div>
            </div>
            <p style={{ margin: '10px 0 0', color: '#5B6470', lineHeight: 1.7 }}>{post.description}</p>
          </article>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 18,
          borderRadius: 18,
          background: '#fff',
          border: '1px dashed #CBD5E1',
          color: '#556070',
          lineHeight: 1.7,
        }}
      >
        Until the first articles go live, the best real-time data entry points are{' '}
        <Link href="/" style={{ textDecoration: 'underline' }}>Rankings</Link>,{' '}
        <Link href="/companies" style={{ textDecoration: 'underline' }}>Companies</Link>, and{' '}
        <Link href="/titles" style={{ textDecoration: 'underline' }}>Titles</Link>.
      </div>

      <style>{`
        .blog-topics {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        @media (max-width: 860px) {
          .blog-topics {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

const primaryLink: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  background: '#F8FAFC',
  color: '#0F172A',
  textDecoration: 'none',
  fontWeight: 800,
};

const secondaryLink: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(248,250,252,0.28)',
  color: '#F8FAFC',
  textDecoration: 'none',
  fontWeight: 800,
};
