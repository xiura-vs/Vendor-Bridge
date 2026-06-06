// src/pages/invoices/InvoicesPage.jsx
/**
 * InvoicesPage — VendorBridge ERP
 * ADMIN / PROCUREMENT_OFFICER : view, update status, send email, download PDF
 * MANAGER                     : read-only
 * VENDOR                      : own invoices (read + download)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Eye, Download, Mail, ChevronDown,
  ReceiptText, CheckCircle, XCircle, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';

import useAuth from '../../hooks/useAuth';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';

import {
  getInvoicesAPI,
  getInvoiceByIdAPI,
  updateInvoiceStatusAPI,
  sendInvoiceAPI,
  getInvoicePdfUrl,
} from '../../api/invoice.api';

// ─── Status maps ──────────────────────────────────────────────────────────────
const INV_COLORS = {
  DRAFT:     'gray',
  SENT:      'blue',
  PAID:      'green',
  OVERDUE:   'red',
  CANCELLED: 'red',
};

// Which status transitions are allowed and by whom
const STATUS_ACTIONS = [
  { from: 'DRAFT',  label: 'Mark Sent',      next: 'SENT',      color: 'var(--primary)',  icon: <Send size={13} />,        rolesAllowed: ['admin', 'officer'] },
  { from: 'SENT',   label: 'Mark Paid',       next: 'PAID',      color: 'var(--success)',  icon: <CheckCircle size={13} />, rolesAllowed: ['admin', 'officer'] },
  { from: 'SENT',   label: 'Mark Overdue',    next: 'OVERDUE',   color: 'var(--warning)',  icon: <XCircle size={13} />,     rolesAllowed: ['admin', 'officer'] },
  { from: 'OVERDUE',label: 'Mark Paid',       next: 'PAID',      color: 'var(--success)',  icon: <CheckCircle size={13} />, rolesAllowed: ['admin', 'officer'] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ActionBtn({ icon, title, color, onClick, disabled }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '28px', height: '28px', borderRadius: '6px',
        border: `1px solid ${color}30`, background: `${color}10`,
        color, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = color; } }}
    >
      {icon}
    </button>
  );
}

const inputStyle = () => ({
  width: '100%', padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  fontSize: '14px', color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
});

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius)',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
      padding: '18px 22px', flex: 1, minWidth: '120px',
    }}>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color }}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { isAdmin, isManager, isOfficer, isVendor } = useAuth();
  const canAct   = isAdmin || isOfficer;
  const readOnly = isManager;

  // list state
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const LIMIT = 10;

  // filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPoId,   setFilterPoId]   = useState('');

  // modals
  const [viewModal,  setViewModal]  = useState(null);
  const [actioning,  setActioning]  = useState(false);  // status update / send
  const [sending,    setSending]    = useState(false);

  // ── Load invoices ──
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      if (filterPoId)   params.po_id  = filterPoId;
      const res = await getInvoicesAPI(params);
      const d = res.data;
      setInvoices(d?.invoices || d?.data || []);
      setTotal(d?.total || 0);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPoId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // ── Derived stats ──
  const counts = Object.keys(INV_COLORS).reduce((acc, s) => {
    acc[s] = invoices.filter(i => i.status === s).length;
    return acc;
  }, {});

  const totalPaid    = invoices.filter(i => i.status === 'PAID').reduce((s, i)    => s + (parseFloat(i.total_amount) || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);

  // ── Open detail ──
  const openView = async (id) => {
    try {
      const res = await getInvoiceByIdAPI(id);
      setViewModal(res.data?.invoice || res.data);
    } catch {
      toast.error('Failed to load invoice details');
    }
  };

  // ── Status transition ──
  const handleStatusUpdate = async (invoice, nextStatus) => {
    setActioning(true);
    try {
      await updateInvoiceStatusAPI(invoice.id, nextStatus);
      toast.success(`Invoice marked as ${nextStatus.toLowerCase()}`);
      loadInvoices();
      if (viewModal?.id === invoice.id) {
        const res = await getInvoiceByIdAPI(invoice.id);
        setViewModal(res.data?.invoice || res.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed');
    } finally {
      setActioning(false);
    }
  };

  // ── Send invoice email ──
  const handleSend = async (invoice) => {
    setSending(true);
    try {
      await sendInvoiceAPI(invoice.id);
      toast.success('Invoice sent to vendor successfully');
      loadInvoices();
      if (viewModal?.id === invoice.id) {
        const res = await getInvoiceByIdAPI(invoice.id);
        setViewModal(res.data?.invoice || res.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  // ── Download PDF ──
  const handleDownload = (id) => {
    window.open(getInvoicePdfUrl(id), '_blank', 'noopener,noreferrer');
  };

  // ── Get available transitions for an invoice ──
  const getActions = (inv) => {
    if (!canAct) return [];
    return STATUS_ACTIONS.filter(a => a.from === inv.status);
  };

  // ── Monetary calculations ──
  const calcTax      = (inv) => parseFloat(inv.tax_amount)      || (parseFloat(inv.subtotal) * (parseFloat(inv.tax_rate) || 0) / 100) || 0;
  const calcSubtotal = (inv) => parseFloat(inv.subtotal)        || (parseFloat(inv.total_amount) - calcTax(inv)) || 0;
  const calcTotal    = (inv) => parseFloat(inv.total_amount)    || (calcSubtotal(inv) + calcTax(inv)) || 0;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Invoices
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {isVendor ? 'Track invoices for your purchase orders' : 'Manage and process vendor invoices'}
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard label='Draft'     value={counts.DRAFT     ?? 0} color='var(--text-secondary)' />
        <StatCard label='Sent'      value={counts.SENT      ?? 0} color='var(--primary)'        />
        <StatCard label='Paid'      value={counts.PAID      ?? 0} color='var(--success)'        />
        <StatCard label='Overdue'   value={counts.OVERDUE   ?? 0} color='var(--danger)'         />
        <StatCard label='Cancelled' value={counts.CANCELLED ?? 0} color='var(--text-secondary)' />
      </div>

      {/* ── Value summary strip ── */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Paid (this page)</p>
          <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700, color: 'var(--success)', fontFamily: 'Syne, sans-serif' }}>{formatCurrency(totalPaid)}</p>
        </div>
        <div style={{ flex: 1, minWidth: '180px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Overdue (this page)</p>
          <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700, color: 'var(--danger)', fontFamily: 'Syne, sans-serif' }}>{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            style={{ ...inputStyle(), width: '170px', appearance: 'none', paddingRight: '30px', cursor: 'pointer' }}
          >
            <option value=''>All Statuses</option>
            {Object.keys(INV_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
        </div>

        <input
          type='text'
          placeholder='Filter by PO ID…'
          value={filterPoId}
          onChange={e => { setFilterPoId(e.target.value); setPage(1); }}
          style={{ ...inputStyle(), width: '180px' }}
        />
      </div>

      {/* ── Table card ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {loading ? (
          <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
            <ReceiptText size={40} strokeWidth={1.2} />
            <p style={{ margin: 0, fontSize: '15px' }}>No invoices found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Invoice No.', 'Vendor', 'PO', 'Subtotal', 'Tax', 'Total', 'Status', 'Due Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => {
                const actions = getActions(inv);
                return (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{(page - 1) * LIMIT + idx + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {inv.invoice_number || `INV-${inv.id}`}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{inv.vendor?.company_name || inv.vendor?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {inv.purchase_order?.po_number || (inv.po_id ? `PO-${inv.po_id}` : '—')}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{formatCurrency(calcSubtotal(inv))}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{formatCurrency(calcTax(inv))}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(calcTotal(inv))}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={INV_COLORS[inv.status] || 'gray'} text={inv.status} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: inv.status === 'OVERDUE' ? 'var(--danger)' : 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: inv.status === 'OVERDUE' ? 600 : 400 }}>
                      {inv.due_date ? formatDate(inv.due_date) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <ActionBtn icon={<Eye size={13} />}      title='View'     color='var(--primary)' onClick={() => openView(inv.id)} />
                        <ActionBtn icon={<Download size={13} />} title='Download PDF' color='var(--text-secondary)' onClick={() => handleDownload(inv.id)} />
                        {canAct && inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                          <ActionBtn icon={<Mail size={13} />} title='Send Email' color='var(--accent)' disabled={sending} onClick={() => handleSend(inv)} />
                        )}
                        {actions.map(a => (
                          <ActionBtn
                            key={a.next}
                            icon={a.icon}
                            title={a.label}
                            color={a.color}
                            disabled={actioning}
                            onClick={() => handleStatusUpdate(inv, a.next)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {total > LIMIT && (
        <div style={{ marginTop: '16px' }}>
          <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Invoice Detail
      ══════════════════════════════════════════════════════════════════════ */}
      {viewModal && (
        <Modal title='Invoice Details' onClose={() => setViewModal(null)} width='680px'>

          {/* Invoice header band */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '22px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invoice Number</p>
              <p style={{ margin: '3px 0 0', fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
                {viewModal.invoice_number || `INV-${viewModal.id}`}
              </p>
            </div>
            <Badge color={INV_COLORS[viewModal.status] || 'gray'} text={viewModal.status} />
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: '22px' }}>
            <DetailRow label='Vendor'       value={viewModal.vendor?.company_name || viewModal.vendor?.name} />
            <DetailRow label='Vendor Email' value={viewModal.vendor?.email} />
            <DetailRow label='Purchase Order' value={viewModal.purchase_order?.po_number || (viewModal.po_id ? `PO-${viewModal.po_id}` : undefined)} />
            <DetailRow label='Issue Date'   value={formatDate(viewModal.created_at)} />
            <DetailRow label='Due Date'     value={viewModal.due_date ? formatDate(viewModal.due_date) : undefined} />
            <DetailRow label='Payment Date' value={viewModal.paid_at  ? formatDate(viewModal.paid_at)  : undefined} />
          </div>

          {/* Line items */}
          {(viewModal.items || []).length > 0 && (
            <>
              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Line Items</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewModal.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{it.description || it.product_name || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{it.quantity}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{formatCurrency(it.unit_price)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(it.total_price ?? (it.unit_price * it.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Tax breakdown card */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '22px' }}>
            {[
              { label: 'Subtotal',                   value: formatCurrency(calcSubtotal(viewModal)),  bold: false },
              { label: `Tax ${viewModal.tax_rate ? `(${viewModal.tax_rate}%)` : ''}`, value: formatCurrency(calcTax(viewModal)), bold: false },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: row.bold ? 700 : 400 }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--primary-light)' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}>Total</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Syne, sans-serif' }}>{formatCurrency(calcTotal(viewModal))}</span>
            </div>
          </div>

          {/* Notes */}
          {viewModal.notes && (
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '22px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{viewModal.notes}</p>
            </div>
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)', gap: '10px', flexWrap: 'wrap' }}>
            {/* Left — PDF + Send */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleDownload(viewModal.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                <Download size={14} /> Download PDF
              </button>
              {canAct && viewModal.status !== 'PAID' && viewModal.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleSend(viewModal)}
                  disabled={sending}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: sending ? 0.7 : 1 }}
                >
                  <Mail size={14} /> {sending ? 'Sending…' : 'Send Email'}
                </button>
              )}
            </div>

            {/* Right — Status transitions */}
            {canAct && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {getActions(viewModal).map(a => (
                  <button
                    key={a.next}
                    onClick={() => handleStatusUpdate(viewModal, a.next)}
                    disabled={actioning}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: a.color, color: '#fff', cursor: actioning ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: actioning ? 0.7 : 1 }}
                  >
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}