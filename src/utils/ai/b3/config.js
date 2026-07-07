export const B3_KEYS = {
  ENABLED: 'sw_b3_case_engine_enabled',
  REVIEW_DATA: 'sw_review_entries',
};

export function isB3Enabled() {
  try { return localStorage.getItem(B3_KEYS.ENABLED) === '1'; } catch { return false; }
}

export function setB3Enabled(enabled) {
  try {
    if (enabled) localStorage.setItem(B3_KEYS.ENABLED, '1');
    else localStorage.removeItem(B3_KEYS.ENABLED);
  } catch {}
}

export const B3_SAFE_SCORE_MIN = 90;
export const B3_CASE_SCORE_MIN = 58;
export const B3_MAX_SIMILAR_CASES = 5;

