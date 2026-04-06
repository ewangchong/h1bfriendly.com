import type { Metadata } from 'next';
import { getJob } from '@/lib/h1bApi';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Job ${id}`,
    alternates: { canonical: `/jobs/${id}` },
  };
}

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let j;
  try {
    j = await getJob(id);
  } catch (e: any) {
    if (e?.message === 'not_found' || String(e?.message).includes('404')) {
      notFound();
    }
    return (
      <div>
        <h1 style={{ margin: 0 }}>Job</h1>
        <p style={{ color: '#b00' }}>Failed to load job.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{String(e?.message || e)}</pre>
      </div>
    );
  }

  const loc = j.location || [j.city, j.state, j.country].filter(Boolean).join(', ');

  return (
    <article>
      <div
        style={{
          border: '1px solid #eee',
          borderRadius: 16,
          padding: 16,
          background: '#fff',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>{j.title}</h1>
            <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
              {[j.company_name, loc].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {j.h1b_sponsorship_available ? (
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: '#EEF2FF', color: '#3730A3', border: '1px solid #E0E7FF', flex: '0 0 auto' }}>
              H1B signal
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 12, color: '#555', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Sponsorship signal</div>
          <div>{j.h1b_sponsorship_available ? 'Likely offers sponsorship (signal).' : 'Sponsorship unknown.'}</div>
          <div style={{ color: '#777', fontSize: 12, marginTop: 8 }}>Always confirm sponsorship with the employer. Not legal advice.</div>
        </div>
      </div>
    </article>
  );
}
