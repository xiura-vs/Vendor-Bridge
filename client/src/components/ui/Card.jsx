/**
 * Card.jsx
 * Reusable white card container used across all pages.
 * Supports title, subtitle, optional action button in header, and padding control.
 */

/**
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   action?: React.ReactNode,
 *   children: React.ReactNode,
 *   padding?: string,
 *   style?: object
 * }} props
 */
export default function Card({ title, subtitle, action, children, padding = '24px', style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Card Header — only renders if title or action provided */}
      {(title || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            {title && (
              <h2 style={{
                margin: 0,
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '15px',
                color: 'var(--text-primary)',
              }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p style={{
                margin: '2px 0 0',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      {/* Card Body */}
      <div style={{ padding }}>
        {children}
      </div>
    </div>
  );
}