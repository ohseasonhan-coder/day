import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const TYPE_STYLES = {
  default: { background: 'var(--gray-800)', color: 'white' },
  success: { background: '#2E7D32', color: 'white' },
  error:   { background: '#C62828', color: 'white' },
  info:    { background: 'var(--primary)', color: 'white' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'default', duration = 2600) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav, 72px) + 16px)',
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            ...(TYPE_STYLES[t.type] || TYPE_STYLES.default),
            padding: '12px 22px', borderRadius: 100,
            fontSize: 14, fontWeight: 700,
            whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            animation: 'toastIn 0.28s ease forwards',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
