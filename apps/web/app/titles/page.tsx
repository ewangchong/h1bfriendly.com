import Link from 'next/link';
import type { Metadata } from 'next';
import TitlesControls from './TitlesControls';

export const metadata: Metadata = {
  title: 'Roles (Titles)',
  description: 'Explore popular roles and H1B sponsorship signals by title (derived from public DOL LCA disclosure data).',
  alternates: { canonical: '/titles' },
};

const API_REVALIDATE_SECONDS = 60 * 60;

type TitleRow = {
  slug: string;
  title: string;
  filings: number;
  last_year: number;
};

async function getTitles(params?: { year?: string; limit?: number }): Promise<TitleRow[]> {
  const sp = new URLSearchParams();
  if (params?.year) sp.set('year', params.year);
  sp.set('limit', String(params?.limit ?? 100));

  const base = process.env.H1B_API_BASE_URL || 'http://127.0.0.1:3000';
  const res = await fetch(`${base}/api/v1/titles?${sp.toString()}`, {
    next: { revalidate: API_REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`Failed to load titles (${res.status})`);
  const json = await res.json();
  return json.data;
}

export default async function TitlesIndex({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; keyword?: string }>;
}) {
  const sp = await searchParams;

  const base = process.env.H1B_API_BASE_URL || 'http://127.0.0.1:3000';
  const yearsRes = await fetch(`${base}/api/v1/meta/years`, {
    next: { revalidate: API_REVALIDATE_SECONDS },
  });
  const yearsJson = yearsRes.ok ? await yearsRes.json() : { data: ['2024'] };
  const years = (yearsJson.data as number[]).map(String);

  const year = sp.year || years[0] || '2024';

  let rows: TitleRow[] = [];
  try {
    rows = await getTitles({ year, limit: 120 });
    if (sp.keyword?.trim()) {
      const kw = sp.keyword.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(kw));
    }
  } catch (e: any) {
    return (
      <div>
        <h1 style={{ margin: 0 }}>Roles</h1>
        <p style={{ color: '#b00' }}>Failed to load roles from API.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{String(e?.message || e)}</pre>
      </div>
    );
  }

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-0.02em' }}>Roles (Titles)</h1>
        <p style={{ margin: '10px auto 0', maxWidth: 820, color: '#555', lineHeight: 1.6 }}>
          Explore role-level H1B sponsorship signals derived from public DOL LCA disclosure data. These are not job postings.
        </p>
      </div>

      <TitlesControls years={years} defaultYear={year} />

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 12 }}>
        {rows.map((r) => (
          <Link
            key={r.slug}
            href={`/titles/${r.slug}?year=${year}`}
            style={{
              display: 'block',
              padding: 14,
              borderRadius: 14,
              border: '1px solid #eee',
              background: '#fff',
              textDecoration: 'none',
              color: '#111',
              boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{r.title.trim()}</div>
            <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
              Filings: <b style={{ color: '#111' }}>{r.filings.toLocaleString()}</b> · FY{r.last_year}
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .grid2 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}
