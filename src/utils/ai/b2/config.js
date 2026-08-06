import { getGeminiConfig } from '../llm/geminiLLM';

export const B2_KEYS = {
  ENGINE: 'sw_b2_sentence_engine',
  REVIEW_DATA: 'sw_review_entries',
};

export const B2_LLM_ENGINES = ['rule-b2', 'local-7b', 'private-server-7b', 'private-server-14b', 'auto', 'gemini'];
export const DEFAULT_B2_ENGINE = 'rule-b2';

// 관리자가 엔진을 한 번도 직접 고른 적이 없으면(저장된 값 없음) Gemini 키가 설정돼 있는지로
// 자동 판단한다 — 키만 저장하면 별도 선택 없이 바로 AI가 작성하고, 키가 없으면 규칙 엔진 그대로다.
// 명시적으로 고른 값(규칙 엔진 포함)은 항상 그대로 저장되어 이 자동 판단보다 우선한다.
export function getB2SentenceEngine() {
  let saved = null;
  try { saved = localStorage.getItem(B2_KEYS.ENGINE); } catch { saved = null; }
  if (B2_LLM_ENGINES.includes(saved)) return saved;
  try { if (getGeminiConfig().apiKey) return 'gemini'; } catch {}
  return DEFAULT_B2_ENGINE;
}

export function setB2SentenceEngine(engine) {
  const next = B2_LLM_ENGINES.includes(engine) ? engine : DEFAULT_B2_ENGINE;
  try { localStorage.setItem(B2_KEYS.ENGINE, next); } catch {}
  return next;
}

export function resolveB2SentenceEngine(engine = getB2SentenceEngine(), { reviewMode = false } = {}) {
  const next = B2_LLM_ENGINES.includes(engine) ? engine : DEFAULT_B2_ENGINE;
  return next === 'auto' && !reviewMode ? DEFAULT_B2_ENGINE : next;
}

export const B2_ADJUSTMENTS = [
  ['shorter', '더 짧게'],
  ['objective', '더 객관적으로'],
  ['warm', '더 따뜻하게'],
  ['learning', '배움 읽기만 다시 정리'],
  ['support', '지원 계획을 더 구체적으로'],
  ['speech', '직접 발화 강조'],
  ['facts_only', '관찰 사실만 남기기'],
];
