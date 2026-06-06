import { forwardRef } from 'react';

const Input = forwardRef(function Input({
  label, error, type = 'text', placeholder, required,
  icon, hint, ...props
}, ref) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
          }}>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: icon ? '11px 14px 11px 38px' : '11px 14px',
            border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            color: 'var(--text-primary)',
            background: '#fff',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = error ? 'var(--danger)' : 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border)'}
          {...props}
        />
      </div>
      {hint && !error && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
});

export default Input;