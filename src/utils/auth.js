// ─── 인증 유틸리티 ────────────────────────────────────────────────────────────
// 백엔드 없이 localStorage 기반 멀티 계정 관리
// 계정 목록: 'sw_accounts' / 현재 세션: 'sw_session'
/* global globalThis */
import { getSettings, saveSettings } from './storage';

const ACCOUNTS_KEY = 'sw_accounts';
const SESSION_KEY  = 'sw_session';

function safeJson(str) {
  try { return str ? JSON.parse(str) : null; } catch { return null; }
}

// ── 비밀번호 해시 (salt + SHA-256, 평문 저장 방지) ──────────────────────────
// 로컬 앱이므로 서버 인증 수준의 보안은 아니며, 목적은 평문 비밀번호 노출을 줄이는 것.
export const PASSWORD_VERSION = 2;

function randomSalt() {
  const c = globalThis.crypto;
  const a = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(a);
  else for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // 폴백: Web Crypto가 없는 환경 — 암호학적 강도는 낮지만 평문 저장은 피한다.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (`00000000${(h >>> 0).toString(16)}`).slice(-8);
}

async function hashPassword(password, salt) {
  return sha256Hex(`sw-pw-v${PASSWORD_VERSION}:${salt}:${password}`);
}

// 계정에서 평문 password를 salt+hash 구조로 변환(평문 필드 제거).
async function migratePlaintext(accounts, account, plainPassword) {
  const idx = accounts.findIndex(a => a.userId === account.userId);
  if (idx === -1) return account;
  const salt = randomSalt();
  const passwordHash = await hashPassword(plainPassword, salt);
  const { password, ...rest } = accounts[idx]; // eslint-disable-line no-unused-vars
  accounts[idx] = { ...rest, passwordHash, passwordSalt: salt, passwordVersion: PASSWORD_VERSION };
  saveAccountsInternal(accounts);
  return accounts[idx];
}

// ── 계정 목록 ────────────────────────────────────────────────────────────────
export function getAccounts() {
  const raw = safeJson(localStorage.getItem(ACCOUNTS_KEY));
  if (!Array.isArray(raw)) return [];
  // 손상된 항목(null·비객체·userId 없음)은 앱이 깨지지 않도록 걸러낸다.
  return raw.filter(a => a && typeof a === 'object' && typeof a.userId === 'string');
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
export async function register(userId, password, displayName, plan = PLANS.FREE) {
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

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    userId: userId2,
    passwordHash,
    passwordSalt: salt,
    passwordVersion: PASSWORD_VERSION,
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
// 마스터(관리자) 계정 — 이 기기에 있는 회원·데이터를 관리할 수 있다.
// 일반 사용자는 구글 로그인만 사용한다.
//
// 운영 빌드에는 하드코딩된 비밀번호를 넣지 않는다. 운영에서는 마스터 계정이
// mustSetPassword 상태로만 시드되어, 최초 로그인 화면에서 관리자가 직접
// 비밀번호를 설정하게 한다. 개발/테스트 빌드에서만 편의용 비밀번호를 시드하며,
// 이 분기(및 'dev-master' 리터럴)는 운영 빌드 번들에서 제거된다.
export const PROD_MASTER_SEED = {
  userId: 'master', displayName: '관리자', plan: PLANS.VIP, role: 'master', mustSetPassword: true,
};

function buildSeedAccounts() {
  if (process.env.NODE_ENV === 'production') {
    return [PROD_MASTER_SEED];
  }
  return [
    { userId: 'master', password: 'dev-master', displayName: '관리자', plan: PLANS.VIP, role: 'master' },
  ];
}

export function isMaster(user) {
  return user?.role === 'master' || user?.userId === 'master';
}

export function seedSpecialAccounts() {
  const accounts = getAccounts();
  let changed = false;
  buildSeedAccounts().forEach(seed => {
    if (!accounts.find(a => a.userId === seed.userId)) {
      accounts.push({ ...seed, createdAt: new Date().toISOString() });
      changed = true;
    }
  });
  if (changed) saveAccountsInternal(accounts);
}

// ── 로그인 ────────────────────────────────────────────────────────────────────
// 비밀번호 검증은 salt+hash로 한다. 기존 평문(password) 계정은 로그인 성공 시
// 해시 구조로 즉시 마이그레이션하고 평문 필드를 제거한다.
export async function login(userId, password) {
  const userId2 = String(userId || '').trim().toLowerCase();
  const accounts = getAccounts();
  const account = accounts.find(a => a.userId === userId2);
  if (!account) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않아요.' };

  // 운영에서 비밀번호가 아직 설정되지 않은 마스터 계정 → 최초 설정 안내
  if (account.mustSetPassword && !account.passwordHash && typeof account.password !== 'string') {
    return { ok: false, error: '관리자 비밀번호를 먼저 설정해 주세요.', needsSetup: true };
  }

  let valid = false;
  let finalAccount = account;
  if (account.passwordHash) {
    const h = await hashPassword(password, account.passwordSalt || '');
    valid = (h === account.passwordHash);
  } else if (typeof account.password === 'string') {
    // 레거시 평문 계정: 검증 후 해시로 마이그레이션
    valid = (account.password === password);
    if (valid) {
      try { finalAccount = await migratePlaintext(accounts, account, password); }
      catch { finalAccount = account; } // 마이그레이션 실패해도 로그인은 진행
    }
  }

  if (!valid) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않아요.' };
  setSession(finalAccount);
  return { ok: true, user: finalAccount };
}

// 운영에서 mustSetPassword 상태의 마스터가 최초 비밀번호를 설정한다.
export async function setInitialPassword(userId, newPw) {
  if (!newPw || newPw.length < 4)
    return { ok: false, error: '비밀번호는 4자 이상이어야 해요.' };
  const userId2 = String(userId || '').trim().toLowerCase();
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.userId === userId2);
  if (idx === -1) return { ok: false, error: '계정을 찾을 수 없어요.' };
  if (!accounts[idx].mustSetPassword)
    return { ok: false, error: '이미 비밀번호가 설정된 계정이에요.' };
  const salt = randomSalt();
  const passwordHash = await hashPassword(newPw, salt);
  const { password, mustSetPassword, ...rest } = accounts[idx]; // eslint-disable-line no-unused-vars
  accounts[idx] = { ...rest, passwordHash, passwordSalt: salt, passwordVersion: PASSWORD_VERSION };
  saveAccountsInternal(accounts);
  return { ok: true };
}

// ── 구글 계정으로 로그인/가입 ────────────────────────────────────────────────
// 구글 ID 토큰에서 얻은 프로필(sub/email/name)로 로컬 계정을 찾거나 새로 만듭니다.
// 인증만 구글을 쓰고, 데이터 저장은 기존과 동일하게 이 기기(localStorage)에만 됩니다.
export function loginWithGoogle(profile) {
  const sub = String(profile?.sub || '').trim();
  if (!sub) return { ok: false, error: '구글 인증 정보가 올바르지 않아요.' };

  const accounts = getAccounts();
  let account = accounts.find(a => a.googleSub === sub);
  const isNew = !account;
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
  // 구글 계정은 본인 드라이브 자동 백업을 기본으로 켠다 (첫 백업 시 1회 동의 필요)
  if (isNew) {
    try { saveSettings({ ...getSettings(), driveAutoBackup: true }); } catch {}
  }
  return { ok: true, user: account };
}

// ── 관리자(마스터) 전용 — 같은 기기에 있는 계정 관리 ─────────────────────────
export function adminUpdateAccount(userId, updates) {
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.userId === userId);
  if (idx === -1) return { ok: false, error: '계정을 찾을 수 없어요.' };
  // userId·role은 관리자 패널에서 바꿀 수 없음
  const { userId: _id, role: _role, ...safe } = updates; // eslint-disable-line no-unused-vars
  accounts[idx] = { ...accounts[idx], ...safe };
  saveAccountsInternal(accounts);
  return { ok: true, user: accounts[idx] };
}

export function adminDeleteAccount(userId, { wipeData = true } = {}) {
  if (userId === 'master') return { ok: false, error: '마스터 계정은 삭제할 수 없어요.' };
  const accounts = getAccounts();
  if (!accounts.find(a => a.userId === userId)) return { ok: false, error: '계정을 찾을 수 없어요.' };
  saveAccountsInternal(accounts.filter(a => a.userId !== userId));
  if (wipeData) {
    try {
      const prefix = `sw_${userId}_`;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
  return { ok: true };
}

// 계정별 데이터 현황 (관리자 패널 표시용)
export function getAccountDataStats(userId) {
  const read = (suffix) => {
    try { return (JSON.parse(localStorage.getItem(`sw_${userId}_${suffix}`)) || []).length; } catch { return 0; }
  };
  return { records: read('records'), children: read('children'), documents: read('documents') };
}

// ── 기존 계정에 구글 연동 ────────────────────────────────────────────────────
// 연동 후에는 로그인 화면의 구글 버튼으로 이 계정(데이터 포함)에 바로 로그인된다
export function linkGoogleToAccount(userId, profile) {
  const sub = String(profile?.sub || '').trim();
  if (!sub) return { ok: false, error: '구글 인증 정보가 올바르지 않아요.' };

  const accounts = getAccounts();
  const taken = accounts.find(a => a.googleSub === sub && a.userId !== userId);
  if (taken) return { ok: false, error: `이 구글 계정은 이미 다른 계정(@${taken.userId})에 연동되어 있어요.` };

  const idx = accounts.findIndex(a => a.userId === userId);
  if (idx === -1) return { ok: false, error: '계정을 찾을 수 없어요.' };

  accounts[idx] = {
    ...accounts[idx],
    googleSub: sub,
    googleEmail: profile.email || '',
    googleLinkedAt: new Date().toISOString(),
  };
  saveAccountsInternal(accounts);
  setSession(accounts[idx]);
  return { ok: true, user: accounts[idx] };
}

export function unlinkGoogleFromAccount(userId) {
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.userId === userId);
  if (idx === -1) return { ok: false, error: '계정을 찾을 수 없어요.' };
  if (accounts[idx].provider === 'google')
    return { ok: false, error: '구글로 만든 계정은 연동을 해제할 수 없어요. (해제하면 로그인 방법이 없어져요)' };

  const { googleSub, googleEmail, googleLinkedAt, ...rest } = accounts[idx]; // eslint-disable-line no-unused-vars
  accounts[idx] = rest;
  saveAccountsInternal(accounts);
  setSession(accounts[idx]);
  return { ok: true };
}

// ── 로그아웃 ──────────────────────────────────────────────────────────────────
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

// ── 비밀번호 일치 확인 (해시 또는 레거시 평문) ───────────────────────────────
async function verifyPassword(account, password) {
  if (account?.passwordHash) {
    const h = await hashPassword(password, account.passwordSalt || '');
    return h === account.passwordHash;
  }
  if (typeof account?.password === 'string') return account.password === password;
  return false;
}

// ── 비밀번호 변경 ─────────────────────────────────────────────────────────────
export async function changePassword(userId, oldPw, newPw) {
  if (!newPw || newPw.length < 4)
    return { ok: false, error: '새 비밀번호는 4자 이상이어야 해요.' };
  const accounts = getAccounts();
  const idx = accounts.findIndex(a => a.userId === userId);
  if (idx === -1) return { ok: false, error: '현재 비밀번호가 올바르지 않아요.' };
  if (!(await verifyPassword(accounts[idx], oldPw)))
    return { ok: false, error: '현재 비밀번호가 올바르지 않아요.' };
  const salt = randomSalt();
  const passwordHash = await hashPassword(newPw, salt);
  const { password, ...rest } = accounts[idx]; // eslint-disable-line no-unused-vars
  accounts[idx] = { ...rest, passwordHash, passwordSalt: salt, passwordVersion: PASSWORD_VERSION };
  saveAccountsInternal(accounts);
  setSession(accounts[idx]);
  return { ok: true };
}

// ── 계정 삭제 ─────────────────────────────────────────────────────────────────
export async function deleteAccount(userId, password) {
  const accounts = getAccounts();
  const account = accounts.find(a => a.userId === userId);
  // 구글 계정은 비밀번호가 없으므로 userId 일치만 확인 (UI에서 확인창을 거침)
  const ok = !!account && (account.provider === 'google' || await verifyPassword(account, password));
  if (!ok) return { ok: false, error: '비밀번호가 올바르지 않아요.' };
  saveAccountsInternal(accounts.filter(a => a.userId !== userId));
  logout();
  return { ok: true };
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────
function setSession(user) {
  // 비밀번호/해시/솔트는 세션에 포함하지 않음
  const { password, passwordHash, passwordSalt, ...safe } = user; // eslint-disable-line no-unused-vars
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
}
