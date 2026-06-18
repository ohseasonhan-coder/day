import React, { useState, useEffect, useRef } from 'react';
import { login, loginWithGoogle, setInitialPassword } from '../utils/auth';
import { renderGoogleSignInButton, googleSignInWithAccountChooser, isElectron } from '../utils/driveBackup';
import { getGoogleClientId, setGoogleClientId } from '../utils/storage';
import { Zap, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

// 로그인은 구글 계정 전용. 관리자(마스터)만 아이디/비밀번호로 로그인한다.
export default function LoginPage({ onLogin }) {
  const [error, setError] = useState('');
  // 구글 로그인
  const [googleClientId, setGoogleClientIdState] = useState(() => getGoogleClientId());
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [clientIdDraft, setClientIdDraft] = useState('');
  const [googleBtnError, setGoogleBtnError] = useState('');
  const googleBtnRef = useRef(null);
  // 관리자 로그인
  const [showAdminLogin, setShowAdminLogin] = useState(() => isElectron());
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current || isElectron()) return;
    let cancelled = false;
    setGoogleBtnError('');
    renderGoogleSignInButton(
      googleClientId,
      googleBtnRef.current,
      (profile) => {
        if (cancelled) return;
        const res = loginWithGoogle(profile);
        if (!res.ok) { setError(res.error); return; }
        onLogin(res.user);
      },
      () => { if (!cancelled) setError('구글 로그인에 실패했어요. 다시 시도해 주세요.'); }
    ).catch(() => {
      if (!cancelled) setGoogleBtnError('구글 로그인 버튼을 불러오지 못했어요. 인터넷 연결과 클라이언트 ID를 확인해 주세요.');
    });
    return () => { cancelled = true; };
  }, [googleClientId, onLogin]);

  const handleSaveClientId = () => {
    const v = clientIdDraft.trim();
    if (!v.endsWith('.apps.googleusercontent.com')) {
      setGoogleBtnError('클라이언트 ID 형식이 아니에요. (…apps.googleusercontent.com 으로 끝나야 해요)');
      return;
    }
    setGoogleClientId(v);
    setGoogleClientIdState(v);
    setShowGoogleSetup(false);
    setGoogleBtnError('');
  };

  // 버튼이 마지막 사용 계정에 고정됐을 때 — 계정 선택 창을 직접 띄움
  const handleOtherAccount = async () => {
    setError('');
    try {
      const profile = await googleSignInWithAccountChooser(googleClientId);
      const res = loginWithGoogle(profile);
      if (!res.ok) { setError(res.error); return; }
      onLogin(res.user);
    } catch (e) {
      const msg = String(e.message || '');
      if (!/popup_closed|access_denied/i.test(msg)) setError(msg || '구글 로그인에 실패했어요.');
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    let res = await login(adminId, adminPw);
    // 운영 빌드: 관리자 비밀번호 미설정 상태면, 입력한 값으로 최초 설정 후 로그인
    if (!res.ok && res.needsSetup) {
      if (!adminPw || adminPw.length < 4) { setError('관리자 비밀번호는 4자 이상으로 설정해 주세요.'); return; }
      const set = await setInitialPassword(adminId, adminPw);
      if (!set.ok) { setError(set.error); return; }
      res = await login(adminId, adminPw);
    }
    if (!res.ok) { setError(res.error); return; }
    onLogin(res.user);
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
        background: 'var(--white)', borderRadius: 24, padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(79,127,255,0.14)',
      }}>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)' }}>구글 계정으로 시작하기</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.7 }}>
            별도 회원가입 없이 구글 계정 하나로 로그인하고,<br />
            기록은 자동으로 <b>본인 구글 드라이브</b>에 백업돼요.
          </div>
        </div>

        {isElectron() ? (
          <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'center', marginBottom: 16 }}>
            🖥️ 데스크탑 앱에서는 구글 로그인이 지원되지 않아요.<br />
            <b>크롬·엣지 브라우저</b>에서 사용해 주세요.
          </div>
        ) : googleClientId ? (
          <div style={{ marginBottom: 8 }}>
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
            <button onClick={handleOtherAccount} style={{
              width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
              background: 'var(--gray-50)', border: '1.5px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700,
            }}>
              👥 다른 구글 계정으로 로그인
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
              🔒 구글은 로그인과 본인 드라이브 백업에만 사용돼요.<br />
              아이 기록이 외부 서버로 전송되지 않습니다.
            </div>
          </div>
        ) : showGoogleSetup ? (
          <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 14px', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>구글 클라이언트 ID (최초 1회)</div>
            <input
              value={clientIdDraft}
              onChange={e => setClientIdDraft(e.target.value)}
              placeholder="예: 1234567890-xxxx.apps.googleusercontent.com"
              style={{ ...inputStyle, fontSize: 13, marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveClientId} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 800 }}>
                저장하고 구글 버튼 켜기
              </button>
              <button onClick={() => { setShowGoogleSetup(false); setGoogleBtnError(''); }} style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700 }}>
                취소
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.7 }}>
              console.cloud.google.com → OAuth 클라이언트 ID(웹 애플리케이션) 발급 후 붙여넣으세요.
            </div>
          </div>
        ) : (
          <button onClick={() => setShowGoogleSetup(true)} style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: 'var(--white)', border: '1.5px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 8,
          }}>
            <span style={{ fontWeight: 900, color: '#4285F4' }}>G</span> 구글로 시작하기 (최초 1회 설정 필요)
          </button>
        )}

        {googleBtnError && (
          <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 600, marginTop: 8, lineHeight: 1.6 }}>
            ⚠️ {googleBtnError}
          </div>
        )}
        {error && !showAdminLogin && (
          <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 600, marginTop: 8 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── 관리자 로그인 ─────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <button onClick={() => { setShowAdminLogin(v => !v); setError(''); }} style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={12} /> 기존 회원 로그인
          </button>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {showAdminLogin && (
          <form onSubmit={handleAdminSubmit}>
            <Field label="아이디">
              <input
                type="text"
                value={adminId}
                onChange={e => setAdminId(e.target.value.toLowerCase().trim())}
                placeholder="기존 아이디 또는 master"
                maxLength={30}
                style={inputStyle}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
            <Field label="비밀번호">
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={adminPw}
                  onChange={e => setAdminPw(e.target.value)}
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
            {error && (
              <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                ⚠️ {error}
              </div>
            )}
            <button
              type="submit"
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <LogIn size={15} /> 로그인
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.7, textAlign: 'center' }}>
              기존 아이디로 로그인한 뒤 <b>설정 → 계정 → 구글 계정 연동</b>을 해두면<br />
              다음부터 구글 버튼으로 바로 들어올 수 있어요.
            </div>
          </form>
        )}

        {/* 하단 안내 */}
        <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--gray-50)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.8 }}>
            🔒 모든 기록은 이 기기와 본인 구글 드라이브에만 저장됩니다.<br />
            개발자 서버로 전송되지 않아요.
          </div>
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
  background: 'var(--white)',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};
