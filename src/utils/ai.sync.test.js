// 기기 간 동기화: 엔진 전환 설정은 본인 드라이브 백업 번들로 동기화하고,
// 검수/fallback 데이터(개인정보 가능)는 백업에 포함하지 않는다.
import { getBackupJson, importBackup } from './storage';
import {
  getEnginePrefsForSync, applyEnginePrefsFromSync,
  setDocumentEngine, resetDocumentEngine, getActiveEngineForDocument, ENGINE_DOC_TYPES,
} from './ai/documentEngineSettings';
import { recordEngineChoice, clearEngineReviews } from './ai/userCorrectionLearning';

function resetPrefs() {
  ENGINE_DOC_TYPES.forEach((t) => resetDocumentEngine(t));
}

describe('엔진 전환 설정 기기 간 동기화', () => {
  beforeEach(() => { resetPrefs(); clearEngineReviews(); });

  test('동기화 헬퍼는 유효한 modular 값만 반영하고 나머지는 legacy로 둔다', () => {
    applyEnginePrefsFromSync({ observation: 'modular', notice: 'modular', counseling: 'bogus', unknownKey: 'modular' });
    expect(getActiveEngineForDocument('observation')).toBe('modular');
    expect(getActiveEngineForDocument('notice')).toBe('modular');
    expect(getActiveEngineForDocument('counseling')).toBe('legacy'); // 잘못된 값 무시
    expect(getActiveEngineForDocument('dailyReport')).toBe('legacy');
    expect(getEnginePrefsForSync().observation).toBe('modular');
  });

  test('백업 번들에 documentEnginePrefs가 포함된다', () => {
    setDocumentEngine('development', 'modular');
    const payload = JSON.parse(getBackupJson());
    expect(payload.documentEnginePrefs).toBeTruthy();
    expect(payload.documentEnginePrefs.development).toBe('modular');
    expect(payload.documentEnginePrefs.observation).toBe('legacy');
  });

  test('다른 기기의 백업을 복원하면 엔진 설정이 동일하게 반영된다', () => {
    // 기기 A: 일부 유형 전환
    setDocumentEngine('observation', 'modular');
    setDocumentEngine('counseling', 'modular');
    const backupFromA = getBackupJson();

    // 기기 B: 기본 legacy 상태 → A의 백업 복원
    resetPrefs();
    expect(getActiveEngineForDocument('observation')).toBe('legacy');
    const res = importBackup(backupFromA);
    expect(res.ok).toBe(true);
    expect(getActiveEngineForDocument('observation')).toBe('modular');
    expect(getActiveEngineForDocument('counseling')).toBe('modular');
    expect(getActiveEngineForDocument('notice')).toBe('legacy');
  });

  test('검수 데이터(개인정보 가능)는 백업에 포함되지 않는다', () => {
    recordEngineChoice({
      documentType: 'notice', selectedEngine: 'modular',
      legacyText: 'L', modularText: 'M',
      inputText: '비밀아이가 "안녕"이라고 말했다',
    });
    const json = getBackupJson();
    expect(json).not.toContain('비밀아이');
    expect(json).not.toContain('engine_reviews');
    expect(json).not.toContain('engine_fallbacks');
  });
});
