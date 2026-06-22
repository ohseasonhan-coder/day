// 데이터 안전 — 복원 무결성/타입검증/안전백업 라운드트립
jest.mock('./driveBackup', () => ({
  __esModule: true,
  restoreFromDrive: jest.fn(),
  backupToDrive: jest.fn(() => Promise.resolve({ fileId: 'mock', at: 'now' })),
  scheduleDriveBackup: jest.fn(),
  isElectron: () => false,
  getDriveMeta: () => ({}),
  DRIVE_FILE_NAME: 'saemwork_backup.json',
}));

import {
  getBackupJson, importBackup, importBackupMerge, verifyBackupChecksum,
  saveChildren, getChildren, saveRecords, getRecords, saveDocuments, getDocuments,
  saveLocalSafetyBackup, restoreLocalSafetyBackup,
} from './storage';

beforeEach(() => { localStorage.clear(); });

describe('백업 무결성(checksum)', () => {
  test('정상 백업은 체크섬이 일치한다', () => {
    saveChildren([{ id: 'c1', name: '하나' }]);
    saveRecords([{ id: 'r1', date: '2026-06-01', childId: 'c1', text: '메모' }]);
    const data = JSON.parse(getBackupJson());
    expect(verifyBackupChecksum(data)).toBe(true);
  });

  test('내용이 변조되면 체크섬 불일치를 감지한다', () => {
    saveChildren([{ id: 'c1', name: '하나' }]);
    const data = JSON.parse(getBackupJson());
    data.children.push({ id: 'c2', name: '몰래추가' }); // 변조
    expect(verifyBackupChecksum(data)).toBe(false);
  });

  test('체크섬이 없는(구버전) 백업은 null(검증 불가)', () => {
    expect(verifyBackupChecksum({ version: 2, appName: '쌤워크', children: [] })).toBeNull();
  });

  test('importBackup 성공 시 summary에 checksumOk가 담긴다', () => {
    saveChildren([{ id: 'c1', name: '하나' }]);
    const json = getBackupJson();
    localStorage.clear();
    const res = importBackup(json);
    expect(res.ok).toBe(true);
    expect(res.summary.checksumOk).toBe(true);
  });
});

describe('복원 라운드트립', () => {
  test('내보내기→가져오기 후 원아/기록/문서가 보존된다', () => {
    saveChildren([{ id: 'c1', name: '하나' }, { id: 'c2', name: '둘' }]);
    saveRecords([{ id: 'r1', date: '2026-06-01', childId: 'c1', text: '메모1' }]);
    saveDocuments([{ id: 'd1', title: '문서', createdAt: '2026-06-01' }]);
    const json = getBackupJson();

    localStorage.clear();
    const res = importBackup(json);
    expect(res.ok).toBe(true);
    expect(getChildren().map(c => c.id).sort()).toEqual(['c1', 'c2']);
    expect(getRecords().some(r => r.id === 'r1')).toBe(true);
    expect(getDocuments().some(d => d.id === 'd1')).toBe(true);
  });
});

describe('타입 검증 — 잘못된 필드가 기존 데이터를 덮어쓰지 않음', () => {
  test('children이 배열이 아니면 건너뛰고 기존 데이터를 보존한다', () => {
    saveChildren([{ id: 'c1', name: '기존' }]);
    const bad = JSON.stringify({
      version: 2, appName: '쌤워크',
      children: { not: 'an array' },          // 손상된 필드
      records: [{ id: 'r1', date: '2026-06-01', text: 'ok' }],
    });
    const res = importBackup(bad);
    expect(res.ok).toBe(true);
    expect(res.summary.skipped).toContain('children');
    expect(getChildren()).toEqual([{ id: 'c1', name: '기존' }]); // 보존
    expect(getRecords().some(r => r.id === 'r1')).toBe(true);     // 정상 필드는 복원
  });

  test('쌤워크 백업이 아니면 거부하고 데이터를 건드리지 않는다', () => {
    saveChildren([{ id: 'c1', name: '기존' }]);
    const res = importBackup(JSON.stringify({ hello: 'world' }));
    expect(res.ok).toBe(false);
    expect(getChildren()).toEqual([{ id: 'c1', name: '기존' }]);
  });

  test('잘못된 JSON이면 ok:false, 기존 데이터 유지', () => {
    saveChildren([{ id: 'c1', name: '기존' }]);
    const res = importBackup('{이건 JSON이 아님');
    expect(res.ok).toBe(false);
    expect(getChildren()).toEqual([{ id: 'c1', name: '기존' }]);
  });
});

describe('병합 복원 안전성', () => {
  test('incoming이 비배열이어도 merge가 깨지지 않는다', () => {
    saveChildren([{ id: 'c1', name: '기존' }]);
    const bad = JSON.stringify({ version: 2, appName: '쌤워크', children: 'oops', records: null });
    const res = importBackupMerge(bad);
    expect(res.ok).toBe(true);
    expect(getChildren().some(c => c.id === 'c1')).toBe(true); // 기존 유지
  });
});

describe('로컬 안전 백업 라운드트립', () => {
  test('안전백업 저장 → 데이터 변경 → 되돌리기로 복구', () => {
    saveChildren([{ id: 'c1', name: '원본' }]);
    expect(saveLocalSafetyBackup()).toBe(true);
    saveChildren([{ id: 'c9', name: '바뀐데이터' }]); // 이후 변경
    const res = restoreLocalSafetyBackup();
    expect(res.ok).toBe(true);
    expect(getChildren()).toEqual([{ id: 'c1', name: '원본' }]); // 원본 복구
  });

  test('안전백업이 없으면 ok:false', () => {
    expect(restoreLocalSafetyBackup().ok).toBe(false);
  });
});
