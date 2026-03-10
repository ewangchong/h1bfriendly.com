'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function CompaniesControls({
  defaultYear,
  years,
}: {
  defaultYear: string;
  years: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const currentKeyword = sp.get('keyword') || '';
  const currentSortBy = (sp.get('sortBy') || 'filed') as 'filed' | 'name';
  const currentSortDirection = (sp.get('sortDirection') || 'DESC') as 'ASC' | 'DESC';
  const currentSize = Number(sp.get('size') || '24') || 24;
  const currentYear = sp.get('year') || defaultYear;

  const [keyword, setKeyword] = useState(currentKeyword);

  useEffect(() => {
    setKeyword(currentKeyword);
  }, [currentKeyword]);

  const sortValue = useMemo(() => {
    return `${currentSortBy}:${currentSortDirection}`;
  }, [currentSortBy, currentSortDirection]);

  function setParams(next: Record<string, string | null>) {
    const nextSp = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') nextSp.delete(k);
      else nextSp.set(k, v);
    }
    // reset pagination once filters change
    if ('keyword' in next || 'sortBy' in next || 'sortDirection' in next || 'size' in next || 'year' in next) {
      nextSp.delete('page');
    }

    const qs = nextSp.toString();
    router.push(qs ? `/companies?${qs}` : '/companies');
    // Ensure server components re-fetch with new search params
    router.refresh();
  }

  return (
    <div
      className="controls-row"
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        margin: '18px 0 10px',
        padding: '20px 24px',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        maxWidth: 920,
        width: '100%',
        justifyContent: 'center',
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .controls-row { width: 100%; justify-content: stretch; }
          .controls-row input, .controls-row select, .controls-row button { width: 100% !important; min-width: 0 !important; }
          .controls-row label { width: 100%; margin-left: 0 !important; }
        }
      `}</style>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Search company name…"
        style={{ padding: '10px 14px', border: '1px solid #ccc', borderRadius: 10, minWidth: 240, background: '#fff' }}
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

      <label style={{ marginLeft: 8, color: '#555', fontSize: 14 }}>Sort</label>
      <select
        value={sortValue}
        onChange={(e) => {
          const [sortBy, sortDirection] = e.target.value.split(':') as ['filed' | 'name', 'ASC' | 'DESC'];
          setParams({ sortBy, sortDirection });
        }}
        style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10 }}
      >
        <option value="filed:DESC">Filed count (high → low)</option>
        <option value="filed:ASC">Filed count (low → high)</option>
        <option value="name:ASC">Name (A → Z)</option>
        <option value="name:DESC">Name (Z → A)</option>
      </select>

      <label style={{ marginLeft: 8, color: '#555', fontSize: 14 }}>Year</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[...years].sort((a,b)=>Number(b)-Number(a)).map((y) => (
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

      <label style={{ marginLeft: 8, color: '#555', fontSize: 14 }}>Page size</label>
      <select
        value={String(currentSize)}
        onChange={(e) => setParams({ size: e.target.value })}
        style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10 }}
      >
        <option value="12">12</option>
        <option value="24">24</option>
        <option value="48">48</option>
      </select>
    </div>
  );
}
