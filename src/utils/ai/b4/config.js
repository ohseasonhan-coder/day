export const B4_KEYS = {
  ENABLED: 'sw_b4_discourse_engine_enabled',
  STYLE_PROFILE: 'sw_b4_style_profile',
  RECENT_PATTERNS: 'sw_b4_recent_patterns',
  TEACHER_PREFERENCE_PROFILE: 'sw_b4_teacher_preference_profile',
  REVIEW_DATA: 'sw_review_entries',
};

export const B4_STYLE_PROFILES = [
  { id: 'objective', label: '객관적 기록형' },
  { id: 'warm', label: '따뜻한 기록형' },
  { id: 'concise', label: '간결한 기록형' },
  { id: 'parent_share', label: '부모 공유 전환형' },
  { id: 'teacher_eval', label: '교사 평가형' },
];

export function isB4Enabled() {
  try { return localStorage.getItem(B4_KEYS.ENABLED) === '1'; } catch { return false; }
}

export function setB4Enabled(enabled) {
  try {
    if (enabled) localStorage.setItem(B4_KEYS.ENABLED, '1');
    else localStorage.removeItem(B4_KEYS.ENABLED);
  } catch {}
}

export function getB4StyleProfile() {
  try {
    const value = localStorage.getItem(B4_KEYS.STYLE_PROFILE);
    return B4_STYLE_PROFILES.some((item) => item.id === value) ? value : 'objective';
  } catch { return 'objective'; }
}

export function setB4StyleProfile(profileId) {
  try {
    const safe = B4_STYLE_PROFILES.some((item) => item.id === profileId) ? profileId : 'objective';
    localStorage.setItem(B4_KEYS.STYLE_PROFILE, safe);
  } catch {}
}

export const B4_SAFE_SCORE_MIN = 92;
export const B4_MAX_RECENT_PATTERNS = 50;
export const B4_MIN_CANDIDATES_PER_SECTION = 5;
export const B4_MAX_CANDIDATES_PER_SECTION = 10;
