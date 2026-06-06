const colorMap = {
  blue:   { bg: '#dbeafe', text: '#1d4ed8' },
  green:  { bg: '#d1fae5', text: '#065f46' },
  red:    { bg: '#fee2e2', text: '#991b1b' },
  yellow: { bg: '#fef3c7', text: '#92400e' },
  gray:   { bg: '#f1f5f9', text: '#475569' },
  purple: { bg: '#ede9fe', text: '#5b21b6' },
};

export default function Badge({ label, color = 'gray' }) {
  const c = colorMap[color] || colorMap.gray;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}