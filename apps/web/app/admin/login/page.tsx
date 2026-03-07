'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Login failed');
      }

      localStorage.setItem('admin_token', token);
      router.push('/admin/subscriptions');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <h1>Admin Login</h1>
      <p style={{ color: '#555' }}>Enter the admin token configured on the backend.</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #d4d4d8' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '12px 14px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontWeight: 800 }}>
          {loading ? 'Checking...' : 'Login'}
        </button>
      </form>
      {error ? <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div> : null}
    </div>
  );
}
