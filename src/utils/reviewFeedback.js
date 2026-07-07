import { auditObservationCopy } from './ai/observationAudit';
import { parseTargetSections } from './ai/targetQuality';
import { buildStage5ReviewBaseline } from './ai/reviewBaselineV5';

export const REVIEW_KEYS = {
  MODE: 'sw_review_mode',
  NOTICE: 'sw_review_notice_seen',
  DATA: 'sw_review_entries',
};
export const MAX_REVIEW_ENTRIES = 200;

export const FEEDBACK_OPTIONS = [
  { key: 'use_as_is', label: '그대로 사용 가능' },
  { key: 'edited_after_use', label: '수정 후 사용' },
  { key: 'minor_wording', label: '표현만 약간 수정 필요' },
  { key: 'fact_mismatch', label: '사실과 다름' },
  { key: 'need_natural', label: '더 자연스럽게 필요' },
  { key: 'need_support_plan', label: '지원 계획을 더 구체적으로' },
  { key: 'preferred_result', label: '선호 결과' },
  { key: 'not_used_hold', label: '사용하지 않음/보류' },
  { key: 'more_natural_b2', label: 'B2보다 더 자연스러움' },
  { key: 'more_individual_b2', label: 'B2보다 더 개별적임' },
  { key: 'more_specific_support_b2', label: 'B2보다 지원 계획이 구체적임' },
  { key: 'overgeneralized', label: '과장 또는 일반론' },
  { key: 'speech_damaged', label: '직접 발화 훼손' },
];
const OPTION_KEYS = FEEDBACK_OPTIONS.map((option) => option.key);
const VARIANTS = ['A', 'B', 'B2', 'B3', 'C'];
const SURFACE_EDIT_TYPES = ['조사', '어미', '연결어', '길이', '일반론', '지원 구체성', '반복'];
const SURFACE_SECTIONS = ['observation', 'learning', 'support'];
export const TEACHER_EDIT_TAG_OPTIONS = [
  { key: 'shorten', label: '문장 축약' },
  { key: 'splitSentence', label: '문장 분리' },
  { key: 'mergeSentence', label: '문장 연결' },
  { key: 'fixParticle', label: '조사 수정' },
  { key: 'changeEnding', label: '종결 어미 수정' },
  { key: 'changeConnector', label: '연결어 수정' },
  { key: 'removeGeneric', label: '일반론 삭제' },
  { key: 'removeObservationRepeat', label: '관찰내용 반복 삭제' },
  { key: 'editLearningReading', label: '배움 읽기 표현 수정' },
  { key: 'makeSupportSpecific', label: '지원 계획 구체화' },
  { key: 'makeSupportConcise', label: '지원 계획 간결화' },
  { key: 'moveDirectSpeech', label: '직접 발화 위치 수정' },
  { key: 'warmTone', label: '따뜻한 톤 조정' },
  { key: 'objectiveTone', label: '객관적 톤 조정' },
  { key: 'other', label: '기타' },
];
const TEACHER_EDIT_TAG_KEYS = TEACHER_EDIT_TAG_OPTIONS.map((option) => option.key);

export function isReviewModeEnabled() {
  try { return localStorage.getItem(REVIEW_KEYS.MODE) === '1'; } catch { return false; }
}

export function setReviewMode(on) {
  try {
    if (on) localStorage.setItem(REVIEW_KEYS.MODE, '1');
    else localStorage.removeItem(REVIEW_KEYS.MODE);
  } catch {}
}

export function hasSeenReviewNotice() {
  try { return localStorage.getItem(REVIEW_KEYS.NOTICE) === '1'; } catch { return false; }
}

export function markReviewNoticeSeen() {
  try { localStorage.setItem(REVIEW_KEYS.NOTICE, '1'); } catch {}
}

export function toggleFeedbackSelection(current = [], key) {
  const cur = (current || []).filter((item) => OPTION_KEYS.includes(item));
  if (!OPTION_KEYS.includes(key)) return cur;
  if (key === 'use_as_is') return cur.includes('use_as_is') ? [] : ['use_as_is'];
  if (key === 'edited_after_use') {
    const withoutPositive = cur.filter((item) => item !== 'use_as_is');
    return withoutPositive.includes(key) ? withoutPositive.filter((item) => item !== key) : [...withoutPositive, key];
  }
  const withoutPositive = cur.filter((item) => item !== 'use_as_is');
  return withoutPositive.includes(key) ? withoutPositive.filter((item) => item !== key) : [...withoutPositive, key];
}

const short = (value, max) => String(value || '').slice(0, max);
const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set((values || []).filter(Boolean))];

function sentenceCount(text = '') {
  return clean(text).split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

function connectorCount(text = '') {
  return (clean(text).match(/수 있도록|과정에서|이후|그 뒤|하며|하고|면서|때문에|따라/g) || []).length;
}

function genericCount(text = '') {
  return (clean(text).match(/다양한 경험|충분한 기회|지속적으로|격려한다|지원한다|제공한다|발달|향상|능력/g) || []).length;
}

function supportSpecificityCount(text = '') {
  return (clean(text).match(/재료|공간|차례|순서|선택|말|표현|도구|카드|시간|자리|친구|역할|사진|그림/g) || []).length;
}

function particleSignal(text = '') {
  return (clean(text).match(/[은는이가을를으로에서에게]/g) || []).join('');
}

function endingSignal(text = '') {
  return clean(text).split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence) => sentence.split(/\s+/).slice(-1)[0]).join('|');
}

function quotePositions(text = '') {
  const value = clean(text);
  const positions = [];
  const re = /"[^"]+"/g;
  let match = re.exec(value);
  while (match) {
    positions.push(match.index);
    match = re.exec(value);
  }
  return positions.join('|');
}

export function extractTeacherEditTags(originalText = '', editedText = '', section = '') {
  const original = clean(originalText);
  const edited = clean(editedText);
  if (!original || !edited || original === edited) return [];
  const tags = [];
  if (edited.length < original.length * 0.84) tags.push('shorten');
  if (sentenceCount(edited) > sentenceCount(original)) tags.push('splitSentence');
  if (sentenceCount(edited) < sentenceCount(original)) tags.push('mergeSentence');
  if (particleSignal(original) !== particleSignal(edited) && Math.abs(original.length - edited.length) <= Math.max(24, original.length * 0.35)) tags.push('fixParticle');
  if (endingSignal(original) !== endingSignal(edited)) tags.push('changeEnding');
  if (connectorCount(original) !== connectorCount(edited)) tags.push('changeConnector');
  if (genericCount(original) > genericCount(edited)) tags.push('removeGeneric');
  if (section === 'learning') tags.push('editLearningReading');
  if (section === 'support' && supportSpecificityCount(edited) > supportSpecificityCount(original)) tags.push('makeSupportSpecific');
  if (section === 'support' && edited.length < original.length * 0.9) tags.push('makeSupportConcise');
  if (quotePositions(original) !== quotePositions(edited)) tags.push('moveDirectSpeech');
  if (/따뜻|기다리|마음|속상|안정/.test(edited) && !/따뜻|기다리|마음|속상|안정/.test(original)) tags.push('warmTone');
  if (/관찰|확인|사실|장면/.test(edited) && !/관찰|확인|사실|장면/.test(original)) tags.push('objectiveTone');
  if (!tags.length) tags.push('other');
  return unique(tags).filter((tag) => TEACHER_EDIT_TAG_KEYS.includes(tag)).slice(0, 8);
}

export function extractTeacherEditMetadata(originalSections = {}, editedSections = {}) {
  const sections = SURFACE_SECTIONS;
  const tagsBySection = {};
  const changedSections = [];
  sections.forEach((section) => {
    const original = clean(originalSections[section]);
    const edited = clean(editedSections[section]);
    if (!original && !edited) return;
    if (original !== edited) {
      changedSections.push(section);
      tagsBySection[section] = extractTeacherEditTags(original, edited, section);
    }
  });
  if (tagsBySection.learning && originalSections.observation) {
    const originalOverlap = tokenOverlapForReview(originalSections.learning, originalSections.observation);
    const editedOverlap = tokenOverlapForReview(editedSections.learning, originalSections.observation);
    if (editedOverlap < originalOverlap - 0.18) {
      tagsBySection.learning = unique([...(tagsBySection.learning || []), 'removeObservationRepeat']);
    }
  }
  return {
    edited: changedSections.length > 0,
    editedSections: changedSections,
    tagsBySection,
    editTags: unique(Object.values(tagsBySection).flat()).slice(0, 10),
  };
}

function tokenOverlapForReview(a = '', b = '') {
  const left = unique(clean(a).replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 2));
  const right = new Set(clean(b).replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 2));
  return left.length ? left.filter((word) => right.has(word)).length / left.length : 0;
}

function sanitizeEntry(entry = {}) {
  const out = {
    id: `rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    kind: ['feedback', 'preference', 'edit'].includes(entry.kind) ? entry.kind : 'feedback',
    resultId: short(entry.resultId, 40),
    docType: short(entry.docType || 'observation', 20),
  };
  if (out.kind === 'feedback') {
    out.variant = VARIANTS.includes(entry.variant) ? entry.variant : 'B';
    out.selections = (entry.selections || []).filter((key) => OPTION_KEYS.includes(key)).slice(0, 10);
    out.auditCodes = (entry.auditCodes || []).map(String).slice(0, 10);
    out.themeIds = (entry.themeIds || []).map(String).slice(0, 3);
    out.skeletonId = short(entry.skeletonId, 60);
    out.variantId = short(entry.variantId, 60);
    out.engine = short(entry.engine, 40);
    out.auditPassed = !!entry.auditPassed;
    out.selected = !!entry.selected;
    out.editedAfterUse = !!entry.editedAfterUse || (entry.selections || []).includes('edited_after_use');
    out.rejectedOrHeld = !!entry.rejectedOrHeld || (entry.selections || []).includes('not_used_hold');
    out.learningPatternId = short(entry.learningPatternId, 80);
    out.supportPatternId = short(entry.supportPatternId, 80);
    out.selectedCandidateId = short(entry.selectedCandidateId, 160);
    out.candidateScore = Math.max(0, Math.min(200, Number(entry.candidateScore) || 0));
    out.discourseRelation = short(entry.discourseRelation, 60);
    out.styleProfile = short(entry.styleProfile, 40);
    out.rhythmSignature = short(entry.rhythmSignature, 140);
    out.section = SURFACE_SECTIONS.includes(entry.section) ? entry.section : '';
    out.primaryTheme = short(entry.primaryTheme, 40);
    out.secondaryTheme = short(entry.secondaryTheme, 40);
    out.surfaceEditTypes = (entry.surfaceEditTypes || []).filter((type) => SURFACE_EDIT_TYPES.includes(type)).slice(0, 7);
    out.editTags = (entry.editTags || []).filter((tag) => TEACHER_EDIT_TAG_KEYS.includes(tag)).slice(0, 10);
    out.finalPreferred = !!entry.finalPreferred;
  } else if (out.kind === 'preference') {
    out.preferred = ['A', 'B', 'C', 'same'].includes(entry.preferred) ? entry.preferred : 'same';
    out.engine = short(entry.engine, 40);
  } else {
    out.variant = VARIANTS.includes(entry.variant) ? entry.variant : 'B';
    out.edited = !!entry.edited;
    out.editLen = Math.max(0, Math.min(9999, Number(entry.editLen) || 0));
    out.editedSections = (entry.editedSections || []).map(String).slice(0, 6);
  }
  return out;
}

export function getReviewEntries() {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEYS.DATA)) || []; } catch { return []; }
}

export function saveReviewEntry(entry) {
  const sanitized = sanitizeEntry(entry);
  try {
    localStorage.setItem(REVIEW_KEYS.DATA, JSON.stringify([sanitized, ...getReviewEntries()].slice(0, MAX_REVIEW_ENTRIES)));
  } catch {}
  return sanitized;
}

export function clearReviewData() {
  try { localStorage.removeItem(REVIEW_KEYS.DATA); } catch {}
}

export function computeEditStats(original = {}, final = {}) {
  const sections = ['observation', 'evaluation', 'support', 'parent'];
  const editedSections = sections.filter((section) => String(original[section] || '').trim() !== String(final[section] || '').trim());
  const editLen = editedSections.reduce((sum, section) => sum + Math.abs(String(final[section] || '').trim().length - String(original[section] || '').trim().length), 0);
  return { edited: editedSections.length > 0, editLen, editedSections };
}

function makeCopyText(variant) {
  return [
    [variant.sectionLabels[0], variant.sections.observation],
    [variant.sectionLabels[1], variant.sections.learning],
    [variant.sectionLabels[2], variant.sections.support],
  ].filter(([, text]) => text && text.trim()).map(([label, text]) => `[${label}]\n${text.trim()}`).join('\n\n');
}

function hashText(value) {
  let h = 7;
  for (const ch of String(value || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function buildComparison({ result = {}, input = '', childName = '' } = {}) {
  const labels = ['관찰내용', '배움 읽기', '교사 지원 및 다음 계획'];
  const baseline = buildStage5ReviewBaseline({ observation: result.observation, support: result.support, input, childName });
  const makeVariant = ({ variant, title, sections, sourceEngine }) => {
    const item = { variant, title, sourceEngine, sections, sectionLabels: labels };
    item.copyText = makeCopyText(item);
    item.audit = auditObservationCopy({ input, observation: item.sections.observation, learning: item.sections.learning, support: item.sections.support, childName });
    return item;
  };

  const A = makeVariant({
    variant: 'A',
    title: '기존 B안',
    sourceEngine: 'legacy-rule',
    sections: baseline.sections,
  });
  A.audit = baseline.audit;

  const bText = result.b3?.copyReady || (result.b3?.enabled && !result.b4?.enabled ? result.copyReady : '') || result.b2CopyReady || result.copyReady || '';
  const bSections = parseTargetSections(bText);
  const B = makeVariant({
    variant: result.b3?.enabled ? 'B3' : (result.b2?.enabled ? 'B2' : 'B'),
    title: result.b3?.enabled ? 'B3 사례기반 문장 엔진' : (result.b2?.enabled ? 'B2 규칙 엔진' : '새 규칙 B안'),
    sourceEngine: result.b3?.enabled ? 'rule-b3' : 'rule-b2',
    sections: {
      observation: bSections.observation || '',
      learning: bSections.learning || '',
      support: bSections.support || '',
    },
  });

  if (!result.b4?.enabled) return { A, B, blind: false, displayKeys: ['A', 'B'] };

  const cSections = parseTargetSections(result.b4.copyReady || result.copyReady || '');
  const C = makeVariant({
    variant: 'C',
    title: 'B4 의미 그래프·담화 계획 엔진',
    sourceEngine: 'rule-b4',
    sections: {
      observation: cSections.observation || '',
      learning: cSections.learning || '',
      support: cSections.support || '',
    },
  });

  const variants = [A, B, C];
  const shift = hashText(`${input}|${childName}`) % variants.length;
  const rotated = [...variants.slice(shift), ...variants.slice(0, shift)];
  const displayKeys = ['A', 'B', 'C'];
  const out = { blind: true, displayKeys };
  rotated.forEach((variant, index) => {
    out[displayKeys[index]] = { ...variant, title: `안 ${displayKeys[index]}`, displaySlot: displayKeys[index] };
  });
  return out;
}

const rate = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export function buildReviewReport(entries = getReviewEntries()) {
  const fb = entries.filter((entry) => entry.kind === 'feedback');
  const prefs = entries.filter((entry) => entry.kind === 'preference');
  const edits = entries.filter((entry) => entry.kind === 'edit');
  const variantStats = (variant) => {
    const rows = fb.filter((entry) => entry.variant === variant);
    const has = (key) => rows.filter((entry) => (entry.selections || []).includes(key)).length;
    return {
      n: rows.length,
      useAsIsRate: rate(has('use_as_is'), rows.length),
      editedAfterUseRate: rate(has('edited_after_use'), rows.length),
      minorWordingRate: rate(has('minor_wording'), rows.length),
      factMismatchRate: rate(has('fact_mismatch'), rows.length),
      needNaturalRate: rate(has('need_natural'), rows.length),
      needSupportPlanRate: rate(has('need_support_plan'), rows.length),
      preferredResultRate: rate(has('preferred_result'), rows.length),
      notUsedHoldRate: rate(has('not_used_hold'), rows.length),
      moreNaturalThanB2Rate: rate(has('more_natural_b2'), rows.length),
      moreIndividualThanB2Rate: rate(has('more_individual_b2'), rows.length),
      moreSpecificSupportThanB2Rate: rate(has('more_specific_support_b2'), rows.length),
      overgeneralizedRate: rate(has('overgeneralized'), rows.length),
      speechDamagedRate: rate(has('speech_damaged'), rows.length),
      factMismatchCount: has('fact_mismatch'),
    };
  };
  const prefB = prefs.filter((entry) => entry.preferred === 'B').length;
  const prefC = prefs.filter((entry) => entry.preferred === 'C').length;
  const sectionFocus = {};
  edits.forEach((entry) => (entry.editedSections || []).forEach((section) => { sectionFocus[section] = (sectionFocus[section] || 0) + 1; }));
  const recentFreq = {};
  fb.slice(0, 20).forEach((entry) => (entry.selections || []).forEach((key) => { recentFreq[key] = (recentFreq[key] || 0) + 1; }));
  const recentPatterns = Object.entries(recentFreq).sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: (FEEDBACK_OPTIONS.find((option) => option.key === key) || {}).label || key, count }));
  const factCodeFreq = {};
  fb.filter((entry) => (entry.selections || []).includes('fact_mismatch'))
    .forEach((entry) => (entry.auditCodes || []).forEach((code) => { factCodeFreq[code] = (factCodeFreq[code] || 0) + 1; }));
  const factCauses = Object.entries(factCodeFreq).sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count }));
  const A = variantStats('A');
  const B = variantStats(fb.some((entry) => entry.variant === 'B3') ? 'B3' : (fb.some((entry) => entry.variant === 'B2') ? 'B2' : 'B'));
  const C = variantStats('C');
  let recommendation = '실제 검토 표본 부족으로 보류';
  if (A.n >= 30 && B.n >= 30 && prefs.length >= 30) {
    if (C.n >= 30 && prefC > prefB && C.useAsIsRate > B.useAsIsRate) recommendation = 'B4 또는 더 큰 계획 엔진 검토 확대 가능';
    else if (B.factMismatchCount > 0 || B.useAsIsRate <= A.useAsIsRate) recommendation = '일부 규칙 보완 후 승격 가능';
    else recommendation = '새 규칙 B안을 기본 엔진으로 승격 가능';
  }
  return {
    total: entries.length,
    feedbackCount: fb.length,
    A,
    B,
    C,
    preference: {
      n: prefs.length,
      a: prefs.filter((entry) => entry.preferred === 'A').length,
      b: prefB,
      c: prefC,
      same: prefs.filter((entry) => entry.preferred === 'same').length,
      bPreferredRate: rate(prefB, prefs.length),
      cPreferredRate: rate(prefC, prefs.length),
    },
    editing: {
      n: edits.length,
      editedRate: rate(edits.filter((entry) => entry.edited).length, edits.length),
      avgEditLen: edits.length ? Math.round(edits.reduce((sum, entry) => sum + (entry.editLen || 0), 0) / edits.length) : 0,
      sectionFocus,
    },
    recentPatterns,
    factCauses,
    recommendation,
    naturalnessAlignment: {
      internalRate: 100,
      teacherNeedNaturalRate: B.needNaturalRate,
      matches: B.n >= 30 && B.needNaturalRate === 0,
    },
  };
}
