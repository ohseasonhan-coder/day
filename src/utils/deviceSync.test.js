// 기기 간 동기화 1차 — 순수 판정 + 안전 백업/복원 동작 검증
jest.mock('./driveBackup', () => ({
  __esModule: true,
  restoreFromDrive: jest.fn(),
  backupToDrive: jest.fn(() => Promise.resolve({ fileId: 'mock', at: 'now' })),
  scheduleDriveBackup: jest.fn(),
  isElectron: () => false,
  getDriveMeta: () => ({}),
  emitSyncEvent: jest.fn(),
  DRIVE_FILE_NAME: 'saemwork_backup.json',
}));

import { decideSyncAction, pullFromDrive, pushToDrive, autoSyncOnStart } from './deviceSync';
import { restoreFromDrive, backupToDrive } from './driveBackup';
import {
  getDeviceId, getDeviceName, getBackupJson, getLocalSafetyBackup,
  saveChildren, getChildren, saveDocuments,
  getSyncState, setSyncState, getDataUpdatedAt, isOnboardingDone, setOnboardingDone, importBackup,
  SYNC_EXCLUDED_KEYS,
} from './storage';

beforeEach(() => { localStorage.clear(); });

describe('기기 식별자', () => {
  test('deviceId가 생성되고 같은 값으로 유지된다', () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toMatch(/^dev_/);
    expect(a).toBe(b);
    expect(a).not.toMatch(/@|이메일|gmail/i); // 개인정보가 아닌 랜덤 ID
  });
  test('deviceName 기본값이 비어있지 않다', () => {
    expect(getDeviceName().length).toBeGreaterThan(0);
  });
});

describe('decideSyncAction (순수 판정)', () => {
  test('원격이 없으면 push', () => {
    expect(decideSyncAction({ remote: null, localDataAt: '2026-01-01', lastSyncedDataAt: null }).action).toBe('push');
  });
  test('Drive가 더 최신이고 로컬은 그대로면 pull', () => {
    const r = decideSyncAction({
      remote: { dataUpdatedAt: '2026-06-10T00:00:00Z' },
      localDataAt: '2026-06-01T00:00:00Z',
      lastSyncedDataAt: '2026-06-01T00:00:00Z',
    });
    expect(r.action).toBe('pull');
  });
  test('로컬이 더 최신이고 Drive는 그대로면 push', () => {
    const r = decideSyncAction({
      remote: { dataUpdatedAt: '2026-06-01T00:00:00Z' },
      localDataAt: '2026-06-10T00:00:00Z',
      lastSyncedDataAt: '2026-06-01T00:00:00Z',
    });
    expect(r.action).toBe('push');
  });
  test('양쪽 모두 마지막 동기화 이후 바뀌면 conflict (자동 덮어쓰기 금지)', () => {
    const r = decideSyncAction({
      remote: { dataUpdatedAt: '2026-06-10T00:00:00Z' },
      localDataAt: '2026-06-09T00:00:00Z',
      lastSyncedDataAt: '2026-06-01T00:00:00Z',
    });
    expect(r.action).toBe('conflict');
  });
  test('시각이 같으면 in-sync', () => {
    const r = decideSyncAction({
      remote: { dataUpdatedAt: '2026-06-10T00:00:00Z' },
      localDataAt: '2026-06-10T00:00:00Z',
      lastSyncedDataAt: '2026-06-10T00:00:00Z',
    });
    expect(r.action).toBe('in-sync');
  });
});

describe('백업 payload 포함/제외', () => {
  test('원아·문서·설정은 포함, 인증/검수 민감값은 미포함', () => {
    saveChildren([{ id: 'c1', name: '홍길동' }]);
    saveDocuments([{ id: 'd1', title: '문서', createdAt: '2026-06-01' }]);
    const data = JSON.parse(getBackupJson());
    // 포함
    expect(data.children.some(c => c.name === '홍길동')).toBe(true);
    expect(Array.isArray(data.documents)).toBe(true);
    expect(data.settings).toBeDefined();
    // 미포함 (탑레벨 키로 존재하면 안 됨)
    ['password', 'passwordHash', 'passwordSalt', 'engine_reviews', 'engine_fallbacks', 'user_corrections', 'accessToken']
      .forEach(k => expect(data).not.toHaveProperty(k));
    // 민감 키워드는 payload 문자열에도 등장하지 않는다
    const json = getBackupJson();
    ['engine_reviews', 'engine_fallbacks', 'user_corrections', 'passwordHash'].forEach(k => expect(json).not.toContain(k));
  });

  test('SYNC_EXCLUDED_KEYS 상수에 인증/검수 민감 키가 문서화되어 있다', () => {
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining(['engine_reviews', 'user_corrections', 'passwordHash', 'sw_session']));
  });

  test('동기화 메타(schemaVersion/deviceId/dataUpdatedAt/checksum)가 포함된다', () => {
    saveChildren([{ id: 'c1', name: '아무개' }]);
    const data = JSON.parse(getBackupJson());
    expect(data.schemaVersion).toBe(1);
    expect(data.deviceId).toMatch(/^dev_/);
    expect(typeof data.dataUpdatedAt).toBe('string');
    expect(typeof data.checksum).toBe('string');
  });
});

describe('데이터 변경 추적', () => {
  test('자료를 저장하면 dataUpdatedAt이 갱신된다', () => {
    expect(getDataUpdatedAt()).toBeNull();
    saveChildren([{ id: 'c1', name: '하나' }]);
    expect(typeof getDataUpdatedAt()).toBe('string');
  });
});

describe('onboarding 동기화', () => {
  test('payload에 onboardingDone이 담기고 복원 시 반영된다', () => {
    setOnboardingDone();
    saveChildren([{ id: 'c1', name: '하나' }]);
    const json = getBackupJson();
    expect(JSON.parse(json).onboardingDone).toBe(true);

    localStorage.clear();
    expect(isOnboardingDone()).toBe(false);
    importBackup(json);
    expect(isOnboardingDone()).toBe(true);
  });
});

describe('pull: 안전 백업 + 실패 시 데이터 보존', () => {
  test('복원 전 로컬 안전 백업이 생성되고, 잘못된 데이터면 기존 데이터가 유지된다', async () => {
    saveChildren([{ id: 'c1', name: '기존원아' }]);
    const before = getChildren();
    const res = await pullFromDrive('client', { json: '이건 JSON이 아님' });
    expect(res.ok).toBe(false);
    expect(getChildren()).toEqual(before);      // 기존 데이터 유지
    expect(getLocalSafetyBackup()).toBeTruthy(); // 안전 백업 생성됨
  });

  test('정상 원격 데이터를 가져오면 반영되고 syncState가 기록된다', async () => {
    saveChildren([{ id: 'r1', name: '원격원아' }]);
    setOnboardingDone();
    const remoteJson = getBackupJson();

    localStorage.clear();
    saveChildren([{ id: 'l1', name: '로컬원아' }]);
    const res = await pullFromDrive('client', { json: remoteJson });
    expect(res.ok).toBe(true);
    expect(getChildren().some(c => c.id === 'r1')).toBe(true);
    expect(getSyncState().lastSyncedAt).toBeTruthy();
    expect(getLocalSafetyBackup().payload.children.some(c => c.id === 'l1')).toBe(true); // 직전 로컬 보관
  });
});

describe('push: 업로드 후 syncState 갱신', () => {
  test('pushToDrive 성공 시 syncVersion이 증가한다', async () => {
    saveChildren([{ id: 'c1', name: '하나' }]);
    const v0 = getSyncState().syncVersion || 0;
    const res = await pushToDrive('client');
    expect(res.ok).toBe(true);
    expect(getSyncState().syncVersion).toBe(v0 + 1);
    expect(getSyncState().lastSyncedAt).toBeTruthy();
  });
});

describe('autoSyncOnStart: 자동 동기화 강화(조용히 push/pull)', () => {
  afterEach(() => { restoreFromDrive.mockReset(); backupToDrive.mockClear(); });

  test('비활성/오프라인이면 건너뛴다', async () => {
    const off = await autoSyncOnStart('client', { enabled: false });
    expect(off.skipped).toBe(true);
  });

  test('로컬이 최신이면 조용히 자동 백업(push)', async () => {
    // 마지막 동기화 시점=원격 시각(과거), 로컬은 그 이후 변경 → push (원격은 그대로)
    setSyncState({ lastSyncedDataAt: '2000-01-01T00:00:00Z' });
    saveChildren([{ id: 'c1', name: '하나' }]); // dataUpdatedAt = 현재(2000 이후)
    restoreFromDrive.mockResolvedValue({
      json: JSON.stringify({ version: 2, appName: '쌤워크', dataUpdatedAt: '2000-01-01T00:00:00Z', children: [] }),
      modifiedTime: '2000-01-01T00:00:00Z',
    });
    backupToDrive.mockResolvedValue({ fileId: 'x', at: 'now' });
    const r = await autoSyncOnStart('client', { enabled: true });
    expect(r.applied).toBe('push');
    expect(backupToDrive).toHaveBeenCalled();
  });

  test('원격이 최신 + 로컬 그대로면 자동 가져오기(pull)', async () => {
    // 로컬을 원격과 동기화된 상태로 만들고, 원격만 더 최신으로
    saveChildren([{ id: 'c1', name: '하나' }]);
    const remote = JSON.parse(getBackupJson());
    remote.dataUpdatedAt = '2999-01-01T00:00:00Z';
    remote.children = [{ id: 'r9', name: '원격최신' }];
    setSyncState({ lastSyncedDataAt: getDataUpdatedAt() }); // 로컬은 마지막 동기화 이후 그대로
    restoreFromDrive.mockResolvedValue({ json: JSON.stringify(remote), modifiedTime: '2999-01-01T00:00:00Z' });
    const r = await autoSyncOnStart('client', { enabled: true });
    expect(r.applied).toBe('pull');
    expect(getChildren().some(c => c.id === 'r9')).toBe(true);
  });
});
