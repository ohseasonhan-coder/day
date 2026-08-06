import fs from 'fs';
import path from 'path';
import {
  register, login, changePassword, deleteAccount,
  getAccounts, getCurrentUser, logout,
  PROD_MASTER_SEED, PASSWORD_VERSION, PLANS,
  adminCreateAccount,
} from './auth';
import { hashPin } from './storage';

const ACCOUNTS_KEY = 'sw_accounts';

function setAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

beforeEach(() => {
  localStorage.clear();
});

describe('보안: 마스터 계정 하드코딩 비밀번호 제거', () => {
  test('운영(production) 마스터 시드에는 비밀번호/해시가 들어있지 않다', () => {
    expect(PROD_MASTER_SEED.userId).toBe('master');
    expect(PROD_MASTER_SEED.mustSetPassword).toBe(true);
    expect(PROD_MASTER_SEED).not.toHaveProperty('password');
    expect(PROD_MASTER_SEED).not.toHaveProperty('passwordHash');
  });

  test('auth.js 소스에 기존 운영용 하드코딩 비밀번호가 남아있지 않다', () => {
    const src = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
    expect(src).not.toContain('saem2026!');
  });

  test('운영 마스터(mustSetPassword)는 비밀번호 설정 전 로그인이 거부되고 안내된다', async () => {
    setAccounts([{ ...PROD_MASTER_SEED, createdAt: new Date().toISOString() }]);
    const res = await login('master', 'anything');
    expect(res.ok).toBe(false);
    expect(res.needsSetup).toBe(true);
  });
});

describe('보안: 신규 계정 비밀번호 해시 저장', () => {
  test('신규 가입 계정은 평문 password 없이 salt+hash로 저장된다', async () => {
    const res = await register('teacher1', 'pw1234', '김선생');
    expect(res.ok).toBe(true);
    const acc = getAccounts().find(a => a.userId === 'teacher1');
    expect(acc).not.toHaveProperty('password');
    expect(typeof acc.passwordHash).toBe('string');
    expect(acc.passwordHash.length).toBeGreaterThan(0);
    expect(typeof acc.passwordSalt).toBe('string');
    expect(acc.passwordVersion).toBe(PASSWORD_VERSION);
  });

  test('로그인 세션에는 비밀번호/해시/솔트가 포함되지 않는다', async () => {
    await register('teacher2', 'pw1234', '이선생');
    const sess = getCurrentUser();
    expect(sess).not.toHaveProperty('password');
    expect(sess).not.toHaveProperty('passwordHash');
    expect(sess).not.toHaveProperty('passwordSalt');
  });

  test('올바른 비밀번호로 로그인 성공, 잘못된 비밀번호는 거부된다', async () => {
    await register('teacher3', 'correct1', '박선생');
    logout();
    const bad = await login('teacher3', 'wrong999');
    expect(bad.ok).toBe(false);
    const good = await login('teacher3', 'correct1');
    expect(good.ok).toBe(true);
  });
});

describe('보안: 기존 평문 계정 → 해시 마이그레이션', () => {
  test('평문 password 계정이 로그인 성공 시 해시 구조로 바뀌고 평문이 제거된다', async () => {
    setAccounts([{ userId: 'legacy1', password: 'oldpw12', displayName: '구계정', plan: 'free' }]);
    const res = await login('legacy1', 'oldpw12');
    expect(res.ok).toBe(true);
    const acc = getAccounts().find(a => a.userId === 'legacy1');
    expect(acc).not.toHaveProperty('password');
    expect(typeof acc.passwordHash).toBe('string');
    expect(acc.passwordVersion).toBe(PASSWORD_VERSION);
  });

  test('마이그레이션 후에도 같은 비밀번호로 다시 로그인된다', async () => {
    setAccounts([{ userId: 'legacy2', password: 'oldpw34', displayName: '구계정2', plan: 'free' }]);
    await login('legacy2', 'oldpw34');
    logout();
    const again = await login('legacy2', 'oldpw34');
    expect(again.ok).toBe(true);
    const bad = await login('legacy2', 'oldpw34x');
    expect(bad.ok).toBe(false);
  });

  test('손상된(필드 없는) 계정 데이터가 있어도 로그인 처리가 깨지지 않는다', async () => {
    setAccounts([{ userId: 'broken1' }, null, { userId: 'ok1', password: 'pw5678', displayName: 'OK', plan: 'free' }]);
    const broken = await login('broken1', 'whatever');
    expect(broken.ok).toBe(false);
    const ok = await login('ok1', 'pw5678');
    expect(ok.ok).toBe(true);
  });
});

describe('보안: 비밀번호 변경/계정 삭제도 해시 기반', () => {
  test('비밀번호 변경 후 새 비밀번호로 로그인되고 password 평문은 남지 않는다', async () => {
    await register('teacher4', 'first12', '최선생');
    const ch = await changePassword('teacher4', 'first12', 'second34');
    expect(ch.ok).toBe(true);
    const acc = getAccounts().find(a => a.userId === 'teacher4');
    expect(acc).not.toHaveProperty('password');
    logout();
    expect((await login('teacher4', 'first12')).ok).toBe(false);
    expect((await login('teacher4', 'second34')).ok).toBe(true);
  });

  test('잘못된 현재 비밀번호로는 변경되지 않는다', async () => {
    await register('teacher5', 'pw0001a', '정선생');
    const ch = await changePassword('teacher5', 'wrongpw', 'pw0002b');
    expect(ch.ok).toBe(false);
  });

  test('해시 계정은 올바른 비밀번호로만 삭제된다', async () => {
    await register('teacher6', 'delpw12', '한선생');
    expect((await deleteAccount('teacher6', 'nope')).ok).toBe(false);
    expect((await deleteAccount('teacher6', 'delpw12')).ok).toBe(true);
    expect(getAccounts().find(a => a.userId === 'teacher6')).toBeUndefined();
  });
});

describe('관리자: 다른 사람 몫 계정 미리 만들기', () => {
  const MASTER = { userId: 'master', role: 'master' };
  const TEACHER = { userId: 'teacher_x' };

  test('일반 사용자는 계정을 만들 수 없다', async () => {
    const res = await adminCreateAccount('newbie1', 'pw1234', '새선생', PLANS.VIP, TEACHER);
    expect(res.ok).toBe(false);
    expect(getAccounts().find(a => a.userId === 'newbie1')).toBeUndefined();
  });

  test('관리자는 지정한 플랜으로 계정을 만들 수 있고, 비밀번호는 해시로만 저장된다', async () => {
    const res = await adminCreateAccount('ssam01', 'Saem@2025', '쌤01', PLANS.VIP, MASTER);
    expect(res.ok).toBe(true);
    const acc = getAccounts().find(a => a.userId === 'ssam01');
    expect(acc.plan).toBe(PLANS.VIP);
    expect(acc).not.toHaveProperty('password');
    expect(typeof acc.passwordHash).toBe('string');
    // 새로 만든 계정 비밀번호로 실제 로그인도 된다
    const loginRes = await login('ssam01', 'Saem@2025');
    expect(loginRes.ok).toBe(true);
  });

  test('관리자가 다른 사람 몫 계정을 만들어도 관리자 자신의 로그인 세션은 그대로 유지된다', async () => {
    localStorage.setItem('sw_session', JSON.stringify(MASTER));
    await adminCreateAccount('ssam02', 'Saem@2025', '쌤02', PLANS.VIP, MASTER);
    expect(getCurrentUser()?.userId).toBe('master'); // register()와 달리 세션이 바뀌지 않음
  });

  test('중복 아이디, 형식이 잘못된 아이디·짧은 비밀번호는 거부된다', async () => {
    await adminCreateAccount('ssam03', 'Saem@2025', '쌤03', PLANS.VIP, MASTER);
    expect((await adminCreateAccount('ssam03', 'other123', '중복', PLANS.FREE, MASTER)).ok).toBe(false);
    expect((await adminCreateAccount('Bad ID', 'Saem@2025', '형식오류', PLANS.FREE, MASTER)).ok).toBe(false);
    expect((await adminCreateAccount('ssam04', 'abc', '짧은비번', PLANS.FREE, MASTER)).ok).toBe(false);
  });
});

describe('회귀: 기존 PIN 해시 유틸은 그대로 동작한다', () => {
  test('hashPin은 결정적이고 입력에 따라 달라진다', () => {
    expect(hashPin('1234')).toBe(hashPin('1234'));
    expect(hashPin('1234')).not.toBe(hashPin('5678'));
  });
});

describe('설정: 공용 기기 사용 주의 안내 노출', () => {
  test('SettingsPage에 공용 기기 안내 문구가 있다', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SettingsPage.js'), 'utf8');
    expect(src).toContain('공용 기기에서는 사용 후 로그아웃하고, 브라우저 저장 데이터를 삭제해주세요. 이 앱은 기록을 기본적으로 기기에 저장합니다.');
  });
});
