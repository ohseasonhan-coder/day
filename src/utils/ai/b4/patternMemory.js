import { B4_KEYS, B4_MAX_RECENT_PATTERNS } from './config';

const safeJson = (value, fallback) => {
  try { return JSON.parse(value || ''); } catch { return fallback; }
};

const clean = (value, max = 80) => String(value || '').slice(0, max);
const cleanNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function getB4RecentPatterns() {
  try {
    const rows = safeJson(localStorage.getItem(B4_KEYS.RECENT_PATTERNS), []);
    return Array.isArray(rows) ? rows.slice(0, B4_MAX_RECENT_PATTERNS) : [];
  } catch { return []; }
}

export function recordB4RecentPattern(meta = {}) {
  const entry = {
    ts: Date.now(),
    primaryTheme: clean(meta.primaryTheme, 40),
    secondaryTheme: clean(meta.secondaryTheme, 40),
    discourseRelation: clean(meta.discourseRelation, 60),
    learningPatternId: clean(meta.learningPatternId, 80),
    supportPatternId: clean(meta.supportPatternId, 80),
    styleProfile: clean(meta.styleProfile, 40),
    rhythmSignature: clean(meta.rhythmSignature, 120),
    lengthBucket: clean(meta.lengthBucket, 24),
    firstTokenType: clean(meta.firstTokenType, 32),
    connectorType: clean(meta.connectorType, 32),
    verbType: clean(meta.verbType, 32),
    endingType: clean(meta.endingType, 48),
    sentenceCount: cleanNumber(meta.sentenceCount, 0),
    hasSpeech: !!meta.hasSpeech,
    selected: !!meta.selected,
    feedbackTags: (meta.feedbackTags || []).map((tag) => clean(tag, 40)).slice(0, 10),
  };
  try {
    const next = [entry, ...getB4RecentPatterns()].slice(0, B4_MAX_RECENT_PATTERNS);
    localStorage.setItem(B4_KEYS.RECENT_PATTERNS, JSON.stringify(next));
  } catch {}
  return entry;
}

export function getB4FeedbackWeight(candidate = {}, themeIds = [], rows = null) {
  let entries = rows;
  if (!entries) {
    try { entries = safeJson(localStorage.getItem(B4_KEYS.REVIEW_DATA), []); } catch { entries = []; }
  }
  const themesKey = [...(themeIds || [])].sort().join('|');
  const relevant = (entries || []).filter((entry) => entry.engine === 'rule-b4' || entry.variant === 'C')
    .filter((entry) => !entry.themeIds?.length || [...entry.themeIds].sort().join('|') === themesKey)
    .filter((entry) => entry.learningPatternId === candidate.patternId || entry.supportPatternId === candidate.patternId);
  const raw = relevant.reduce((sum, entry) => {
    const selected = entry.selections || [];
    const editTypes = entry.surfaceEditTypes || [];
    return sum
      + (selected.includes('use_as_is') ? 7 : 0)
      - (selected.includes('minor_wording') ? 2 : 0)
      - (selected.includes('need_natural') ? 5 : 0)
      - (selected.includes('need_support_plan') ? 5 : 0)
      - (selected.includes('fact_mismatch') ? 40 : 0)
      - (selected.includes('overgeneralized') ? 10 : 0)
      - (selected.includes('speech_damaged') ? 30 : 0)
      - (editTypes.includes('조사') ? 2 : 0)
      - (editTypes.includes('어미') ? 2 : 0)
      - (editTypes.includes('연결어') ? 2 : 0)
      - (editTypes.includes('반복') ? 2 : 0)
      - (editTypes.includes('일반론') ? 4 : 0)
      - (editTypes.includes('지원 구체성') ? 4 : 0);
  }, 0);
  return Math.max(-40, Math.min(14, raw));
}

export function getB4RecentPatternPenalty(candidate = {}, plan = {}, styleProfile = 'objective', rows = getB4RecentPatterns()) {
  const relation = plan.relation || '';
  const primary = plan.primaryTheme || plan.learningFocus?.[0] || '';
  const secondary = plan.secondaryTheme || plan.learningFocus?.[1] || '';
  const repeated = (rows || []).filter((entry) =>
    entry.primaryTheme === primary
    && entry.secondaryTheme === secondary
    && entry.discourseRelation === relation
    && entry.styleProfile === styleProfile
    && (entry.learningPatternId === candidate.patternId || entry.supportPatternId === candidate.patternId));
  return Math.min(18, repeated.length * 4);
}

export function getB4RhythmPenalty(candidate = {}, plan = {}, styleProfile = 'objective', rows = getB4RecentPatterns()) {
  const signature = candidate.rhythmSignature || candidate.rhythm?.signature || '';
  if (!signature) return 0;
  const relation = plan.relation || '';
  const primary = plan.primaryTheme || plan.learningFocus?.[0] || '';
  const secondary = plan.secondaryTheme || plan.learningFocus?.[1] || '';
  const repeated = (rows || []).filter((entry) =>
    entry.primaryTheme === primary
    && entry.secondaryTheme === secondary
    && entry.discourseRelation === relation
    && entry.styleProfile === styleProfile
    && entry.rhythmSignature === signature);
  return Math.min(16, repeated.length * 4);
}
