// 기기 간 동기화: 엔진 전환 설정(engineSettings)만 본인 드라이브 백업으로 동기화하고,
// 검수/fallback/correction 데이터(개인정보 가능)는 백업/복원에서 제외한다.
import { getBackupJson, importBackup } from './storage';
import {
  getEnginePrefsForSync, applyEnginePrefsFromSync, ENGINE_SETTINGS_VERSION,
  setDocumentEngine, resetDocumentEngine, getActiveEngineForDocument, ENGINE_DOC_TYPES,
} from './ai/documentEngineSettings';
import { recordEngineChoice, recordFallback, clearEngineReviews, clearFallbackLog } from './ai/userCorrectionLearning';

function resetPrefs() {
  ENGINE_DOC_TYPES.forEach((t) => resetDocumentEngine(t));
}
function validBackup(extra = {}) {
  return JSON.stringify({ version: 2, appName: '쌤워크', ...extra });
}

describe('엔진 전환 설정 기기 간 동기화', () => {
  beforeEach(() => { resetPrefs(); clearEngineReviews(); clearFallbackLog(); });

  test('백업 번들에 버전드 engineSettings가 포함된다', () => {
    setDocumentEngine('dailyReport', 'modular');
    setDocumentEngine('notice', 'modular');
    const payload = JSON.parse(getBackupJson());
    expect(payload.engineSettings).toBeTruthy();
    expect(payload.engineSettings.version).toBe(ENGINE_SETTINGS_VERSION);
    expect(payload.engineSettings.updatedAt).toBeTruthy();
    expect(payload.engineSettings.engines.dailyReport).toBe('modular');
    expect(payload.engineSettings.engines.notice).toBe('modular');
    expect(payload.engineSettings.engines.observation).toBe('legacy');
  });

  test('백업 번들에 검수/fallback/correction·개인정보 필드가 포함되지 않는다', () => {
    recordEngineChoice({
      documentType: 'notice', selectedEngine: 'modular',
      legacyText: '레거시문장', modularText: '모듈러문장', userEditedText: '수정한문장',
      inputText: '비밀아이가 "안녕"이라고 말했다',
    });
    recordFallback({ documentType: 'counseling', reasons: ['low_score'], inputText: '비밀아이 메모' });
    const json = getBackupJson();
    expect(json).not.toContain('engine_reviews');
    expect(json).not.toContain('engine_fallbacks');
    expect(json).not.toContain('비밀아이');     // inputText
    expect(json).not.toContain('레거시문장');   // legacyText
    expect(json).not.toContain('모듈러문장');   // modularText
    expect(json).not.toContain('수정한문장');   // userEditedText
  });

  test('복원 시 engineSettings가 문서 유형별로 적용된다', () => {
    setDocumentEngine('observation', 'modular');
    setDocumentEngine('counseling', 'modular');
    const backupFromA = getBackupJson();
    resetPrefs();
    expect(getActiveEngineForDocument('observation')).toBe('legacy');
    const res = importBackup(backupFromA);
    expect(res.ok).toBe(true);
    expect(getActiveEngineForDocument('observation')).toBe('modular');
    expect(getActiveEngineForDocument('counseling')).toBe('modular');
    expect(getActiveEngineForDocument('notice')).toBe('legacy');
  });

  test('알 수 없는 documentType은 무시되고 허용되지 않은 값은 legacy로 처리된다', () => {
    applyEnginePrefsFromSync({ engines: { observation: 'modular', notice: 'banana', unknownDoc: 'modular' } });
    expect(getActiveEngineForDocument('observation')).toBe('modular');
    expect(getActiveEngineForDocument('notice')).toBe('legacy');     // 잘못된 값 → legacy
    expect(getActiveEngineForDocument('dailyReport')).toBe('legacy'); // 누락 → legacy
    // 평면 객체(래퍼 없이)도 하위 호환으로 허용
    resetPrefs();
    applyEnginePrefsFromSync({ development: 'modular' });
    expect(getActiveEngineForDocument('development')).toBe('modular');
  });

  test('engineSettings가 없는 기존 백업도 정상 복원되고 기본 legacy를 유지한다', () => {
    setDocumentEngine('observation', 'modular'); // 현재 기기 상태
    const oldBackup = validBackup({ children: [], records: [] }); // engineSettings 없음
    const res = importBackup(oldBackup);
    expect(res.ok).toBe(true);
    // engineSettings가 없으면 기존 설정을 건드리지 않는다(legacy로 강제 초기화하지 않음)
    expect(getActiveEngineForDocument('observation')).toBe('modular');
  });

  test('손상된 engineSettings면 안전하게 legacy로 둔다', () => {
    resetPrefs();
    const res = importBackup(validBackup({ engineSettings: 'not-an-object' }));
    expect(res.ok).toBe(true);
    ENGINE_DOC_TYPES.forEach((t) => expect(getActiveEngineForDocument(t)).toBe('legacy'));
  });

  test('구버전 키(documentEnginePrefs) 백업도 하위 호환으로 복원된다', () => {
    resetPrefs();
    const legacyKeyBackup = validBackup({ documentEnginePrefs: { engines: { notice: 'modular' } } });
    importBackup(legacyKeyBackup);
    expect(getActiveEngineForDocument('notice')).toBe('modular');
  });

  test('getEnginePrefsForSync는 5종 문서의 현재 플래그만 담는다', () => {
    setDocumentEngine('development', 'modular');
    const sync = getEnginePrefsForSync();
    expect(Object.keys(sync.engines).sort()).toEqual([...ENGINE_DOC_TYPES].sort());
    expect(sync.engines.development).toBe('modular');
  });
});
