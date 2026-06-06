/**
 * Table.jsx
 * Reusable table component with hover states, loading skeleton,
 * empty state, and consistent styling across all list pages.
 */

import Spinner from './Spinner';
import { Inbox } from 'lucide-react';

/**
 * @param {{
 *   columns: Array<{ key: string, label: string, width?: string, render?: (row) => ReactNode }>,
 *   data: object[],
 *   loading?: boolean,
 *   emptyMessage?: string,
 *   onRowClick?: (row: object) => void,
 * }} props
 */
export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found.',
  onRowClick,
}) {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
        color: 'var(--text-primary)',
      }}>
        {/* Table Head */}
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  width: col.width || 'auto',
                  background: 'var(--bg)',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {loading ? (
            // Loading skeleton rows
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '14px 16px' }}>
                    <div style={{
                      height: '14px',
                      borderRadius: '6px',
                      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      width: `${60 + Math.random() * 30}%`,
                    }} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            // Empty state
            <tr>
              <td colSpan={columns.length}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  color: 'var(--text-secondary)',
                  gap: '12px',
                }}>
                  <Inbox size={36} strokeWidth={1.5} color="var(--border)" />
                  <p style={{ margin: 0, fontSize: '14px' }}>{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => {
                  if (onRowClick) e.currentTarget.style.background = 'var(--bg)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 16px',
                      verticalAlign: 'middle',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}