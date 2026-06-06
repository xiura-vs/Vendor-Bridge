/**
 * @file QuotationsPage.jsx
 * @description Quotations management page.
 * VENDORs: submit quotations against invited RFQs.
 * PROCUREMENT_OFFICERs / ADMINs: view all, compare per RFQ, accept or reject.
 * MANAGERs: read-only view.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Eye, CheckCircle, XCircle,
  BarChart2, AlertCircle, DollarSign, RefreshCw,
} from 'lucide-react';
import useAuth from '/src/hooks/useAuth.js';
import { formatDate, formatCurrency } from '../../utils/formatters';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Card from '../../components/ui/Card';

import {
  getQuotationsAPI, compareQuotationsAPI, getQuotationByIdAPI,
  createQuotationAPI, acceptQuotationAPI, rejectQuotationAPI,
} from '../../api/quotation.api';
import { getRFQsAPI, getRFQByIdAPI } from '../../api/rfq.api';

// ─── Constants ──────────────────────────────────────────────────────────────────

const QUOT_COLORS = {
  PENDING:   'gray',
  SUBMITTED: 'blue',
  ACCEPTED:  'green',
  REJECTED:  'red',
  REVISED:   'yellow',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputStyle = (hasError = false) => ({
  width: '100%', padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
  fontSize: '14px', color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
});

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
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = color; } }}
    >
      {icon}
    </button>
  );
}

function FormField({ label, error, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}

const thStyle = {
  padding: '9px 14px', textAlign: 'left', fontWeight: 700,
  color: 'var(--text-secondary)', fontSize: '11px',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  background: 'var(--bg)',
};

const tdStyle = (extra = {}) => ({
  padding: '10px 14px', fontSize: '13px',
  color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
  ...extra,
});

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const quotationSchema = z.object({
  rfq_id:        z.coerce.number().min(1, 'Select an RFQ'),
  notes:         z.string().optional(),
  delivery_days: z.coerce.number().min(1, 'Enter delivery days'),
  validity_days: z.coerce.number().min(1, 'Enter validity days'),
});

// ─── SubmitQuotationModal (VENDOR) ─────────────────────────────────────────────

function SubmitQuotationModal({ open, onClose, onSubmitted, user }) {
  const [rfqs, setRfqs]               = useState([]);
  const [loadingRFQs, setLoadingRFQs] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemPrices, setItemPrices]   = useState({});  // { rfq_item_id: string }
  const [priceErrors, setPriceErrors] = useState({});
  const [submitting, setSubmitting]   = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: zodResolver(quotationSchema),
    defaultValues: { rfq_id: '', notes: '', delivery_days: 7, validity_days: 30 },
  });

  const watchedRFQId = watch('rfq_id');

  // Load published RFQs vendor is invited to
  useEffect(() => {
    if (!open) return;
    setLoadingRFQs(true);
    (async () => {
      try {
        const res = await getRFQsAPI({ status: 'PUBLISHED', limit: 200 });
        setRfqs(res.data?.rfqs || res.data?.data || []);
      } catch {
        toast.error('Failed to load available RFQs');
      } finally {
        setLoadingRFQs(false);
      }
    })();
  }, [open]);

  // Load RFQ items when vendor picks an RFQ
  useEffect(() => {
    const id = parseInt(watchedRFQId);
    if (!id) { setSelectedRFQ(null); setItemPrices({}); return; }
    setLoadingItems(true);
    (async () => {
      try {
        const res = await getRFQByIdAPI(id);
        const rfq = res.data?.rfq || res.data?.data || res.data;
        setSelectedRFQ(rfq);
        const init = {};
        rfq.items?.forEach(item => { init[item.id] = ''; });
        setItemPrices(init);
        setPriceErrors({});
      } catch {
        toast.error('Failed to load RFQ items');
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [watchedRFQId]);

  const grandTotal = selectedRFQ?.items?.reduce((sum, item) => {
    const price = parseFloat(itemPrices[item.id] || 0);
    return sum + price * (item.quantity || 1);
  }, 0) || 0;

  const handleClose = () => {
    reset();
    setSelectedRFQ(null);
    setItemPrices({});
    setPriceErrors({});
    onClose();
  };

  const onSubmit = async (data) => {
    // Validate all item prices
    const errs = {};
    selectedRFQ?.items?.forEach(item => {
      const val = parseFloat(itemPrices[item.id]);
      if (!itemPrices[item.id] || isNaN(val) || val <= 0) {
        errs[item.id] = 'Required';
      }
    });
    if (Object.keys(errs).length > 0) {
      setPriceErrors(errs);
      toast.error('Enter a valid unit price for every item');
      return;
    }

    const payload = {
      rfq_id:        Number(data.rfq_id),
      vendor_id:     user?.vendor_id ?? user?.id,
      notes:         data.notes || '',
      delivery_days: Number(data.delivery_days),
      validity_days: Number(data.validity_days),
      items: selectedRFQ.items.map(item => ({
        rfq_item_id: item.id,
        unit_price:  parseFloat(itemPrices[item.id]),
      })),
    };

    setSubmitting(true);
    try {
      await createQuotationAPI(payload);
      toast.success('Quotation submitted successfully');
      onSubmitted();
      handleClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit quotation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Submit Quotation" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* RFQ select */}
        <FormField label="Select RFQ" error={errors.rfq_id?.message} required>
          <select
            {...register('rfq_id')}
            disabled={loadingRFQs}
            style={{ ...inputStyle(!!errors.rfq_id), cursor: 'pointer' }}
          >
            <option value="">— Choose an RFQ —</option>
            {rfqs.map(r => (
              <option key={r.id} value={r.id}>
                {r.title} (Deadline: {formatDate(r.deadline)})
              </option>
            ))}
          </select>
        </FormField>

        {/* Delivery + validity side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <FormField label="Delivery Days" error={errors.delivery_days?.message} required>
            <input
              {...register('delivery_days')}
              type="number" min="1" placeholder="7"
              style={inputStyle(!!errors.delivery_days)}
            />
          </FormField>
          <FormField label="Validity Days" error={errors.validity_days?.message} required>
            <input
              {...register('validity_days')}
              type="number" min="1" placeholder="30"
              style={inputStyle(!!errors.validity_days)}
            />
          </FormField>
        </div>

        {/* Notes */}
        <FormField label="Notes" error={errors.notes?.message}>
          <textarea
            {...register('notes')}
            placeholder="Optional terms or remarks..."
            rows={2}
            style={{ ...inputStyle(false), resize: 'vertical' }}
          />
        </FormField>

        {/* Items pricing */}
        {loadingItems ? (
          <div style={{ padding: '24px', textAlign: 'center' }}><Spinner size={24} /></div>
        ) : selectedRFQ?.items?.length > 0 && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Item Pricing
            </p>
            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Product', 'Qty', 'Unit', 'Unit Price (₹)', 'Line Total'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedRFQ.items.map((item, i) => {
                    const price = parseFloat(itemPrices[item.id] || 0);
                    const lineTotal = price * (item.quantity || 1);
                    const isLast = i === selectedRFQ.items.length - 1;
                    return (
                      <tr key={item.id}>
                        <td style={{ ...tdStyle(), fontWeight: 600, borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                          {item.product_name}
                        </td>
                        <td style={{ ...tdStyle(), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                          {item.quantity}
                        </td>
                        <td style={{ ...tdStyle(), color: 'var(--text-secondary)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                          {item.unit}
                        </td>
                        <td style={{ padding: '6px 10px', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={itemPrices[item.id] || ''}
                            onChange={e => {
                              setItemPrices(p => ({ ...p, [item.id]: e.target.value }));
                              if (priceErrors[item.id]) setPriceErrors(p => { const n = { ...p }; delete n[item.id]; return n; });
                            }}
                            style={{
                              ...inputStyle(!!priceErrors[item.id]),
                              width: '120px', padding: '6px 10px',
                            }}
                          />
                          {priceErrors[item.id] && (
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--danger)' }}>
                              {priceErrors[item.id]}
                            </p>
                          )}
                        </td>
                        <td style={{ ...tdStyle({ fontWeight: 600, color: lineTotal ? 'var(--text-primary)' : 'var(--text-secondary)' }), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                          {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grand total */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              gap: '12px', marginTop: '10px', padding: '10px 14px',
              borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Grand Total</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Syne, sans-serif' }}>
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
        <button
          onClick={handleClose}
          style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={submitting || !selectedRFQ}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--primary)', color: '#fff',
            cursor: (submitting || !selectedRFQ) ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 600,
            opacity: (submitting || !selectedRFQ) ? 0.7 : 1,
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Quotation'}
        </button>
      </div>
    </Modal>
  );
}

// ─── ViewQuotationModal ────────────────────────────────────────────────────────

function ViewQuotationModal({ quotationId, open, onClose }) {
  const [quot, setQuot]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !quotationId) return;
    setQuot(null);
    setLoading(true);
    (async () => {
      try {
        const res = await getQuotationByIdAPI(quotationId);
        setQuot(res.data?.quotation || res.data?.data || res.data);
      } catch {
        toast.error('Failed to load quotation');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [open, quotationId]);

  const labelStyle = {
    margin: 0, fontSize: '11px', fontWeight: 700,
    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em',
  };
  const valueStyle = { margin: '5px 0 0', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 };

  const grandTotal = quot?.items?.reduce((s, i) => s + (i.total_price ?? (i.unit_price * (i.quantity || 1))), 0) || 0;

  return (
    <Modal open={open} onClose={onClose} title="Quotation Details" size="lg">
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}><Spinner /></div>
      ) : !quot ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={labelStyle}>RFQ</p>
              <p style={valueStyle}>{quot.rfq?.title || `RFQ #${quot.rfq_id}`}</p>
            </div>
            <div>
              <p style={labelStyle}>Vendor</p>
              <p style={valueStyle}>{quot.vendor?.company_name || quot.vendor?.name || '—'}</p>
            </div>
            <div>
              <p style={labelStyle}>Status</p>
              <div style={{ marginTop: '5px' }}>
                <Badge label={quot.status} color={QUOT_COLORS[quot.status] || 'gray'} />
              </div>
            </div>
            <div>
              <p style={labelStyle}>Submitted</p>
              <p style={valueStyle}>{formatDate(quot.created_at)}</p>
            </div>
            <div>
              <p style={labelStyle}>Delivery Days</p>
              <p style={valueStyle}>{quot.delivery_days} days</p>
            </div>
            <div>
              <p style={labelStyle}>Validity Days</p>
              <p style={valueStyle}>{quot.validity_days} days</p>
            </div>
          </div>

          {quot.notes && (
            <div>
              <p style={labelStyle}>Notes</p>
              <p style={{ ...valueStyle, lineHeight: 1.7 }}>{quot.notes}</p>
            </div>
          )}

          {/* Items */}
          {quot.items?.length > 0 && (
            <div>
              <p style={{ ...labelStyle, marginBottom: '10px' }}>Items</p>
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {['Product', 'Qty', 'Unit', 'Unit Price', 'Total'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quot.items.map((item, i) => {
                      const lineTotal = item.total_price ?? (item.unit_price * (item.quantity || 1));
                      const isLast = i === quot.items.length - 1;
                      return (
                        <tr key={item.id || i}>
                          <td style={{ ...tdStyle({ fontWeight: 600 }), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                            {item.product_name || item.rfq_item?.product_name || '—'}
                          </td>
                          <td style={{ ...tdStyle(), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                            {item.quantity ?? item.rfq_item?.quantity ?? '—'}
                          </td>
                          <td style={{ ...tdStyle({ color: 'var(--text-secondary)' }), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                            {item.unit ?? item.rfq_item?.unit ?? '—'}
                          </td>
                          <td style={{ ...tdStyle(), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td style={{ ...tdStyle({ fontWeight: 600 }), borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grand total */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: '12px',
                alignItems: 'center', marginTop: '10px', padding: '10px 14px',
                background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Grand Total</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'Syne, sans-serif' }}>
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// ─── CompareQuotationsModal ────────────────────────────────────────────────────

function CompareQuotationsModal({ open, onClose, onAction }) {
  const [rfqs, setRfqs]               = useState([]);
  const [selectedRFQId, setSelectedRFQId] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [loadingRFQs, setLoadingRFQs] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [acting, setActing]           = useState(null); // quotation id in flight

  // Load RFQs (published or closed — quotations can exist on closed ones too)
  useEffect(() => {
    if (!open) return;
    setLoadingRFQs(true);
    (async () => {
      try {
        const res = await getRFQsAPI({ limit: 200 });
        setRfqs(res.data?.rfqs || res.data?.data || []);
      } catch {
        toast.error('Failed to load RFQs');
      } finally {
        setLoadingRFQs(false);
      }
    })();
  }, [open]);

  // Fetch comparison when RFQ selected
  useEffect(() => {
    if (!selectedRFQId) { setCompareData(null); return; }
    setLoadingCompare(true);
    (async () => {
      try {
        const res = await compareQuotationsAPI(selectedRFQId);
        setCompareData(res.data?.data || res.data);
      } catch {
        toast.error('Failed to load comparison data');
        setCompareData(null);
      } finally {
        setLoadingCompare(false);
      }
    })();
  }, [selectedRFQId]);

  const reloadCompare = async () => {
    if (!selectedRFQId) return;
    try {
      const res = await compareQuotationsAPI(selectedRFQId);
      setCompareData(res.data?.data || res.data);
    } catch { /* silent */ }
  };

  const handleAccept = async (quotId) => {
    setActing(quotId);
    try {
      await acceptQuotationAPI(quotId);
      toast.success('Quotation accepted');
      await reloadCompare();
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Accept failed');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (quotId) => {
    if (!window.confirm('Reject this quotation?')) return;
    setActing(quotId);
    try {
      await rejectQuotationAPI(quotId);
      toast.success('Quotation rejected');
      await reloadCompare();
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Reject failed');
    } finally {
      setActing(null);
    }
  };

  const rfqItems    = compareData?.rfq?.items   || [];
  const quotations  = compareData?.quotations    || [];

  // For each quotation, build a map: rfq_item_id → unit_price
  const priceMap = (quot) => {
    const m = {};
    quot.items?.forEach(qi => { m[qi.rfq_item_id] = qi.unit_price; });
    return m;
  };

  const quotTotal = (quot) =>
    rfqItems.reduce((sum, item) => {
      const pm = priceMap(quot);
      return sum + (pm[item.id] || 0) * (item.quantity || 1);
    }, 0);

  // Best (lowest) total
  const totals = quotations.map(q => quotTotal(q));
  const minTotal = totals.length ? Math.min(...totals) : Infinity;

  const handleClose = () => {
    setSelectedRFQId('');
    setCompareData(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Compare Quotations" size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* RFQ selector */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedRFQId}
            onChange={e => setSelectedRFQId(e.target.value)}
            disabled={loadingRFQs}
            style={{ ...inputStyle(false), maxWidth: '380px', cursor: 'pointer' }}
          >
            <option value="">— Select an RFQ to compare —</option>
            {rfqs.map(r => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          {loadingRFQs && <Spinner size={18} />}
        </div>

        {/* Comparison table */}
        {loadingCompare ? (
          <div style={{ padding: '48px', textAlign: 'center' }}><Spinner /></div>
        ) : !compareData ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <BarChart2 size={36} style={{ color: 'var(--border)', marginBottom: '12px' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              Select an RFQ above to see quotations side by side
            </p>
          </div>
        ) : quotations.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <AlertCircle size={36} style={{ color: 'var(--border)', marginBottom: '12px' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              No quotations submitted for this RFQ yet
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: `${280 + quotations.length * 180}px` }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {/* Row label column */}
                  <th style={{ ...thStyle, width: '200px', position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}>
                    Attribute / Item
                  </th>
                  {quotations.map(q => (
                    <th key={q.id} style={{ ...thStyle, textAlign: 'center', minWidth: '180px' }}>
                      <div>{q.vendor?.company_name || q.vendor?.name || `Vendor #${q.vendor_id}`}</div>
                      <div style={{ marginTop: '4px' }}>
                        <Badge label={q.status} color={QUOT_COLORS[q.status] || 'gray'} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Delivery days */}
                <tr style={{ background: 'var(--bg-card)' }}>
                  <td style={{ ...tdStyle({ fontWeight: 600, color: 'var(--text-secondary)' }), position: 'sticky', left: 0, background: 'var(--bg-card)' }}>
                    Delivery Days
                  </td>
                  {quotations.map(q => (
                    <td key={q.id} style={{ ...tdStyle({ textAlign: 'center' }) }}>
                      {q.delivery_days} days
                    </td>
                  ))}
                </tr>

                {/* Validity days */}
                <tr style={{ background: 'var(--bg)' }}>
                  <td style={{ ...tdStyle({ fontWeight: 600, color: 'var(--text-secondary)' }), position: 'sticky', left: 0, background: 'var(--bg)' }}>
                    Validity Days
                  </td>
                  {quotations.map(q => (
                    <td key={q.id} style={{ ...tdStyle({ textAlign: 'center' }) }}>
                      {q.validity_days} days
                    </td>
                  ))}
                </tr>

                {/* Divider row */}
                <tr>
                  <td
                    colSpan={quotations.length + 1}
                    style={{ padding: '6px 14px', background: 'var(--primary-light)', fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    Item Unit Prices
                  </td>
                </tr>

                {/* One row per RFQ item */}
                {rfqItems.map((item, idx) => {
                  const bg = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg)';
                  return (
                    <tr key={item.id} style={{ background: bg }}>
                      <td style={{ ...tdStyle({ fontWeight: 600 }), position: 'sticky', left: 0, background: bg }}>
                        {item.product_name}
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                          × {item.quantity} {item.unit}
                        </span>
                      </td>
                      {quotations.map(q => {
                        const pm = priceMap(q);
                        const unitPrice = pm[item.id];
                        return (
                          <td key={q.id} style={{ ...tdStyle({ textAlign: 'center' }) }}>
                            {unitPrice != null ? (
                              <>
                                <span style={{ fontWeight: 600 }}>{formatCurrency(unitPrice)}</span>
                                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  Total: {formatCurrency(unitPrice * (item.quantity || 1))}
                                </span>
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Grand totals */}
                <tr style={{ background: 'var(--primary-light)', borderTop: '2px solid var(--primary)30' }}>
                  <td style={{ ...tdStyle({ fontWeight: 700, color: 'var(--primary)' }), position: 'sticky', left: 0, background: 'var(--primary-light)' }}>
                    Grand Total
                  </td>
                  {quotations.map((q, idx) => {
                    const total = totals[idx];
                    const isBest = total === minTotal && quotations.filter((_, i) => totals[i] === minTotal).length === 1;
                    return (
                      <td key={q.id} style={{ ...tdStyle({ textAlign: 'center', fontWeight: 700, color: isBest ? 'var(--success)' : 'var(--text-primary)', fontSize: '15px' }) }}>
                        {formatCurrency(total)}
                        {isBest && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--success)', fontWeight: 600 }}>
                            ★ LOWEST
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Accept / Reject actions */}
                <tr style={{ background: 'var(--bg-card)' }}>
                  <td style={{ ...tdStyle({ fontWeight: 700, color: 'var(--text-secondary)' }), position: 'sticky', left: 0, background: 'var(--bg-card)' }}>
                    Actions
                  </td>
                  {quotations.map(q => (
                    <td key={q.id} style={{ ...tdStyle({ textAlign: 'center' }), borderBottom: 'none' }}>
                      {q.status === 'SUBMITTED' ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleAccept(q.id)}
                            disabled={!!acting}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                              border: 'none', background: 'var(--success)', color: '#fff',
                              cursor: acting ? 'not-allowed' : 'pointer',
                              fontWeight: 600, fontSize: '12px', opacity: acting ? 0.7 : 1,
                            }}
                          >
                            <CheckCircle size={12} /> Accept
                          </button>
                          <button
                            onClick={() => handleReject(q.id)}
                            disabled={!!acting}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--danger)', background: '#fef2f2',
                              color: 'var(--danger)', cursor: acting ? 'not-allowed' : 'pointer',
                              fontWeight: 600, fontSize: '12px', opacity: acting ? 0.7 : 1,
                            }}
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <Badge label={q.status} color={QUOT_COLORS[q.status] || 'gray'} />
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleClose}
          style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// ─── QuotationsPage (main export) ─────────────────────────────────────────────

export default function QuotationsPage() {
  const { isAdmin, isOfficer, isManager, isVendor, user } = useAuth();

  // Data
  const [quotations, setQuotations] = useState([]);
  const [rfqList, setRfqList]       = useState([]);   // for rfq_id filter dropdown
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [rfqFilter, setRfqFilter]       = useState('');
  const [page, setPage]                 = useState(1);
  const limit = 10;

  // Modals
  const [showSubmit, setShowSubmit]     = useState(false);
  const [showCompare, setShowCompare]   = useState(false);
  const [viewQuotId, setViewQuotId]     = useState(null);

  // Refresh key
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  // Load RFQ list for filter dropdown (once)
  useEffect(() => {
    (async () => {
      try {
        const res = await getRFQsAPI({ limit: 200 });
        setRfqList(res.data?.rfqs || res.data?.data || []);
      } catch { /* non-critical */ }
    })();
  }, []);

  // Fetch quotations
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getQuotationsAPI({
          status:  statusFilter || undefined,
          rfq_id:  rfqFilter    || undefined,
          page,
          limit,
        });
        if (cancelled) return;
        const d = res.data;
        setQuotations(d?.quotations || d?.data || []);
        setTotal(d?.total || d?.count || 0);
      } catch {
        if (!cancelled) toast.error('Failed to load quotations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [statusFilter, rfqFilter, page, refreshKey]);

  const handleStatusFilter = (v) => { setStatusFilter(v); setPage(1); };
  const handleRfqFilter    = (v) => { setRfqFilter(v);    setPage(1); };

  const totalPages  = Math.ceil(total / limit);
  const canCompare  = isAdmin || isOfficer;
  const canSubmit   = isVendor;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            Quotations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {isVendor ? 'Submit and track your quotations' : 'Review and compare vendor quotations'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {canCompare && (
            <button
              onClick={() => setShowCompare(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)', background: 'var(--primary-light)',
                color: 'var(--primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              }}
            >
              <BarChart2 size={15} /> Compare
            </button>
          )}
          {canSubmit && (
            <button
              onClick={() => setShowSubmit(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                border: 'none', background: 'var(--primary)', color: '#fff',
                cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <Plus size={15} /> Submit Quotation
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: '14px 18px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* RFQ filter */}
          <select
            value={rfqFilter}
            onChange={e => handleRfqFilter(e.target.value)}
            style={{ ...inputStyle(false), flex: '1 1 220px', cursor: 'pointer' }}
          >
            <option value="">All RFQs</option>
            {rfqList.map(r => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => handleStatusFilter(e.target.value)}
            style={{ ...inputStyle(false), width: '180px', cursor: 'pointer' }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="REVISED">Revised</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center' }}><Spinner /></div>
        ) : quotations.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <DollarSign size={40} style={{ color: 'var(--border)', marginBottom: '14px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No quotations found
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {isVendor
                ? 'Submit a quotation for a published RFQ to get started.'
                : 'Quotations from vendors will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['RFQ', 'Vendor', 'Status', 'Total', 'Delivery', 'Validity', 'Submitted', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q, i) => (
                    <tr
                      key={q.id}
                      style={{ borderBottom: i < quotations.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--bg-card)', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, maxWidth: '200px' }}>
                        <span title={q.rfq?.title} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                          {q.rfq?.title || `RFQ #${q.rfq_id}`}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {q.vendor?.company_name || q.vendor?.name || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge label={q.status} color={QUOT_COLORS[q.status] || 'gray'} />
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {q.total != null ? formatCurrency(q.total) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {q.delivery_days} days
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {q.validity_days} days
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(q.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <ActionBtn
                            icon={<Eye size={13} />}
                            title="View details"
                            color="var(--primary)"
                            onClick={() => setViewQuotId(q.id)}
                          />
                          {/* Quick accept/reject for officers in the table */}
                          {canCompare && q.status === 'SUBMITTED' && (
                            <>
                              <ActionBtn
                                icon={<CheckCircle size={13} />}
                                title="Accept"
                                color="var(--success)"
                                onClick={async () => {
                                  try {
                                    await acceptQuotationAPI(q.id);
                                    toast.success('Quotation accepted');
                                    refresh();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.message || 'Accept failed');
                                  }
                                }}
                              />
                              <ActionBtn
                                icon={<XCircle size={13} />}
                                title="Reject"
                                color="var(--danger)"
                                onClick={async () => {
                                  if (!window.confirm('Reject this quotation?')) return;
                                  try {
                                    await rejectQuotationAPI(q.id);
                                    toast.success('Quotation rejected');
                                    refresh();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.message || 'Reject failed');
                                  }
                                }}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modals */}
      <SubmitQuotationModal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        onSubmitted={refresh}
        user={user}
      />

      <ViewQuotationModal
        quotationId={viewQuotId}
        open={!!viewQuotId}
        onClose={() => setViewQuotId(null)}
      />

      <CompareQuotationsModal
        open={showCompare}
        onClose={() => setShowCompare(false)}
        onAction={refresh}
      />
    </div>
  );
}