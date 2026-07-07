import { B4_KEYS } from './config';

export const TEACHER_PREFERENCE_VERSION = 1;
export const TEACHER_PREFERENCE_LIMITS = {
  MIN_SHOWN_FOR_WEIGHT: 4,
  MIN_FEEDBACK_FOR_WEIGHT: 3,
  MAX_WEIGHT: 8,
  MIN_WEIGHT: -8,
  MAX_ENTRIES: 360,
};

export const TEACHER_EDIT_TAGS = [
  'shorten',
  'splitSentence',
  'mergeSentence',
  'fixParticle',
  'changeEnding',
  'changeConnector',
  'removeGeneric',
  'removeObservationRepeat',
  'editLearningReading',
  'makeSupportSpecific',
  'makeSupportConcise',
  'moveDirectSpeech',
  'warmTone',
  'objectiveTone',
  'other',
];

const SECTION_IDS = ['observation', 'learning', 'support', 'learningReading', 'supportPlan'];
const clean = (value, max = 80) => String(value || '').trim().replace(/\s{2,}/g, ' ').slice(0, max);
const unique = (values) => [...new Set((values || []).filter(Boolean))];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeJson = (value, fallback) => {
  try { return JSON.parse(value || ''); } catch { return fallback; }
};

function normalizeSection(section = '') {
  if (section === 'learningReading') return 'learning';
  if (section === 'supportPlan') return 'support';
  return SECTION_IDS.includes(section) ? section : '';
}

function normalizeThemes(primaryTheme = '', secondaryTheme = '') {
  return unique([clean(primaryTheme, 40), clean(secondaryTheme, 40)]).join('+');
}

function patternFor(meta = {}) {
  return clean(meta.patternId || meta.supportPatternId || meta.selectedCandidateId, 100);
}

function normalizeProfile(profile = {}) {
  return {
    version: TEACHER_PREFERENCE_VERSION,
    sequence: Number(profile.sequence) || 0,
    entries: Array.isArray(profile.entries) ? profile.entries.slice(0, TEACHER_PREFERENCE_LIMITS.MAX_ENTRIES) : [],
  };
}

export function buildTeacherPreferenceKey(meta = {}) {
  const section = normalizeSection(meta.section);
  const themes = normalizeThemes(meta.primaryTheme, meta.secondaryTheme);
  const relation = clean(meta.discourseRelation, 60);
  const pattern = patternFor(meta);
  const styleProfile = clean(meta.styleProfile || 'objective', 40);
  if (!section || !pattern) return '';
  return [section, themes || 'theme_unknown', relation || 'relation_unknown', pattern, styleProfile].join('|');
}

export function getTeacherPreferenceProfile() {
  try {
    return normalizeProfile(safeJson(localStorage.getItem(B4_KEYS.TEACHER_PREFERENCE_PROFILE), {}));
  } catch {
    return normalizeProfile({});
  }
}

function feedbackCount(entry = {}) {
  return (entry.acceptedCount || 0)
    + (entry.editedCount || 0)
    + (entry.rejectedCount || 0)
    + (entry.factIssueCount || 0)
    + (entry.holdCount || 0)
    + (entry.preferredCount || 0);
}

export function computeTeacherPreferenceWeight(entry = {}) {
  const shown = Number(entry.shownCount) || 0;
  const feedback = feedbackCount(entry);
  if (shown < TEACHER_PREFERENCE_LIMITS.MIN_SHOWN_FOR_WEIGHT || feedback < TEACHER_PREFERENCE_LIMITS.MIN_FEEDBACK_FOR_WEIGHT) return 0;
  const raw =
    (entry.acceptedCount || 0) * 1.6
    + (entry.preferredCount || 0) * 1.4
    + (entry.editedCount || 0) * 0.35
    - (entry.rejectedCount || 0) * 1.5
    - (entry.holdCount || 0) * 0.8
    - (entry.factIssueCount || 0) * 5.5;
  const editPressure = shown ? (entry.editedCount || 0) / shown : 0;
  const adjusted = raw - (editPressure > 0.45 ? 1.2 : 0);
  return clamp(Math.round(adjusted), TEACHER_PREFERENCE_LIMITS.MIN_WEIGHT, TEACHER_PREFERENCE_LIMITS.MAX_WEIGHT);
}

function sanitizeEditTags(tags = []) {
  return unique(tags).filter((tag) => TEACHER_EDIT_TAGS.includes(tag)).slice(0, 10);
}

function patchEntry(entry = {}, meta = {}, nextSequence = 0) {
  const selections = meta.selections || [];
  const editTags = sanitizeEditTags(meta.editTags);
  const selected = !!meta.selected || !!meta.finalPreferred || selections.includes('preferred_result');
  const editedAfterUse = !!meta.editedAfterUse || selections.includes('edited_after_use') || editTags.length > 0;
  const useAsIs = selections.includes('use_as_is');
  const factIssue = selections.includes('fact_mismatch');
  const held = selections.includes('not_used_hold');
  const rejected = factIssue || held || selections.includes('overgeneralized') || selections.includes('speech_damaged');
  const next = {
    ...entry,
    key: meta.key,
    section: normalizeSection(meta.section),
    primaryTheme: clean(meta.primaryTheme, 40),
    secondaryTheme: clean(meta.secondaryTheme, 40),
    theme: normalizeThemes(meta.primaryTheme, meta.secondaryTheme),
    discourseRelation: clean(meta.discourseRelation, 60),
    patternId: clean(meta.patternId, 100),
    supportPatternId: clean(meta.supportPatternId, 100),
    styleProfile: clean(meta.styleProfile || 'objective', 40),
    rhythmSignature: clean(meta.rhythmSignature, 140),
    sequence: nextSequence,
    shownCount: (entry.shownCount || 0) + 1,
    acceptedCount: (entry.acceptedCount || 0) + (useAsIs ? 1 : 0),
    editedCount: (entry.editedCount || 0) + (editedAfterUse ? 1 : 0),
    rejectedCount: (entry.rejectedCount || 0) + (rejected ? 1 : 0),
    factIssueCount: (entry.factIssueCount || 0) + (factIssue ? 1 : 0),
    holdCount: (entry.holdCount || 0) + (held ? 1 : 0),
    preferredCount: (entry.preferredCount || 0) + (selected ? 1 : 0),
    auditPassedCount: (entry.auditPassedCount || 0) + (meta.auditPassed ? 1 : 0),
    auditFailedCount: (entry.auditFailedCount || 0) + (meta.auditPassed === false ? 1 : 0),
    editTags: { ...(entry.editTags || {}) },
  };
  editTags.forEach((tag) => {
    next.editTags[tag] = (next.editTags[tag] || 0) + 1;
  });
  next.preferenceWeight = computeTeacherPreferenceWeight(next);
  return next;
}

export function saveTeacherPreferenceProfile(profile = {}) {
  const safe = normalizeProfile(profile);
  try { localStorage.setItem(B4_KEYS.TEACHER_PREFERENCE_PROFILE, JSON.stringify(safe)); } catch {}
  return safe;
}

export function clearTeacherPreferenceProfile() {
  try { localStorage.removeItem(B4_KEYS.TEACHER_PREFERENCE_PROFILE); } catch {}
}

export function recordTeacherPreferenceFeedback(meta = {}) {
  const key = buildTeacherPreferenceKey(meta);
  if (!key) return null;
  const profile = getTeacherPreferenceProfile();
  const sequence = profile.sequence + 1;
  const current = profile.entries.find((entry) => entry.key === key) || {};
  const nextEntry = patchEntry(current, { ...meta, key }, sequence);
  const entries = [nextEntry, ...profile.entries.filter((entry) => entry.key !== key)]
    .slice(0, TEACHER_PREFERENCE_LIMITS.MAX_ENTRIES);
  saveTeacherPreferenceProfile({ version: TEACHER_PREFERENCE_VERSION, sequence, entries });
  return nextEntry;
}

export function getTeacherPreferenceWeight(candidate = {}, plan = {}, styleProfile = 'objective', profile = getTeacherPreferenceProfile()) {
  if (!candidate.safe) return 0;
  const key = buildTeacherPreferenceKey({
    section: candidate.section,
    primaryTheme: candidate.primaryTheme || plan.primaryTheme || plan.learningFocus?.[0],
    secondaryTheme: candidate.secondaryTheme || plan.secondaryTheme || plan.learningFocus?.[1],
    discourseRelation: candidate.discourseRelation || plan.relation,
    patternId: candidate.patternId,
    supportPatternId: candidate.supportPatternId,
    selectedCandidateId: candidate.id,
    styleProfile,
  });
  const entry = (profile.entries || []).find((row) => row.key === key);
  return entry ? computeTeacherPreferenceWeight(entry) : 0;
}

function commonEditTags(entry = {}) {
  return Object.entries(entry.editTags || {})
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag)
    .slice(0, 4);
}

function recommendationFor(entry = {}) {
  const shown = entry.shownCount || 0;
  const editedRate = shown ? (entry.editedCount || 0) / shown : 0;
  const acceptedRate = shown ? (entry.acceptedCount || 0) / shown : 0;
  const factRate = shown ? (entry.factIssueCount || 0) / shown : 0;
  const tags = commonEditTags(entry);
  if (shown < 8 || feedbackCount(entry) < 4) return 'sample_insufficient';
  if (factRate > 0.03) return 'fact_issue_check_needed';
  if (editedRate >= 0.35 && tags.some((tag) => ['shorten', 'makeSupportConcise'].includes(tag))) return 'shorter_variant_needed';
  if (editedRate >= 0.35 && tags.includes('changeConnector')) return 'connector_improvement_needed';
  if (editedRate >= 0.35 && tags.includes('makeSupportSpecific')) return 'support_specificity_needed';
  if (acceptedRate >= 0.6 && editedRate < 0.25) return 'keep';
  return 'sample_insufficient';
}

function confidenceFor(entry = {}) {
  const shown = entry.shownCount || 0;
  const feedback = feedbackCount(entry);
  if (shown >= 30 && feedback >= 15) return 'high';
  if (shown >= 12 && feedback >= 6) return 'medium';
  return 'low';
}

export function getPhraseImprovementCandidates(profile = getTeacherPreferenceProfile(), { includeInsufficient = true } = {}) {
  return (profile.entries || []).map((entry) => {
    const shown = entry.shownCount || 0;
    const recommendation = recommendationFor(entry);
    const factIssueRate = shown ? Math.round(((entry.factIssueCount || 0) / shown) * 100) / 100 : 0;
    return {
      patternId: entry.patternId || entry.supportPatternId,
      supportPatternId: entry.supportPatternId,
      section: entry.section,
      theme: entry.theme,
      styleProfile: entry.styleProfile,
      shownCount: shown,
      acceptedRate: shown ? Math.round(((entry.acceptedCount || 0) / shown) * 100) / 100 : 0,
      editedRate: shown ? Math.round(((entry.editedCount || 0) / shown) * 100) / 100 : 0,
      commonEditTags: commonEditTags(entry),
      factIssueCount: entry.factIssueCount || 0,
      factIssueRate,
      auditPassed: (entry.auditFailedCount || 0) === 0,
      recommendation,
      confidence: confidenceFor(entry),
      metadataOnly: true,
    };
  }).filter((item) => includeInsufficient || item.recommendation !== 'sample_insufficient');
}

export function exportTeacherPreferenceProfileSummary(profile = getTeacherPreferenceProfile()) {
  return JSON.stringify({
    version: TEACHER_PREFERENCE_VERSION,
    sequence: profile.sequence || 0,
    entries: (profile.entries || []).map((entry) => ({
      patternId: entry.patternId || '',
      supportPatternId: entry.supportPatternId || '',
      theme: entry.theme || '',
      section: entry.section || '',
      styleProfile: entry.styleProfile || '',
      shownCount: entry.shownCount || 0,
      acceptedCount: entry.acceptedCount || 0,
      editedCount: entry.editedCount || 0,
      rejectedCount: entry.rejectedCount || 0,
      factIssueCount: entry.factIssueCount || 0,
      editTags: entry.editTags || {},
      preferenceWeight: entry.preferenceWeight || 0,
      auditPassed: (entry.auditFailedCount || 0) === 0,
    })),
  }, null, 2);
}

export function importTeacherPreferenceProfileSummary(jsonString = '') {
  const data = safeJson(jsonString, null);
  if (!data || !Array.isArray(data.entries)) return { ok: false, error: 'invalid_profile_summary' };
  const profile = getTeacherPreferenceProfile();
  let next = profile;
  data.entries.forEach((entry) => {
    const tags = Object.entries(entry.editTags || {}).flatMap(([tag, count]) => Array(Math.min(10, Number(count) || 0)).fill(tag));
    next = saveTeacherPreferenceProfile(next);
    for (let i = 0; i < Math.max(1, entry.shownCount || 1); i += 1) {
      recordTeacherPreferenceFeedback({
        section: entry.section,
        primaryTheme: (entry.theme || '').split('+')[0],
        secondaryTheme: (entry.theme || '').split('+')[1],
        patternId: entry.patternId,
        supportPatternId: entry.supportPatternId,
        styleProfile: entry.styleProfile,
        selections: i < (entry.acceptedCount || 0) ? ['use_as_is'] : [],
        editTags: i === 0 ? tags : [],
        auditPassed: entry.auditPassed !== false,
      });
    }
    next = getTeacherPreferenceProfile();
  });
  return { ok: true, entries: getTeacherPreferenceProfile().entries.length };
}

const teacherPreferenceProfileApi = {
  getTeacherPreferenceProfile,
  recordTeacherPreferenceFeedback,
  getTeacherPreferenceWeight,
  getPhraseImprovementCandidates,
};

export default teacherPreferenceProfileApi;
