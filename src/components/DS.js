// ── 공통 디자인 시스템 컴포넌트 ──────────────────────────────────────────────
import React, { useState, useEffect } from 'react';

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, onClick, hover = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: 'var(--white)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        padding: 16,
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({
  children, onClick, disabled, variant = 'primary', size = 'md', fullWidth = false, icon, style,
}) {
  const variants = {
    primary:   { bg: 'var(--primary)', color: 'white', border: 'none', shadow: '0 4px 14px rgba(79,127,255,0.3)' },
    secondary: { bg: 'var(--white)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', shadow: 'none' },
    danger:    { bg: 'var(--accent)', color: 'white', border: 'none', shadow: '0 4px 14px rgba(255,87,87,0.3)' },
    ghost:     { bg: 'transparent', color: 'var(--primary)', border: 'none', shadow: 'none' },
    success:   { bg: 'var(--cat-play)', color: 'white', border: 'none', shadow: '0 4px 14px rgba(76,175,80,0.3)' },
  };
  const sizes = {
    sm:  { padding: '7px 14px', fontSize: 12, borderRadius: 10 },
    md:  { padding: '12px 20px', fontSize: 14, borderRadius: 13 },
    lg:  { padding: '16px 24px', fontSize: 16, borderRadius: 15 },
  };
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: fullWidth ? '100%' : 'auto',
        background: disabled ? 'var(--gray-300)' : v.bg,
        color: disabled ? 'var(--text-tertiary)' : v.color,
        border: v.border,
        boxShadow: disabled ? 'none' : v.shadow,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        ...s,
        ...style,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'primary', style }) {
  const colors = {
    primary: { bg: 'var(--primary-light)', text: 'var(--primary)' },
    success: { bg: 'var(--cat-play-light)', text: 'var(--cat-play)' },
    warn:    { bg: 'var(--accent-light)', text: 'var(--accent)' },
    gray:    { bg: 'var(--gray-100)', text: 'var(--text-secondary)' },
    peer:    { bg: 'var(--cat-peer-light, #fce4ec)', text: 'var(--cat-peer, #c62828)' },
    habit:   { bg: 'var(--cat-habit-light)', text: 'var(--cat-habit)' },
    art:     { bg: 'var(--cat-art-light)', text: 'var(--cat-art)' },
  };
  const c = colors[color] || colors.primary;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
      borderRadius: 100, fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.text,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, maxHeight = '80vh' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight, overflowY: 'auto', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
          </div>
        )}
        {children}
        {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = 'var(--primary)', height = 6 }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: 'var(--gray-100)', borderRadius: 100, height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 100, transition: 'width 0.4s' }} />
    </div>
  );
}

// ── ScorePill ─────────────────────────────────────────────────────────────────
export function ScorePill({ score }) {
  const color = score >= 75 ? 'var(--cat-play)' : score >= 50 ? 'var(--primary)' : 'var(--accent)';
  const bg    = score >= 75 ? 'var(--cat-play-light)' : score >= 50 ? 'var(--primary-light)' : 'var(--accent-light)';
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 900, borderRadius: 100, padding: '4px 10px' }}>
      {score}점
    </span>
  );
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────
export function Spinner({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="31.4 31.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ label, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0', ...style }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {label && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

// ── EmptyCard ─────────────────────────────────────────────────────────────────
export function EmptyCard({ emoji = '📭', title, desc, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</div>
      {title && <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</div>}
      {desc  && <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: action ? 16 : 0 }}>{desc}</div>}
      {action}
    </div>
  );
}
