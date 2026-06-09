import React from 'react';

export default function EmptyState({ emoji = '📭', title, desc, actionLabel, onAction }) {
  return (
    <div style={{
      textAlign: 'center', padding: '52px 24px',
      background: 'var(--white)', border: '1.5px dashed var(--border)',
      borderRadius: 20, margin: '8px 0',
    }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
      {desc && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: actionLabel ? 20 : 0 }}>
          {desc}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 4, background: 'var(--primary)', color: 'white',
            borderRadius: 12, padding: '11px 24px', fontWeight: 800, fontSize: 14,
            boxShadow: '0 4px 14px rgba(79,127,255,0.3)', border: 'none',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
