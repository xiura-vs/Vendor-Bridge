// src/pages/approvals/ApprovalsPage.jsx
/**
 * ApprovalsPage — VendorBridge ERP
 * PROCUREMENT_OFFICER : request approvals
 * MANAGER / ADMIN     : resolve (approve / reject) approvals
 * All roles           : read-only table view
 */

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Plus, Eye, CheckCircle, XCircle, ChevronDown, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import useAuth from '../../hooks/useAuth';
import { formatDate, formatDateTime } from '../../utils/formatters';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';

import { getApprovalsAPI, getApprovalByIdAPI, createApprovalAPI, resolveApprovalAPI } from '../../api/approval.api';
import { getRFQsAPI } from '../../api/rfq.api';
import { getQuotationsAPI } from '../../api/quotation.api';

// ─── Status colour map ────────────────────────────────────────────────────────
const APPR_COLORS = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' };

// ─── Reusable tiny components ─────────────────────────────────────────────────
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

function FormField({ label, error, children, hint }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && !error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{hint}</p>}
      {error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}

const inputStyle = (hasError = false) => ({
  width: '100%', padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
  fontSize: '14px', color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
});

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const requestSchema = z.object({
  rfq_id:       z.string().min(1, 'RFQ is required'),
  quotation_id: z.string().optional(),
  remarks:      z.string().min(3, 'Remarks are required'),
});

const resolveSchema = z.object({
  status:  z.enum(['APPROVED', 'REJECTED'], { required_error: 'Decision is required' }),
  remarks: z.string().min(3, 'Remarks are required'),
});

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)', padding: '18px 22px', flex: 1, minWidth: '130px',
    }}>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color }}>{value}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const { isAdmin, isManager, isOfficer } = useAuth();
  const canRequest = isOfficer || isAdmin;
  const canResolve = isManager || isAdmin;

  // list state
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const LIMIT = 10;

  // filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRfqId,  setFilterRfqId]  = useState('');

  // dropdown data
  const [rfqs,       setRfqs]       = useState([]);
  const [quotations, setQuotations] = useState([]);

  // modals
  const [viewModal,    setViewModal]    = useState(null);   // approval object
  const [requestModal, setRequestModal] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);   // approval object

  const [submitting, setSubmitting] = useState(false);

  // forms
  const requestForm = useForm({ resolver: zodResolver(requestSchema), defaultValues: { rfq_id: '', quotation_id: '', remarks: '' } });
  const resolveForm = useForm({ resolver: zodResolver(resolveSchema), defaultValues: { status: '', remarks: '' } });

  const watchedRfqId = requestForm.watch('rfq_id');

  // ── Load RFQs once ──
  useEffect(() => {
    (async () => {
      try {
        const res = await getRFQsAPI({ limit: 100 });
        setRfqs(res.data?.rfqs || res.data?.data || []);
      } catch { /* silent */ }
    })();
  }, []);

  // ── Load quotations when RFQ changes in request form ──
  useEffect(() => {
    if (!watchedRfqId) { setQuotations([]); return; }
    (async () => {
      try {
        const res = await getQuotationsAPI({ rfq_id: watchedRfqId, limit: 50 });
        setQuotations(res.data?.quotations || res.data?.data || []);
      } catch { /* silent */ }
    })();
  }, [watchedRfqId]);

  // ── Load approvals ──
  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      if (filterRfqId)  params.rfq_id = filterRfqId;
      const res = await getApprovalsAPI(params);
      const d = res.data;
      setApprovals(d?.approvals || d?.data || []);
      setTotal(d?.total || 0);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterRfqId]);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  // ── Derived stats ──
  const stats = {
    PENDING:  approvals.filter(a => a.status === 'PENDING').length,
    APPROVED: approvals.filter(a => a.status === 'APPROVED').length,
    REJECTED: approvals.filter(a => a.status === 'REJECTED').length,
  };

  // ── Open view detail ──
  const openView = async (id) => {
    try {
      const res = await getApprovalByIdAPI(id);
      setViewModal(res.data?.approval || res.data);
    } catch {
      toast.error('Failed to load approval details');
    }
  };

  // ── Open resolve modal ──
  const openResolve = (approval) => {
    resolveForm.reset({ status: '', remarks: '' });
    setResolveModal(approval);
  };

  // ── Request approval (OFFICER) ──
  const onRequestSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = { rfq_id: data.rfq_id, remarks: data.remarks };
      if (data.quotation_id) payload.quotation_id = data.quotation_id;
      await createApprovalAPI(payload);
      toast.success('Approval request submitted');
      setRequestModal(false);
      requestForm.reset();
      setQuotations([]);
      loadApprovals();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to request approval');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resolve approval (MANAGER / ADMIN) ──
  const onResolveSubmit = async (data) => {
    setSubmitting(true);
    try {
      await resolveApprovalAPI(resolveModal.id, { status: data.status, remarks: data.remarks });
      toast.success(`Approval ${data.status === 'APPROVED' ? 'approved' : 'rejected'}`);
      setResolveModal(null);
      resolveForm.reset();
      loadApprovals();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to resolve approval');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Approvals
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {canResolve ? 'Review and resolve pending approval requests' : 'Track your approval requests'}
          </p>
        </div>
        {canRequest && (
          <button
            onClick={() => { requestForm.reset(); setQuotations([]); setRequestModal(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            <Plus size={15} /> Request Approval
          </button>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard label='Pending'  value={stats.PENDING}  color='var(--warning)' />
        <StatCard label='Approved' value={stats.APPROVED} color='var(--success)' />
        <StatCard label='Rejected' value={stats.REJECTED} color='var(--danger)'  />
        <StatCard label='Total'    value={approvals.length} color='var(--primary)' />
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
            {Object.keys(APPR_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
        </div>

        <div style={{ position: 'relative' }}>
          <select
            value={filterRfqId}
            onChange={e => { setFilterRfqId(e.target.value); setPage(1); }}
            style={{ ...inputStyle(), width: '220px', appearance: 'none', paddingRight: '30px', cursor: 'pointer' }}
          >
            <option value=''>All RFQs</option>
            {rfqs.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {loading ? (
          <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : approvals.length === 0 ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
            <Inbox size={40} strokeWidth={1.2} />
            <p style={{ margin: 0, fontSize: '15px' }}>No approvals found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'RFQ', 'Quotation', 'Requested By', 'Remarks', 'Status', 'Requested On', 'Resolved By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {approvals.map((a, idx) => (
                <tr
                  key={a.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{(page - 1) * LIMIT + idx + 1}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.rfq?.title || a.rfq_id}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{a.quotation?.id ? `#${a.quotation.id}` : '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{a.requested_by?.name || a.requester?.name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={a.remarks}>{a.remarks || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge color={APPR_COLORS[a.status] || 'gray'} text={a.status} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(a.created_at)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{a.resolved_by?.name || a.resolver?.name || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <ActionBtn icon={<Eye size={13} />} title='View Details' color='var(--primary)' onClick={() => openView(a.id)} />
                      {canResolve && a.status === 'PENDING' && (
                        <>
                          <ActionBtn icon={<CheckCircle size={13} />} title='Resolve' color='var(--success)' onClick={() => openResolve(a)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
          MODAL: View Approval Detail
      ══════════════════════════════════════════════════════════════════════ */}
      {viewModal && (
        <Modal title='Approval Details' onClose={() => setViewModal(null)} width='560px'>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
            {[
              ['RFQ',          viewModal.rfq?.title || viewModal.rfq_id],
              ['Quotation',    viewModal.quotation?.id ? `#${viewModal.quotation.id}` : '—'],
              ['Requested By', viewModal.requested_by?.name || viewModal.requester?.name || '—'],
              ['Requested On', formatDateTime(viewModal.created_at)],
              ['Resolved By',  viewModal.resolved_by?.name || viewModal.resolver?.name || '—'],
              ['Resolved On',  viewModal.resolved_at ? formatDateTime(viewModal.resolved_at) : '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</p>
                <p style={{ margin: '3px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{val}</p>
              </div>
            ))}

            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</p>
              <div style={{ marginTop: '4px' }}>
                <Badge color={APPR_COLORS[viewModal.status] || 'gray'} text={viewModal.status} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Request Remarks</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{viewModal.remarks || '—'}</p>
            </div>

            {viewModal.resolution_remarks && (
              <div style={{ gridColumn: '1 / -1', padding: '12px', background: viewModal.status === 'APPROVED' ? '#f0fdf4' : '#fef2f2', borderRadius: 'var(--radius-sm)', border: `1px solid ${viewModal.status === 'APPROVED' ? '#bbf7d0' : '#fecaca'}` }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: viewModal.status === 'APPROVED' ? 'var(--success)' : 'var(--danger)' }}>Resolution Remarks</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{viewModal.resolution_remarks}</p>
              </div>
            )}
          </div>

          {/* Resolve from detail modal */}
          {canResolve && viewModal.status === 'PENDING' && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setViewModal(null); openResolve(viewModal); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                <ShieldCheck size={14} /> Resolve
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Request Approval (OFFICER / ADMIN)
      ══════════════════════════════════════════════════════════════════════ */}
      {requestModal && (
        <Modal title='Request Approval' onClose={() => { setRequestModal(false); requestForm.reset(); }} width='500px'>
          <FormField label='RFQ *' error={requestForm.formState.errors.rfq_id?.message}>
            <div style={{ position: 'relative' }}>
              <select
                {...requestForm.register('rfq_id')}
                style={{ ...inputStyle(!!requestForm.formState.errors.rfq_id), appearance: 'none', paddingRight: '30px', cursor: 'pointer' }}
              >
                <option value=''>Select RFQ…</option>
                {rfqs.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          </FormField>

          <FormField label='Quotation (optional)' hint='Link a specific quotation to this approval request'>
            <div style={{ position: 'relative' }}>
              <select
                {...requestForm.register('quotation_id')}
                disabled={!watchedRfqId || quotations.length === 0}
                style={{ ...inputStyle(), appearance: 'none', paddingRight: '30px', cursor: watchedRfqId ? 'pointer' : 'not-allowed', opacity: (!watchedRfqId || quotations.length === 0) ? 0.5 : 1 }}
              >
                <option value=''>None</option>
                {quotations.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.vendor?.company_name || `Quotation #${q.id}`} — {q.status}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          </FormField>

          <FormField label='Remarks *' error={requestForm.formState.errors.remarks?.message}>
            <textarea
              {...requestForm.register('remarks')}
              rows={4}
              style={{ ...inputStyle(!!requestForm.formState.errors.remarks), resize: 'vertical' }}
              placeholder='Explain why this approval is needed…'
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => { setRequestModal(false); requestForm.reset(); }}
              style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
            >
              Cancel
            </button>
            <button
              onClick={requestForm.handleSubmit(onRequestSubmit)}
              disabled={submitting}
              style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Resolve Approval (MANAGER / ADMIN)
      ══════════════════════════════════════════════════════════════════════ */}
      {resolveModal && (
        <Modal title='Resolve Approval' onClose={() => { setResolveModal(null); resolveForm.reset(); }} width='480px'>
          {/* Context banner */}
          <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>RFQ</p>
            <p style={{ margin: '3px 0 6px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{resolveModal.rfq?.title || resolveModal.rfq_id}</p>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Request Remarks</p>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-primary)' }}>{resolveModal.remarks}</p>
          </div>

          <FormField label='Decision *' error={resolveForm.formState.errors.status?.message}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['APPROVED', 'REJECTED'].map(opt => {
                const selected = resolveForm.watch('status') === opt;
                const col = opt === 'APPROVED' ? 'var(--success)' : 'var(--danger)';
                return (
                  <button
                    key={opt}
                    type='button'
                    onClick={() => resolveForm.setValue('status', opt, { shouldValidate: true })}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${selected ? col : 'var(--border)'}`,
                      background: selected ? `${col}15` : 'transparent',
                      color: selected ? col : 'var(--text-secondary)',
                      cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt === 'APPROVED' ? <CheckCircle size={15} /> : <XCircle size={15} />}
                    {opt}
                  </button>
                );
              })}
            </div>
            {resolveForm.formState.errors.status && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--danger)' }}>{resolveForm.formState.errors.status.message}</p>
            )}
          </FormField>

          <FormField label='Resolution Remarks *' error={resolveForm.formState.errors.remarks?.message}>
            <textarea
              {...resolveForm.register('remarks')}
              rows={4}
              style={{ ...inputStyle(!!resolveForm.formState.errors.remarks), resize: 'vertical' }}
              placeholder='Provide your reasoning for this decision…'
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => { setResolveModal(null); resolveForm.reset(); }}
              style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
            >
              Cancel
            </button>
            <button
              onClick={resolveForm.handleSubmit(onResolveSubmit)}
              disabled={submitting}
              style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Saving…' : 'Confirm Decision'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}