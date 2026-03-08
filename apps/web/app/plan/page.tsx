'use client';

import { useMemo, useState } from 'react';

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
  const [yearsExperience, setYearsExperience] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PlanResponse | null>(null);

  const canSubmit = useMemo(() => targetRole.trim().length >= 2, [targetRole]);

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
          years_experience: yearsExperience,
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

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', paddingBottom: 28 }}>
      <h1 style={{ margin: '8px 0 8px', fontSize: 'clamp(30px,4vw,42px)' }}>Personalized H1B Plan</h1>
      <p style={{ color: '#52525b', marginTop: 0 }}>
        Tell us your target role and location. We will return top sponsors, suggested titles, and a 7-day action checklist.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14, padding: 14 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#3f3f46' }}>Target role</span>
          <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Software Engineer" style={inputStyle} required />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#3f3f46' }}>Target state</span>
          <input value={targetState} onChange={(e) => setTargetState(e.target.value)} placeholder="CA" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#3f3f46' }}>Target city (optional)</span>
          <input value={targetCity} onChange={(e) => setTargetCity(e.target.value)} placeholder="San Francisco" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#3f3f46' }}>Years experience</span>
          <input type="number" min={0} max={30} value={yearsExperience} onChange={(e) => setYearsExperience(Number(e.target.value || 0))} style={inputStyle} />
        </label>

        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button disabled={!canSubmit || loading} type="submit" style={{ ...btnStyle, opacity: !canSubmit || loading ? 0.6 : 1 }}>
            {loading ? 'Generating...' : 'Generate My Plan'}
          </button>
          {error ? <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span> : null}
        </div>
      </form>

      {!loading && !plan ? (
        <div style={{ marginTop: 14, padding: 14, border: '1px dashed #d4d4d8', borderRadius: 12, color: '#71717a' }}>
          No plan yet. Fill out the form and click <b>Generate My Plan</b>.
        </div>
      ) : null}

      {plan ? (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 6px' }}>Top Target Sponsors (FY{plan.year})</h2>
            {plan.recommendations.map((r, idx) => (
              <div key={`${r.company_name}-${idx}`} style={{ padding: '10px 0', borderTop: idx === 0 ? 'none' : '1px solid #eee' }}>
                <div style={{ fontWeight: 700 }}>{idx + 1}. {r.company_name}</div>
                <div style={{ color: '#52525b', fontSize: 13 }}>
                  {r.approvals.toLocaleString()} approvals · {r.approval_rate}% approval rate · Avg salary ${r.avg_salary.toLocaleString()}
                </div>
                <ul style={{ margin: '8px 0 0 18px', color: '#27272a' }}>
                  {r.explainability.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 6px' }}>Suggested Titles</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {plan.suggested_titles.map((t) => (
                <span key={t.title} style={{ border: '1px solid #ddd', borderRadius: 999, padding: '6px 10px', fontSize: 13 }}>
                  {t.title} ({t.approvals})
                </span>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 6px' }}>7-day action checklist</h2>
            <ol style={{ margin: '8px 0 0 18px' }}>
              {plan.weekly_checklist.map((i) => <li key={i} style={{ marginBottom: 6 }}>{i}</li>)}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
};

const btnStyle: React.CSSProperties = {
  border: 'none',
  background: '#4f46e5',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e4e4e7',
  borderRadius: 14,
  padding: 14,
  background: '#fff',
};
