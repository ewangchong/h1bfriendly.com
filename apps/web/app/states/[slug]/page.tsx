import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getRankings, getRankingsSummary, getAvailableYears } from '@/lib/h1bApi';
import { STATES, getStateBySlug } from '@/lib/states';

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ year?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const state = getStateBySlug(slug);

  if (!state) return { title: 'Not Found' };

  const title = `Top H1B Sponsors in ${state.name} | H1B Finder`;
  const desc = `Discover the top H1B visa sponsoring companies in ${state.name}. View recent filing volumes, approval rates, and average salaries.`;

  return {
    title,
    description: desc,
    alternates: { canonical: `/states/${state.name.toLowerCase().replace(/ /g, '-')}-h1b-sponsors${sp.year ? `?year=${sp.year}` : ''}` },
  };
}

export default async function StateLandingPage({
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
    const nameSlug = slug.replace(/-h1b-sponsors$/, '');
    permanentRedirect(`/states/${nameSlug}-h1b-sponsors${yearParam}`);
  }

  const state = getStateBySlug(slug);
  if (!state) notFound();

  const years = await getAvailableYears();
  const year = sp.year || String(years[0] || 2024);

  const rankings = await getRankings({ state: state.code, year, limit: 20 });
  const summary = await getRankingsSummary({ state: state.code });

  const totalFilings = summary?.totals?.total_filings || 0;
  const totalApprovals = summary?.totals?.total_approvals || 0;
  const avgSalary = summary?.totals?.avg_salary || 0;
  const rate = totalFilings > 0 ? (totalApprovals / totalFilings) * 100 : 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'US States H1B Data',
        item: 'https://www.h1bfinder.com/'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: state.name,
        item: `https://www.h1bfinder.com/states/${slug}`
      }
    ]
  };

  return (
    <article style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 64 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ 
        textAlign: 'center', 
        padding: '64px 20px 48px',
        borderBottom: '1px solid #f1f5f9',
        marginBottom: 32
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: 'clamp(32px, 5vw, 48px)', 
          letterSpacing: '-0.04em',
          fontWeight: 900,
          color: '#0f172a',
          lineHeight: 1.1
        }}>
          H1B Sponsors in {state.name}
        </h1>
        <p style={{ marginTop: 16, color: '#64748b', fontSize: 18, fontWeight: 500 }}>
          Comprehensive list of companies sponsoring H1B visas in {state.name}.
        </p>

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
            {years.map((y) => {
              const isActive = String(y) === year;
              return (
                <Link
                  key={y}
                  href={`/states/${slug}?year=${y}`}
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
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Search H1B Companies in {state.name}</h3>
            <p style={{ marginTop: 8, color: '#cbd5e1', fontSize: 15, maxWidth: 500 }}>
              Unlock full access to {state.name} sponsor history and salary benchmarks with H1B Finder My Plan.
            </p>
          </div>
          <Link href="/plan" style={{ background: '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: 999, fontWeight: 700, textDecoration: 'none', fontSize: 15, transition: 'all 0.2s', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}>
            Start Free Search
          </Link>
        </div>

        {/* Key Metrics Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: 16,
          marginBottom: 32
        }}>
          <BigStat label="Total H1B Filings" value={totalFilings.toLocaleString()} subtext="Recent LCA volume" />
          <BigStat label="Average Salary" value={`$${Math.round(Number(avgSalary)).toLocaleString()}`} subtext="Prevailing wage signal" />
          <BigStat label="Approval Rate" value={`${rate.toFixed(1)}%`} subtext="Certification benchmark" />
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Top {state.name} H1B Sponsors</h2>
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {rankings.map((r, i) => (
                <div key={r.company_name} style={{ 
                  padding: '20px', 
                  borderRadius: 16, 
                  border: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#4F46E5', background: '#EEF2FF', padding: '4px 8px', borderRadius: 8 }}>
                      #{i + 1}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                      {r.approvals.toLocaleString()} Ceritified
                    </div>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    {r.company_name}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>
                      ${Math.round(Number(r.avg_salary)).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>avg</span>
                    </div>
                    {r.company_slug && (
                      <Link href={`/companies/${r.company_slug}-h1b-sponsorship`} style={{ fontSize: 13, fontWeight: 700, textDecoration: 'none', color: '#4F46E5' }}>
                        Details →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* State Trend */}
        <div style={{ ...cardStyle, marginTop: 24 }}>
          <h2 style={cardTitleStyle}>{state.name} Sponsorship Trend</h2>
          <div style={{ marginTop: 24 }}>
             {summary?.trend && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {summary.trend.map((t) => (
                  <div key={t.year} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', width: 60 }}>FY{t.year}</div>
                    <div style={{ flex: 1, height: 10, background: '#f1f5f9', margin: '0 20px', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                       <div style={{ 
                         position: 'absolute', 
                         left: 0, 
                         top: 0, 
                         bottom: 0, 
                         width: `${(t.filings / totalFilings) * 100}%`, 
                         background: 'linear-gradient(to right, #4f46e5, #3b82f6)',
                         borderRadius: 5
                       }} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#444', minWidth: 100, textAlign: 'right' }}>
                      {t.filings.toLocaleString()} <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>cases</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function BigStat({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: '24px', background: '#fff' }}>
      <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontWeight: 900, marginTop: 12, fontSize: 28, color: '#0f172a', letterSpacing: '-0.04em' }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, fontWeight: 500 }}>{subtext}</div>
    </div>
  );
}

const cardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 32,
  background: '#fff',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
};

const cardTitleStyle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.02em'
};
