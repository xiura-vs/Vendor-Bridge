/**
 * AppLayout.jsx
 * Root layout wrapper for all authenticated pages.
 * Manages sidebar collapsed state and passes correct offsets to Header + main content.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? '72px' : '240px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main area — offset by sidebar width */}
      <div style={{
        marginLeft: sidebarWidth,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.25s ease',
        minWidth: 0,
      }}>
        <Header sidebarWidth={sidebarWidth} />

        {/* Page Content */}
        <main style={{
          marginTop: '64px',
          padding: '24px',
          flex: 1,
          animation: 'fadeIn 0.3s ease',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}