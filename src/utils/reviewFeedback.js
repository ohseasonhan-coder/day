// 교사 검토 모드(4단계) — A안(기존)/B안(개선) 비교·피드백을 "이 기기 로컬"에만 저장한다.
//
// 원칙:
//  - 외부 전송 없음. 저장 키는 일반 기록 데이터(records 등)와 분리된 sw_review_* 전용.
//  - 원아 이름·원문 관찰기록·생성 전문은 저장하지 않는다(화이트리스트 필드만 저장).
//  - 최근 200건만 보관, "검토 데이터 삭제"로 즉시 전체 삭제.
//  - 리포트는 통계 중심(원문 미출력). 점수는 개발 검토 정보로만 다룬다.
import { auditObservationCopy } from './ai/observationAudit';
import { parseTargetSections } from './ai/targetQuality';

export const REVIEW_KEYS = {
  MODE: 'sw_review_mode',            // 검토 모드 feature flag
  NOTICE: 'sw_review_notice_seen',   // 개인정보 안내 확인 여부
  // 주의: 'sw_review_feedback'은 계정 키 패턴 sw_${uid}_feedback(uid='review')과 정확히 충돌하므로 금지.
  DATA: 'sw_review_entries',         // 피드백·선호·수정 통계 엔트리(최근 200건)
};
export const MAX_REVIEW_ENTRIES = 200;

export const FEEDBACK_OPTIONS = [
  { key: 'use_as_is', label: '그대로 사용 가능' },
  { key: 'minor_wording', label: '표현만 약간 수정 필요' },
  { key: 'fact_mismatch', label: '사실과 다름' },
  { key: 'need_natural', label: '더 자연스럽게 필요' },
  { key: 'need_support_plan', label: '더 구체적인 지원 계획 필요' },
];
const OPTION_KEYS = FEEDBACK_OPTIONS.map((o) => o.key);

// ── feature flag / 안내 ──────────────────────────────────────────────────
export function isReviewModeEnabled() {
  try { return localStorage.getItem(REVIEW_KEYS.MODE) === '1'; } catch { return false; }
}
export function setReviewMode(on) {
  try { if (on) localStorage.setItem(REVIEW_KEYS.MODE, '1'); else localStorage.removeItem(REVIEW_KEYS.MODE); } catch {}
}
export function hasSeenReviewNotice() {
  try { return localStorage.getItem(REVIEW_KEYS.NOTICE) === '1'; } catch { return false; }
}
export function markReviewNoticeSeen() {
  try { localStorage.setItem(REVIEW_KEYS.NOTICE, '1'); } catch {}
}

// ── 선택 규칙: "그대로 사용 가능"은 다른 항목과 동시 선택 불가 ─────────────
export function toggleFeedbackSelection(current = [], key) {
  const cur = (current || []).filter((k) => OPTION_KEYS.includes(k));
  if (!OPTION_KEYS.includes(key)) return cur;
  if (key === 'use_as_is') return cur.includes('use_as_is') ? [] : ['use_as_is'];
  const withoutPositive = cur.filter((k) => k !== 'use_as_is');
  return withoutPositive.includes(key) ? withoutPositive.filter((k) => k !== key) : [...withoutPositive, key];
}

// ── 저장(화이트리스트) — 원문·이름·생성 전문은 어떤 필드로 와도 저장하지 않음 ──
function sanitizeEntry(entry = {}) {
  const out = {
    id: `rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    kind: ['feedback', 'preference', 'edit'].includes(entry.kind) ? entry.kind : 'feedback',
    resultId: String(entry.resultId || '').slice(0, 40),
    docType: String(entry.docType || 'observation').slice(0, 20),
  };
  if (out.kind === 'feedback') {
    out.variant = ['A', 'B', 'C'].includes(entry.variant) ? entry.variant : 'B'; // C = 로컬 LLM(실험)
    out.selections = (entry.selections || []).filter((k) => OPTION_KEYS.includes(k)).slice(0, 5);
    out.memo = String(entry.memo || '').slice(0, 120); // 선택 메모(로컬 전용, 리포트 미출력)
    out.auditCodes = (entry.auditCodes || []).map(String).slice(0, 10); // 코드만(원문 아님)
  } else if (out.kind === 'preference') {
    out.preferred = ['A', 'B', 'C', 'same'].includes(entry.preferred) ? entry.preferred : 'same';
  } else if (out.kind === 'edit') {
    out.variant = entry.variant === 'A' ? 'A' : 'B';
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
  const san = sanitizeEntry(entry);
  try {
    const list = [san, ...getReviewEntries()].slice(0, MAX_REVIEW_ENTRIES); // 최근 200건만 보관
    localStorage.setItem(REVIEW_KEYS.DATA, JSON.stringify(list));
  } catch {}
  return san;
}
// 검토 데이터 즉시 삭제(피드백·수정 비교·집계 원천). 모드 flag·안내 확인은 데이터가 아니므로 유지.
export function clearReviewData() {
  try { localStorage.removeItem(REVIEW_KEYS.DATA); } catch {}
}

// ── 수정 전후 비교(원문 미보관 — 파생 통계만) ─────────────────────────────
export function computeEditStats(original = {}, final = {}) {
  const sections = ['observation', 'evaluation', 'support', 'parent'];
  const editedSections = sections.filter((s) => String(original[s] || '').trim() !== String(final[s] || '').trim());
  const editLen = editedSections.reduce((sum, s) => sum + Math.abs(String(final[s] || '').trim().length - String(original[s] || '').trim().length), 0);
  return { edited: editedSections.length > 0, editLen, editedSections };
}

// ── A안/B안 비교 데이터 — 같은 입력에서 기존/개선 결과를 나란히 ─────────────
//   A안: 기존 방식(관찰일지 문장 + 보육일지 평가 + 교사 지원계획)
//   B안: 3단계 개선 복사용(관찰내용 + 배움 읽기 + 교사 지원 및 다음 계획)
export function buildComparison({ result = {}, input = '', childName = '' } = {}) {
  const bSections = parseTargetSections(result.copyReady || '');
  const A = {
    variant: 'A',
    title: 'A안 · 기존 방식',
    sections: {
      observation: String(result.observation || ''),
      learning: String(result.evaluation || ''),
      support: String(result.support || ''),
    },
    sectionLabels: ['관찰내용(관찰일지 문장)', '평가(보육일지 평가)', '교사 지원계획'],
  };
  const B = {
    variant: 'B',
    title: 'B안 · 개선 방식(복사용 3단)',
    sections: {
      observation: bSections.observation || '',
      learning: bSections.learning || '',
      support: bSections.support || '',
    },
    sectionLabels: ['관찰내용', '배움 읽기', '교사 지원 및 다음 계획'],
  };
  [A, B].forEach((v) => {
    v.copyText = [
      [v.sectionLabels[0], v.sections.observation],
      [v.sectionLabels[1], v.sections.learning],
      [v.sectionLabels[2], v.sections.support],
    ].filter(([, t]) => t && t.trim()).map(([l, t]) => `[${l}]\n${t.trim()}`).join('\n\n');
    v.audit = auditObservationCopy({ input, observation: v.sections.observation, learning: v.sections.learning, support: v.sections.support, childName });
  });
  return { A, B };
}

// ── 로컬 검토 리포트(통계 중심 · 원문/메모 미출력) ─────────────────────────
const rate = (n, d) => (d ? Math.round((n / d) * 100) : 0);
export function buildReviewReport(entries = getReviewEntries()) {
  const fb = entries.filter((e) => e.kind === 'feedback');
  const prefs = entries.filter((e) => e.kind === 'preference');
  const edits = entries.filter((e) => e.kind === 'edit');

  const variantStats = (variant) => {
    const rows = fb.filter((e) => e.variant === variant);
    const has = (k) => rows.filter((e) => (e.selections || []).includes(k)).length;
    return {
      n: rows.length,
      useAsIsRate: rate(has('use_as_is'), rows.length),
      minorWordingRate: rate(has('minor_wording'), rows.length),
      factMismatchRate: rate(has('fact_mismatch'), rows.length),
      needNaturalRate: rate(has('need_natural'), rows.length),
      needSupportPlanRate: rate(has('need_support_plan'), rows.length),
      factMismatchCount: has('fact_mismatch'),
    };
  };

  const prefB = prefs.filter((e) => e.preferred === 'B').length;
  const prefC = prefs.filter((e) => e.preferred === 'C').length;
  const sectionFocus = {};
  edits.forEach((e) => (e.editedSections || []).forEach((s) => { sectionFocus[s] = (sectionFocus[s] || 0) + 1; }));

  // 최근 20건 반복 피드백 유형
  const recent = fb.slice(0, 20);
  const recentFreq = {};
  recent.forEach((e) => (e.selections || []).forEach((k) => { recentFreq[k] = (recentFreq[k] || 0) + 1; }));
  const recentPatterns = Object.entries(recentFreq).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ key: k, label: (FEEDBACK_OPTIONS.find((o) => o.key === k) || {}).label || k, count: n }));

  // 사실 오류 대표 원인 — fact_mismatch 엔트리의 audit 코드 빈도(원문 아님)
  const factCodeFreq = {};
  fb.filter((e) => (e.selections || []).includes('fact_mismatch'))
    .forEach((e) => (e.auditCodes || []).forEach((c) => { factCodeFreq[c] = (factCodeFreq[c] || 0) + 1; }));
  const factCauses = Object.entries(factCodeFreq).sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, count: n }));

  return {
    total: entries.length,
    feedbackCount: fb.length,
    A: variantStats('A'),
    B: variantStats('B'),
    C: variantStats('C'), // 로컬 LLM(실험) — 표본 있을 때만 의미
    preference: { n: prefs.length, a: prefs.filter((e) => e.preferred === 'A').length, b: prefB, c: prefC, same: prefs.filter((e) => e.preferred === 'same').length, bPreferredRate: rate(prefB, prefs.length), cPreferredRate: rate(prefC, prefs.length) },
    editing: {
      n: edits.length,
      editedRate: rate(edits.filter((e) => e.edited).length, edits.length),
      avgEditLen: edits.length ? Math.round(edits.reduce((s, e) => s + (e.editLen || 0), 0) / edits.length) : 0,
      sectionFocus,
    },
    recentPatterns,
    factCauses,
  };
}
