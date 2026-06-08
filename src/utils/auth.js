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

// ── 회원가입 ─────────────────────────────────────────────────────────────────
// 반환값: { ok: true, user } | { ok: false, error: string }
export function register(userId, password, displayName) {
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
    password,            // 로컬 앱 — 평문 저장 (백엔드 없음)
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
  };
  saveAccountsInternal([...accounts, user]);
  setSession(user);
  return { ok: true, user };
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
  const idx = accounts.findIndex(a => a.userId === userId && a.password === password);
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
