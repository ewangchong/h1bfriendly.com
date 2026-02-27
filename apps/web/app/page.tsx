import Link from 'next/link';
import type { Metadata } from 'next';
import { getAvailableYears, getRankings, getRankingsSummary, getTitles } from '@/lib/h1bApi';
import RankingsControls from './RankingsControls';
import RankingsChart from './RankingsChart';

export const metadata: Metadata = {
  title: 'H1B Sponsor Rankings & Database | Find H1B Friendly Jobs',
  description: 'Discover the top H1B visa sponsors by year, location, and job title. Explore verified data to find H1B friendly companies and track application trends.',
  keywords: ['h1b', 'h1b sponsor', 'h1b friendly', 'h1b database', 'h1b jobs', 'h1b visa', 'top h1b sponsors'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'H1B Sponsor Rankings & Database',
    description: 'Find top H1B visa sponsors by year, location, and job title. Explore verified data.',
    type: 'website',
  }
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    state?: string;
    city?: string;
    job_title?: string;
    company?: string;
    sortBy?: 'approvals' | 'salary';
    limit?: string;
    minApprovals?: string;
  }>;
}) {
  const sp = await searchParams;
  const years = (await getAvailableYears()).map(String);
  const year = sp.year || years[0] || '2025'; // Fallback to latest

  const limitNum = sp.limit ? parseInt(sp.limit, 10) : 10;
  const minAppsNum = sp.minApprovals !== undefined ? parseInt(sp.minApprovals, 10) : undefined;

  let rankings;
  let summary;
  let titles: { title: string; slug: string }[] = [];
  try {
    const [rankingsData, summaryData, titlesData] = await Promise.all([
      getRankings({
        year,
        state: sp.state,
        city: sp.city,
        job_title: sp.job_title,
        company: sp.company,
        sortBy: sp.sortBy,
        limit: limitNum,
        minApprovals: minAppsNum,
      }),
      getRankingsSummary({
        year, // The backend ignores year for trend but uses it for exact totals
        state: sp.state,
        city: sp.city,
        job_title: sp.job_title,
        company: sp.company,
      }),
      getTitles({ year, limit: 50 })
    ]);
    rankings = rankingsData;
    summary = summaryData;
    titles = titlesData.map(t => ({ title: t.title, slug: t.slug }));
  } catch (e: any) {
    return (
      <div>
        <h1 style={{ margin: 0 }}>H1B Sponsor Rankings</h1>
        <p style={{ color: '#b00' }}>Failed to load rankings from API. Check H1B_API_BASE_URL.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{String(e?.message || e)}</pre>
      </div>
    );
  }

  // Determine which years to show in the UI selector. 
  // If we have a trend (e.g. searching for a company), only show years they actually filed in.
  const yearsWithData = summary?.trend
    ?.filter(t => t.filings > 0)
    .map(t => String(t.year)) || [];
  
  const displayYears = (yearsWithData.length > 0) ? yearsWithData : years;

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '32px 16px 16px' }}>
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(32px, 5vw, 48px)',
          letterSpacing: '-0.03em',
          fontWeight: 900,
          background: 'linear-gradient(to right, #111 0%, #4f46e5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2
        }}>
          {sp.company ? sp.company : 'H1B Sponsor'} Leaderboard
        </h1>
        <p style={{
          margin: '16px auto 0',
          maxWidth: 760,
          color: '#52525b',
          lineHeight: 1.6,
          fontSize: 'clamp(16px, 2vw, 18px)'
        }}>
          Find the top H1B sponsoring companies for your specific role and location.
          Ranked by number of approved applications and average salary across historical USCIS public data.
        </p>
      </div>

      <div style={{ marginTop: 12 }}>
        <RankingsControls defaultYear={year} years={displayYears} titles={titles} />
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          Top {rankings.length} Sponsors
          {sp.state ? ` in ${sp.state}` : ''}
          {sp.job_title ? ` for "${sp.job_title}"` : ''}
          {` (FY${year})`}
        </div>
      </div>

      {rankings.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#777', background: '#fafafa', borderRadius: 12 }}>
          No sponsors found matching these filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rankings.map((r, i) => (
            <RankingCard key={r.employer_norm + i} rank={i + 1} r={r} />
          ))}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            {(() => {
              const nextLimit = limitNum === 10 ? 100 : 10;
              const nextLimitLabel = limitNum === 10 ? 'Show Top 100' : 'Show Top 10';
              const sp2 = new URLSearchParams();
              if (year) sp2.set('year', year);
              if (sp.state) sp2.set('state', sp.state);
              if (sp.job_title) sp2.set('job_title', sp.job_title);
              if (sp.company) sp2.set('company', sp.company);
              if (sp.sortBy) sp2.set('sortBy', sp.sortBy);
              sp2.set('limit', String(nextLimit));
              return (
                <Link
                  href={`/?${sp2.toString()}`}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 24,
                    border: '1px solid #ddd',
                    background: '#fff',
                    color: '#111',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  {nextLimitLabel}
                </Link>
              );
            })()}
          </div>
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 48, marginBottom: 32 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 16
          }}>
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Filings</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {(summary.totals.total_filings ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#ecfdf5', padding: 20, borderRadius: 16, border: '1px solid #d1fae5' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Approvals</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#065f46', marginTop: 4 }}>
                {(summary.totals.total_approvals ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#fffbeb', padding: 20, borderRadius: 16, border: '1px solid #fef3c7' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Salary</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#92400e', marginTop: 4 }}>
                {summary.totals.avg_salary ? `$${Number(summary.totals.avg_salary ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0'}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px 20px 4px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
              Historical Approval Trend
              {sp.state ? ` in ${sp.state}` : ''}
              {sp.job_title ? ` for "${sp.job_title}"` : ''}
            </div>
            <RankingsChart trend={summary.trend} />
          </div>
        </div>
      )}
    </div>
  );
}

function RankingCard({ rank, r }: { rank: number; r: any }) {
  const avgSalary = Number(r.avg_salary);
  const formattedSalary = isNaN(avgSalary) || avgSalary === 0
    ? 'N/A'
    : '$' + (avgSalary ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        border: '1px solid #eee',
        borderRadius: 14,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{
        width: 36,
        fontWeight: 900,
        fontSize: 20,
        color: rank <= 3 ? '#eab308' : '#aaa',
        textAlign: 'center'
      }}>
        #{rank}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {r.company_slug ? (
          <Link
            href={`/companies/${r.company_slug}`}
            style={{ fontWeight: 800, fontSize: 16, color: '#111', textDecoration: 'none' }}
          >
            {r.company_name}
          </Link>
        ) : (
          <div style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>{r.company_name}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approvals</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#059669' }}>
            {(r.approvals ?? 0).toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Salary</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {formattedSalary}
          </div>
        </div>
      </div>
    </div>
  );
}