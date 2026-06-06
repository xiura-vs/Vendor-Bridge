/**
 * VendorsPage.jsx
 * Full vendor management page with:
 * - Searchable, filterable, paginated table
 * - Create vendor modal
 * - Edit vendor modal
 * - Status change (ACTIVE / INACTIVE / BLACKLISTED)
 * - Soft delete (deactivate)
 * - Role-based action visibility
 */

import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ToggleLeft, Eye, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  getVendorsAPI, createVendorAPI, updateVendorAPI,
  updateVendorStatusAPI, deleteVendorAPI,
} from '../../api/vendor.api';

import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import useAuth from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatters';

// ─── Status color map ─────────────────────────────────────────────────────────
const STATUS_COLORS = { ACTIVE: 'green', INACTIVE: 'gray', BLACKLISTED: 'red' };

// ─── Zod validation schema ────────────────────────────────────────────────────
const vendorSchema = z.object({
  name:          z.string().min(2, 'Name must be at least 2 characters.'),
  category:      z.string().min(1, 'Category is required.'),
  gst_number:    z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format.'),
  pan_number:    z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format. e.g. ABCDE1234F'),
  contact_email: z.string().email('Invalid email address.'),
  contact_phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number.'),
  address:       z.string().min(10, 'Address must be at least 10 characters.'),
});

// ─── Field config for form ────────────────────────────────────────────────────
const FORM_FIELDS = [
  { name: 'name',          label: 'Vendor Name',    placeholder: 'TechSupplies Pvt. Ltd.', col: 2 },
  { name: 'category',      label: 'Category',       placeholder: 'IT Hardware', col: 1 },
  { name: 'contact_email', label: 'Contact Email',  placeholder: 'vendor@company.com', col: 1 },
  { name: 'contact_phone', label: 'Contact Phone',  placeholder: '9876543210', col: 1 },
  { name: 'gst_number',    label: 'GST Number',     placeholder: '27AABCT1332L1ZY', col: 1 },
  { name: 'pan_number',    label: 'PAN Number',     placeholder: 'ABCDE1234F', col: 1 },
  { name: 'address',       label: 'Address',        placeholder: 'Full business address...', col: 2, multiline: true },
];

// ─── Reusable form field ──────────────────────────────────────────────────────
function FormField({ label, error, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '13px', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: '6px',
      }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Input style ──────────────────────────────────────────────────────────────
const inputStyle = (hasError) => ({
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
  transition: 'border-color 0.15s ease',
});

// ─── Vendor Form Modal ────────────────────────────────────────────────────────
function VendorFormModal({ isOpen, onClose, onSuccess, editData }) {
  const isEdit = !!editData;
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: editData || {},
  });

  useEffect(() => {
    if (isOpen) reset(editData || {});
  }, [isOpen, editData]);

  async function onSubmit(data) {
    try {
      setSubmitting(true);
      if (isEdit) {
        await updateVendorAPI(editData.id, data);
        toast.success('Vendor updated successfully.');
      } else {
        await createVendorAPI(data);
        toast.success('Vendor created successfully.');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Vendor' : 'Add New Vendor'}
      width="620px"
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={submitting}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--primary)',
              color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600, opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Vendor' : 'Create Vendor'}
          </button>
        </>
      }
    >
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
      }}>
        {FORM_FIELDS.map(field => (
          <div key={field.name} style={{ gridColumn: `span ${field.col}` }}>
            <FormField label={field.label} error={errors[field.name]?.message}>
              {field.multiline ? (
                <textarea
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  rows={3}
                  style={{ ...inputStyle(!!errors[field.name]), resize: 'vertical' }}
                />
              ) : (
                <input
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  style={inputStyle(!!errors[field.name])}
                />
              )}
            </FormField>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Status Change Modal ──────────────────────────────────────────────────────
function StatusModal({ isOpen, onClose, vendor, onSuccess }) {
  const [status, setStatus]       = useState(vendor?.status || 'ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (vendor) setStatus(vendor.status); }, [vendor]);

  async function handleSave() {
    try {
      setSubmitting(true);
      await updateVendorStatusAPI(vendor.id, status);
      toast.success('Vendor status updated.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Vendor Status"
      width="400px"
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--primary)', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600, opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Saving...' : 'Update Status'}
          </button>
        </>
      }
    >
      <div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: 0 }}>
          Changing status for <strong>{vendor?.name}</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['ACTIVE', 'INACTIVE', 'BLACKLISTED'].map(s => (
            <label
              key={s}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: `2px solid ${status === s ? 'var(--primary)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'border-color 0.15s ease',
                background: status === s ? 'var(--primary-light)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <Badge color={STATUS_COLORS[s]}>{s}</Badge>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ isOpen, onClose, vendor, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    try {
      setSubmitting(true);
      await deleteVendorAPI(vendor.id);
      toast.success('Vendor deactivated successfully.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to deactivate vendor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deactivate Vendor"
      width="400px"
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={submitting}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--danger)', color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600, opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Deactivating...' : 'Deactivate'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
        Are you sure you want to deactivate <strong>{vendor?.name}</strong>?
        Their status will be set to <Badge color="gray">INACTIVE</Badge>.
      </p>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const { isAdmin, isOfficer } = useAuth();
  const canManage = isAdmin;

  const [vendors, setVendors]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const LIMIT = 10;

  // Modal states
  const [showCreate, setShowCreate]   = useState(false);
  const [editVendor, setEditVendor]   = useState(null);
  const [statusVendor, setStatusVendor] = useState(null);
  const [deleteVendor, setDeleteVendor] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, [search, statusFilter, page]);

  async function fetchVendors() {
    try {
      setLoading(true);
      const res = await getVendorsAPI({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: LIMIT,
      });
      const d = res.data;
      setVendors(d.data || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load vendors.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  function handleStatusFilter(e) {
    setStatusFilter(e.target.value);
    setPage(1);
  }

  // Table column definitions
  const columns = [
    {
      key: 'name', label: 'Vendor',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'var(--primary-light)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Building2 size={15} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.category}</div>
          </div>
        </div>
      ),
    },
    { key: 'contact_email', label: 'Email' },
    { key: 'contact_phone', label: 'Phone' },
    { key: 'gst_number',    label: 'GST Number' },
    {
      key: 'status', label: 'Status',
      render: r => <Badge color={STATUS_COLORS[r.status] || 'gray'}>{r.status}</Badge>,
    },
    {
      key: 'created_at', label: 'Joined',
      render: r => formatDate(r.created_at),
    },
    {
      key: 'actions', label: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {canManage && (
            <>
              <ActionBtn
                icon={<Edit2 size={13} />}
                title="Edit"
                color="var(--primary)"
                onClick={e => { e.stopPropagation(); setEditVendor(r); }}
              />
              <ActionBtn
                icon={<ToggleLeft size={13} />}
                title="Change Status"
                color="var(--warning)"
                onClick={e => { e.stopPropagation(); setStatusVendor(r); }}
              />
              <ActionBtn
                icon={<Trash2 size={13} />}
                title="Deactivate"
                color="var(--danger)"
                onClick={e => { e.stopPropagation(); setDeleteVendor(r); }}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{
            position: 'absolute', left: '10px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-secondary)',
          }} />
          <input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search vendors..."
            style={{
              width: '100%', padding: '9px 12px 9px 34px',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              fontSize: '14px', background: 'var(--bg-card)', outline: 'none',
              boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={handleStatusFilter}
          style={{
            padding: '9px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: '14px',
            background: 'var(--bg-card)', cursor: 'pointer',
            color: 'var(--text-primary)', outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>

        {/* Add Vendor button — ADMIN only */}
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--primary)', color: '#fff',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={15} /> Add Vendor
          </button>
        )}
      </div>

      {/* ── Table Card ── */}
      <Card
        title="Vendors"
        subtitle={`${total} vendor${total !== 1 ? 's' : ''} found`}
      >
        <Table
          columns={columns}
          data={vendors}
          loading={loading}
          emptyMessage="No vendors found. Add your first vendor to get started."
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={setPage}
        />
      </Card>

      {/* ── Modals ── */}
      <VendorFormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchVendors}
      />
      <VendorFormModal
        isOpen={!!editVendor}
        onClose={() => setEditVendor(null)}
        onSuccess={fetchVendors}
        editData={editVendor}
      />
      <StatusModal
        isOpen={!!statusVendor}
        onClose={() => setStatusVendor(null)}
        vendor={statusVendor}
        onSuccess={fetchVendors}
      />
      <DeleteModal
        isOpen={!!deleteVendor}
        onClose={() => setDeleteVendor(null)}
        vendor={deleteVendor}
        onSuccess={fetchVendors}
      />
    </div>
  );
}

// ─── Small action icon button ─────────────────────────────────────────────────
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
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = `${color}10`;
        e.currentTarget.style.color = color;
      }}
    >
      {icon}
    </button>
  );
}