export const B2_KEYS = {
  ENGINE: 'sw_b2_sentence_engine',
  REVIEW_DATA: 'sw_review_entries',
};

export const B2_LLM_ENGINES = ['rule-b2', 'local-7b', 'private-server-7b', 'private-server-14b', 'auto'];
export const DEFAULT_B2_ENGINE = 'rule-b2';

export function getB2SentenceEngine() {
  try {
    const saved = localStorage.getItem(B2_KEYS.ENGINE);
    return B2_LLM_ENGINES.includes(saved) ? saved : DEFAULT_B2_ENGINE;
  } catch { return DEFAULT_B2_ENGINE; }
}

export function setB2SentenceEngine(engine) {
  const next = B2_LLM_ENGINES.includes(engine) ? engine : DEFAULT_B2_ENGINE;
  try {
    if (next === DEFAULT_B2_ENGINE) localStorage.removeItem(B2_KEYS.ENGINE);
    else localStorage.setItem(B2_KEYS.ENGINE, next);
  } catch {}
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
