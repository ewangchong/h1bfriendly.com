import Link from 'next/link';
import type { Metadata } from 'next';
import { getAvailableYears, getCompanyBySlug, getCompanyInsightsBySlug } from '@/lib/h1bApi';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Company ${slug}`,
    alternates: { canonical: `/companies/${slug}` },
  };
}

export default async function CompanyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  let c;
  try {
    c = await getCompanyBySlug(slug);
  } catch (e: any) {
    return (
      <div>
        <h1 style={{ margin: 0 }}>Company</h1>
        <p style={{ color: '#b00' }}>Failed to load company.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{String(e?.message || e)}</pre>
      </div>
    );
  }

  const year = sp.year || String(c.last_h1b_filing_year || 2024);

  let insights;
  try {
    insights = await getCompanyInsightsBySlug(slug, year);
  } catch {
    insights = { top_titles: [], top_states: [], trend: [] };
  }

  const hasInsights =
    (insights.top_titles && insights.top_titles.length > 0) ||
    (insights.top_states && insights.top_states.length > 0) ||
    (insights.trend && insights.trend.length > 0);

  const filed = c.h1b_applications_filed ?? 0;
  const approved = c.h1b_applications_approved ?? 0;
  const rate = filed > 0 ? approved / filed : null;

  const hq = [c.headquarters_city, c.headquarters_state, c.headquarters_country].filter(Boolean).join(', ');

  const globalYears = (await getAvailableYears()).map(String);
  const companyYears = insights.trend?.length > 0 
    ? [...insights.trend].reverse().map((t: any) => String(t.year))
    : globalYears;

  return (
    <article>
      <div
        style={{
          border: '1px solid #eee',
          borderRadius: 16,
          padding: 16,
          background: '#fff',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {companyYears.map((y) => (
              <a
                key={y}
                href={`/companies/${slug}?year=${y}`}
                style={{
                  padding: '9px 10px',
                  borderRadius: 999,
                  border: '1px solid #eee',
                  background: y === year ? '#111' : '#fff',
                  color: y === year ? '#fff' : '#111',
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: '#EEF2FF',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                color: '#3730A3',
                flex: '0 0 auto',
              }}
            >
              {initials(c.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>{c.name}</h1>
              <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{hq || '—'}</div>
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 999,
              background: '#ECFDF3',
              color: '#027A48',
              border: '1px solid #D1FADF',
              flex: '0 0 auto',
            }}
          >
            Active sponsor
          </span>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <Stat label="Approval rate" value={rate === null ? '—' : `${(rate * 100).toFixed(1)}%`} />
          <Stat label="Filings (FY)" value={filed ? filed.toLocaleString() : '—'} />
          <Stat label="Approvals (FY)" value={approved ? approved.toLocaleString() : '—'} />
        </div>

        <div style={{ marginTop: 12, color: '#777', fontSize: 12, lineHeight: 1.5 }}>
          FY{year} view. Data source: DOL LCA disclosure (FY2020–FY2024) aggregated by employer name. Not legal advice.
        </div>
      </div>

      {!hasInsights ? (
        <div style={{ ...cardStyle, marginTop: 14, textAlign: 'center', color: '#666' }}>
          No filings found for FY{year}. Try{' '}
          <a href={`/companies/${slug}?year=${c.last_h1b_filing_year || 2023}`} style={{ fontWeight: 800 }}>
            FY{c.last_h1b_filing_year || 2023}
          </a>
          .
        </div>
      ) : null}

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 14 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Top titles (by filings)</div>
          {insights.top_titles.length ? (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {insights.top_titles.map((t) => (
                <li key={t.title} style={{ margin: '8px 0', color: '#444' }}>
                  <div style={{ fontWeight: 800, color: '#111' }}>
                    {t.title_slug ? (
                      <Link href={`/titles/${t.title_slug}?year=${year}`}>
                        {t.title}
                      </Link>
                    ) : (
                      t.title
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                    Filed/Approved: <b style={{ color: '#111' }}>{t.filings.toLocaleString()}</b> /{' '}
                    <b style={{ color: '#111' }}>{t.approvals.toLocaleString()}</b>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ color: '#666' }}>No data.</div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Top states (by filings)</div>
          {insights.top_states.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {insights.top_states.map((s: any) => (
                <li key={s.state} style={{ margin: '8px 0' }}>
                  <b>{s.state}</b> — {s.filings.toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#666' }}>No data.</div>
          )}

          <div style={{ fontWeight: 900, margin: '14px 0 10px' }}>Yearly trend</div>
          {insights.trend.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {insights.trend.map((t: any) => (
                <li key={t.year} style={{ margin: '6px 0' }}>
                  FY{t.year}: <b>{t.filings.toLocaleString()}</b> filings / <b>{t.approvals.toLocaleString()}</b> approvals
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#666' }}>No data.</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 420px) {
          .grid4 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        }
      `}</style>
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 16,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #F0F0F0', borderRadius: 12, padding: '10px 10px' }}>
      <div style={{ color: '#666', fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function initials(name: string) {
  const parts = name
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || 'H';
  const b = parts[1]?.[0] || parts[0]?.[1] || 'B';
  return (a + b).toUpperCase();
}
