export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

export const formatDate = (date) =>
  date ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date)) : '—';

export const formatDateTime = (date) =>
  date ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date)) : '—';

export const truncate = (str, n = 40) =>
  str && str.length > n ? str.slice(0, n) + '...' : str;