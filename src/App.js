import React, { useState, useEffect } from 'react';
import './index.css';
import { getClasses, getChildren, getRecordsByDate, today } from './utils/storage';
import { isLoggedIn, getCurrentUser, logout } from './utils/auth';

import TodayPage    from './pages/TodayPage';
import RecordPage   from './pages/RecordPage';
import ChildrenPage from './pages/ChildrenPage';
import DocsPage     from './pages/DocsPage';
import CheckPage    from './pages/CheckPage';
import SetupPage    from './pages/SetupPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage    from './pages/LoginPage';

import { Home, PenLine, Users, FolderOpen, CheckSquare, Settings, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'today',    label: '오늘',   icon: Home },
  { id: 'record',   label: '기록',   icon: PenLine },
  { id: 'children', label: '아이들', icon: Users },
  { id: 'docs',     label: '문서함', icon: FolderOpen },
  { id: 'check',    label: '점검',   icon: CheckSquare },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isDesktop;
}

export default function App() {
  const [user, setUser]                     = useState(() => isLoggedIn() ? getCurrentUser() : null);
  const [page, setPage]                     = useState('today');
  const [isSetup, setIsSetup]               = useState(false);
  const [showSettings, setShowSettings]     = useState(false);
  const [recordContext, setRecordContext]   = useState(null);
  const [unrecordedCount, setUnrecordedCount] = useState(0);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!user) return;
    if (getClasses().length === 0) setIsSetup(true);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const children = getChildren();
    const recs     = getRecordsByDate(today());
    const ids      = new Set(recs.map(r => r.childId));
    setUnrecordedCount(children.filter(c => !ids.has(c.id)).length);
  }, [page, user]);

  const handleLogout = () => {
    logout();
    setUser(null);
    setPage('today');
    setIsSetup(false);
  };

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!user) {
    return <LoginPage onLogin={(u) => { setUser(u); setPage('today'); }} />;
  }

  if (isSetup)     return <SetupPage    onComplete={() => setIsSetup(false)} />;
  if (showSettings) return <SettingsPage onBack={() => setShowSettings(false)} currentUser={user} onLogout={handleLogout} />;

  const handleNavigate = (p, ctx = null) => {
    setPage(p);
    setRecordContext(p === 'record' ? ctx : null);
  };

  const pageProps = { onNavigate: handleNavigate, isDesktop };
  const renderPage = () => {
    switch (page) {
      case 'today':    return <TodayPage    {...pageProps} />;
      case 'record':   return <RecordPage   {...pageProps} context={recordContext} />;
      case 'children': return <ChildrenPage {...pageProps} />;
      case 'docs':     return <DocsPage     {...pageProps} />;
      case 'check':    return <CheckPage    {...pageProps} />;
      default:         return <TodayPage    {...pageProps} />;
    }
  };

  /* ─── 데스크톱 레이아웃 ─────────────────────────── */
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--gray-50)' }}>

        {/* 사이드바 */}
        <aside style={{
          width: 230, flexShrink: 0,
          background: 'white',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, height: '100vh',
          boxShadow: '4px 0 28px rgba(79,127,255,0.07)',
          zIndex: 100,
        }}>
          {/* 로고 */}
          <div style={{ padding: '28px 24px 22px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} color="white" fill="white" />
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.7px' }}>쌤워크</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, paddingLeft: 2 }}>
              선생님은 기록만, 문서는 앱이.
            </div>
          </div>

          {/* 네비 아이템 */}
          <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.6px', padding: '4px 12px 10px', textTransform: 'uppercase' }}>
              메뉴
            </div>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = page === id;
              const badge  = (id === 'record' || id === 'check') && unrecordedCount > 0 ? unrecordedCount : 0;
              return (
                <button
                  key={id}
                  onClick={() => handleNavigate(id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                    padding: '11px 14px', borderRadius: 12, marginBottom: 3,
                    background: active ? 'var(--primary-light)' : 'transparent',
                    color:      active ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: 14, fontWeight: active ? 800 : 500,
                    transition: 'all 0.12s',
                  }}
                >
                  <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                  {badge > 0 && (
                    <span style={{
                      minWidth: 20, height: 20, padding: '0 5px',
                      background: 'var(--accent)', color: 'white',
                      borderRadius: 100, fontSize: 11, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* 설정 */}
          <div style={{ padding: '14px 12px 20px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '11px 14px', borderRadius: 12,
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
              }}
            >
              <Settings size={19} strokeWidth={1.8} />
              설정
            </button>
          </div>
        </aside>

        {/* 콘텐츠 영역 */}
        <div style={{ marginLeft: 230, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* 데스크톱 상단바 */}
          <header style={{
            height: 58, background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 36px',
            position: 'sticky', top: 0, zIndex: 50,
          }}>
            <div>
              <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {NAV_ITEMS.find(n => n.id === page)?.label}
              </span>
              {unrecordedCount > 0 && page === 'today' && (
                <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-light)', padding: '3px 10px', borderRadius: 100 }}>
                  미기록 아이 {unrecordedCount}명
                </span>
              )}
            </div>
            <button
              onClick={() => handleNavigate('record')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--primary)', color: 'white',
                padding: '9px 18px', borderRadius: 12,
                fontSize: 13, fontWeight: 800,
                boxShadow: '0 4px 14px rgba(79,127,255,0.3)',
              }}
            >
              <PenLine size={15} /> 기록하기
            </button>
          </header>

          {/* 페이지 */}
          <main className="page-enter" style={{ flex: 1 }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
              {renderPage()}
            </div>
          </main>
        </div>
      </div>
    );
  }

  /* ─── 모바일 레이아웃 ───────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,250,254,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary)', letterSpacing: '-0.5px' }}>쌤워크</span>
        <button
          onClick={() => setShowSettings(true)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-600)' }}
        >
          <Settings size={18} />
        </button>
      </header>

      <main className="page-enter" style={{ flex: 1, paddingBottom: 'calc(var(--bottom-nav) + 16px)' }}>
        {renderPage()}
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        height: 'var(--bottom-nav)', padding: '0 8px',
        zIndex: 200, boxShadow: '0 -4px 24px rgba(79,127,255,0.06)',
      }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          const badge  = (id === 'record' || id === 'check') && unrecordedCount > 0 ? unrecordedCount : 0;
          return (
            <button key={id} onClick={() => handleNavigate(id)} style={{
              flex: 1, position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              color: active ? 'var(--primary)' : 'var(--text-tertiary)',
              background: active ? 'var(--primary-light)' : 'transparent',
            }}>
              {badge > 0 && <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, letterSpacing: '-0.2px' }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
