/**
 * @file RFQPage.jsx
 * @description Request for Quotation management page.
 * Features: stats bar, searchable/filterable table, create modal with dynamic
 * items + vendor multi-select, detail view modal, status transitions, and delete.
 * Role-guarded: VENDORs see only invited RFQs; PROCUREMENT_OFFICERs and ADMINs
 * have full create/manage access; MANAGERs have read-only access.
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Search, Eye, X,
  CheckCircle, XCircle, Clock, AlertCircle,
} from 'lucide-react';

import useAuth from '/src/hooks/useAuth.js';
import { formatDate } from '../../utils/formatters';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Card from '../../components/ui/Card';

import {
  getRFQsAPI,
  getRFQStatsAPI,
  getRFQByIdAPI,
  createRFQAPI,
  updateRFQStatusAPI,
  deleteRFQAPI,
} from '../../api/rfq.api';
import { getVendorsAPI } from '../../api/vendor.api';

// ─── Constants ─────────────────────────────────────────────────────────────────

const RFQ_COLORS = {
  DRAFT: 'gray',
  PUBLISHED: 'blue',
  CLOSED: 'green',
  CANCELLED: 'red',
};

const STAT_CARDS = [
  { key: 'DRAFT',     label: 'Draft',     icon: <Clock size={18} />,        cssColor: 'var(--text-secondary)' },
  { key: 'PUBLISHED', label: 'Published', icon: <CheckCircle size={18} />,  cssColor: 'var(--primary)'        },
  { key: 'CLOSED',    label: 'Closed',    icon: <CheckCircle size={18} />,  cssColor: 'var(--success)'        },
  { key: 'CANCELLED', label: 'Cancelled', icon: <XCircle size={18} />,      cssColor: 'var(--danger)'         },
];

// ─── Inline Helpers ─────────────────────────────────────────────────────────────

const inputStyle = (hasError = false) => ({
  width: '100%',
  padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
  fontSize: '14px',
  color: 'var(--text-primary)',
  background: 'var(--bg-card)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'DM Sans, sans-serif',
});

function ActionBtn({ icon, title, color, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: '28px', height: '28px', borderRadius: '6px',
        border: `1px solid ${color}30`, background: `${color}10`,
        color, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = color; }}
    >
      {icon}
    </button>
  );
}

function FormField({ label, error, required, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '13px', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: '6px',
      }}>
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  );
}

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const rfqSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  deadline: z.string().min(1, 'Deadline is required'),
  items: z.array(z.object({
    product_name:   z.string().min(1, 'Required'),
    quantity:       z.coerce.number().min(1, 'Min 1'),
    unit:           z.string().min(1, 'Required'),
    specifications: z.string().optional(),
  })).min(1, 'Add at least one item'),
  vendor_ids: z.array(z.number()).min(1, 'Select at least one vendor'),
});

// ─── CreateRFQModal ─────────────────────────────────────────────────────────────

function CreateRFQModal({ open, onClose, onCreated }) {
  const [submitting, setSubmitting]       = useState(false);
  const [vendors, setVendors]             = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [vendorSearch, setVendorSearch]   = useState('');

  const {
    register, control, handleSubmit,
    formState: { errors }, setValue, reset,
  } = useForm({
    resolver: zodResolver(rfqSchema),
    defaultValues: {
      title: '', description: '', deadline: '',
      items: [{ product_name: '', quantity: 1, unit: '', specifications: '' }],
      vendor_ids: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Load approved vendors when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingVendors(true);
    (async () => {
      try {
        const res = await getVendorsAPI({ limit: 200, status: 'APPROVED' });
        setVendors(res.data?.vendors || res.data?.data || []);
      } catch {
        toast.error('Failed to load vendors');
      } finally {
        setLoadingVendors(false);
      }
    })();
  }, [open]);

  const toggleVendor = (id) => {
    const updated = selectedVendors.includes(id)
      ? selectedVendors.filter(v => v !== id)
      : [...selectedVendors, id];
    setSelectedVendors(updated);
    setValue('vendor_ids', updated, { shouldValidate: true });
  };

  const handleClose = () => {
    reset();
    setSelectedVendors([]);
    setVendorSearch('');
    onClose();
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await createRFQAPI(data);
      toast.success('RFQ created successfully');
      handleClose();
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create RFQ');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVendors = vendors.filter(v =>
    (v.company_name || v.name || '')
      .toLowerCase()
      .includes(vendorSearch.toLowerCase())
  );

  const todayISO = new Date().toISOString().split('T')[0];

  // Items array error message (zod puts it on root or message)
  const itemsRootError =
    typeof errors.items?.message === 'string'
      ? errors.items.message
      : errors.items?.root?.message;

  return (
    <Modal open={open} onClose={handleClose} title="Create New RFQ" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* Title */}
        <FormField label="Title" error={errors.title?.message} required>
          <input
            {...register('title')}
            placeholder="e.g. Office Supplies Q3 2025"
            style={inputStyle(!!errors.title)}
          />
        </FormField>

        {/* Description */}
        <FormField label="Description" error={errors.description?.message}>
          <textarea
            {...register('description')}
            placeholder="Optional notes or requirements..."
            rows={3}
            style={{ ...inputStyle(false), resize: 'vertical' }}
          />
        </FormField>

        {/* Deadline */}
        <FormField label="Deadline" error={errors.deadline?.message} required>
          <input
            {...register('deadline')}
            type="date"
            min={todayISO}
            style={inputStyle(!!errors.deadline)}
          />
        </FormField>

        {/* ── Items ── */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '10px',
          }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Items <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <button
              type="button"
              onClick={() => append({ product_name: '', quantity: 1, unit: '', specifications: '' })}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)', background: 'var(--primary-light)',
                color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}
            >
              <Plus size={12} /> Add Item
            </button>
          </div>

          {itemsRootError && (
            <p style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '8px' }}>
              {itemsRootError}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fields.map((field, index) => (
              <div
                key={field.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 70px 80px 2fr 30px',
                  gap: '8px',
                  alignItems: 'start',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}
              >
                <FormField
                  label={index === 0 ? 'Product Name' : ''}
                  error={errors.items?.[index]?.product_name?.message}
                >
                  <input
                    {...register(`items.${index}.product_name`)}
                    placeholder="Product name"
                    style={inputStyle(!!errors.items?.[index]?.product_name)}
                  />
                </FormField>

                <FormField
                  label={index === 0 ? 'Qty' : ''}
                  error={errors.items?.[index]?.quantity?.message}
                >
                  <input
                    {...register(`items.${index}.quantity`)}
                    type="number"
                    min="1"
                    placeholder="1"
                    style={inputStyle(!!errors.items?.[index]?.quantity)}
                  />
                </FormField>

                <FormField
                  label={index === 0 ? 'Unit' : ''}
                  error={errors.items?.[index]?.unit?.message}
                >
                  <input
                    {...register(`items.${index}.unit`)}
                    placeholder="pcs / kg"
                    style={inputStyle(!!errors.items?.[index]?.unit)}
                  />
                </FormField>

                <FormField
                  label={index === 0 ? 'Specifications' : ''}
                >
                  <input
                    {...register(`items.${index}.specifications`)}
                    placeholder="Optional specs"
                    style={inputStyle(false)}
                  />
                </FormField>

                {/* Remove row */}
                <div style={{ paddingTop: index === 0 ? '22px' : '0' }}>
                  <button
                    type="button"
                    onClick={() => fields.length > 1 && remove(index)}
                    disabled={fields.length === 1}
                    title="Remove item"
                    style={{
                      width: '28px', height: '28px', borderRadius: '6px',
                      border: '1px solid var(--danger)30',
                      background: fields.length === 1 ? 'var(--bg)' : '#fef2f2',
                      color: fields.length === 1 ? 'var(--border)' : 'var(--danger)',
                      cursor: fields.length === 1 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Vendor Multi-Select ── */}
        <div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px',
          }}>
            Invite Vendors <span style={{ color: 'var(--danger)' }}>*</span>
            {selectedVendors.length > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 500,
                color: 'var(--primary)', background: 'var(--primary-light)',
                padding: '2px 10px', borderRadius: '20px',
              }}>
                {selectedVendors.length} selected
              </span>
            )}
          </label>

          {errors.vendor_ids && (
            <p style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '6px' }}>
              {errors.vendor_ids.message}
            </p>
          )}

          <input
            value={vendorSearch}
            onChange={e => setVendorSearch(e.target.value)}
            placeholder="Search vendors..."
            style={{ ...inputStyle(false), marginBottom: '8px' }}
          />

          <div style={{
            maxHeight: '168px', overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)',
          }}>
            {loadingVendors ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <Spinner size={20} />
              </div>
            ) : filteredVendors.length === 0 ? (
              <p style={{
                padding: '20px', textAlign: 'center',
                fontSize: '13px', color: 'var(--text-secondary)', margin: 0,
              }}>
                No approved vendors found
              </p>
            ) : (
              filteredVendors.map(vendor => (
                <label
                  key={vendor.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: selectedVendors.includes(vendor.id)
                      ? 'var(--primary-light)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedVendors.includes(vendor.id)}
                    onChange={() => toggleVendor(vendor.id)}
                    style={{ accentColor: 'var(--primary)', width: '15px', height: '15px', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{
                      margin: 0, fontSize: '13px', fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>
                      {vendor.company_name || vendor.name}
                    </p>
                    {vendor.email && (
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {vendor.email}
                      </p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
        <button
          onClick={handleClose}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'transparent',
            cursor: 'pointer', fontSize: '14px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={submitting}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--primary)', color: '#fff',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 600, opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Creating...' : 'Create RFQ'}
        </button>
      </div>
    </Modal>
  );
}

// ─── ViewRFQModal ───────────────────────────────────────────────────────────────

function ViewRFQModal({ rfqId, open, onClose, onRefresh, canManage }) {
  const [rfq, setRfq]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    if (!open || !rfqId) return;
    setRfq(null);
    setLoading(true);
    (async () => {
      try {
        const res = await getRFQByIdAPI(rfqId);
        setRfq(res.data?.rfq || res.data?.data || res.data);
      } catch {
        toast.error('Failed to load RFQ details');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [open, rfqId]);

  const handleStatusChange = async (status) => {
    setActing(true);
    try {
      await updateRFQStatusAPI(rfqId, status);
      toast.success(`RFQ marked as ${status.toLowerCase()}`);
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed');
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this RFQ? This cannot be undone.')) return;
    setActing(true);
    try {
      await deleteRFQAPI(rfqId);
      toast.success('RFQ deleted');
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setActing(false);
    }
  };

  const labelStyle = {
    margin: 0, fontSize: '11px', fontWeight: 700,
    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em',
  };
  const valueStyle = {
    margin: '5px 0 0', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500,
  };

  return (
    <Modal open={open} onClose={onClose} title="RFQ Details" size="lg">
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}><Spinner /></div>
      ) : !rfq ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={labelStyle}>Title</p>
              <p style={{ ...valueStyle, fontSize: '16px', fontWeight: 700 }}>{rfq.title}</p>
            </div>
            <div>
              <p style={labelStyle}>Status</p>
              <div style={{ marginTop: '5px' }}>
                <Badge label={rfq.status} color={RFQ_COLORS[rfq.status] || 'gray'} />
              </div>
            </div>
            <div>
              <p style={labelStyle}>Deadline</p>
              <p style={valueStyle}>{formatDate(rfq.deadline)}</p>
            </div>
            <div>
              <p style={labelStyle}>Created</p>
              <p style={valueStyle}>{formatDate(rfq.created_at)}</p>
            </div>
            {rfq.created_by_name && (
              <div>
                <p style={labelStyle}>Created By</p>
                <p style={valueStyle}>{rfq.created_by_name}</p>
              </div>
            )}
          </div>

          {rfq.description && (
            <div>
              <p style={labelStyle}>Description</p>
              <p style={{ ...valueStyle, lineHeight: 1.7 }}>{rfq.description}</p>
            </div>
          )}

          {/* Items table */}
          <div>
            <p style={{ ...labelStyle, marginBottom: '10px' }}>
              Items ({rfq.items?.length || 0})
            </p>
            {rfq.items?.length > 0 ? (
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      {['#', 'Product Name', 'Qty', 'Unit', 'Specifications'].map(h => (
                        <th key={h} style={{
                          padding: '9px 14px', textAlign: 'left',
                          fontWeight: 600, color: 'var(--text-secondary)',
                          fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em',
                          borderBottom: '1px solid var(--border)',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.items.map((item, i) => (
                      <tr
                        key={item.id || i}
                        style={{ borderBottom: i < rfq.items.length - 1 ? '1px solid var(--border)' : 'none' }}
                      >
                        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</td>
                        <td style={{ padding: '9px 14px' }}>{item.quantity}</td>
                        <td style={{ padding: '9px 14px' }}>{item.unit}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{item.specifications || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No items on this RFQ.</p>
            )}
          </div>

          {/* Invited vendors */}
          <div>
            <p style={{ ...labelStyle, marginBottom: '10px' }}>
              Invited Vendors ({rfq.vendors?.length || 0})
            </p>
            {rfq.vendors?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {rfq.vendors.map((v, i) => (
                  <span key={v.id || i} style={{
                    padding: '4px 14px', borderRadius: '20px',
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    fontSize: '12px', fontWeight: 600,
                  }}>
                    {v.company_name || v.name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No vendors invited.</p>
            )}
          </div>

          {/* Status action buttons — only for managers/admins/officers */}
          {canManage && (
            <div style={{
              paddingTop: '16px', borderTop: '1px solid var(--border)',
              display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
            }}>
              {rfq.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => handleStatusChange('PUBLISHED')}
                    disabled={acting}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                      border: 'none', background: 'var(--primary)', color: '#fff',
                      cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600,
                      fontSize: '13px', opacity: acting ? 0.7 : 1,
                    }}
                  >
                    Publish RFQ
                  </button>
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={acting}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--danger)', background: '#fef2f2',
                      color: 'var(--danger)', cursor: acting ? 'not-allowed' : 'pointer',
                      fontWeight: 600, fontSize: '13px', opacity: acting ? 0.7 : 1,
                    }}
                  >
                    Cancel RFQ
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={acting}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                      border: 'none', background: 'var(--danger)', color: '#fff',
                      cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600,
                      fontSize: '13px', opacity: acting ? 0.7 : 1, marginLeft: 'auto',
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
              {rfq.status === 'PUBLISHED' && (
                <>
                  <button
                    onClick={() => handleStatusChange('CLOSED')}
                    disabled={acting}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                      border: 'none', background: 'var(--success)', color: '#fff',
                      cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600,
                      fontSize: '13px', opacity: acting ? 0.7 : 1,
                    }}
                  >
                    Close RFQ
                  </button>
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={acting}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--danger)', background: '#fef2f2',
                      color: 'var(--danger)', cursor: acting ? 'not-allowed' : 'pointer',
                      fontWeight: 600, fontSize: '13px', opacity: acting ? 0.7 : 1,
                    }}
                  >
                    Cancel RFQ
                  </button>
                </>
              )}
              {(rfq.status === 'CLOSED' || rfq.status === 'CANCELLED') && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                  This RFQ is {rfq.status.toLowerCase()} — no further actions available.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 20px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'transparent',
            cursor: 'pointer', fontSize: '14px',
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// ─── RFQPage (main export) ─────────────────────────────────────────────────────

export default function RFQPage() {
  const { isAdmin, isOfficer, isManager, isVendor } = useAuth();

  // Data
  const [rfqs, setRfqs]   = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters & pagination
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);
  const limit = 10;

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [viewRFQId, setViewRFQId]   = useState(null);

  // Trigger key — incrementing this re-runs both fetch effects
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  // Fetch stats
  useEffect(() => {
    (async () => {
      try {
        const res = await getRFQStatsAPI();
        setStats(res.data?.stats || res.data || {});
      } catch {
        // stats failure is non-critical
      }
    })();
  }, [refreshKey]);

  // Fetch RFQs
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await getRFQsAPI({
          search:  search  || undefined,
          status:  statusFilter || undefined,
          page,
          limit,
        });
        if (cancelled) return;
        const d = res.data;
        setRfqs(d?.rfqs || d?.data || []);
        setTotal(d?.total || d?.count || 0);
      } catch {
        if (!cancelled) toast.error('Failed to load RFQs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [search, statusFilter, page, refreshKey]);

  const handleSearch = (val) => { setSearch(val); setPage(1); };
  const handleStatus = (val) => { setStatusFilter(val); setPage(1); };

  const totalPages = Math.ceil(total / limit);
  const canCreate  = isAdmin || isOfficer;
  const canManage  = isAdmin || isOfficer;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: '22px', fontWeight: 700,
            fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)',
          }}>
            Request for Quotations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Manage procurement RFQs across all vendors
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--primary)', color: '#fff',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Plus size={16} /> New RFQ
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px', marginBottom: '24px',
      }}>
        {STAT_CARDS.map(card => (
          <Card key={card.key} style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{
                  margin: 0, fontSize: '11px', fontWeight: 700,
                  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {card.label}
                </p>
                <p style={{
                  margin: '8px 0 0', fontSize: '30px', fontWeight: 700,
                  color: card.cssColor, fontFamily: 'Syne, sans-serif', lineHeight: 1,
                }}>
                  {stats[card.key] ?? '—'}
                </p>
              </div>
              <div style={{ color: card.cssColor, opacity: 0.4 }}>{card.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card style={{ padding: '14px 18px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{
              position: 'absolute', left: '10px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by title..."
              style={{ ...inputStyle(false), paddingLeft: '32px' }}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => handleStatus(e.target.value)}
            style={{ ...inputStyle(false), width: '170px', cursor: 'pointer' }}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center' }}><Spinner /></div>
        ) : rfqs.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <AlertCircle size={40} style={{ color: 'var(--border)', marginBottom: '14px' }} />
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No RFQs found
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {canCreate
                ? 'Click "New RFQ" to create your first request.'
                : 'No RFQs have been assigned to you yet.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Title', 'Status', 'Deadline', 'Items', 'Vendors', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left', fontWeight: 700,
                        color: 'var(--text-secondary)', fontSize: '11px',
                        textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rfqs.map((rfq, i) => (
                    <tr
                      key={rfq.id}
                      style={{
                        borderBottom: i < rfqs.length - 1 ? '1px solid var(--border)' : 'none',
                        background: 'var(--bg-card)', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                    >
                      {/* Title */}
                      <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                        <span
                          title={rfq.title}
                          style={{
                            display: 'block', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontWeight: 600, color: 'var(--text-primary)',
                          }}
                        >
                          {rfq.title}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <Badge label={rfq.status} color={RFQ_COLORS[rfq.status] || 'gray'} />
                      </td>

                      {/* Deadline */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(rfq.deadline)}
                      </td>

                      {/* Items count */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {rfq.items_count ?? rfq.items?.length ?? '—'}
                      </td>

                      {/* Vendors count */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {rfq.vendors_count ?? rfq.vendors?.length ?? '—'}
                      </td>

                      {/* Created */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(rfq.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <ActionBtn
                            icon={<Eye size={13} />}
                            title="View details"
                            color="var(--primary)"
                            onClick={() => setViewRFQId(rfq.id)}
                          />
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

      {/* ── Modals ── */}
      <CreateRFQModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refresh(); }}
      />

      <ViewRFQModal
        rfqId={viewRFQId}
        open={!!viewRFQId}
        onClose={() => setViewRFQId(null)}
        onRefresh={refresh}
        canManage={canManage}
      />
    </div>
  );
}