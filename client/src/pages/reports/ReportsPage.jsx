// src/pages/reports/ReportsPage.jsx
/**
 * ReportsPage
 * Displays 4 analytical charts built with Recharts:
 *  1. Bar  — RFQ status distribution
 *  2. Pie  — Invoice status distribution
 *  3. Line — Monthly PO trend
 *  4. Bar  — Top vendors by PO count
 * Data is fetched from GET /dashboard.
 * Accessible to ADMIN, PROCUREMENT_OFFICER, MANAGER.
 */

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { BarChart2, PieChart as PieIcon, TrendingUp, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDashboardStatsAPI } from '../../api/dashboard.api';
import Spinner from '../../components/ui/Spinner';
import Card from '../../components/ui/Card';

/* ─── colour palettes (CSS variables not available inside Recharts so we use hex) ─── */
const RFQ_COLORS   = { DRAFT: '#94a3b8', PUBLISHED: '#2563eb', CLOSED: '#10b981', CANCELLED: '#ef4444' };
const INV_COLORS   = { DRAFT: '#94a3b8', SENT: '#2563eb', PAID: '#10b981', OVERDUE: '#ef4444', CANCELLED: '#f59e0b' };
const PIE_PALETTE  = ['#94a3b8', '#2563eb', '#10b981', '#ef4444', '#f59e0b'];
const LINE_COLOR   = '#2563eb';
const VENDOR_COLOR = '#f59e0b';

/* ─── tiny section header ─── */
function SectionHeader({ icon: Icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        background: 'var(--primary-light)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} />
      </div>
      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
        {title}
      </h2>
    </div>
  );
}

/* ─── custom Pie label ─── */
const renderPieLabel = ({ name, percent }) =>
  percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : '';

/* ─── empty state inside a chart area ─── */
function ChartEmpty() {
  return (
    <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-secondary)' }}>
      <AlertCircle size={32} strokeWidth={1.4} />
      <span style={{ fontSize: 14 }}>No data available</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getDashboardStatsAPI();
        setStats(data?.data ?? data);
      } catch {
        toast.error('Failed to load report data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spinner />
      </div>
    );
  }

  /* ── shape the data ── */

  // 1. RFQ status distribution  → expects stats.rfq_by_status: [{ status, count }]
  const rfqBarData = Object.entries(stats?.rfq_by_status ?? {}).map(([status, count]) => ({
    status,
    count: Number(count),
    fill: RFQ_COLORS[status] ?? '#94a3b8',
  }));

  // 2. Invoice status distribution → expects stats.invoice_by_status: { STATUS: count, … }
  const invPieData = Object.entries(stats?.invoice_by_status ?? {}).map(([name, value], i) => ({
    name,
    value: Number(value),
    color: INV_COLORS[name] ?? PIE_PALETTE[i % PIE_PALETTE.length],
  }));

  // 3. Monthly PO trend → expects stats.monthly_po_trend: [{ month: 'Jan', count: 4 }, …]
  const poTrendData = stats?.monthly_po_trend ?? [];

  // 4. Top vendors by PO count → expects stats.top_vendors: [{ vendor_name, po_count }, …]
  const topVendors = stats?.top_vendors ?? [];

  /* ── tooltip style shared ── */
  const tooltipStyle = {
    contentStyle: {
      borderRadius: '8px',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-md)',
      fontSize: '13px',
      fontFamily: 'DM Sans, sans-serif',
    },
    cursor: { fill: 'rgba(37,99,235,0.06)' },
  };

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
          Reports & Analytics
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
          Aggregated insights across RFQs, purchase orders, invoices and vendors.
        </p>
      </div>

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>

        {/* ── 1. RFQ Status Distribution ── */}
        <Card style={{ padding: 24 }}>
          <SectionHeader icon={BarChart2} title="RFQ Status Distribution" />
          {rfqBarData.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rfqBarData} barSize={36} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  cursor={tooltipStyle.cursor}
                  formatter={(v) => [v, 'RFQs']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {rfqBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── 2. Invoice Status Distribution ── */}
        <Card style={{ padding: 24 }}>
          <SectionHeader icon={PieIcon} title="Invoice Status Distribution" />
          {invPieData.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={invPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={52}
                  label={renderPieLabel}
                  labelLine={false}
                  paddingAngle={3}
                >
                  {invPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  formatter={(v, name) => [v, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif', paddingTop: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── 3. Monthly PO Trend ── */}
        <Card style={{ padding: 24 }}>
          <SectionHeader icon={TrendingUp} title="Monthly Purchase Order Trend" />
          {poTrendData.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={poTrendData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  cursor={{ stroke: LINE_COLOR, strokeWidth: 1, strokeDasharray: '4 2' }}
                  formatter={(v) => [v, 'POs']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={LINE_COLOR}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: LINE_COLOR, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── 4. Top Vendors by PO Count ── */}
        <Card style={{ padding: 24 }}>
          <SectionHeader icon={Users} title="Top Vendors by Purchase Orders" />
          {topVendors.length === 0 ? <ChartEmpty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topVendors}
                layout="vertical"
                barSize={20}
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="vendor_name"
                  width={130}
                  tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'DM Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.length > 18 ? v.slice(0, 17) + '…' : v}
                />
                <Tooltip
                  contentStyle={tooltipStyle.contentStyle}
                  cursor={{ fill: 'rgba(245,158,11,0.08)' }}
                  formatter={(v) => [v, 'POs']}
                />
                <Bar dataKey="po_count" fill={VENDOR_COLOR} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

      </div>
    </div>
  );
}