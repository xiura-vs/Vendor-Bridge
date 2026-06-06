// src/pages/activity/ActivityPage.jsx
/**
 * ActivityPage — VendorBridge ERP
 * Read-only audit trail of all system activity.
 * ADMIN only (or all internal roles depending on backend guards).
 * No create / edit / delete — purely observational.
 */

import { useEffect, useState, useCallback } from 'react';
import { Activity, ChevronDown, SlidersHorizontal, ClockIcon } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatDateTime } from '../../utils/formatters';
import Spinner from '../../components/ui/Spinner';
import Pagination from '../../components/ui/Pagination';
import Badge from '../../components/ui/Badge';
import api from '../../api/axios';

// ─── Inline log API (no separate file needed — single endpoint) ───────────────
const getLogsAPI = (params) => api.get('/logs', { params });

// ─── Entity type → badge colour ──────────────────────────────────────────────
const ENTITY_COLORS = {
  RFQ:            'blue',
  QUOTATION:      'yellow',
  APPROVAL:       'green',
  PURCHASE_ORDER: 'gray',
  INVOICE:        'red',
  VENDOR:         'blue',
  USER:           'gray',
};

// ─── Action → colour ─────────────────────────────────────────────────────────
const ACTION_COLORS = {
  CREATE:   'green',
  UPDATE:   'blue',
  DELETE:   'red',
  PUBLISH:  'blue',
  CLOSE:    'gray',
  CANCEL:   'red',
  ACCEPT:   'green',
  REJECT:   'red',
  APPROVE:  'green',
  RESOLVE:  'blue',
  ISSUE:    'blue',
  COMPLETE: 'green',
  SEND:     'yellow',
  LOGIN:    'gray',
  LOGOUT:   'gray',
};

// ─── Known entity types and actions for filter dropdowns ─────────────────────
const ENTITY_TYPES = ['RFQ', 'QUOTATION', 'APPROVAL', 'PURCHASE_ORDER', 'INVOICE', 'VENDOR', 'USER'];
const ACTIONS      = ['CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'CLOSE', 'CANCEL', 'ACCEPT', 'REJECT', 'APPROVE', 'RESOLVE', 'ISSUE', 'COMPLETE', 'SEND', 'LOGIN', 'LOGOUT'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inputStyle = () => ({
  width: '100%', padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  fontSize: '14px', color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
});

// Pretty-print JSON metadata — truncate if too long
function MetaCell({ value }) {
  const [expanded, setExpanded] = useState(false);

  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>;
  }

  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = value; }
  }

  const pretty   = typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed);
  const isLong   = pretty.length > 120;
  const display  = isLong && !expanded ? pretty.slice(0, 120) + '…' : pretty;

  return (
    <div>
      <pre style={{
        margin: 0, fontSize: '11px', fontFamily: 'monospace',
        color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
        wordBreak: 'break-all', maxWidth: '260px',
        background: 'var(--bg)', padding: '5px 8px',
        borderRadius: '4px', border: '1px solid var(--border)',
      }}>
        {display}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(p => !p)}
          style={{ marginTop: '4px', fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// ─── Stat strip ──────────────────────────────────────────────────────────────
function StatPill({ label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)',
    }}>
      <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{value}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const LIMIT = 15;

  // filters
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  // ── Load logs ──
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterEntity) params.entity_type = filterEntity;
      if (filterAction) params.action      = filterAction;
      const res = await getLogsAPI(params);
      const d = res.data;
      setLogs(d?.logs || d?.data || []);
      setTotal(d?.total || 0);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, filterEntity, filterAction]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Client-side search filter (entity_id / user name) ──
  const visible = filterSearch.trim()
    ? logs.filter(l =>
        String(l.entity_id  || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
        String(l.user?.name || l.user?.email || '').toLowerCase().includes(filterSearch.toLowerCase())
      )
    : logs;

  // ── Derived stats from current page ──
  const uniqueUsers    = new Set(logs.map(l => l.user?.id).filter(Boolean)).size;
  const uniqueEntities = new Set(logs.map(l => l.entity_type).filter(Boolean)).size;

  // ── Active filter count badge ──
  const activeFilters = [filterEntity, filterAction].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Activity Logs
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Full audit trail of all system events
          </p>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: showFilters ? 'var(--primary-light)' : 'var(--bg-card)',
            color: showFilters ? 'var(--primary)' : 'var(--text-primary)',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeFilters > 0 && (
            <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '99px', fontSize: '11px', fontWeight: 700, padding: '1px 7px', marginLeft: '2px' }}>
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* ── Stat pills ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <StatPill label='Events (this page)' value={logs.length}    />
        <StatPill label='Unique Users'        value={uniqueUsers}    />
        <StatPill label='Entity Types'        value={uniqueEntities} />
        <StatPill label='Total Events'        value={total}          />
      </div>

      {/* ── Collapsible filters ── */}
      {showFilters && (
        <div style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap',
          marginBottom: '18px', padding: '16px',
          background: 'var(--bg-card)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
        }}>
          {/* Entity type */}
          <div style={{ position: 'relative', flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Entity Type</label>
            <select
              value={filterEntity}
              onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
              style={{ ...inputStyle(), appearance: 'none', paddingRight: '30px', cursor: 'pointer' }}
            >
              <option value=''>All Entities</option>
              {ENTITY_TYPES.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '9px', bottom: '10px', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </div>

          {/* Action */}
          <div style={{ position: 'relative', flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Action</label>
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(1); }}
              style={{ ...inputStyle(), appearance: 'none', paddingRight: '30px', cursor: 'pointer' }}
            >
              <option value=''>All Actions</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '9px', bottom: '10px', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </div>

          {/* Search */}
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Search User / Entity ID</label>
            <input
              type='text'
              placeholder='Search by user name, email or entity ID…'
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              style={inputStyle()}
            />
          </div>

          {/* Clear */}
          {activeFilters > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => { setFilterEntity(''); setFilterAction(''); setFilterSearch(''); setPage(1); }}
                style={{ padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Table card ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {loading ? (
          <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
            <ClockIcon size={40} strokeWidth={1.2} />
            <p style={{ margin: 0, fontSize: '15px' }}>No activity logs found</p>
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterEntity(''); setFilterAction(''); setFilterSearch(''); }}
                style={{ fontSize: '13px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Metadata'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((log, idx) => (
                  <tr
                    key={log.id ?? idx}
                    style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Row number */}
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {(page - 1) * LIMIT + idx + 1}
                    </td>

                    {/* Timestamp */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {formatDateTime(log.created_at || log.timestamp)}
                        </span>
                      </div>
                    </td>

                    {/* User */}
                    <td style={{ padding: '12px 16px', minWidth: '140px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.user?.name || log.user?.email || '—'}
                      </p>
                      {log.user?.role && (
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {log.user.role.replace('_', ' ')}
                        </p>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <Badge color={ACTION_COLORS[log.action] || 'gray'} text={log.action || '—'} />
                    </td>

                    {/* Entity type */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <Badge color={ENTITY_COLORS[log.entity_type] || 'gray'} text={(log.entity_type || '—').replace('_', ' ')} />
                    </td>

                    {/* Entity ID */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {log.entity_id || '—'}
                      </span>
                    </td>

                    {/* Metadata */}
                    <td style={{ padding: '12px 16px' }}>
                      <MetaCell value={log.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {total > LIMIT && (
        <div style={{ marginTop: '16px' }}>
          <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
        </div>
      )}
    </div>
  );
}