import React, { useState, useRef, useEffect } from 'react';
import { hashPin } from '../utils/storage';
import { Zap, LogOut } from 'lucide-react';

// 화면 잠금 — 설정한 4자리 PIN을 입력해야 해제됩니다
export default function LockScreen({ pinHash, onUnlock, onLogout, displayName }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (hashPin(pin) === pinHash) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => { setPin(''); setError(false); }, 600);
    }
  }, [pin, pinHash, onUnlock]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'linear-gradient(160deg, var(--gray-50) 0%, #EEF2FF 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 18, background: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14, boxShadow: '0 10px 28px rgba(79,127,255,0.3)',
      }}>
        <Zap size={28} color="white" fill="white" />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>화면 잠금</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
        {displayName ? `${displayName} 선생님, ` : ''}PIN 4자리를 입력하세요
      </div>

      {/* PIN 점 표시 */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            background: i < pin.length ? (error ? 'var(--accent)' : 'var(--primary)') : 'var(--gray-200)',
            transition: 'background 0.12s',
          }} />
        ))}
      </div>
      {error && <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 14 }}>PIN이 일치하지 않아요</div>}

      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        autoFocus
        style={{
          width: 180, padding: '13px 16px', borderRadius: 14, textAlign: 'center',
          border: `2px solid ${error ? 'var(--accent)' : 'var(--border)'}`,
          fontSize: 22, letterSpacing: 12, fontWeight: 900, outline: 'none',
          background: 'var(--white)', color: 'var(--text-primary)',
        }}
      />

      <button onClick={onLogout} style={{
        marginTop: 32, display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)',
        background: 'transparent', padding: '8px 14px',
      }}>
        <LogOut size={14} /> PIN을 잊으셨나요? 로그아웃 후 다시 로그인
      </button>
    </div>
  );
}
