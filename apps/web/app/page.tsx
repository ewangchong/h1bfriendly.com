import Link from 'next/link';
import type { Metadata } from 'next';
import RankingsControls from './RankingsControls';
import HomeHeroActions from './HomeHeroActions';
import HomeLeadCapture from './HomeLeadCapture';
import { getAvailableYears, listCompanies, getTitles } from '@/lib/h1bApi';

export const metadata: Metadata = {
  title: 'H1B Finder: The Verified AI Skill for Your Career',
  description: 'Grounded in 4M+ records from DOL. Bring verified H1B insights directly into your OpenClaw workspace.',
  keywords: ['h1b', 'h1b sponsor', 'h1b database', 'h1b jobs', 'h1b visa', 'openclaw', 'ai agent'],
  alternates: { canonical: '/' },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const years = (await getAvailableYears()).map(String);
  const year = sp.year || years[0] || '2025';

  const [companiesRes, titlesRes, allTitlesRes] = await Promise.allSettled([
    listCompanies({ year, size: 4, sortBy: 'filed', sortDirection: 'DESC' }),
    getTitles({ year, limit: 4 }),
    getTitles({ year, limit: 50 })
  ]);

  const topCompanies = companiesRes.status === 'fulfilled' ? companiesRes.value.content : [];
  const topTitles = titlesRes.status === 'fulfilled' ? titlesRes.value : [];
  const allTitles = allTitlesRes.status === 'fulfilled' ? allTitlesRes.value.map(t => ({ title: t.title, slug: t.slug })) : [];

  return (
    <div className="landing-page">
      
      {/* 1. Hero */}
      <section className="landing-hero">
        <h1 className="landing-hero-title">
          Give Your AI Agent<br />
          <span className="landing-hero-highlight">Verified H1B Intelligence</span>
        </h1>
        <p className="landing-hero-copy">
          Stop searching manually. Install the official OpenClaw skill to query millions of DOL sponsorship records directly from your workspace.
        </p>

        {/* Terminal Block */}
        <div className="landing-terminal">
          <div className="landing-terminal-lights">
            <div className="landing-terminal-light landing-terminal-light-red" />
            <div className="landing-terminal-light landing-terminal-light-amber" />
            <div className="landing-terminal-light landing-terminal-light-green" />
          </div>
          <div className="landing-terminal-command">
            <span className="landing-terminal-prompt">$</span>{' '}
            <span className="landing-terminal-value">npx clawhub install h1b-finder</span>
          </div>
          <div className="landing-terminal-examples">
            <div><strong className="landing-terminal-label">Example:</strong> "Which Austin companies sponsor Data Scientists?"</div>
            <div><strong className="landing-terminal-label">Example:</strong> "Compare H1B salaries for Meta and Apple"</div>
          </div>
        </div>

        {/* Hero CTAs */}
        <HomeHeroActions />
      </section>

      {/* 2. Proof Strip */}
      <section className="landing-proof-strip">
        <div className="landing-proof-metric">
          <div className="landing-proof-value">4M+</div>
          <div className="landing-proof-label">Official DOL Records</div>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-metric">
          <div className="landing-proof-value">FY2025</div>
          <div className="landing-proof-label">Latest Data Included</div>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-metric">
          <div className="landing-proof-value">100%</div>
          <div className="landing-proof-label">Verified Sponsor Signal</div>
        </div>
      </section>

      <HomeLeadCapture />

      {/* 3. Lightweight Search Demo */}
      <section className="landing-search">
        <h2 className="landing-section-title">Test the Database</h2>
        <p className="landing-section-copy">Search public LCA disclosures directly on the web before integrating the agent.</p>
        <RankingsControls defaultYear={year} years={years} titles={allTitles} />
      </section>

      {/* 4. Flagship Modules */}
      <section className="landing-module-grid">
        
        {/* Top Sponsors */}
        <div>
          <div className="landing-module-head">
            <div>
              <h2 className="landing-module-title">Top Sponsors</h2>
              <div className="landing-module-copy">Employers filing the most H1B cases</div>
            </div>
            <Link href="/companies" className="landing-module-link">View All →</Link>
          </div>
          <div className="landing-card-stack">
            {topCompanies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug || c.id}`} className="landing-stat-card">
                <div className="landing-card-title">{c.name}</div>
                <div className="landing-card-stats">
                  <div><span style={{ color: '#64748b' }}>Filed:</span> <strong style={{color: '#0f172a'}}>{c.h1b_applications_filed?.toLocaleString() || '0'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Approved:</span> <strong style={{color: '#10b981'}}>{c.h1b_applications_approved?.toLocaleString() || '0'}</strong></div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Jobs */}
        <div>
          <div className="landing-module-head">
            <div>
              <h2 className="landing-module-title">Top Jobs</h2>
              <div className="landing-module-copy">Roles with the highest sponsorship demand</div>
            </div>
            <Link href="/titles" className="landing-module-link">View All →</Link>
          </div>
          <div className="landing-card-stack">
            {topTitles.map((t) => (
              <Link key={t.slug} href={`/titles/${t.slug}?year=${year}`} className="landing-stat-card">
                <div className="landing-card-title">{t.title}</div>
                <div className="landing-card-stats">
                  <div><span style={{ color: '#64748b' }}>Filings:</span> <strong style={{color: '#0f172a'}}>{t.filings.toLocaleString()}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Latest:</span> <strong style={{color: '#0f172a'}}>FY{t.last_year}</strong></div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </section>

      {/* 5. Teasers (Deprioritized) */}
      <section className="landing-teaser-grid">
        <Link href="/plan" className="landing-teaser-card">
          <div className="landing-teaser-kicker landing-teaser-kicker-indigo">Action Plan</div>
          <div className="landing-teaser-title">My Plan Generator</div>
          <div className="landing-teaser-copy">Generate a personalized step-by-step roadmap from OPT to H1B based on your target role and timeline. →</div>
        </Link>
        <Link href="/chat" className="landing-teaser-card">
           <div className="landing-teaser-kicker landing-teaser-kicker-sky">Ask the Data</div>
          <div className="landing-teaser-title">Web AI Chat</div>
          <div className="landing-teaser-copy">Don't have an OpenClaw workspace yet? Try our basic web-based AI assistant to ask questions naturally. →</div>
        </Link>
      </section>

    </div>
  );
}
