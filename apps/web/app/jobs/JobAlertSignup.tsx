'use client';

import { useState } from 'react';

export default function JobAlertSignup() {
  const [email, setEmail] = useState('');
  const [keywords, setKeywords] = useState('');
  const [state, setState] = useState('');
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/v1/job-alert-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          keywords,
          state: state.toUpperCase(),
          title,
          frequency,
          source_page: '/jobs',
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to subscribe');
      }

      setMessage(payload?.message || 'Subscription saved.');

      const referralCode = (typeof window !== 'undefined' ? (window.localStorage.getItem('h1bfriend_ref_code') || '') : '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 64);
      const sessionKey = (typeof window !== 'undefined' ? (window.localStorage.getItem('h1bfriend_ref_session') || '') : '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 80);

      if (referralCode) {
        fetch('/api/v1/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_name: 'referral_signup',
            referral_code: referralCode,
            session_key: sessionKey || undefined,
            source_page: '/jobs',
            metadata: { frequency },
          }),
        }).catch(() => undefined);
      }

      setEmail('');
      setKeywords('');
      setState('');
      setTitle('');
      setFrequency('weekly');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          style={inputStyle}
        />
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Keywords, e.g. data engineer"
          style={inputStyle}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title, e.g. Software Engineer"
          style={inputStyle}
        />
        <input
          value={state}
          onChange={(e) => setState(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
          placeholder="State, e.g. CA"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: '#555', fontSize: 14 }}>
          Frequency
        </label>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')} style={inputStyle}>
          <option value="weekly">Weekly</option>
          <option value="daily">Daily</option>
        </select>
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Saving...' : 'Subscribe'}
        </button>
      </div>

      {message ? <div style={{ color: '#047857', fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d4d4d8',
  background: '#fff',
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#111',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};
