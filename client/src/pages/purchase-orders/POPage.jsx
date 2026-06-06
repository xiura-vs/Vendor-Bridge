// src/pages/purchase-orders/POPage.jsx
/**
 * POPage — VendorBridge ERP
 * ADMIN / PROCUREMENT_OFFICER : view, update status
 * MANAGER                     : read-only
 * VENDOR                      : own POs only (read + acknowledge)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList, Eye, ChevronDown, ArrowRight,
  PackageSearch, CheckCheck, Send, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import useAuth from '../../hooks/useAuth';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';

import { getPurchaseOrdersAPI, getPurchaseOrderByIdAPI, updatePOStatusAPI } from '../../api/po.api';
import { getVendorsAPI } from '../../api/vendor.api';

// ─── Status maps ──────────────────────────────────────────────────────────────
const PO_COLORS = {
  DRAFT:        'gray',
  ISSUED:       'blue',
  ACKNOWLEDGED: 'yellow',
  COMPLETED:    'green',
  CANCELLED:    'red',
};

// Status machine: what button to show and what status it transitions to
const TRANSITIONS = {
  DRAFT:        { label: 'Issue',       icon: <Send size={13} />,      next: 'ISSUED',       color: 'var(--primary)' },
  ISSUED:       { label: 'Acknowledge', icon: <CheckCheck size={13} />, next: 'ACKNOWLEDGED', color: 'var(--warning)' },
  ACKNOWLEDGED: { label: 'Complete',    icon: <CheckCheck size={13} />, next: 'COMPLETED',    color: 'var(--success)' },
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
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

// ─── Detail section label ─────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function POPage() {
  const { isAdmin, isManager, isOfficer, isVendor } = useAuth();
  const canTransition = isAdmin || isOfficer || isVendor;
  const readOnly      = isManager;

  // list state
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const LIMIT = 10;

  // filters
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterVendorId, setFilterVendorId] = useState('');

  // vendors for filter dropdown
  const [vendors, setVendors] = useState([]);

  // modals
  const [viewModal,    setViewModal]    = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  // ── Load vendors once ──
  useEffect(() => {
    (async () => {
      try {
        const res = await getVendorsAPI({ limit: 100 });
        setVendors(res.data?.vendors || res.data?.data || []);
      } catch { /* silent */ }
    })();
  }, []);

  // ── Load POs ──
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus)   params.status    = filterStatus;
      if (filterVendorId) params.vendor_id = filterVendorId;
      const res = await getPurchaseOrdersAPI(params);
      const d = res.data;
      setOrders(d?.purchase_orders || d?.purchaseOrders || d?.data || []);
      setTotal(d?.total || 0);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterVendorId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // ── Derived stats ──
  const counts = Object.keys(PO_COLORS).reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {});

  // ── Open detail modal ──
  const openView = async (id) => {
    try {
      const res = await getPurchaseOrderByIdAPI(id);
      setViewModal(res.data?.purchase_order || res.data?.purchaseOrder || res.data);
    } catch {
      toast.error('Failed to load PO details');
    }
  };

  // ── Status transition ──
  const handleTransition = async (po, nextStatus) => {
    // Vendor can only ACKNOWLEDGE (ISSUED → ACKNOWLEDGED)
    if (isVendor && nextStatus !== 'ACKNOWLEDGED') return;

    setTransitioning(true);
    try {
      await updatePOStatusAPI(po.id, nextStatus);
      toast.success(`PO marked as ${nextStatus.toLowerCase()}`);
      loadOrders();
      // refresh view modal if open
      if (viewModal?.id === po.id) {
        const res = await getPurchaseOrderByIdAPI(po.id);
        setViewModal(res.data?.purchase_order || res.data?.purchaseOrder || res.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed');
    } finally {
      setTransitioning(false);
    }
  };

  // ── Can this role trigger this transition? ──
  const canDoTransition = (po) => {
    if (readOnly) return false;
    if (!TRANSITIONS[po.status]) return false;
    const next = TRANSITIONS[po.status].next;
    if (isVendor && next !== 'ACKNOWLEDGED') return false;
    return true;
  };

  // ── Grand total from quotation items ──
  const grandTotal = (items = []) =>
    items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Purchase Orders
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {isVendor ? 'Track POs assigned to you' : 'Manage and track all purchase orders'}
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {Object.entries(PO_COLORS).map(([status, color]) => (
          <StatCard key={status} label={status} value={counts[status] ?? 0} color={`var(--${color === 'gray' ? 'text-secondary' : color === 'blue' ? 'primary' : color === 'yellow' ? 'warning' : color === 'green' ? 'success' : 'danger'})`} />
        ))}
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
            {Object.keys(PO_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
        </div>

        {!isVendor && (
          <div style={{ position: 'relative' }}>
            <select
              value={filterVendorId}
              onChange={e => { setFilterVendorId(e.target.value); setPage(1); }}
              style={{ ...inputStyle(), width: '220px', appearance: 'none', paddingRight: '30px', cursor: 'pointer' }}
            >
              <option value=''>All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name || v.name}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </div>
        )}
      </div>

      {/* ── Table card ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {loading ? (
          <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
            <PackageSearch size={40} strokeWidth={1.2} />
            <p style={{ margin: 0, fontSize: '15px' }}>No purchase orders found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'PO Number', 'Vendor', 'RFQ', 'Total Value', 'Status', 'Issued On', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((po, idx) => {
                const transition = TRANSITIONS[po.status];
                const allowed    = canDoTransition(po);
                return (
                  <tr
                    key={po.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{(page - 1) * LIMIT + idx + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{po.po_number || `PO-${po.id}`}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{po.vendor?.company_name || po.vendor?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{po.quotation?.rfq?.title || po.rfq?.title || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(po.total_amount ?? grandTotal(po.quotation?.items))}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={PO_COLORS[po.status] || 'gray'} text={po.status} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(po.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <ActionBtn icon={<Eye size={13} />} title='View Details' color='var(--primary)' onClick={() => openView(po.id)} />
                        {transition && allowed && (
                          <ActionBtn
                            icon={transition.icon}
                            title={transition.label}
                            color={transition.color}
                            disabled={transitioning}
                            onClick={() => handleTransition(po, transition.next)}
                          />
                        )}
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
          MODAL: PO Detail
      ══════════════════════════════════════════════════════════════════════ */}
      {viewModal && (
        <Modal title='Purchase Order Details' onClose={() => setViewModal(null)} width='700px'>

          {/* PO header band */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', marginBottom: '22px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PO Number</p>
              <p style={{ margin: '3px 0 0', fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--primary)', letterSpacing: '0.03em' }}>
                {viewModal.po_number || `PO-${viewModal.id}`}
              </p>
            </div>
            <Badge color={PO_COLORS[viewModal.status] || 'gray'} text={viewModal.status} />
          </div>

          {/* Grid of info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: '22px' }}>
            <DetailRow label='Vendor'       value={viewModal.vendor?.company_name || viewModal.vendor?.name} />
            <DetailRow label='Vendor Email' value={viewModal.vendor?.email} />
            <DetailRow label='RFQ'          value={viewModal.quotation?.rfq?.title || viewModal.rfq?.title} />
            <DetailRow label='Quotation #'  value={viewModal.quotation_id ? `#${viewModal.quotation_id}` : undefined} />
            <DetailRow label='Issued On'    value={formatDateTime(viewModal.created_at)} />
            <DetailRow label='Delivery Days' value={viewModal.quotation?.delivery_days ? `${viewModal.quotation.delivery_days} days` : undefined} />
          </div>

          {/* Terms / notes */}
          {viewModal.terms && (
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '22px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Terms & Conditions</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{viewModal.terms}</p>
            </div>
          )}

          {/* Line items */}
          {(viewModal.quotation?.items || viewModal.items || []).length > 0 && (
            <>
              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Line Items</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '22px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Product', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(viewModal.quotation?.items || viewModal.items || []).map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>{it.rfq_item?.product_name || it.product_name || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{it.rfq_item?.quantity || it.quantity}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{it.rfq_item?.unit || it.unit || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{formatCurrency(it.unit_price)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(it.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Grand Total</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: '15px', color: 'var(--primary)' }}>
                      {formatCurrency(viewModal.total_amount ?? grandTotal(viewModal.quotation?.items || viewModal.items))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {/* Status pipeline visualiser */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '22px', flexWrap: 'wrap' }}>
            {['DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'COMPLETED'].map((s, i, arr) => {
              const statuses   = ['DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'];
              const currentIdx = statuses.indexOf(viewModal.status);
              const thisIdx    = statuses.indexOf(s);
              const done       = currentIdx >= thisIdx;
              const active     = viewModal.status === s;
              return (
                <>
                  <div key={s} style={{
                    padding: '5px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                    background: active ? 'var(--primary)' : done ? 'var(--primary-light)' : 'var(--bg)',
                    color: active ? '#fff' : done ? 'var(--primary)' : 'var(--text-secondary)',
                    border: `1px solid ${active ? 'var(--primary)' : done ? 'var(--primary)' : 'var(--border)'}`,
                  }}>{s}</div>
                  {i < arr.length - 1 && <ArrowRight size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                </>
              );
            })}
            {viewModal.status === 'CANCELLED' && (
              <div style={{ marginLeft: '6px', padding: '5px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, background: '#fef2f2', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                CANCELLED
              </div>
            )}
          </div>

          {/* Action buttons */}
          {canDoTransition(viewModal) && TRANSITIONS[viewModal.status] && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => handleTransition(viewModal, TRANSITIONS[viewModal.status].next)}
                disabled={transitioning}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 22px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: TRANSITIONS[viewModal.status].color,
                  color: '#fff', cursor: transitioning ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600, opacity: transitioning ? 0.7 : 1,
                }}
              >
                {TRANSITIONS[viewModal.status].icon}
                {transitioning ? 'Updating…' : TRANSITIONS[viewModal.status].label}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}