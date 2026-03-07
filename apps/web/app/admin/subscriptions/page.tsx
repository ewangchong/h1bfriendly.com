'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SubscriptionRow = {
  id: string;
  created_at: string;
  email: string;
  keywords?: string | null;
  state?: string | null;
  title?: string | null;
  frequency: string;
  active: boolean;
  source_page?: string | null;
  last_sent_at?: string | null;
};

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }
    const adminToken = token;

    async function load() {
      try {
        const headers = new Headers();
        headers.set('x-admin-token', adminToken);

        const res = await fetch('/api/v1/admin/job-alert-subscriptions?size=100', {
          headers,
        });
        const payload = await res.json();
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.message || 'Failed to load subscriptions');
        }
        setRows(payload.data.content || []);
      } catch (err: any) {
        setError(err?.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Job Alert Subscriptions</h1>
          <p style={{ marginTop: 0, color: '#555' }}>Recent subscriber records captured from the public jobs page.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/login" style={{ color: '#111', textDecoration: 'underline' }}>Re-login</Link>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('admin_token');
              router.push('/admin/login');
            }}
            style={{ border: 'none', background: 'transparent', color: '#111', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? <p>Loading subscriptions...</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      {!loading && !error ? (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Created', 'Email', 'Keywords', 'State', 'Title', 'Frequency', 'Active', 'Source'].map((label) => (
                  <th key={label} style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={cellStyle}>{new Date(row.created_at).toLocaleString()}</td>
                  <td style={cellStyle}>{row.email}</td>
                  <td style={cellStyle}>{row.keywords || '—'}</td>
                  <td style={cellStyle}>{row.state || '—'}</td>
                  <td style={cellStyle}>{row.title || '—'}</td>
                  <td style={cellStyle}>{row.frequency}</td>
                  <td style={cellStyle}>{row.active ? 'Yes' : 'No'}</td>
                  <td style={cellStyle}>{row.source_page || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'top',
};
