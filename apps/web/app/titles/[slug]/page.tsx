import Link from 'next/link';
import type { Metadata } from 'next';

type Summary = {
  totals: { title: string; filings: number; approvals: number; last_year: number };
  top_companies: Array<{ company_slug: string | null; company_name: string; filings: number; approvals: number }>;
  top_states: Array<{ state: string; filings: number }>;
  top_cities: Array<{ city: string; state: string; filings: number }>;
  trend: Array<{ year: number; filings: number; approvals: number }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  return {
    title: `${slug.replace(/-/g, ' ')} (H1B Signals)`,
    alternates: { canonical: `/titles/${slug}${sp.year ? `?year=${sp.year}` : ''}` },
  };
}

async function getSummary(slug: string, year?: string): Promise<Summary> {
  const base = process.env.H1B_API_BASE_URL || 'http://127.0.0.1:3000';
  const sp = new URLSearchParams();
  if (year) sp.set('year', year);
  const res = await fetch(`${base}/api/v1/titles/${slug}/summary?${sp.toString()}`, { cache: 'no-store' });
  if (res.status === 404) throw new Error('not_found');
  if (!res.ok) throw new Error(`Failed to load summary (${res.status})`);
  const json = await res.json();
  return json.data as Summary;
}

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const base = process.env.H1B_API_BASE_URL || 'http://127.0.0.1:3000';
  const yearsRes = await fetch(`${base}/api/v1/meta/years`, { cache: 'no-store' });
  const yearsJson = yearsRes.ok ? await yearsRes.json() : { data: ['2024'] };
  const years = (yearsJson.data as number[]).map(String);

  const year = sp.year || years[0] || '2024';

  let s: Summary;
  try {
    s = await getSummary(slug, year);
  } catch (e: any) {
    return (
      <div>
        <h1 style={{ margin: 0 }}>Role</h1>
        <p style={{ color: '#b00' }}>Failed to load role summary.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{String(e?.message || e)}</pre>
      </div>
    );
  }

  const filed = s.totals.filings || 0;
  const approved = s.totals.approvals || 0;
  const rate = filed > 0 ? approved / filed : null;

  const titleYears = s.trend?.length > 0
    ? [...s.trend].reverse().map(t => String(t.year))
    : years;

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.02em' }}>{s.totals.title.trim()}</h1>
        <p style={{ margin: '10px auto 0', maxWidth: 820, color: '#555', lineHeight: 1.6 }}>
          Role-level H1B sponsorship signals derived from public DOL LCA disclosure data. Not job postings.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            margin: '18px 0 10px',
            padding: 12,
            borderRadius: 14,
            border: '1px solid #eee',
            background: '#fff',
            boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
            maxWidth: 920,
            width: '100%',
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#666', fontSize: 14 }}>Year</span>
          {titleYears.map((y) => (
            <Link
              key={y}
              href={`/titles/${slug}?year=${y}`}
              style={{
                padding: '8px 10px',
                borderRadius: 999,
                border: '1px solid #eee',
                background: y === year ? '#111' : '#fff',

                color: y === year ? '#fff' : '#111',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }} className="grid4">
        <Stat label="Approval rate" value={rate === null ? '—' : `${(rate * 100).toFixed(1)}%`} />
        <Stat label="Total filings" value={filed.toLocaleString()} />
        <Stat label="Total approvals" value={approved.toLocaleString()} />
        <Stat label="Last FY" value={String(s.totals.last_year)} />
      </div>

      <Section title="Top sponsors for this role">
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {s.top_companies.slice(0, 10).map((c) => (
            <div key={`${c.company_name}-${c.filings}`} style={cardStyle}>
              <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{c.company_name.trim()}</div>
              <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
                Filed/Approved: <b style={{ color: '#111' }}>{c.filings.toLocaleString()}</b> /{' '}
                <b style={{ color: '#111' }}>{c.approvals.toLocaleString()}</b>
              </div>
              {c.company_slug ? (
                <Link href={`/companies/${c.company_slug}`} style={{ marginTop: 10, display: 'inline-block', fontSize: 13 }}>
                  View company →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        <Section title="Top states">
          <div style={cardStyle}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.top_states.map((x) => (
                <li key={x.state} style={{ margin: '6px 0' }}>
                  <b>{x.state}</b> — {x.filings.toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Trend (FY2020–FY2024)">
          <div style={cardStyle}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.trend.map((t) => (
                <li key={t.year} style={{ margin: '6px 0' }}>
                  FY{t.year}: <b>{t.filings.toLocaleString()}</b> filings / <b>{t.approvals.toLocaleString()}</b> approvals
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </div>

      <div style={{ marginTop: 18, color: '#777', fontSize: 12, lineHeight: 1.5 }}>
        Data source: DOL LCA disclosure (FY2020–FY2024). Aggregated by normalized job title. Not legal advice.
      </div>

      <style>{`
        @media (max-width: 980px) {
          .grid2 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
          .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .grid4 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 14, padding: 14, background: '#fff', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
      <div style={{ color: '#666', fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 900, marginTop: 6, fontSize: 18 }}>{value}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 14,
  padding: 14,
  background: '#fff',
  boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
};
