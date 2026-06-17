// 사용자 선택/수정 검수 데이터 로컬 저장 (외부 전송 절대 없음).
// 비교 모드에서 legacy/modular 중 무엇을 선택했고, 선택 후 어떻게 수정했는지 누적한다.
// 저장 위치: localStorage (사용자별 키). 드라이브 자동 백업 대상 키가 아니므로 외부로 나가지 않는다.
// storage.js(드라이브/사진 의존) import를 피하기 위해 localStorage를 직접 사용한다.

function currentUid() {
  try {
    const s = localStorage.getItem('sw_session');
    return s ? (JSON.parse(s)?.userId || 'default') : 'default';
  } catch {
    return 'default';
  }
}
function reviewKey() {
  return `sw_${currentUid()}_engine_reviews`;
}
function readAll() {
  try {
    const v = localStorage.getItem(reviewKey());
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}
function writeAll(list) {
  try {
    localStorage.setItem(reviewKey(), JSON.stringify(list));
  } catch {
    /* 저장 한도 초과 등은 조용히 무시(외부 전송 없음) */
  }
}
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// 비교 모드에서 사용자가 legacy/modular를 선택(또는 직접 수정)했을 때 호출.
// 새 스키마 필드를 기본으로 하되, 이전 필드명(docType/chosenEngine/input/finalText)도 받아들인다.
export function recordEngineChoice(payload = {}) {
  const documentType = payload.documentType || payload.docType || '';
  const selectedEngine = payload.selectedEngine || payload.chosenEngine || null;
  const inputText = payload.inputText ?? payload.input ?? '';
  const legacyText = payload.legacyText ?? '';
  const modularText = payload.modularText ?? '';
  // userEditedText(신규) 또는 finalText(구버전)로 사용자가 직접 고친 문장을 받는다.
  const rawEdited = payload.userEditedText != null ? payload.userEditedText : payload.finalText;
  const baseText = selectedEngine === 'modular' ? modularText : legacyText;
  const userEditedText = rawEdited != null && rawEdited !== baseText ? rawEdited : null;
  const finalText = userEditedText != null ? userEditedText : baseText;
  const edited = userEditedText != null;

  const entry = {
    id: genId(),
    recordId: payload.recordId || null,
    inputText,
    documentType,
    legacyText,
    modularText,
    legacyScore: payload.legacyScore || null,   // { totalScore, factPreservation, naturalness, safety, documentFit }
    modularScore: payload.modularScore || null,
    recommendedEngine: payload.recommendedEngine || null,
    selectedEngine,                             // 'legacy' | 'modular'
    userEditedText,
    finalText,
    edited,
    tags: payload.tags || [],
    category: payload.category || null,
    warnings: payload.warnings || [],           // 선택 시점의 modular 경고
    selectedAt: new Date().toISOString(),
  };
  // 구버전 테스트/호출 호환을 위한 별칭 필드
  entry.chosenEngine = selectedEngine;

  const list = readAll();
  list.push(entry);
  writeAll(list);
  // TODO(userCorrectionLearning): 누적된 correction을 다음 단계에서 문장 선택/규칙 보강에 반영.
  return entry;
}

export function getEngineReviews() {
  return readAll();
}
export function clearEngineReviews() {
  writeAll([]);
}

// ── fallback 로그 (modular → legacy 되돌아간 사유 누적, 로컬 전용) ──
function fallbackKey() {
  return `sw_${currentUid()}_engine_fallbacks`;
}
function readFallbacks() {
  try {
    const v = localStorage.getItem(fallbackKey());
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}
export function recordFallback({ documentType, reasons = [], inputText = '', at } = {}) {
  const entry = { id: genId(), documentType, reasons, inputText, at: at || new Date().toISOString() };
  try {
    const list = readFallbacks();
    list.push(entry);
    // 최근 200건만 보관(저장 한도 보호)
    localStorage.setItem(fallbackKey(), JSON.stringify(list.slice(-200)));
  } catch {
    /* 무시 */
  }
  return entry;
}
export function getFallbackLog() {
  return readFallbacks();
}
export function clearFallbackLog() {
  try {
    localStorage.setItem(fallbackKey(), JSON.stringify([]));
  } catch {
    /* 무시 */
  }
}

// 구버전 호환 별칭 (이전 인메모리 API를 쓰던 코드/테스트 대비)
export const getPendingCorrections = getEngineReviews;
export const clearPendingCorrections = clearEngineReviews;
