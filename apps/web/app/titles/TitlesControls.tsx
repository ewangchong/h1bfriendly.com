'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TitlesControls({
  years,
  defaultYear,
}: {
  years: string[];
  defaultYear: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const currentYear = sp.get('year') || defaultYear;
  const currentKeyword = sp.get('keyword') || '';

  const [keyword, setKeyword] = useState(currentKeyword);

  useEffect(() => {
    setKeyword(currentKeyword);
  }, [currentKeyword]);

  function setParams(next: Record<string, string | null>) {
    const nextSp = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) nextSp.delete(k);
      else nextSp.set(k, v);
    }
    const qs = nextSp.toString();
    router.push(qs ? `/titles?${qs}` : '/titles');
    router.refresh();
  }

  return (
    <div
      style={{
        margin: '18px auto 10px',
        padding: '20px 24px',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        maxWidth: 920,
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Search job title..."
        style={{ padding: '10px 14px', border: '1px solid #ccc', borderRadius: 10, minWidth: 280, background: '#fff' }}
      />
      <button
        onClick={() => setParams({ keyword: keyword.trim() || null })}
        style={{ padding: '10px 14px', border: 'none', background: 'linear-gradient(to right, #4f46e5, #3b82f6)', color: '#fff', borderRadius: 10, fontWeight: 700 }}
      >
        Apply
      </button>
      <button
        onClick={() => {
          setKeyword('');
          setParams({ keyword: null });
        }}
        style={{ padding: '10px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 10 }}
      >
        Clear
      </button>

      <span style={{ marginLeft: 8, color: '#555', fontSize: 14 }}>Year</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[...years].sort((a, b) => Number(b) - Number(a)).map((y) => (
          <button
            key={y}
            onClick={() => setParams({ year: y })}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: y === currentYear ? '1px solid #111' : '1px solid #ddd',
              background: y === currentYear ? '#111' : '#fff',
              color: y === currentYear ? '#fff' : '#444',
              fontWeight: y === currentYear ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
