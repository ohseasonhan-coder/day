import React, { useState } from 'react';
import { login, register } from '../utils/auth';
import { Zap, Eye, EyeOff, UserPlus, LogIn, ChevronRight } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [mode, setMode]           = useState('login'); // 'login' | 'signup'
  const [userId, setUserId]       = useState('');
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const reset = () => {
    setError('');
    setPassword('');
    setPassword2('');
  };

  const switchMode = (m) => {
    setMode(m);
    reset();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'login') {
      const res = login(userId, password);
      if (!res.ok) { setError(res.error); setLoading(false); return; }
      onLogin(res.user);
    } else {
      if (password !== password2) {
        setError('비밀번호가 일치하지 않아요.'); setLoading(false); return;
      }
      const res = register(userId, password, displayName);
      if (!res.ok) { setError(res.error); setLoading(false); return; }
      onLogin(res.user);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, var(--gray-50) 0%, #EEF2FF 100%)',
      padding: '24px 20px',
    }}>

      {/* 로고 */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 12px 32px rgba(79,127,255,0.32)',
        }}>
          <Zap size={32} color="white" fill="white" />
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-1px' }}>쌤워크</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
          선생님은 기록만, 문서는 앱이.
        </div>
      </div>

      {/* 카드 */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'white', borderRadius: 24, padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(79,127,255,0.14)',
      }}>

        {/* 모드 탭 */}
        <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 12, padding: 4, marginBottom: 28 }}>
          {[['login', '로그인', <LogIn size={14} />], ['signup', '회원가입', <UserPlus size={14} />]].map(([m, label, icon]) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? 'var(--primary)' : 'var(--text-tertiary)',
              boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}>
              {icon} {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>

          {/* 이름 (회원가입만) */}
          {mode === 'signup' && (
            <Field label="선생님 이름" required>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="홍길동"
                maxLength={20}
                style={inputStyle}
                autoFocus
              />
            </Field>
          )}

          {/* 아이디 */}
          <Field label="아이디" hint={mode === 'signup' ? '영문 소문자·숫자·밑줄, 3자 이상' : undefined}>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value.toLowerCase().trim())}
              placeholder="teacher01"
              maxLength={30}
              style={inputStyle}
              autoFocus={mode === 'login'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>

          {/* 비밀번호 */}
          <Field label="비밀번호" hint={mode === 'signup' ? '4자 이상' : undefined}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          {/* 비밀번호 확인 (회원가입만) */}
          {mode === 'signup' && (
            <Field label="비밀번호 확인">
              <input
                type={showPw ? 'text' : 'password'}
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                placeholder="••••••••"
                style={{
                  ...inputStyle,
                  borderColor: password2 && password !== password2 ? 'var(--accent)' : undefined,
                }}
              />
            </Field>
          )}

          {/* 에러 */}
          {error && (
            <div style={{
              background: 'var(--accent-light)', color: 'var(--accent)',
              borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 600,
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: loading ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: 'white', fontSize: 15, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : '0 8px 24px rgba(79,127,255,0.35)',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {mode === 'login'
              ? <><LogIn size={17} /> 로그인</>
              : <><UserPlus size={17} /> 계정 만들기</>
            }
            {!loading && <ChevronRight size={16} />}
          </button>
        </form>

        {/* 하단 안내 */}
        <div style={{ marginTop: 20, padding: '16px', background: 'var(--gray-50)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8, textAlign: 'center' }}>
            {mode === 'login' ? (
              <>계정이 없으신가요? <button onClick={() => switchMode('signup')} style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 12 }}>회원가입</button></>
            ) : (
              <>이미 계정이 있으신가요? <button onClick={() => switchMode('login')} style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 12 }}>로그인</button></>
            )}
          </div>
          {mode === 'login' && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center', lineHeight: 1.7 }}>
              🔒 모든 데이터는 이 기기에만 저장됩니다.<br />
              외부 서버로 전송되지 않아요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 7 }}>
        <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '13px 15px',
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  fontSize: 15,
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'white',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};
