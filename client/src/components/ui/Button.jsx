import Spinner from './Spinner';

const variants = {
  primary:  { background: 'var(--primary)', color: '#fff', border: 'none' },
  secondary:{ background: 'var(--bg)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' },
  danger:   { background: 'var(--danger)', color: '#fff', border: 'none' },
  ghost:    { background: 'transparent', color: 'var(--primary)', border: 'none' },
};

export default function Button({
  children, variant = 'primary', loading = false,
  disabled = false, fullWidth = false, size = 'md',
  onClick, type = 'button', style = {},
}) {
  const sizes = { sm: '8px 14px', md: '10px 20px', lg: '13px 28px' };
  const fontSizes = { sm: 13, md: 14, lg: 15 };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        padding: sizes[size],
        fontSize: fontSizes[size],
        fontWeight: 600,
        borderRadius: 'var(--radius-sm)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.65 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'center',
        width: fullWidth ? '100%' : 'auto',
        transition: 'all 0.15s ease',
        ...style,
      }}
    >
      {loading && <Spinner size={14} color={variant === 'primary' ? '#fff' : 'var(--primary)'} />}
      {children}
    </button>
  );
}