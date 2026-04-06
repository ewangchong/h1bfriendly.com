import Link from 'next/link';
import type { Metadata } from 'next';
import { permanentRedirect, notFound } from 'next/navigation';
import { STATES } from '@/lib/states';

type Summary = {
  totals?: { title: string; filings: number; approvals: number; last_year: number };
  top_companies?: Array<{ company_slug: string | null; company_name: string; filings: number; approvals: number }>;
  top_states?: Array<{ state: string; filings: number }>;
  top_cities?: Array<{ city: string; state: string; filings: number }>;
  trend?: Array<{ year: number; filings: number; approvals: number }>;
};

const API_REVALIDATE_SECONDS = 60 * 60;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const isSeoRoute = slug.endsWith('-h1b-sponsors');
  const realSlug = isSeoRoute ? slug.replace(/-h1b-sponsors$/, '') : slug;
  
  let titleName = realSlug.replace(/-/g, ' ').toUpperCase();
  let desc = `Discover the top H1B sponsors, average salaries, and visa approval rates for ${titleName} jobs.`;

  try {
    const s = await getSummary(realSlug, sp.year);
    if (s && s.totals) {
      titleName = s.totals.title;
      const filed = s.totals.filings?.toLocaleString() || 'multiple';
      desc = `Discover the top H1B sponsors and visa approval rates for ${titleName} jobs. Compare ${filed} recent LCA filings.`;
    }
  } catch (e) {
    // fallback to slug
  }

  return {
    title: `${titleName} H1B Salary & Top Employers | H1B Finder`,
    description: desc,
    alternates: { canonical: `/titles/${realSlug}-h1b-sponsors${sp.year ? `?year=${sp.year}` : ''}` },
  };
}

async function getSummary(slug: string, year?: string): Promise<Summary> {
  const base = process.env.H1B_API_BASE_URL || 'http://127.0.0.1:3000';
  const sp = new URLSearchParams();
  if (year) sp.set('year', year);
  const res = await fetch(`${base}/api/v1/titles/${slug}/summary?${sp.toString()}`, {
    next: { revalidate: API_REVALIDATE_SECONDS },
  });
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

  if (!slug.endsWith('-h1b-sponsors')) {
    const yearParam = sp.year ? `?year=${sp.year}` : '';
    permanentRedirect(`/titles/${slug}-h1b-sponsors${yearParam}`);
  }

  const realSlug = slug.replace(/-h1b-sponsors$/, '');

  const base = process.env.H1B_API_BASE_URL || 'http://127.0.0.1:3000';
  const yearsRes = await fetch(`${base}/api/v1/meta/years`, {
    next: { revalidate: API_REVALIDATE_SECONDS },
  });
  const yearsJson = yearsRes.ok ? await yearsRes.json() : { data: ['2025'] };
  const years = (yearsJson.data as number[]).map(String);

  const year = sp.year || years[0] || '2025';

  let s: Summary;
  try {
    s = await getSummary(realSlug, year);
  } catch (e: any) {
    if (e?.message === 'not_found' || String(e?.message).includes('404')) {
      notFound();
    }
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center' }}>
        <h1 style={{ color: '#0f172a', fontSize: 24, fontWeight: 800 }}>Job Summary</h1>
        <p style={{ color: '#ef4444', marginTop: 12 }}>Failed to load job summary.</p>
        <pre style={{ color: '#64748b', marginTop: 8, fontSize: 13, background: '#f8fafc', padding: 16, borderRadius: 12, display: 'inline-block' }}>
          {String(e?.message || e)}
        </pre>
      </div>
    );
  }

  const totals = s.totals ?? { title: realSlug.replace(/-/g, ' '), filings: 0, approvals: 0, last_year: Number(year) || 0 };
  const topCompanies = s.top_companies ?? [];
  const topStates = s.top_states ?? [];
  const trend = s.trend ?? [];

  const filed = totals.filings || 0;
  const approved = totals.approvals || 0;
  const rate = filed > 0 ? approved / filed : null;

  const titleYears = trend.length > 0
    ? [...trend].reverse().map(t => String(t.year))
    : years;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'H1B Job Titles',
        item: 'https://www.h1bfinder.com/titles'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: totals.title.toUpperCase(),
        item: `https://www.h1bfinder.com/titles/${realSlug}-h1b-sponsors`
      }
    ]
  };

  return (
    <article style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 64 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* 1. Page Header / Hero */}
      <div style={{ 
        textAlign: 'center', 
        padding: '64px 20px 48px',
        borderBottom: '1px solid #f1f5f9',
        marginBottom: 32
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: '#eff6ff',
            display: 'grid',
            placeItems: 'center',
            color: '#2563eb',
            border: '1px solid #bfdbfe',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
        </div>
        
        <h1 style={{ 
          margin: 0, 
          fontSize: 'clamp(32px, 5vw, 48px)', 
          letterSpacing: '-0.04em',
          fontWeight: 900,
          color: '#0f172a',
          lineHeight: 1.1
        }}>
          {totals.title.trim()} H1B Sponsorship & Salaries
        </h1>
        
        <div style={{ 
          marginTop: 16, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>Demand Signal Breakdown</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#f0f9ff',
            color: '#0369a1',
            border: '1px solid #bae6fd',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            H1B Eligible Role
          </span>
        </div>

        {/* Year Toggle */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            padding: '6px', 
            background: '#f8fafc', 
            borderRadius: 999,
            border: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {titleYears.map((y) => {
              const isActive = y === year;
              return (
                <Link
                  key={y}
                  href={`/titles/${realSlug}-h1b-sponsors?year=${y}`}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: isActive ? '#0f172a' : 'transparent',
                    color: isActive ? '#fff' : '#475569',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: 13,
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  FY{y}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        
        {/* Conversion CTA */}
        <div style={{ marginTop: 12, marginBottom: 32, padding: 32, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: 24, color: '#fff', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Search H1B Jobs for {totals.title.trim()}</h3>
            <p style={{ marginTop: 8, color: '#cbd5e1', fontSize: 15, maxWidth: 500 }}>
              Unlock full historical sponsorship data and salary benchmarks for {totals.title.trim()} roles with My Plan.
            </p>
          </div>
          <Link href="/plan" style={{ background: '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: 999, fontWeight: 700, textDecoration: 'none', fontSize: 15, transition: 'all 0.2s', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}>
            Start Free Search
          </Link>
        </div>

        {/* 2. Key Metrics Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: 16,
          marginBottom: 32
        }}>
          <BigStat label="Sponsorship Rate" value={rate === null ? '—' : `${(rate * 100).toFixed(1)}%`} subtext="Overall certification rate" />
          <BigStat label="Total Volume" value={filed.toLocaleString()} subtext="Applications filed" />
          <BigStat label="Certifications" value={approved.toLocaleString()} subtext="LCA outcomes" />
          <BigStat label="Data Recency" value={`FY${totals.last_year}`} subtext="Latest records available" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
          
          {/* Top Sponsors for this title */}
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Top Sponsors for this Role</h2>
            <div style={{ marginTop: 20 }}>
              {topCompanies.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topCompanies.slice(0, 10).map((c) => (
                    <div key={`${c.company_name}-${c.filings}`} style={{ 
                      padding: '16px', 
                      borderRadius: 16, 
                      border: '1px solid #f1f5f9',
                      background: '#f8fafc'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>
                          {c.company_name.trim()}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: 8 }}>
                          {c.filings.toLocaleString()} cases
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span>{c.approvals.toLocaleString()} approvals</span>
                         {c.company_slug && (
                           <Link href={`/companies/${c.company_slug}-h1b-sponsorship`} style={{ fontSize: 12, fontWeight: 700, textDecoration: 'none', color: '#4F46E5' }}>
                             Profile →
                           </Link>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8' }}>No specific sponsor data for this period.</div>
              )}
            </div>
          </div>

          {/* Geographic & Trend Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Geographic Demand</h2>
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {topStates.length ? (
                  topStates.map((x) => {
                    const st = STATES.find(s => s.code === x.state || s.name === x.state);
                    const isLinked = !!st;
                    const c = (
                      <div style={{ 
                        padding: '10px 16px', 
                        borderRadius: 12, 
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        fontWeight: 700,
                        fontSize: 14,
                        color: isLinked ? '#2563eb' : '#0f172a',
                        textDecoration: 'none'
                      }}>
                        {x.state} <span style={{ color: '#64748b', fontWeight: 500, marginLeft: 4 }}>({x.filings.toLocaleString()})</span>
                      </div>
                    );

                    if (isLinked) {
                      const stateSlug = st.name.toLowerCase().replace(/ /g, '-');
                      return (
                        <Link key={x.state} href={`/states/${stateSlug}-h1b-sponsors`} style={{ textDecoration: 'none' }}>
                          {c}
                        </Link>
                      );
                    }
                    return <div key={x.state}>{c}</div>;
                  })
                ) : (
                  <div style={{ color: '#94a3b8' }}>No geographic data.</div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Role Filing Trend</h2>
              <div style={{ marginTop: 20 }}>
                 {trend.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {trend.map((t) => (
                      <div key={t.year} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>FY{t.year}</div>
                        <div style={{ flex: 1, height: 8, background: '#f1f5f9', margin: '0 16px', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                           <div style={{ 
                             position: 'absolute', 
                             left: 0, 
                             top: 0, 
                             bottom: 0, 
                             width: `${Math.min(100, (t.filings / filed) * 100)}%`, 
                             background: '#2563eb',
                             borderRadius: 4
                           }} />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#475569', minWidth: 80, textAlign: 'right' }}>
                          {t.filings.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>No historical trend data.</div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div style={{ marginTop: 64, borderTop: '1px solid #f1f5f9', paddingTop: 24, textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, maxWidth: 800, margin: '0 auto' }}>
             Role-level data is aggregated based on job titles normalized from U.S. Department of Labor (DOL) disclosure files. Filing volume provides a signal of employer demand but does not represent legal eligibility or job guarantees.
          </p>
        </div>
      </div>

    </article>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 24,
  background: '#fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.02em'
};

function BigStat({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div style={{ 
      border: '1px solid #e2e8f0', 
      borderRadius: 20, 
      padding: '24px', 
      background: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontWeight: 900, marginTop: 12, fontSize: 26, color: '#0f172a', letterSpacing: '-0.04em' }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6, fontWeight: 500 }}>{subtext}</div>
    </div>
  );
}
