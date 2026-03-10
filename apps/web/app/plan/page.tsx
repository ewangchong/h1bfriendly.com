'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type PlanResponse = {
  year: number;
  profile: {
    target_role: string;
    target_state: string | null;
    target_city: string | null;
    years_experience: number;
  };
  recommendations: Array<{
    company_name: string;
    company_slug?: string;
    approvals: number;
    filings: number;
    avg_salary: number;
    approval_rate: number;
    explainability: string[];
  }>;
  suggested_titles: Array<{ title: string; filings: number; approvals: number }>;
  weekly_checklist: string[];
  metric_definitions: Record<string, string>;
};

export default function PlanPage() {
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [targetState, setTargetState] = useState('CA');
  const [targetCity, setTargetCity] = useState('');
  const [yearsExperienceInput, setYearsExperienceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [refCode, setRefCode] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [shareNotice, setShareNotice] = useState('');

  const canSubmit = useMemo(() => targetRole.trim().length >= 2, [targetRole]);

  function createSessionKey() {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(8);
      window.crypto.getRandomValues(bytes);
      const randomPart = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `s_${Date.now().toString(36)}_${randomPart}`;
    }
    return `s_${Date.now().toString(36)}_${Date.now().toString(16)}`;
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const refFromUrl = sp.get('ref')?.trim() || '';
    const refFromStorage = window.localStorage.getItem('h1bfinder_ref_code') || '';
    const resolvedRef = (refFromUrl || refFromStorage).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);

    const existingSession = window.localStorage.getItem('h1bfinder_ref_session') || '';
    const generatedSession = createSessionKey();
    const resolvedSession = (existingSession || generatedSession).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

    setSessionKey(resolvedSession);
    window.localStorage.setItem('h1bfinder_ref_session', resolvedSession);

    if (resolvedRef) {
      setRefCode(resolvedRef);
      window.localStorage.setItem('h1bfinder_ref_code', resolvedRef);

      const visitTrackKey = `h1bfinder_ref_visit_${resolvedSession}_${resolvedRef}`;
      if (!window.localStorage.getItem(visitTrackKey)) {
        fetch('/api/v1/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_name: 'referral_visit',
            referral_code: resolvedRef,
            session_key: resolvedSession,
            source_page: '/plan',
            metadata: { landing_path: window.location.pathname },
          }),
        }).catch(() => undefined);
        window.localStorage.setItem(visitTrackKey, '1');
      }
    }
  }, []);

  useEffect(() => {
    if (!shareNotice) return;
    const t = window.setTimeout(() => setShareNotice(''), 2500);
    return () => window.clearTimeout(t);
  }, [shareNotice]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    try {
      setLoading(true);
      setError('');
      setPlan(null);
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'plan_started');
      }

      const res = await fetch('/api/v1/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_role: targetRole.trim(),
          target_state: targetState.trim() || undefined,
          target_city: targetCity.trim() || undefined,
          years_experience: Math.max(0, Math.min(30, Number.parseInt(yearsExperienceInput || '0', 10) || 0)),
          referral_code: refCode || undefined,
          session_key: sessionKey || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Request failed (${res.status})`);
      }

      setPlan(json.data);
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'plan_submitted');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate plan.');
    } finally {
      setLoading(false);
    }
  }

  function buildShareUrl() {
    if (typeof window === 'undefined') return 'https://h1bfinder.com/plan';
    const url = new URL('/plan', window.location.origin);
    if (refCode) url.searchParams.set('ref', refCode);
    return url.toString();
  }

  function buildShareText() {
    if (!plan) return '';
    const topCompany = plan.recommendations[0]?.company_name || 'top H1B sponsors';
    const title = plan.profile.target_role || 'my target role';
    const location = [plan.profile.target_city, plan.profile.target_state].filter(Boolean).join(', ');
    return [
      `I generated my H1B action plan for ${title}${location ? ` in ${location}` : ''}.`,
      `Top sponsor match: ${topCompany}.`,
      'Try your own personalized plan:',
      buildShareUrl(),
    ].join(' ');
  }

  async function onCopyShareText() {
    const text = buildShareText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setShareNotice('Share text copied.');
      if ((window as any).gtag) {
        (window as any).gtag('event', 'plan_shared', { method: 'copy_text' });
      }
    } catch {
      setShareNotice('Copy failed. Please copy manually.');
    }
  }

  async function onShareLink() {
    const shareUrl = buildShareUrl();
    const text = buildShareText();

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My H1B Plan',
          text,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareNotice('Share link ready.');
      if ((window as any).gtag) {
        (window as any).gtag('event', 'plan_shared', { method: typeof navigator.share === 'function' ? 'native_share' : 'copy_link' });
      }
    } catch {
      setShareNotice('Share canceled or unavailable.');
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 80 }}>
      
      {/* 1. Page Header / Hero */}
      <div style={{ textAlign: 'center', padding: '64px 20px 48px' }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#4f46e5",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            background: "#eef2ff",
            padding: "6px 14px",
            borderRadius: 999,
          }}>
            Strategy
          </span>
        </div>
        <h1 style={{ 
          margin: 0, 
          fontSize: "clamp(32px, 5vw, 48px)", 
          letterSpacing: "-0.04em",
          fontWeight: 900,
          color: '#0f172a',
          lineHeight: 1.1
        }}>
          My H1B Action Plan
        </h1>
        <p style={{
          margin: '18px auto 0',
          maxWidth: 640,
          color: '#475569',
          lineHeight: 1.7,
          fontSize: 'clamp(16px, 2vw, 18px)',
          fontWeight: 500
        }}>
          Generate a data-backed roadmap based on your target role and location. We’ll identify top matching sponsors and build a 7-day checklist for your search.
        </p>

        {/* Cross-Navigation Teaser */}
        <div style={{ marginTop: 32 }}>
          <Link href="/chat" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            background: "#f8fafc",
            color: "#475569",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            border: "1px solid #e2e8f0",
            transition: "all 0.2s"
          }}>
            <span>Need more detail? Ask our AI Assistant</span>
            <span style={{ color: "#94a3b8" }}>→</span>
          </Link>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        
        {/* 2. Product Utility / Form Card */}
        <div style={{ 
          background: '#fff', 
          border: '1px solid #e2e8f0', 
          borderRadius: 24, 
          padding: '32px',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.04)',
          maxWidth: 800,
          margin: '0 auto 48px'
        }}>
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 24 }}>
            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={labelStyle}>
                <span style={spanLabelStyle}>Target role</span>
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Software Engineer" style={inputStyle} required />
              </label>
              <label style={labelStyle}>
                <span style={spanLabelStyle}>Target state</span>
                <input value={targetState} onChange={(e) => setTargetState(e.target.value)} placeholder="e.g. CA" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                <span style={spanLabelStyle}>Target city</span>
                <input value={targetCity} onChange={(e) => setTargetCity(e.target.value)} placeholder="San Francisco" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                <span style={spanLabelStyle}>Experience (Years)</span>
                <input type="number" min={0} max={30} value={yearsExperienceInput} onChange={(e) => setYearsExperienceInput(e.target.value)} placeholder="3" style={inputStyle} />
              </label>
            </div>

            <button disabled={!canSubmit || loading} type="submit" style={{ 
              ...btnStyle, 
              opacity: !canSubmit || loading ? 0.6 : 1,
              padding: '16px 24px',
              fontSize: 16
            }}>
              {loading ? 'Building Strategy...' : 'Create My Personalized Roadmap'}
            </button>
            {error && <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{error}</div>}
          </form>
        </div>

        {/* 3. Main Content Area / Plan Results */}
        {!loading && !plan ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '64px 24px',
            border: '2px dashed #e2e8f0',
            borderRadius: 24,
            color: '#94a3b8',
            fontSize: 15,
            background: '#f8fafc'
          }}>
            Fill out your profile above to generate your H1B search strategy.
          </div>
        ) : null}

        {plan ? (
          <div style={{ display: 'grid', gap: 24 }}>
            
            {/* Share Highlight Card */}
            <div style={shareCardStyle}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, alignItems: 'center' }}>
                <div>
                  <h2 style={{ ...cardTitleStyle, fontSize: 22 }}>Roadmap for {plan.profile.target_role}</h2>
                  <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 14, fontWeight: 500 }}>
                    Successfully generated for FY{plan.year} data benchmarks.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" style={secondaryBtnStyle} onClick={onCopyShareText}>Copy Summary</button>
                  <button type="button" style={btnStyle} onClick={onShareLink}>Share Plan</button>
                </div>
              </div>
              {shareNotice && <div style={{ marginTop: 12, fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>{shareNotice}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
              
              {/* Recommendations Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>Recommended Sponsors</h3>
                <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                   {plan.recommendations.map((r, idx) => (
                    <div key={idx} style={{ 
                      padding: '16px', 
                      borderRadius: 16, 
                      border: '1px solid #f1f5f9',
                      background: '#f8fafc'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.company_name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: 8 }}>
                          {r.approval_rate}% Rate
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
                        {r.filings.toLocaleString()} Filings · Avg. ${r.avg_salary.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>7-Day Implementation</h3>
                <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
                  {plan.weekly_checklist.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: 999, 
                        background: '#0f172a', 
                        color: '#fff', 
                        display: 'grid', 
                        placeItems: 'center', 
                        fontSize: 13, 
                        fontWeight: 800,
                        flexShrink: 0
                      }}>{idx + 1}</div>
                      <div style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>{item}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 80, paddingTop: 32, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, maxWidth: 800, margin: '0 auto' }}>
            Roadmaps are algorithmically generated based on historical DOL data filters. Performance in a specific role or location is indicative of demand but does not guarantee employment or legal visa status.
          </p>
        </div>
      </div>

    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'grid', gap: 8 };
const spanLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', fontSize: 15, background: '#f8fafc', color: '#0f172a', outline: 'none' };
const btnStyle: React.CSSProperties = { border: 'none', background: '#0f172a', color: '#fff', borderRadius: 14, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' };
const secondaryBtnStyle: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 14, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' };
const cardStyle: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 24, padding: '32px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const cardTitleStyle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' };
const shareCardStyle: React.CSSProperties = { ...cardStyle, border: '1px solid #c7d2fe', background: 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)' };
