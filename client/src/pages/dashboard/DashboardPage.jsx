/**
 * DashboardPage.jsx
 * Main dashboard with KPI stat cards, procurement trend chart,
 * and recent RFQs / POs / Invoices tables.
 * Vendors see a welcome screen instead of stats.
 */

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import {
  FileText, ShoppingCart, TrendingUp, Clock, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDashboardStatsAPI } from '/src/api/dashboard.api.js';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import useAuth from '../../hooks/useAuth';

// ─── Status color maps ────────────────────────────────────────────────────────
const RFQ_COLORS  = { DRAFT: 'gray', PUBLISHED: 'blue', CLOSED: 'green', CANCELLED: 'red' };
const PO_COLORS   = { DRAFT: 'gray', ISSUED: 'blue', ACKNOWLEDGED: 'yellow', COMPLETED: 'green', CANCELLED: 'red' };
const INV_COLORS  = { DRAFT: 'gray', SENT: 'blue', PAID: 'green', OVERDUE: 'red', CANCELLED: 'red' };
const APPR_COLORS = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' };

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      flex: 1,
      minWidth: '180px',
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: 'var(--radius-sm)',
        background: `${color}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{
          fontSize: '24px',
          fontWeight: 700,
          fontFamily: 'Syne, sans-serif',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          {value ?? 0}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: '12px', color, marginTop: '4px', fontWeight: 500 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: 'Syne, sans-serif',
      fontWeight: 700,
      fontSize: '16px',
      color: 'var(--text-primary)',
      margin: '0 0 16px',
    }}>
      {children}
    </h2>
  );
}

// ─── Recent Mini Table ────────────────────────────────────────────────────────
function RecentTable({ columns, data, emptyMsg }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px',
        color: 'var(--text-secondary)',
        fontSize: '14px',
      }}>
        {emptyMsg || 'No records yet.'}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {columns.map(c => (
              <th key={c.key} style={{
                padding: '8px 12px',
                textAlign: 'left',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'var(--bg)',
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id || i}
              style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map(c => (
                <td key={c.key} style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      fontSize: '13px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.name === 'total_value' ? formatCurrency(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

// ─── Vendor Welcome Screen ────────────────────────────────────────────────────
function VendorWelcome({ user }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'var(--primary-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <FileText size={32} color="var(--primary)" />
      </div>
      <h2 style={{
        fontFamily: 'Syne, sans-serif',
        color: 'var(--text-primary)',
        margin: 0,
        fontSize: '22px',
      }}>
        Welcome, {user?.full_name}!
      </h2>
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '14px',
        margin: 0,
        textAlign: 'center',
        maxWidth: '340px',
      }}>
        Navigate to <strong>RFQs</strong> to view your invitations and submit
        quotations. Use <strong>Purchase Orders</strong> to track your confirmed orders.
      </p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const { isVendor, user }  = useAuth();

  useEffect(() => {
    if (isVendor) {
      setLoading(false);
      return;
    }
    fetchDashboard();
  }, [isVendor]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await getDashboardAPI();
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <Spinner size={36} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Loading dashboard...
        </p>
      </div>
    );
  }

  // ── Vendor view ──
  if (isVendor) {
    return <VendorWelcome user={user} />;
  }

  // ── Data ──
  const rfq   = data?.rfq_stats || {};
  const po    = data?.po_stats || {};
  const inv   = data?.invoice_stats || {};
  const appr  = data?.approval_stats || {};
  const trend = data?.monthly_procurement_trend || [];

  // Column definitions
  const rfqColumns = [
    { key: 'rfq_number', label: 'RFQ #' },
    { key: 'title', label: 'Title', render: r => (
      <span style={{
        maxWidth: '180px', display: 'inline-block',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {r.title}
      </span>
    )},
    { key: 'status', label: 'Status', render: r => (
      <Badge color={RFQ_COLORS[r.status] || 'gray'}>{r.status}</Badge>
    )},
    { key: 'deadline', label: 'Deadline', render: r => formatDate(r.deadline) },
  ];

  const poColumns = [
    { key: 'po_number', label: 'PO #' },
    { key: 'vendor',    label: 'Vendor',  render: r => r.vendor?.name || '—' },
    { key: 'status',    label: 'Status',  render: r => (
      <Badge color={PO_COLORS[r.status] || 'gray'}>{r.status}</Badge>
    )},
    { key: 'issued_at', label: 'Issued',  render: r => formatDate(r.issued_at) },
  ];

  const invColumns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'total_amount',   label: 'Amount', render: r => formatCurrency(r.total_amount) },
    { key: 'status',         label: 'Status', render: r => (
      <Badge color={INV_COLORS[r.status] || 'gray'}>{r.status}</Badge>
    )},
    { key: 'due_date', label: 'Due Date', render: r => formatDate(r.due_date) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>

      {/* ── KPI Cards ── */}
      <div>
        <SectionTitle>Overview</SectionTitle>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <StatCard
            label="Total RFQs"
            value={rfq.total}
            icon={FileText}
            color="var(--primary)"
            sub={`${rfq.PUBLISHED || 0} Published`}
          />
          <StatCard
            label="Purchase Orders"
            value={po.total}
            icon={ShoppingCart}
            color="var(--success)"
            sub={`${po.COMPLETED || 0} Completed`}
          />
          <StatCard
            label="Pending Approvals"
            value={appr.PENDING || 0}
            icon={Clock}
            color="var(--warning)"
            sub={appr.PENDING > 0 ? 'Needs attention' : 'All clear'}
          />
          <StatCard
            label="Total Revenue"
            value={formatCurrency(inv.total_revenue || 0)}
            icon={TrendingUp}
            color="var(--success)"
            sub={`${inv.PAID || 0} Invoices Paid`}
          />
          <StatCard
            label="Overdue Invoices"
            value={inv.OVERDUE || 0}
            icon={AlertCircle}
            color="var(--danger)"
            sub={inv.OVERDUE > 0 ? 'Action required' : 'None overdue'}
          />
        </div>
      </div>

      {/* ── Status Breakdowns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        <Card title="RFQ Status Breakdown">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'].map(s => (
              <div key={s} style={{
                flex: 1, minWidth: '80px', textAlign: 'center',
                padding: '12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {rfq[s] || 0}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <Badge color={RFQ_COLORS[s]}>{s}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Approval Status">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
              <div key={s} style={{
                flex: 1, minWidth: '80px', textAlign: 'center',
                padding: '12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {appr[s] || 0}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <Badge color={APPR_COLORS[s]}>{s}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Trend Chart ── */}
      {trend.length > 0 && (
        <Card title="Monthly Procurement Trend" subtitle="PO count and total value over time">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="po_count"
                name="PO Count"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
              <Bar
                yAxisId="right"
                dataKey="total_value"
                name="total_value"
                fill="var(--success)"
                opacity={0.7}
                radius={[4, 4, 0, 0]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Recent Tables ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card title="Recent RFQs">
          <RecentTable
            columns={rfqColumns}
            data={data?.recent_rfqs}
            emptyMsg="No RFQs yet."
          />
        </Card>
        <Card title="Recent Purchase Orders">
          <RecentTable
            columns={poColumns}
            data={data?.recent_pos}
            emptyMsg="No purchase orders yet."
          />
        </Card>
      </div>

      <Card title="Recent Invoices">
        <RecentTable
          columns={invColumns}
          data={data?.recent_invoices}
          emptyMsg="No invoices yet."
        />
      </Card>

    </div>
  );
}