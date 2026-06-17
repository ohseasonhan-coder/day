// 문서 출력 엔진 resolver + fallback.
// 활성 엔진이 modular면 modular 결과를 생성·검수하고, 문제가 있으면 legacy로 안전하게 되돌린다.
// 일반 사용자에게는 결과 텍스트만 전달되며, 점수/엔진/사유 등 내부 정보는 노출하지 않는다.
import { scoreText } from './qualityScorer';
import { extractActualSpeech } from './inputParser';
import { getActiveEngineForDocument } from './documentEngineSettings';
import { recordFallback } from './userCorrectionLearning';

export const FALLBACK_MIN_SCORE = 85;
const INTERNAL_LABEL_RE = /놀이 흐름:|교사 지원:|발달영역:|평가:|소재:|qualityScore:|modularDrafts:/;
const SPEECH_REQUIRED = new Set(['observation']);

// 발화 보존 검사: 출력의 따옴표 발화는 입력 발화와 일치해야 하고,
// 관찰일지는 입력 발화를 모두 포함해야 한다.
function speechPreserved(text, input, documentType) {
  const inputSpeeches = extractActualSpeech(input).filter(Boolean);
  const outputSpeeches = extractActualSpeech(text).filter(Boolean);
  // 출력에 입력에 없던 발화가 있으면(변형/날조) 실패
  if (outputSpeeches.some((q) => !inputSpeeches.includes(q))) return false;
  // 관찰일지는 입력 발화를 모두 보존해야 함
  if (SPEECH_REQUIRED.has(documentType)) {
    return inputSpeeches.every((q) => text.includes(q));
  }
  return true;
}

// modular 결과를 검수해 fallback 여부를 판단한다.
export function validateModularOutput({ text, input = '', documentType = 'observation', scoreFn = scoreText } = {}) {
  const reasons = [];
  const value = String(text || '');
  if (!value.trim()) reasons.push('empty');
  if (INTERNAL_LABEL_RE.test(value)) reasons.push('internal_label');
  if (!speechPreserved(value, input, documentType)) reasons.push('speech_not_preserved');

  let score = null;
  if (value.trim()) {
    score = scoreFn(value, { input, documentType });
    if (score.totalScore < FALLBACK_MIN_SCORE) reasons.push('low_score');
    if (score.detail && score.detail.safety < 15) reasons.push('safety_warning');
  }
  return { ok: reasons.length === 0, reasons, score };
}

// 활성 엔진 설정에 따라 최종 출력을 결정한다.
//  - legacy 설정: legacy 텍스트 그대로
//  - modular 설정: modularFn 생성 → 검수 → 통과 시 modular, 실패 시 legacy fallback(+로그)
// 반환: { text, engine, fellBack, reasons }. (text만 사용자에게 노출)
export function resolveDocumentEngine({
  documentType,
  input = '',
  legacyText = '',
  modularFn,
  scoreFn = scoreText,
  log = true,
} = {}) {
  const active = getActiveEngineForDocument(documentType);
  if (active !== 'modular') {
    return { text: legacyText, engine: 'legacy', fellBack: false, reasons: [] };
  }

  let modularText = '';
  try {
    modularText = modularFn ? modularFn() : '';
  } catch {
    if (log) recordFallback({ documentType, reasons: ['modular_error'], inputText: input });
    return { text: legacyText, engine: 'legacy', fellBack: true, reasons: ['modular_error'] };
  }

  const verdict = validateModularOutput({ text: modularText, input, documentType, scoreFn });
  if (verdict.ok) {
    return { text: modularText, engine: 'modular', fellBack: false, reasons: [], score: verdict.score };
  }
  if (log) recordFallback({ documentType, reasons: verdict.reasons, inputText: input });
  return { text: legacyText, engine: 'legacy', fellBack: true, reasons: verdict.reasons, score: verdict.score };
}

// 사용자 노출용: 결과 텍스트만 반환(엔진/점수/사유 비노출)
export function generateWithFallback(args) {
  return resolveDocumentEngine(args).text;
}
