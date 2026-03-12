'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function HomeLeadCapture() {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('Software Engineer');
  const [state, setState] = useState('CA');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);
    setError(null);
    trackEvent('lead_capture_started', { source_page: '/', frequency });

    try {
      const res = await fetch('/api/v1/job-alert-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          title,
          state: state.toUpperCase(),
          frequency,
          source_page: '/',
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to subscribe');
      }

      const outcome = payload?.data?.existing ? 'reactivated' : 'created';
      setMessage(
        outcome === 'reactivated'
          ? 'Your alert is active again. We will send new sponsor matches.'
          : 'Saved. We will send sponsor matches to your inbox.'
      );
      trackEvent('lead_capture_submitted', {
        source_page: '/',
        frequency,
        outcome,
        has_title: Boolean(title.trim()),
        has_state: Boolean(state.trim()),
      });

      setEmail('');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
      trackEvent('lead_capture_failed', { source_page: '/' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="lead-capture" className="landing-lead-section">
      <div className="landing-lead-card">
        <div>
          <div className="landing-lead-kicker">Free Weekly Workflow</div>
          <h2 className="landing-section-title">Get sponsor matches without checking the site every day</h2>
          <p className="landing-section-copy landing-lead-copy">
            Pick your target role and state once. We will email sponsor-heavy job alerts using the existing H1B Finder data feed.
          </p>
        </div>

        <form onSubmit={onSubmit} className="landing-lead-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="landing-lead-input"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Target role"
            className="landing-lead-input"
          />
          <input
            value={state}
            onChange={(e) => setState(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
            placeholder="State"
            className="landing-lead-input landing-lead-input-state"
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
            className="landing-lead-input landing-lead-select"
          >
            <option value="weekly">Weekly alerts</option>
            <option value="daily">Daily alerts</option>
          </select>
          <button type="submit" disabled={loading} className="landing-lead-submit">
            {loading ? 'Saving...' : 'Email Me Matches'}
          </button>
        </form>

        {message ? <div className="landing-lead-success">{message}</div> : null}
        {error ? <div className="landing-lead-error">{error}</div> : null}
      </div>
    </section>
  );
}
