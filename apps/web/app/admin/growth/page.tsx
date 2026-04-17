'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

type SummaryItem = {
  event_name: string;
  total: number;
};

type TrendItem = {
  day: string;
  event_name: string;
  count: number;
};

type Payload = {
  summary: SummaryItem[];
  trend: TrendItem[];
};

export default function AdminGrowthPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    async function load() {
      try {
        const headers = new Headers();
        headers.set('x-admin-token', token as string);

        const res = await fetch('/api/v1/admin/growth-metrics', { headers });
        const payload = await res.json();
        
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.message || 'Failed to load growth metrics');
        }
        setData(payload.data);
      } catch (err: any) {
        setError(err?.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  const { totalVisits, totalSignups, totalPlans } = useMemo(() => {
    if (!data) return { totalVisits: 0, totalSignups: 0, totalPlans: 0 };
    const getCount = (name: string) => data.summary.find(s => s.event_name === name)?.total || 0;
    return {
      totalVisits: getCount('referral_visit'),
      totalSignups: getCount('referral_signup'),
      totalPlans: getCount('referral_plan_generated'),
    };
  }, [data]);

  const chartData = useMemo(() => {
    if (!data?.trend) return [];
    const grouped: Record<string, any> = {};
    data.trend.forEach(t => {
      // Split to avoid timezone shift dropping a day depending on local browser time
      const dateStr = t.day.split('T')[0] || t.day; 
      if (!grouped[dateStr]) grouped[dateStr] = { day: dateStr, referral_visit: 0, referral_signup: 0, referral_plan_generated: 0 };
      grouped[dateStr][t.event_name] = t.count;
    });
    return Object.values(grouped).sort((a, b) => a.day.localeCompare(b.day));
  }, [data]);

  const conversionRate = totalVisits > 0 ? ((totalPlans / totalVisits) * 100).toFixed(1) : '0';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Growth & Referrals Dashboard</h1>
          <p style={{ marginTop: 0, color: '#555' }}>End-to-end plan conversion and sharing funnel metrics.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/subscriptions" style={{ color: '#111', textDecoration: 'underline' }}>Alerts</Link>
          <Link href="/admin/login" style={{ color: '#111', textDecoration: 'underline' }}>Re-login</Link>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('admin_token');
              router.push('/admin/login');
            }}
            style={{ border: 'none', background: 'transparent', color: '#111', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? <p>Loading metrics...</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={cardStyle}>
              <div style={cardTitleStyle}>Referral Visits</div>
              <div style={cardValueStyle}>{totalVisits}</div>
            </div>
            <div style={cardStyle}>
              <div style={cardTitleStyle}>Plan Generated (via Referral)</div>
              <div style={cardValueStyle}>{totalPlans}</div>
            </div>
            <div style={cardStyle}>
              <div style={cardTitleStyle}>Signups (via Referral)</div>
              <div style={cardValueStyle}>{totalSignups}</div>
            </div>
            <div style={{...cardStyle, background: '#f0fdf4', borderColor: '#bbf7d0'}}>
              <div style={cardTitleStyle}>Visit → Plan Rate</div>
              <div style={{...cardValueStyle, color: '#166534'}}>{conversionRate}%</div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 24 }}>30-Day Trend (Referral Funnel)</h3>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#666' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#666' }} />
                  <Tooltip
                    cursor={{ fill: '#f4f4f5' }}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  <Bar dataKey="referral_visit" name="Visits" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="referral_plan_generated" name="Plans Generated" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="referral_signup" name="Signups" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5
};

const cardValueStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: '#0f172a',
  lineHeight: 1.2
};
