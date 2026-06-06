/**
 * Header.jsx
 * Top navigation bar showing current page title, user avatar, and logout.
 * Receives sidebarWidth as prop to offset correctly.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Bell, User } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/vendors':         'Vendor Management',
  '/rfqs':            'Requests for Quotation',
  '/quotations':      'Quotations',
  '/approvals':       'Approvals',
  '/purchase-orders': 'Purchase Orders',
  '/invoices':        'Invoices',
  '/reports':         'Reports & Analytics',
  '/activity':        'Activity Logs',
};

/**
 * @param {{ sidebarWidth: string }} props
 */
export default function Header({ sidebarWidth }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || 'VendorBridge';

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: sidebarWidth,
      right: 0,
      height: '64px',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 99,
      transition: 'left 0.25s ease',
      boxShadow: 'var(--shadow)',
    }}>

      {/* Page Title */}
      <div>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '18px',
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          {pageTitle}
        </h1>
      </div>

      {/* Right Side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Notification Bell (placeholder) */}
        <button style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}>
          <Bell size={16} />
        </button>

        {/* User Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {user?.role?.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--danger)',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}