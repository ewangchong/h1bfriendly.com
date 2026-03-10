import Link from 'next/link';
import type { Metadata } from 'next';
import { getAvailableYears, getRankings, getRankingsSummary, getTitles } from '@/lib/h1bApi';
import RankingsControls from './RankingsControls';
import RankingsChart from './RankingsChart';
import HomeChatLauncher from './HomeChatLauncher';

export const metadata: Metadata = {
  title: 'H1B Finder: The Power Source for Your AI Career Agent',
  description: 'Grounded in 4M+ records from DOL FY2025. Bring verified H1B insights directly into your OpenClaw workspace.',
  keywords: ['h1b', 'h1b sponsor', 'h1b database', 'h1b jobs', 'h1b visa', 'openclaw', 'ai agent'],
  alternates: { canonical: '/' },
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
    view?: 'rankings' | 'explorer';
  }>;
}) {
  const sp = await searchParams;
  const years = (await getAvailableYears()).map(String);
  const year = sp.year || years[0] || '2025';
  const currentView = sp.view || 'rankings';

  // State for performance-optimized tab switching in 2GB RAM env
  const isRankingsView = currentView === 'rankings';
  const isExplorerView = currentView === 'explorer';

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
        year,
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
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>H1B Finder</h1>
        <p style={{ color: '#ef4444' }}>API Connection Error. Verify H1B_API_BASE_URL.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#71717a', fontSize: 12 }}>{String(e?.message || e)}</pre>
      </div>
    );
  }

  const yearsWithData = summary?.trend?.filter(t => t.filings > 0).map(t => String(t.year)) || [];
  const displayYears = (yearsWithData.length > 0) ? yearsWithData : years;

  const getTabUrl = (view: string) => {
    const p = new URLSearchParams();
    if (sp.year) p.set('year', sp.year);
    if (sp.state) p.set('state', sp.state);
    if (sp.job_title) p.set('job_title', sp.job_title);
    if (sp.company) p.set('company', sp.company);
    p.set('view', view);
    return `/?${p.toString()}`;
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <HomeChatLauncher />
      
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '48px 16px 32px' }}>
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(32px, 5vw, 60px)',
          letterSpacing: '-0.05em',
          fontWeight: 900,
          background: 'linear-gradient(to bottom right, #18181b 20%, #4f46e5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.05
        }}>
          H1B Finder: The AI Data Source for Your Career
        </h1>
        <p style={{
          margin: '20px auto 0',
          maxWidth: 800,
          color: '#52525b',
          lineHeight: 1.6,
          fontSize: 'clamp(18px, 2.5vw, 22px)',
          fontWeight: 500
        }}>
          Grounded in 4M+ records from DOL FY2025. Stop searching, start automating—bring verified H1B insights directly into your OpenClaw workspace.
        </p>

        {/* OpenClaw Integration Tile */}
        <div style={{
          marginTop: 40,
          background: '#09090b',
          borderRadius: 20,
          padding: '24px',
          textAlign: 'left',
          display: 'inline-block',
          width: '100%',
          maxWidth: 640,
          border: '1px solid #27272a',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#a1a1aa', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Quick Integration / 极速上手</span>
          </div>
          <div style={{ background: '#18181b', padding: 16, borderRadius: 12, fontFamily: 'monospace', fontSize: 14, color: '#e4e4e7', border: '1px solid #3f3f46' }}>
            <div style={{ color: '#a1a1aa', marginBottom: 4 }}># 1. Install Skill / 安装技能</div>
            <div style={{ color: '#4f46e5', fontWeight: 700 }}>npx clawhub install h1b-finder</div>
            <div style={{ color: '#a1a1aa', marginTop: 12, marginBottom: 4 }}># 2. Ask your Agent / 下达指令</div>
            <div style={{ fontStyle: 'italic' }}>&quot;Which Austin companies pay Data Scientists over $150k?&quot;</div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <Link href="/plan" style={{ color: '#fff', background: '#4f46e5', padding: '10px 20px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Get Action Plan</Link>
             <span style={{ color: '#71717a', fontSize: 12 }}>API: Operational · DOL FY2025</span>
          </div>
        </div>
      </div>

      {/* Legal Footer */}
      <div style={{ 
        textAlign: 'center', 
        padding: '24px 16px', 
        borderTop: '1px solid #e4e4e7', 
        marginTop: 32,
        color: '#71717a',
        fontSize: 13
      }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
          H1B Finder © 2026 · AI Ready Data Source
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Link href="/legal/tos.md" target="_blank" style={{ color: '#71717a', textDecoration: 'none' }}>Terms</Link>
          <Link href="/legal/privacy.md" target="_blank" style={{ color: '#71717a', textDecoration: 'none' }}>Privacy</Link>
          <a href="mailto:contact@h1bfinder.com" style={{ color: '#71717a', textDecoration: 'none' }}>Contact</a>
        </div>
        <p style={{ marginTop: 12, fontSize: 11, maxWidth: 600, margin: '12px auto 0', lineHeight: 1.5 }}>
          Disclaimer: Data sourced from public DOL records. Not legal advice. AI Skill `h1b-finder` is open source. Use at your own risk.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e4e4e7', marginBottom: 24, gap: 24, padding: '0 16px' }}>
        <Link 
          href={getTabUrl('rankings')}
          style={{
            padding: '12px 4px',
            textDecoration: 'none',
            fontSize: 16,
            fontWeight: 700,
            color: currentView === 'rankings' ? '#4f46e5' : '#71717a',
            borderBottom: currentView === 'rankings' ? '3px solid #4f46e5' : '3px solid transparent'
          }}
        >
          Sponsor Rankings
        </Link>
        <Link 
          href={getTabUrl('explorer')}
          style={{
            padding: '12px 4px',
            textDecoration: 'none',
            fontSize: 16,
            fontWeight: 700,
            color: currentView === 'explorer' ? '#4f46e5' : '#71717a',
            borderBottom: currentView === 'explorer' ? '3px solid #4f46e5' : '3px solid transparent'
          }}
        >
          Company Explorer
        </Link>
      </div>

      <div style={{ padding: '0 16px' }}>
        {isRankingsView && (
          <div style={{ display: 'grid', gap: 24 }}>
            <div id="rankings">
              <RankingsControls defaultYear={year} years={displayYears} titles={titles} />
            </div>

            {summary && (
              <div style={{ background: '#fff', padding: '24px 20px 4px', borderRadius: 20, border: '1px solid #e4e4e7' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#18181b', marginBottom: 12 }}>
                  Historical Approval Trend
                  {sp.state ? ` in ${sp.state}` : ''}
                  {sp.job_title ? ` for "${sp.job_title}"` : ''}
                </div>
                <RankingsChart trend={summary.trend} />
              </div>
            )}

            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 12 }}>
              Top {rankings.length} Sponsors
              {sp.state ? ` in ${sp.state}` : ''}
              {sp.job_title ? ` for "${sp.job_title}"` : ''}
              {` (FY${year})`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rankings.map((r: any, i: number) => (
                <RankingCard key={r.employer_norm + i} rank={i + 1} r={r} />
              ))}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 48 }}>
                <Link
                  href={`/?${(() => {
                    const p = new URLSearchParams(sp as any);
                    p.set('limit', limitNum === 10 ? '100' : '10');
                    return p.toString();
                  })()}`}
                  style={{ padding: '12px 32px', borderRadius: 16, border: '1px solid #e4e4e7', background: '#fff', color: '#18181b', fontWeight: 700, textDecoration: 'none' }}
                >
                  {limitNum === 10 ? 'Show Top 100' : 'Show Top 10'}
                </Link>
            </div>
          </div>
        )}
        
        {isExplorerView && (
          <div style={{ minHeight: '50vh' }}>
            <div style={{ background: '#f4f4f5', padding: '40px 20px', borderRadius: 24, textAlign: 'center', border: '1px dashed #d4d4d8' }}>
              <h2 style={{ margin: '0 0 8px', fontWeight: 900 }}>Company Explorer</h2>
              <p style={{ color: '#52525b', marginBottom: 24 }}>Deep dive into specific employer records across all fiscal years.</p>
              <div style={{ maxWidth: 500, margin: '0 auto' }}>
                <RankingsControls defaultYear={year} years={displayYears} titles={titles} />
              </div>
              <p style={{ marginTop: 24, fontSize: 13, color: '#71717a' }}>
                Search by company name or use filters to narrow down the dataset.
              </p>
            </div>
          </div>
        )}

        {summary && isRankingsView && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginTop: 48,
            marginBottom: 64
          }}>
            <SummaryCard title="Total Filings" value={summary.totals.total_filings} color="#f8fafc" border="#e2e8f0" />
            <SummaryCard title="Total Approvals" value={summary.totals.total_approvals} color="#ecfdf5" border="#d1fae5" />
            <SummaryCard 
              title="Average Salary" 
              value={summary.totals.avg_salary ? `$${Number(summary.totals.avg_salary).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0'} 
              color="#fffbeb" 
              border="#fef3c7" 
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color, border }: { title: string, value: any, color: string, border: string }) {
  return (
    <div style={{ background: color, padding: 24, borderRadius: 20, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function RankingCard({ rank, r }: { rank: number; r: any }) {
  const avgSalary = Number(r.avg_salary);
  const formattedSalary = isNaN(avgSalary) || avgSalary === 0
    ? 'N/A'
    : '$' + avgSalary.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', border: '1px solid #e4e4e7', borderRadius: 18, background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ width: 40, fontWeight: 900, fontSize: 22, color: rank <= 3 ? '#eab308' : '#d4d4d8', textAlign: 'center' }}>#{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {r.company_slug ? (
          <Link href={`/companies/${r.company_slug}`} style={{ fontWeight: 800, fontSize: 17, color: '#18181b', textDecoration: 'none' }}>{r.company_name}</Link>
        ) : (
          <div style={{ fontWeight: 800, fontSize: 17, color: '#18181b' }}>{r.company_name}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Approvals</div>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#10b981' }}>{r.approvals.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 90 }}>
          <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Avg Salary</div>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#18181b' }}>{formattedSalary}</div>
        </div>
      </div>
    </div>
  );
}
