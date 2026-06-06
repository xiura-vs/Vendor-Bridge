/**
 * Sidebar.jsx
 * Dark collapsible sidebar with navigation links.
 * Shows icon + label, highlights active route, collapses to icon-only mode.
 * Receives collapsed + setCollapsed props from AppLayout.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FileText,
  MessageSquare,
  CheckCircle,
  ShoppingCart,
  Receipt,
  BarChart3,
  Activity,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/dashboard',        icon: LayoutDashboard },
  { label: 'Vendors',         path: '/vendors',          icon: Building2 },
  { label: 'RFQs',            path: '/rfqs',             icon: FileText },
  { label: 'Quotations',      path: '/quotations',       icon: MessageSquare },
  { label: 'Approvals',       path: '/approvals',        icon: CheckCircle },
  { label: 'Purchase Orders', path: '/purchase-orders',  icon: ShoppingCart },
  { label: 'Invoices',        path: '/invoices',         icon: Receipt },
  { label: 'Reports',         path: '/reports',          icon: BarChart3 },
  { label: 'Activity',        path: '/activity',         icon: Activity },
];

/**
 * @param {{ collapsed: boolean, setCollapsed: Function }} props
 */
export default function Sidebar({ collapsed, setCollapsed }) {
  const { user } = useAuthStore();
  const sidebarWidth = collapsed ? '72px' : '240px';

  return (
    <aside style={{
      width: sidebarWidth,
      minHeight: '100vh',
      background: 'var(--sidebar-bg)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
      overflow: 'hidden',
    }}>

      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        minHeight: '64px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Zap size={18} color="#fff" />
        </div>

        {!collapsed && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            <div style={{
              color: '#fff',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              whiteSpace: 'nowrap',
            }}>
              VendorBridge
            </div>
            <div style={{ color: 'var(--sidebar-text)', fontSize: '11px' }}>
              ERP Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation Links ── */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '2px',
              textDecoration: 'none',
              color: isActive ? '#fff' : 'var(--sidebar-text)',
              background: isActive ? 'var(--sidebar-active)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: '14px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            })}
            onMouseEnter={e => {
              const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
              if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={e => {
              const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── User Info ── */}
      {!collapsed && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {user?.full_name}
          </div>
          <div style={{
            color: 'var(--sidebar-text)',
            fontSize: '11px',
            marginTop: '2px',
            whiteSpace: 'nowrap',
          }}>
            {user?.role?.replace(/_/g, ' ')}
          </div>
        </div>
      )}

      {/* ── Collapse Toggle Button ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          margin: '8px',
          padding: '10px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--sidebar-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

    </aside>
  );
}