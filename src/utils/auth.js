// ─── 인증 유틸리티 ────────────────────────────────────────────────────────────
// 백엔드 없이 localStorage 기반 멀티 계정 관리
// 계정 목록: 'sw_accounts' / 현재 세션: 'sw_session'

const ACCOUNTS_KEY = 'sw_accounts';
const SESSION_KEY  = 'sw_session';

function safeJson(str) {
  try { return str ? JSON.parse(str) : null; } catch { return null; }
}

// ── 계정 목록 ────────────────────────────────────────────────────────────────
export function getAccounts() {
  return safeJson(localStorage.getItem(ACCOUNTS_KEY)) || [];
}
function saveAccountsInternal(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

// ── 현재 세션 ────────────────────────────────────────────────────────────────
export function getCurrentUser() {
  return safeJson(localStorage.getItem(SESSION_KEY));
}
export function getUserId() {
  return getCurrentUser()?.userId || null;
}
export function isLoggedIn() {
  return !!getCurrentUser();
}

// ── 플랜 상수 ────────────────────────────────────────────────────────────────
export const PLANS = {
  FREE:      'free',       // 일반 무료 계정
  PREMIUM:   'premium',    // 유료 구독 계정
  VIP:       'vip',        // 영구 무료 계정 (유료화 이후에도 무료 유지)
};

// ── 플랜 확인 헬퍼 ───────────────────────────────────────────────────────────
export function isPremium(user) {
  return user?.plan === PLANS.PREMIUM || user?.plan === PLANS.VIP;
}
export function isVip(user) {
  return user?.plan === PLANS.VIP;
}

// ── 회원가입 ─────────────────────────────────────────────────────────────────
// 반환값: { ok: true, user } | { ok: false, error: string }
export function register(userId, password, displayName, plan = PLANS.FREE) {
  const userId2 = userId.trim().toLowerCase();
  if (!userId2)       return { ok: false, error: '아이디를 입력해 주세요.' };
  if (userId2.length < 3) return { ok: false, error: '아이디는 3자 이상이어야 해요.' };
  if (!/^[a-z0-9_]+$/.test(userId2))
    return { ok: false, error: '아이디는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있어요.' };
  if (!password || password.length < 4)
    return { ok: false, error: '비밀번호는 4자 이상이어야 해요.' };
  if (!displayName.trim())
    return { ok: false, error: '선생님 이름을 입력해 주세요.' };

  const accounts = getAccounts();
  if (accounts.find(a => a.userId === userId2))
    return { ok: false, error: '이미 사용 중인 아이디예요.' };

  const user = {
    userId: userId2,
    password,
    displayName: displayName.trim(),
    plan,
    createdAt: new Date().toISOString(),
  };
  saveAccountsInternal([...accounts, user]);
  setSession(user);
  return { ok: true, user };
}

// ── 시드 계정 (앱 초기화 시 자동 생성) ──────────────────────────────────────
// 이미 존재하는 계정은 건드리지 않음 (idempotent)
const SEED_ACCOUNTS = [
  // ① 테스트 계정
  { userId: 'saemtest',  password: 'test1234',  displayName: '테스트계정',  plan: PLANS.VIP },
  // ② VIP 계정 × 5 — 유료화 이후에도 영구 무료
  { userId: 'ssam01',    password: 'Saem@2025', displayName: '쌤워크VIP01', plan: PLANS.VIP },
  { userId: 'ssam02',    password: 'Saem@2025', displayName: '쌤워크VIP02', plan: PLANS.VIP },
  { userId: 'ssam03',    password: 'Saem@2025', displayName: '쌤워크VIP03', plan: PLANS.VIP },
  { userId: 'ssam04',    password: 'Saem@2025', displayName: '쌤워크VIP04', plan: PLANS.VIP },
  { userId: 'ssam05',    password: 'Saem@2025', displayName: '쌤워크VIP05', plan: PLANS.VIP },
];

export function seedSpecialAccounts() {
  const accounts = getAccounts();
  let changed = false;
  SEED_ACCOUNTS.forEach(seed => {
    if (!accounts.find(a => a.userId === seed.userId)) {
      accounts.push({ ...seed, createdAt: new Date().toISOString() });
      changed = true;
    }
  });
  if (changed) saveAccountsInternal(accounts);
}

// ── 로그인 ────────────────────────────────────────────────────────────────────
export function login(userId, password) {
  const userId2 = userId.trim().toLowerCase();
  const accounts = getAccounts();
  const account = accounts.find(a => a.userId === userId2 && a.password === password);
  if (!account) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않아요.' };
  setSession(account);
  return { ok: true, user: account };
}

// ── 구글 계정으로 로그인/가입 ────────────────────────────────────────────────
// 구글 ID 토큰에서 얻은 프로필(sub/email/name)로 로컬 계정을 찾거나 새로 만듭니다.
// 인증만 구글을 쓰고, 데이터 저장은 기존과 동일하게 이 기기(localStorage)에만 됩니다.
export function loginWithGoogle(profile) {
  const sub = String(profile?.sub || '').trim();
  if (!sub) return { ok: false, error: '구글 인증 정보가 올바르지 않아요.' };

  const accounts = getAccounts();
  let account = accounts.find(a => a.googleSub === sub);
  if (!account) {
    const displayName = (profile.name || profile.email?.split('@')[0] || '선생님').trim();
    account = {
      userId: `g_${sub}`,
      googleSub: sub,
      email: profile.email || '',
      provider: 'google',
      displayName,
      plan: PLANS.FREE,
      createdAt: new Date().toISOString(),
    };
    saveAccountsInternal([...accounts, account]);
  }
  setSession(account);
  return { ok: true, user: account };
}

// ── 로그아웃 ──────────────────────────────────────────────────────────────────
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

// ── 비밀번호 변경 ─────────────────────────────────────────────────────────────
export function changePassword(userId, oldPw, newPw) {
  if (!newPw || newPw.length < 4)
    return { ok: false, error: '새 비밀번호는 4자 이상이어야 해요.' };
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.userId === userId && a.password === oldPw);
  if (idx === -1) return { ok: false, error: '현재 비밀번호가 올바르지 않아요.' };
  accounts[idx] = { ...accounts[idx], password: newPw };
  saveAccountsInternal(accounts);
  setSession(accounts[idx]);
  return { ok: true };
}

// ── 계정 삭제 ─────────────────────────────────────────────────────────────────
export function deleteAccount(userId, password) {
  const accounts = getAccounts();
  // 구글 계정은 비밀번호가 없으므로 userId 일치만 확인 (UI에서 확인창을 거침)
  const idx = accounts.findIndex(a =>
    a.userId === userId && (a.provider === 'google' || a.password === password)
  );
  if (idx === -1) return { ok: false, error: '비밀번호가 올바르지 않아요.' };
  saveAccountsInternal(accounts.filter((_, i) => i !== idx));
  logout();
  return { ok: true };
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────
function setSession(user) {
  // 비밀번호는 세션에 포함하지 않음
  const { password: _pw, ...safe } = user; // eslint-disable-line no-unused-vars
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
}
