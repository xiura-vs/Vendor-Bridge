/**
 * Modal.jsx
 * Centered overlay modal with backdrop blur.
 * Used for all create/edit forms across the app.
 * Closes on backdrop click or Escape key.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title: string,
 *   children: React.ReactNode,
 *   width?: string,
 *   footer?: React.ReactNode
 * }} props
 */
export default function Modal({ isOpen, onClose, title, children, width = '520px', footer }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s ease',
          border: '1px solid var(--border)',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--text-primary)',
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.color = 'var(--danger)';
              e.currentTarget.style.borderColor = 'var(--danger)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {children}
        </div>

        {/* Modal Footer (optional) */}
        {footer && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}