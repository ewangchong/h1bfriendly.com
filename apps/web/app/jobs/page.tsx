import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'H1B Sponsorship Jobs',
  description: 'Browse jobs and signals related to H1B sponsorship.',
  alternates: { canonical: '/jobs' },
};

export default function JobsPage() {
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.02em' }}>Jobs</h1>
        <p style={{ margin: '10px auto 0', maxWidth: 820, color: '#555', lineHeight: 1.6 }}>
          We’re focusing on historical sponsorship signals for job seekers first. Role-level insights are available under{' '}
          <a href="/titles">Titles</a>, and company sponsor scorecards under <a href="/companies">Companies</a>.
        </p>
      </div>

      <div
        style={{
          margin: '18px auto 10px',
          padding: 14,
          borderRadius: 14,
          border: '1px solid #eee',
          background: '#fff',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
          maxWidth: 920,
          textAlign: 'center',
          color: '#666',
        }}
      >
        Job postings will return once we have enough live listings. For now, start here:
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a href="/titles" style={btnPrimary}>
            Explore Titles
          </a>
          <a href="/companies" style={btnSecondary}>
            Explore Companies
          </a>
          <a href="/blog" style={btnSecondary}>
            Read Blog
          </a>
        </div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#111',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
};
