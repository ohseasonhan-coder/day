import React, { useState, useEffect } from 'react';
import './index.css';
import { getClasses } from './utils/storage';

// Pages
import TodayPage from './pages/TodayPage';
import RecordPage from './pages/RecordPage';
import ChildrenPage from './pages/ChildrenPage';
import DocsPage from './pages/DocsPage';
import CheckPage from './pages/CheckPage';
import SetupPage from './pages/SetupPage';
import SettingsPage from './pages/SettingsPage';

// Icons
import { Home, PenLine, Users, FolderOpen, CheckSquare, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'today', label: '오늘', icon: Home },
  { id: 'record', label: '기록', icon: PenLine },
  { id: 'children', label: '아이들', icon: Users },
  { id: 'docs', label: '문서함', icon: FolderOpen },
  { id: 'check', label: '점검', icon: CheckSquare },
];

export default function App() {
  const [page, setPage] = useState('today');
  const [isSetup, setIsSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recordContext, setRecordContext] = useState(null); // for pre-selected child

  useEffect(() => {
    const classes = getClasses();
    if (classes.length === 0) setIsSetup(true);
  }, []);

  if (isSetup) {
    return <SetupPage onComplete={() => setIsSetup(false)} />;
  }

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />;
  }

  const handleNavigate = (p, ctx = null) => {
    setPage(p);
    if (ctx) setRecordContext(ctx);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Top Bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,250,254,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--primary)', letterSpacing: '-0.5px' }}>
          쌤워크
        </span>
        <button onClick={() => setShowSettings(true)} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--gray-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gray-600)',
          transition: 'background 0.15s',
        }}>
          <Settings size={18} />
        </button>
      </header>

      {/* Page Content */}
      <main style={{ flex: 1, paddingBottom: 'calc(var(--bottom-nav) + 16px)' }}>
        {page === 'today' && <TodayPage onNavigate={handleNavigate} />}
        {page === 'record' && <RecordPage context={recordContext} onNavigate={handleNavigate} />}
        {page === 'children' && <ChildrenPage onNavigate={handleNavigate} />}
        {page === 'docs' && <DocsPage onNavigate={handleNavigate} />}
        {page === 'check' && <CheckPage onNavigate={handleNavigate} />}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        height: 'var(--bottom-nav)',
        padding: '0 8px',
        zIndex: 200,
        boxShadow: '0 -4px 24px rgba(79,127,255,0.06)',
      }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => handleNavigate(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: '8px 4px',
                borderRadius: 'var(--radius-md)',
                transition: 'all 0.15s ease',
                color: active ? 'var(--primary)' : 'var(--text-tertiary)',
                background: active ? 'var(--primary-light)' : 'transparent',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, letterSpacing: '-0.2px' }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
