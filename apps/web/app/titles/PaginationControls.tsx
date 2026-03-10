'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function PaginationControls({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(nextPage: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(nextPage));
    const qs = next.toString();
    router.push(qs ? `/titles?${qs}` : '/titles');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 18 }}>
      <button
        onClick={() => go(Math.max(0, page - 1))}
        disabled={page <= 0}
        style={btnStyle(page <= 0)}
      >
        Prev
      </button>
      <div style={{ color: '#666', fontSize: 13 }}>
        Page <b style={{ color: '#111' }}>{page + 1}</b> / {Math.max(1, totalPages)}
      </div>
      <button
        onClick={() => go(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        style={btnStyle(page >= totalPages - 1)}
      >
        Next
      </button>
    </div>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: disabled ? '#f7f7f7' : '#fff',
    color: disabled ? '#aaa' : '#111',
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: 84,
  };
}
