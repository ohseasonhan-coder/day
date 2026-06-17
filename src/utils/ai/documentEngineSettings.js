// 문서 유형별 기본 문장 엔진 설정 (사용자별 localStorage, 외부 전송 없음).
// 기본값은 모두 legacy. 관리자가 검수 기준을 충족한 유형만 수동으로 modular로 전환한다.
// storage.js(드라이브/사진 의존) import를 피하기 위해 localStorage를 직접 사용한다.
export const ENGINE_DOC_TYPES = ['observation', 'dailyReport', 'notice', 'counseling', 'development'];

export const DEFAULT_ENGINE_PREFS = {
  observation: 'legacy',
  dailyReport: 'legacy',
  notice: 'legacy',
  counseling: 'legacy',
  development: 'legacy',
};

function currentUid() {
  try {
    const s = localStorage.getItem('sw_session');
    return s ? (JSON.parse(s)?.userId || 'default') : 'default';
  } catch {
    return 'default';
  }
}
function prefsKey() {
  return `sw_${currentUid()}_engine_prefs`;
}

export function getDocumentEngineSettings() {
  try {
    const v = localStorage.getItem(prefsKey());
    const saved = v ? JSON.parse(v) : {};
    return { ...DEFAULT_ENGINE_PREFS, ...saved };
  } catch {
    return { ...DEFAULT_ENGINE_PREFS };
  }
}

export function getActiveEngineForDocument(documentType) {
  const prefs = getDocumentEngineSettings();
  return prefs[documentType] === 'modular' ? 'modular' : 'legacy';
}

export function setDocumentEngine(documentType, engine) {
  if (!ENGINE_DOC_TYPES.includes(documentType)) return getDocumentEngineSettings();
  const next = { ...getDocumentEngineSettings(), [documentType]: engine === 'modular' ? 'modular' : 'legacy' };
  try {
    localStorage.setItem(prefsKey(), JSON.stringify(next));
  } catch {
    /* 저장 실패는 조용히 무시(외부 전송 없음) */
  }
  return next;
}

// legacy로 되돌리기
export function resetDocumentEngine(documentType) {
  return setDocumentEngine(documentType, 'legacy');
}

// ── 기기 간 동기화용 (백업 번들에 포함되는 비민감 설정) ──
// 엔진 전환 설정(legacy/modular 플래그)만 동기화한다. 검수/fallback 데이터는 개인정보가
// 포함될 수 있어 동기화 대상이 아니다.
export const ENGINE_SETTINGS_VERSION = 1;

// 백업에 넣을 버전드 페이로드: { version, updatedAt, engines: { docType: 'legacy'|'modular' } }
export function getEnginePrefsForSync() {
  return {
    version: ENGINE_SETTINGS_VERSION,
    updatedAt: new Date().toISOString(),
    engines: getDocumentEngineSettings(),
  };
}

// 복원: 버전드 래퍼({engines}) 또는 평면 객체 모두 허용.
//  - 알 수 없는 documentType은 무시
//  - 허용되지 않은 값은 legacy로 처리(=modular가 아닌 모든 값)
//  - 비어 있거나 손상되면 기본값(legacy) 유지
export function applyEnginePrefsFromSync(payload) {
  if (!payload || typeof payload !== 'object') return getDocumentEngineSettings();
  const engines = payload.engines && typeof payload.engines === 'object' ? payload.engines : payload;
  const clean = {};
  ENGINE_DOC_TYPES.forEach((k) => {
    if (engines[k] === 'modular') clean[k] = 'modular';
  });
  const next = { ...DEFAULT_ENGINE_PREFS, ...clean };
  try {
    localStorage.setItem(prefsKey(), JSON.stringify(next));
  } catch {
    /* 무시 */
  }
  return next;
}
