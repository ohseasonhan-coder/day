import React, { useState, useEffect } from 'react';
import './index.css';
import { getClasses, getChildren, getRecords, getRecordsByDate, today, getActiveClassId, setActiveClassId, isOnboardingDone, getSettings, storage, getBackupJson, addBackupRecord, getGoogleClientId } from './utils/storage';
import { backupToDrive, getDriveMeta } from './utils/driveBackup';
import { autoSyncOnStart } from './utils/deviceSync';
import { emitSyncEvent } from './utils/driveBackup';
import SyncStatusPill from './components/SyncStatusPill';
import { isLoggedIn, getCurrentUser, logout, seedSpecialAccounts } from './utils/auth';
import { initTheme, useTheme } from './utils/theme';
import TodayPage    from './pages/TodayPage';
import RecordPage   from './pages/RecordPage';
import ChildrenPage from './pages/ChildrenPage';
import DocsPage     from './pages/DocsPage';
import CheckPage    from './pages/CheckPage';
import NotePage     from './pages/NotePage';
import SetupPage    from './pages/SetupPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage    from './pages/LoginPage';
import StatsPage      from './pages/StatsPage';
import PortfolioPage  from './pages/PortfolioPage';
import MedicinePage   from './pages/MedicinePage';
import AccidentPage   from './pages/AccidentPage';
import NewsletterPage from './pages/NewsletterPage';
import CoachPage      from './pages/CoachPage';
import EventsPage     from './pages/EventsPage';
import ConsultPage    from './pages/ConsultPage';
import ChecklistPage  from './pages/ChecklistPage';
import InternalDocsPage from './pages/InternalDocsPage';
import AutomationPage from './pages/AutomationPage';
import OnboardingModal from './components/OnboardingModal';
import SearchModal from './components/SearchModal';
import LockScreen from './components/LockScreen';

import { Home, PenLine, Users, FolderOpen, CheckSquare, Settings, Zap, BookOpen, BarChart3, Pill, AlertTriangle, Newspaper, MessageSquare, ClipboardList, Search, ChevronDown, ChevronRight, Sparkles, MoreHorizontal } from 'lucide-react';
import { MOBILE_PRIMARY, MORE_MENU_ITEMS } from './utils/navConfig';

initTheme(); // 페이지 로드 즉시 테마 적용 (깜박임 방지)

// 메뉴 id → 아이콘
const NAV_ICONS = {
  today: Home, record: PenLine, aiwrite: Zap, docs: FolderOpen, children: Users,
  settings: Settings, internal: ClipboardList, consult: MessageSquare, checklist: ClipboardList,
  check: CheckSquare, stats: BarChart3, newsletter: Newspaper, note: BookOpen,
  medicine: Pill, accident: AlertTriangle, automation: Sparkles,
};

// 모바일 하단 탭 — 핵심 4개 + 더보기 (설정은 상단 기어)
const MOBILE_NAV = [
  ...MOBILE_PRIMARY.filter((i) => i.id !== 'settings').map((i) => ({ id: i.id, label: i.label, icon: NAV_ICONS[i.id] })),
  { id: 'more', label: '더보기', icon: MoreHorizontal },
];
// 더보기 시트에 노출할 고급 기능(삭제하지 않고 이동)
const MORE_MENU = MORE_MENU_ITEMS.map((i) => ({ id: i.id, label: i.label, icon: NAV_ICONS[i.id] }));

// 데스크톱 사이드바 — 카테고리로 묶어 접을 수 있게 구성
const NAV_GROUPS = [
  {
    title: '기록 · 문서', emoji: '✍️', color: '#4F7FFF',
    items: [
      { id: 'today',    label: '오늘',     icon: Home },
      { id: 'record',   label: '오늘기록', icon: PenLine },
      { id: 'aiwrite',  label: 'AI작성',   icon: Zap },
      { id: 'automation', label: '자동화', icon: Sparkles },
      { id: 'internal', label: '원내문서', icon: ClipboardList },
      { id: 'docs',     label: '문서함',   icon: FolderOpen },
    ],
  },
  {
    title: '아이 · 평가', emoji: '🌱', color: '#4CAF50',
    items: [
      { id: 'children',  label: '원아기록',  icon: Users },
      { id: 'checklist', label: '발달 체크', icon: ClipboardList },
      { id: 'check',     label: '점검',      icon: CheckSquare },
      { id: 'stats',     label: '통계',      icon: BarChart3 },
    ],
  },
  {
    title: '소통 · 안전', emoji: '💬', color: '#FF8C42',
    items: [
      { id: 'note',       label: '알림장',    icon: BookOpen },
      { id: 'newsletter', label: '가정통신문', icon: Newspaper },
      { id: 'consult',    label: '상담 관리',  icon: MessageSquare },
      { id: 'medicine',   label: '투약',      icon: Pill },
      { id: 'accident',   label: '사고기록',  icon: AlertTriangle },
    ],
  },
];

const PAGE_TITLES = {
  today: '오늘', record: '오늘기록', aiwrite: 'AI 문서작성', note: '알림장',
  children: '원아기록', docs: '문서함', check: '점검', stats: '통계',
  internal: '원내문서', automation: '자동화 작업',
  medicine: '투약 관리', accident: '사고·상해 기록', newsletter: '가정통신문',
  coach: 'AI 코칭', events: '행사 캘린더', consult: '상담 관리', checklist: '발달 체크리스트',
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isDesktop;
}

// 앱 최초 로드 시 시드 계정 생성 (이미 있으면 무시)
seedSpecialAccounts();

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser]                       = useState(() => isLoggedIn() ? getCurrentUser() : null);
  const [page, setPage]                       = useState('today');
  const [isSetup, setIsSetup]                 = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [recordContext, setRecordContext]     = useState(null);
  const [docsContext, setDocsContext]         = useState(null);
  const [portfolioChild, setPortfolioChild]   = useState(null);
  const [automationContext, setAutomationContext] = useState(null);
  const [unrecordedCount, setUnrecordedCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [showMore, setShowMore] = useState(false);
  // 사이드바 그룹 접기 상태 — 기본은 모두 접힘 (현재 페이지가 속한 그룹만 자동으로 펼침)
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const init = {};
    NAV_GROUPS.forEach(g => { init[g.title] = true; });
    return init;
  });
  const [activeClassId, setActiveClassIdState] = useState(() => getActiveClassId());
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  // iOS는 자동 설치 배너(beforeinstallprompt)가 없어 직접 안내 — 홈 화면 추가 후에는 표시 안 함
  const [showIosGuide, setShowIosGuide] = useState(() => {
    try {
      const ua = navigator.userAgent;
      const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      return isIos && !standalone && localStorage.getItem('sw_ios_install_dismissed') !== '1';
    } catch { return false; }
  });
  const dismissIosGuide = () => {
    try { localStorage.setItem('sw_ios_install_dismissed', '1'); } catch {}
    setShowIosGuide(false);
  };
  const [showOnboarding, setShowOnboarding] = useState(() => user ? !isOnboardingDone() : false);
  // PIN 잠금 — 설정돼 있으면 앱을 열 때 잠금
  const [locked, setLocked] = useState(() => {
    try { return !!(user && getSettings().pinHash); } catch { return false; }
  });
  const isDesktop = useIsDesktop();

  // 방치 시 자동 잠금 (설정한 시간 동안 입력이 없으면)
  useEffect(() => {
    if (!user) return;
    const settings = getSettings();
    if (!settings.pinHash) return;
    const minutes = Number(settings.pinLockMinutes ?? 5);
    if (!minutes) return; // 0 = 앱을 열 때만 잠금
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last > minutes * 60000) setLocked(true);
    }, 15000);
    return () => { events.forEach(ev => window.removeEventListener(ev, bump)); clearInterval(timer); };
  }, [user, showSettings]);

  const handleSetActiveClass = (id) => {
    setActiveClassId(id);
    setActiveClassIdState(id);
  };

  useEffect(() => {
    if (!user) return;
    if (getClasses().length === 0) setIsSetup(true);
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  useEffect(() => {
    if (!user) return;
    const children = getChildren();
    const recs     = getRecordsByDate(today());
    const ids      = new Set(recs.map(r => r.childId));
    setUnrecordedCount(children.filter(c => !ids.has(c.id)).length);
  }, [page, user]);

  // 미기록 아이 알림 — 설정에서 켠 경우, 하루 1회만
  useEffect(() => {
    if (!user) return;
    const settings = getSettings();
    if (!settings.notifyUnrecorded) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const todayStr = today();
    if (storage.get('sw_notify_last') === todayStr) return;

    const children = getChildren();
    if (children.length === 0) return;
    const ids = new Set(getRecordsByDate(todayStr).map(r => r.childId));
    const missing = children.filter(c => !ids.has(c.id));
    if (missing.length === 0) return;

    const names = missing.slice(0, 3).map(c => c.name).join(', ');
    const extra = missing.length > 3 ? ` 외 ${missing.length - 3}명` : '';
    try {
      new Notification('쌤워크 — 오늘 미기록 원아가 있어요', {
        body: `${names}${extra} (${missing.length}명) 아직 기록이 없어요.`,
        tag: 'sw-unrecorded',
      });
      storage.set('sw_notify_last', todayStr);
    } catch {}
  }, [user]);

  // 구글 드라이브 자동 백업 — 켜져 있으면 앱 열 때 하루 1회 조용히 업로드
  useEffect(() => {
    if (!user) return;
    const settings = getSettings();
    const clientId = (getGoogleClientId() || settings.driveClientId || '').trim();
    if (!settings.driveAutoBackup || !clientId) return;
    if (getRecords().length === 0) return;
    const last = getDriveMeta().lastBackupAt;
    if (last && Date.now() - new Date(last).getTime() < 20 * 3600 * 1000) return;

    backupToDrive(clientId, getBackupJson(), { silent: true })
      .then(() => addBackupRecord())
      .catch(() => {}); // 조용히 실패 — 설정 > 백업/복구에서 수동 백업 가능
  }, [user]);

  // 앱 시작 시 보수적 자동 동기화(1회): 자동 백업을 켠 경우에만, 원격이 명백히 최신이면 가져오기.
  // 충돌이거나 로컬이 최신이면 자동으로 데이터를 바꾸지 않는다(설정 화면에서 수동 선택).
  useEffect(() => {
    if (!user) return;
    try { if (sessionStorage.getItem('sw_autosync_done')) return; } catch {}
    const settings = getSettings();
    const clientId = (getGoogleClientId() || settings.driveClientId || '').trim();
    if (!settings.driveAutoBackup || !clientId) return;
    try { sessionStorage.setItem('sw_autosync_done', '1'); } catch {}
    autoSyncOnStart(clientId, { enabled: true })
      .then(r => {
        if (r && r.applied === 'pull') { window.location.reload(); return; } // 가져온 데이터 반영
        if (r && r.action === 'conflict') emitSyncEvent('conflict'); // 상단 표시로 알림(자동 변경 안 함)
      })
      .catch(() => {}); // 조용히 실패 — 설정 화면에서 상태 확인/수동 동기화 가능
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (user) setShowSearch(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user]);

  const handleLogout = () => {
    logout();
    setUser(null);
    setPage('today');
    setIsSetup(false);
  };

  if (!user)        return <LoginPage    onLogin={(u) => { setUser(u); setPage('today'); setLocked(false); setShowOnboarding(!isOnboardingDone()); }} />;
  if (locked && getSettings().pinHash) {
    return (
      <LockScreen
        pinHash={getSettings().pinHash}
        displayName={user.displayName}
        onUnlock={() => setLocked(false)}
        onLogout={() => { setLocked(false); handleLogout(); }}
      />
    );
  }
  if (isSetup)      return <SetupPage    onComplete={() => setIsSetup(false)} />;
  if (showSettings) return <SettingsPage onBack={() => setShowSettings(false)} currentUser={user} onLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme} activeClassId={activeClassId} onSetActiveClass={handleSetActiveClass} />;

  const handleNavigate = (p, ctx = null) => {
    setPage(p);
    setRecordContext(p === 'record' ? ctx : null);
    setDocsContext((p === 'docs' || p === 'aiwrite') ? ctx : null);
    setPortfolioChild(p === 'portfolio' ? ctx : null);
    setAutomationContext(p === 'automation' ? ctx : null);
  };

  const pageProps = { onNavigate: handleNavigate, isDesktop, isDark, toggleTheme, activeClassId };

  const renderPage = () => {
    switch (page) {
      case 'today':    return <TodayPage    {...pageProps} />;
      case 'record':   return <RecordPage   {...pageProps} context={recordContext} />;
      case 'note':     return <NotePage     {...pageProps} />;
      case 'children': return <ChildrenPage {...pageProps} />;
      case 'docs':     return <DocsPage     {...pageProps} context={docsContext} initialTab="history" />;
      case 'aiwrite':  return <DocsPage     {...pageProps} context={docsContext} initialTab="new" />;
      case 'check':    return <CheckPage    {...pageProps} />;
      case 'stats':      return <StatsPage      {...pageProps} />;
      case 'medicine':   return <MedicinePage   {...pageProps} />;
      case 'accident':   return <AccidentPage   {...pageProps} />;
      case 'newsletter': return <NewsletterPage {...pageProps} />;
      case 'coach':      return <CoachPage      {...pageProps} />;
      case 'events':     return <EventsPage     {...pageProps} />;
      case 'consult':    return <ConsultPage    {...pageProps} />;
      case 'checklist':  return <ChecklistPage  {...pageProps} />;
      case 'internal':   return <InternalDocsPage {...pageProps} />;
      case 'automation': return <AutomationPage {...pageProps} context={automationContext} />;
      case 'portfolio': return portfolioChild ? <PortfolioPage {...pageProps} childId={portfolioChild.childId} childName={portfolioChild.childName} onBack={() => handleNavigate('children')} /> : <ChildrenPage {...pageProps} />;
      default:         return <TodayPage    {...pageProps} />;
    }
  };

  /* ─── 데스크톱 레이아웃 ─────────────────────────── */
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--gray-50)' }}>
        {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}

        {/* 사이드바 */}
        <aside style={{
          width: 230, flexShrink: 0, background: 'white',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, height: '100vh',
          boxShadow: '4px 0 28px rgba(79,127,255,0.07)', zIndex: 100,
        }}>
          {/* 로고 */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} color="white" fill="white" />
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.7px' }}>쌤워크</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 2 }}>선생님은 기록만, 문서는 앱이.</div>
          </div>

          {/* 네비 — 카테고리별 그룹 (접기 가능) */}
          <nav style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
            {NAV_GROUPS.map((group, gi) => {
              const groupHasActive = group.items.some(it => it.id === page);
              // 현재 페이지가 속한 그룹은 접혀 있어도 자동으로 펼쳐 보여준다
              const collapsed = !!collapsedGroups[group.title] && !groupHasActive;
              return (
                <div key={group.title} style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => setCollapsedGroups(c => ({ ...c, [group.title]: !c[group.title] }))}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '11px 12px', borderRadius: 12, marginBottom: 4,
                      background: collapsed ? 'var(--gray-50)' : `${group.color}14`,
                      borderLeft: `3px solid ${group.color}`,
                      fontSize: 15.5, fontWeight: 900, letterSpacing: '-0.3px',
                      color: group.color,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{group.emoji}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{group.title}</span>
                    {collapsed ? <ChevronRight size={17} strokeWidth={2.5} /> : <ChevronDown size={17} strokeWidth={2.5} />}
                  </button>
                  {!collapsed && group.items.map(({ id, label, icon: Icon }) => {
                    const active = page === id;
                    const badge  = (id === 'today' || id === 'record' || id === 'check') && unrecordedCount > 0 ? unrecordedCount : 0;
                    return (
                      <button
                        key={id}
                        onClick={() => handleNavigate(id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                          padding: '10px 14px', borderRadius: 12, marginBottom: 2,
                          background: active ? 'var(--primary-light)' : 'transparent',
                          color:      active ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: 14, fontWeight: active ? 800 : 500,
                          transition: 'all 0.12s',
                        }}
                      >
                        <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                        {badge > 0 && (
                          <span style={{ minWidth: 20, height: 20, padding: '0 5px', background: 'var(--accent)', color: 'white', borderRadius: 100, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* 설정 + 사용자 */}
          <div style={{ padding: '12px 12px 18px', borderTop: '1px solid var(--border)' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: 'var(--primary)', flexShrink: 0 }}>
                  {user.displayName?.[0] || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{user.userId}</div>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 12, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}
            >
              <Settings size={19} strokeWidth={1.8} /> 설정
            </button>
          </div>
        </aside>

        {/* 콘텐츠 */}
        <div style={{ marginLeft: 230, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header className="no-print" style={{
            height: 58, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 36px', position: 'sticky', top: 0, zIndex: 50,
          }}>
            <div>
              <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {PAGE_TITLES[page] || '쌤워크'}
              </span>
              {unrecordedCount > 0 && page === 'today' && (
                <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-light)', padding: '3px 10px', borderRadius: 100 }}>
                  미기록 원아 {unrecordedCount}명
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SyncStatusPill onClick={() => setShowSettings(true)} />
              <button
                onClick={() => setShowSearch(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--gray-100)', color: 'var(--text-secondary)', padding: '9px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}
                title="전체 검색 (Ctrl+K)"
              >
                <Search size={15} /> 검색
              </button>
              <button
                onClick={() => handleNavigate('record')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--primary)', color: 'white', padding: '9px 18px', borderRadius: 12, fontSize: 13, fontWeight: 800, boxShadow: '0 4px 14px rgba(79,127,255,0.3)' }}
              >
                <PenLine size={15} /> 기록하기
              </button>
            </div>
          </header>
          <main className="page-enter" style={{ flex: 1 }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              {renderPage()}
            </div>
          </main>
        </div>
        {showInstallBanner && (
          <div style={{
            position: 'fixed', bottom: 20,
            left: '50%', transform: 'translateX(-50%)',
            background: 'var(--gray-800)', color: 'white',
            borderRadius: 14, padding: '12px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: 'var(--shadow-lg)', zIndex: 9999,
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            📲 홈 화면에 추가하면 앱처럼 사용할 수 있어요
            <button onClick={handleInstall} style={{ background: 'var(--primary)', color: 'white', borderRadius: 8, padding: '6px 14px', fontWeight: 800, fontSize: 13 }}>설치</button>
            <button onClick={() => setShowInstallBanner(false)} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        )}
        {showIosGuide && !showInstallBanner && (
          <div style={{
            position: 'fixed', bottom: 20,
            left: '50%', transform: 'translateX(-50%)',
            background: 'var(--gray-800)', color: 'white',
            borderRadius: 14, padding: '13px 16px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            boxShadow: 'var(--shadow-lg)', zIndex: 9999,
            fontSize: 13, fontWeight: 600, maxWidth: 460,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>📲</span>
            <span style={{ flex: 1, lineHeight: 1.6 }}>
              아이패드·아이폰에서도 앱처럼 설치할 수 있어요!<br />
              <b>Safari 공유 버튼</b> <span style={{ display: 'inline-block', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 4, padding: '0 5px', fontSize: 11 }}>⬆</span> → <b>"홈 화면에 추가"</b>를 누르세요
            </span>
            <button onClick={dismissIosGuide} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        )}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} onNavigate={handleNavigate} />
      </div>
    );
  }

  /* ─── 모바일 레이아웃 ───────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <header className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,250,254,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => handleNavigate('today')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent' }}>
          <Home size={18} color="var(--primary)" />
          <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary)', letterSpacing: '-0.5px' }}>쌤워크</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SyncStatusPill compact onClick={() => setShowSettings(true)} />
          <button
            onClick={() => setShowSearch(true)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-600)' }}
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-600)' }}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="page-enter" style={{ flex: 1, paddingBottom: 'calc(var(--bottom-nav) + 16px)' }}>
        {renderPage()}
      </main>

      <nav className="no-print" style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        height: 'var(--bottom-nav)', padding: '0 8px',
        zIndex: 200, boxShadow: '0 -4px 24px rgba(79,127,255,0.06)',
      }}>
        {MOBILE_NAV.map(({ id, label, icon: Icon }) => {
          const active = id === 'more' ? showMore : (page === id || (id === 'docs' && page === 'note'));
          const badge  = (id === 'record' || id === 'check') && unrecordedCount > 0 ? unrecordedCount : 0;
          return (
            <button key={id} onClick={() => (id === 'more' ? setShowMore(true) : handleNavigate(id))} style={{
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
      {showInstallBanner && (
        <div style={{
          position: 'fixed', bottom: 'calc(var(--bottom-nav) + 8px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'var(--gray-800)', color: 'white',
          borderRadius: 14, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: 'var(--shadow-lg)', zIndex: 9999,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          maxWidth: 440, width: 'calc(100% - 32px)',
        }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>📲 홈 화면에 추가하면 앱처럼 사용할 수 있어요</span>
          <button onClick={handleInstall} style={{ background: 'var(--primary)', color: 'white', borderRadius: 8, padding: '6px 14px', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>설치</button>
          <button onClick={() => setShowInstallBanner(false)} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}
      {showIosGuide && !showInstallBanner && (
        <div style={{
          position: 'fixed', bottom: 'calc(var(--bottom-nav) + 8px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'var(--gray-800)', color: 'white',
          borderRadius: 14, padding: '13px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          boxShadow: 'var(--shadow-lg)', zIndex: 9999,
          fontSize: 13, fontWeight: 600,
          maxWidth: 440, width: 'calc(100% - 32px)',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📲</span>
          <span style={{ flex: 1, lineHeight: 1.6 }}>
            아이폰에서도 앱처럼 설치할 수 있어요!<br />
            <b>Safari 하단 공유 버튼</b> <span style={{ display: 'inline-block', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 4, padding: '0 5px', fontSize: 11 }}>⬆</span> → <b>"홈 화면에 추가"</b>를 누르세요
          </span>
          <button onClick={dismissIosGuide} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}
      {showMore && (
        <div onClick={() => setShowMore(false)} className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,20,50,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--white)', borderRadius: '20px 20px 0 0', padding: '18px 18px calc(var(--bottom-nav) + 18px)', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 900 }}>더보기</span>
              <button onClick={() => setShowMore(false)} style={{ fontSize: 20, lineHeight: 1, color: 'var(--text-tertiary)', background: 'transparent' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {MORE_MENU.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setShowMore(false); handleNavigate(id); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, background: 'var(--gray-50, var(--gray-100))', minHeight: 74 }}>
                  {Icon && <Icon size={20} color="var(--primary)" />}
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                </button>
              ))}
              <button onClick={() => { setShowMore(false); setShowSettings(true); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, background: 'var(--gray-50, var(--gray-100))', minHeight: 74 }}>
                <Settings size={20} color="var(--primary)" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>설정</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} onNavigate={handleNavigate} />
    </div>
  );
}





