/**
 * Pagination.jsx
 * Page navigation controls used below every table.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * @param {{
 *   page: number,
 *   totalPages: number,
 *   onPageChange: (page: number) => void,
 *   total: number,
 *   limit: number
 * }} props
 */
export default function Pagination({ page, totalPages, onPageChange, total, limit }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btnStyle = (disabled) => ({
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: disabled ? 'var(--bg)' : 'var(--bg-card)',
    color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderTop: '1px solid var(--border)',
      fontSize: '13px',
      color: 'var(--text-secondary)',
    }}>
      <span>Showing {from}–{to} of {total} results</span>

      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          style={btnStyle(page === 1)}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page numbers */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px' }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: p === page ? 'var(--primary)' : 'var(--bg-card)',
                  color: p === page ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: p === page ? 600 : 400,
                  fontSize: '13px',
                }}
              >
                {p}
              </button>
            )
          )}

        <button
          style={btnStyle(page === totalPages)}
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}