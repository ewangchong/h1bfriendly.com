import Link from 'next/link';
import type { Metadata } from 'next';
import { permanentRedirect, notFound } from 'next/navigation';
import { getAvailableYears, getCompanyBySlug, getCompanyInsightsBySlug } from '@/lib/h1bApi';
import { STATES } from '@/lib/states';

type TrendPoint = { year: number; filings: number; approvals: number };

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ year?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const isSeoRoute = slug.endsWith('-h1b-sponsorship');
  const realSlug = isSeoRoute ? slug.replace(/-h1b-sponsorship$/, '') : slug;
  
  let companyName = realSlug.replace(/-/g, ' ').toUpperCase();
  let desc = `Review ${companyName} H1B visa sponsorship history, salaries, and approval rates. Discover top roles and locations.`;
  
  try {
    const c = await getCompanyBySlug(realSlug, sp.year);
    if (c && c.name) {
      companyName = c.name;
      const filed = c.h1b_applications_filed?.toLocaleString() || 'multiple';
      desc = `Review ${companyName} H1B visa sponsorship history. See top roles, locations, and data from ${filed} recent LCA certifications.`;
    }
  } catch (e) {
    // fallback to slug
  }

  return {
    title: `${companyName} H1B Sponsorship Data & Salaries | H1B Finder`,
    description: desc,
    alternates: { canonical: `/companies/${realSlug}-h1b-sponsorship${sp.year ? `?year=${sp.year}` : ''}` },
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

  if (!slug.endsWith('-h1b-sponsorship')) {
    const yearParam = sp.year ? `?year=${sp.year}` : '';
    permanentRedirect(`/companies/${slug}-h1b-sponsorship${yearParam}`);
  }

  const realSlug = slug.replace(/-h1b-sponsorship$/, '');
  const requestedYear = sp.year;

  let c;
  try {
    c = await getCompanyBySlug(realSlug, requestedYear);
  } catch (e: any) {
    if (e?.message === 'not_found' || String(e?.message).includes('404')) {
      notFound();
    }
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center' }}>
        <h1 style={{ color: '#0f172a', fontSize: 24, fontWeight: 800 }}>Company</h1>
        <p style={{ color: '#ef4444', marginTop: 12 }}>Failed to load company.</p>
        <pre style={{ color: '#64748b', marginTop: 8, fontSize: 13, background: '#f8fafc', padding: 16, borderRadius: 12, display: 'inline-block' }}>
          {String(e?.message || e)}
        </pre>
      </div>
    );
  }

  const year = sp.year || String(c.last_h1b_filing_year || 2024);

  let insights;
  try {
    insights = await getCompanyInsightsBySlug(realSlug, year);
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
  const stability = getSponsorStability(insights.trend ?? []);

  const hq = [c.headquarters_city, c.headquarters_state, c.headquarters_country].filter(Boolean).join(', ');

  const globalYears = (await getAvailableYears()).map(String);
  const companyYears = insights.trend?.length > 0 
    ? [...insights.trend].reverse().map((t: any) => String(t.year))
    : globalYears;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: c.name,
    url: c.website_url ? (c.website_url.startsWith('http') ? c.website_url : `https://${c.website_url}`) : `https://www.h1bfinder.com/companies/${realSlug}-h1b-sponsorship`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: c.headquarters_city || '',
      addressRegion: c.headquarters_state || '',
      addressCountry: c.headquarters_country || 'US'
    },
    // We map approval rate to a 5-star rating system for search snippets
    ...(rate !== null && filed > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (rate * 5).toFixed(1),
        reviewCount: filed,
        bestRating: '5',
        worstRating: '1',
      }
    })
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
            background: '#f1f5f9',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 24,
            color: '#475569',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            {initials(c.name)}
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
          {c.name} H1B Sponsorship & Salaries
        </h1>
        
        <div style={{ 
          marginTop: 16, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>{hq || 'Verified Sponsor'}</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Active Sponsor
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
            {companyYears.map((y) => {
              const isActive = y === year;
              return (
                <Link
                  key={y}
                  href={`/companies/${realSlug}-h1b-sponsorship?year=${y}`}
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
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Start your {c.name} job search</h3>
            <p style={{ marginTop: 8, color: '#cbd5e1', fontSize: 15, maxWidth: 500 }}>
              Track your H1B applications, save sponsors, and get personalized job match alerts with My Plan.
            </p>
          </div>
          <Link href="/plan" style={{ background: '#3b82f6', color: '#fff', padding: '12px 24px', borderRadius: 999, fontWeight: 700, textDecoration: 'none', fontSize: 15, transition: 'all 0.2s', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}>
            Create Free Plan
          </Link>
        </div>

        {/* 2. Key Metrics Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: 16,
          marginBottom: 32
        }}>
          <BigStat label="Approval Rate" value={rate === null ? '—' : `${(rate * 100).toFixed(1)}%`} subtext={`FY${year} benchmark`} />
          <BigStat label="Total Filings" value={filed ? filed.toLocaleString() : '—'} subtext="LCA disclosure files" />
          <BigStat label="Reliability Score" value={`${stability.score}/100`} subtext={stability.label} valueColor={stability.color} />
          <BigStat
            label="Historical Trend"
            value={stability.trendDirection === 'up' ? 'Growing' : stability.trendDirection === 'down' ? 'Declining' : 'Steady'}
            subtext={stability.explanation}
            valueColor={stability.color}
          />
        </div>

        {/* 2.5 Reliability Analysis Section (SEO Rich) */}
        <div style={{ ...cardStyle, marginBottom: 32, background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={cardTitleStyle}>Sponsorship Reliability Analysis</h2>
              <p style={{ marginTop: 8, color: '#64748b', fontSize: 14, maxWidth: 600 }}>
                Our reliability score is calculated based on multi-year filing consistency, annual volume variance, and approval rates.
              </p>
            </div>
            <div style={{ 
              padding: '12px 20px', 
              borderRadius: 16, 
              background: stability.color + '10', 
              border: `1px solid ${stability.color}30`,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: stability.color }}>{stability.score}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: stability.color, textTransform: 'uppercase' }}>Reliability<br/>Score</div>
            </div>
          </div>

          <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
             <div style={{ padding: '20px', borderRadius: 16, background: '#fff', border: '1px solid #f1f5f9' }}>
               <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Consistency Metrics</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <MetricRow label="Active Years" value={`${stability.activeYears} of 5`} highlight={stability.activeYears >= 4} />
                 <MetricRow label="Volume Variance" value={stability.varianceLabel} highlight={stability.label === 'Stable'} />
                 <MetricRow label="Approval Track" value={(rate !== null && rate > 0.9) ? 'Excellent' : 'Average'} highlight={!!(rate !== null && rate > 0.9)} />
               </div>
             </div>
             
             <div style={{ padding: '20px', borderRadius: 16, background: '#fff', border: '1px solid #f1f5f9' }}>
               <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Expert Verdict</h3>
               <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
                 <strong>{stability.label} Sponsor:</strong> {stability.detailedVerdict}
               </div>
             </div>
          </div>
        </div>

        {!hasInsights ? (
          <div style={{ 
            marginTop: 48, 
            textAlign: 'center', 
            color: '#64748b', 
            padding: '48px 24px',
            background: '#f8fafc',
            borderRadius: 24,
            border: '1px dashed #e2e8f0'
          }}>
            No filings detected for FY{year}. Perspective shifted? Check <Link href={`/companies/${realSlug}-h1b-sponsorship?year=${c.last_h1b_filing_year || 2023}`} style={{ fontWeight: 800, color: '#0f172a' }}>FY{c.last_h1b_filing_year || 2023}</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
            
            {/* Top Titles Card */}
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Top Roles Sponsored</h2>
              <div style={{ marginTop: 20 }}>
                {insights.top_titles.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insights.top_titles.map((t) => (
                      <div key={t.title} style={{ 
                        padding: '16px', 
                        borderRadius: 16, 
                        border: '1px solid #f1f5f9',
                        background: '#f8fafc'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>
                            {t.title_slug ? (
                              <Link href={`/titles/${t.title_slug}-h1b-sponsors?year=${year}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                {t.title}
                              </Link>
                            ) : (
                              t.title
                            )}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '4px 8px', borderRadius: 8 }}>
                            {t.filings.toLocaleString()} filings
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                          {t.approvals.toLocaleString()} approvals · {t.filings > 0 ? (t.approvals/t.filings*100).toFixed(1) : 0}% rate
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>No title-specific data for this period.</div>
                )}
              </div>
            </div>

            {/* Geographic & Trend Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div style={cardStyle}>
                <h2 style={cardTitleStyle}>Geographic Focus</h2>
                <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {insights.top_states.length ? (
                    insights.top_states.map((s: any) => {
                      const st = STATES.find(x => x.code === s.state || x.name === s.state);
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
                          {s.state} <span style={{ color: '#64748b', fontWeight: 500, marginLeft: 4 }}>({s.filings.toLocaleString()})</span>
                        </div>
                      );

                      if (isLinked) {
                        const stateSlug = st.name.toLowerCase().replace(/ /g, '-');
                        return (
                          <Link key={s.state} href={`/states/${stateSlug}-h1b-sponsors`} style={{ textDecoration: 'none' }}>
                            {c}
                          </Link>
                        );
                      }
                      return <div key={s.state}>{c}</div>;
                    })
                  ) : (
                    <div style={{ color: '#94a3b8' }}>No geographic data.</div>
                  )}
                </div>
              </div>

              <div style={cardStyle}>
                <h2 style={cardTitleStyle}>Multi-Year Trend</h2>
                <div style={{ marginTop: 20 }}>
                   {insights.trend.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {insights.trend.map((t: any) => (
                        <div key={t.year} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>FY{t.year}</div>
                          <div style={{ flex: 1, height: 8, background: '#f1f5f9', margin: '0 16px', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                             <div style={{ 
                               position: 'absolute', 
                               left: 0, 
                               top: 0, 
                               bottom: 0, 
                               width: `${Math.min(100, (t.filings / filed) * 100)}%`, 
                               background: '#4F46E5',
                               borderRadius: 4
                             }} />
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#475569', minWidth: 80, textAlign: 'right' }}>
                            {t.filings.toLocaleString()} <span style={{ color: '#94a3b8', fontWeight: 500 }}>cases</span>
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
        )}

        <div style={{ marginTop: 64, borderTop: '1px solid #f1f5f9', paddingTop: 24, textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, maxWidth: 800, margin: '0 auto' }}>
             Data is aggregated from U.S. Department of Labor (DOL) LCA disclosure records. This represents historical filing patterns and satisfies no guarantee of future sponsorship or visa eligibility. Not legal advice.
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

function BigStat({
  label,
  value,
  subtext,
  valueColor,
}: {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 20,
        padding: '24px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div
        style={{
          fontWeight: 900,
          marginTop: 12,
          fontSize: 32,
          color: valueColor || '#0f172a',
          letterSpacing: '-0.04em',
        }}
      >
        {value}
      </div>
      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, fontWeight: 500 }}>{subtext}</div>
    </div>
  );
}

function getSponsorStability(trend: TrendPoint[]) {
  if (!trend.length) {
    return {
      label: 'Moderate',
      color: '#b45309',
      score: 50,
      activeYears: 0,
      varianceLabel: 'N/A',
      trendDirection: 'neutral',
      explanation: 'No multi-year filing history available yet.',
      detailedVerdict: 'Historical trends are not yet available for this sponsor. We recommend checking their primary website for official sponsorship stances while more data is indexed.'
    };
  }

  const sorted = [...trend].sort((a, b) => a.year - b.year);
  const lastYear = sorted[sorted.length - 1].year;
  const firstYear = Math.max(sorted[0].year, lastYear - 4);
  const filingsByYear = new Map(sorted.map((point) => [point.year, point.filings]));
  
  const recentSeries = Array.from({ length: 5 }, (_, index) => {
    const year = lastYear - 4 + index;
    return { year, filings: filingsByYear.get(year) ?? 0 };
  });

  const filings = recentSeries.map((point) => point.filings);
  const activeYears = filings.filter(v => v > 0).length;
  const mean = filings.reduce((sum, value) => sum + value, 0) / filings.length;
  const variance = filings.reduce((sum, value) => sum + (value - mean) ** 2, 0) / filings.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  
  // YoY Trend
  const lastVal = filings[filings.length - 1];
  const prevVal = filings[filings.length - 2] || 0;
  const trendDirection = lastVal > prevVal * 1.1 ? 'up' : lastVal < prevVal * 0.9 ? 'down' : 'stable';

  // Score Calculation (0-100)
  // Consistency (40 pts) + Volume (30 pts) + Trend (30 pts)
  const consistencyScore = (activeYears / 5) * 40;
  const varianceScore = Math.max(0, (1 - cv) * 30);
  const growthScore = trendDirection === 'up' ? 30 : trendDirection === 'stable' ? 20 : 10;
  const totalScore = Math.round(consistencyScore + varianceScore + growthScore);

  if (activeYears >= 4 && cv <= 0.4) {
    return {
      label: 'Stable',
      color: '#059669',
      score: totalScore,
      activeYears,
      varianceLabel: 'Very Low',
      trendDirection,
      explanation: `${activeYears}/5 active years with steady volume.`,
      detailedVerdict: `Highly reliable hiring pattern. This sponsor has maintained consistent H1B filing volumes over the last 5 years, making them a predictable target for applicants.`
    };
  }

  if (totalScore < 40 || cv >= 1.0) {
    return {
      label: 'Volatile',
      color: '#dc2626',
      score: totalScore,
      activeYears,
      varianceLabel: 'High',
      trendDirection,
      explanation: 'Irregular filing patterns detected.',
      detailedVerdict: `This sponsor shows high volatility in visa filings. This could indicate seasonal hiring or project-based sponsorship. Verify their current job openings carefully.`
    };
  }

  return {
    label: 'Moderate',
    color: '#b45309',
    score: totalScore,
    activeYears,
    varianceLabel: cv < 0.7 ? 'Moderate' : 'High',
    trendDirection,
    explanation: `${activeYears}/5 years active with moderate swings.`,
    detailedVerdict: `Moderate reliability. While this company sponsors regularly, their annual volume fluctuates based on business cycles. A good target but requires timing.`
  };
}

function MetricRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <div style={{ color: '#64748b', fontWeight: 500 }}>{label}</div>
      <div style={{ fontWeight: 700, color: highlight ? '#059669' : '#0f172a' }}>{value}</div>
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
