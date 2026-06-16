import { extractActualSpeech } from '../inputParser';
import {
  ABSOLUTE_OVERSTATEMENTS,
  CONCRETE_OBSERVATION_VERBS,
  CURRICULUM_AREAS,
  FORMAL_ENDINGS,
  NEGATIVE_FACT_MARKERS,
  POSITIVE_SPIN_MARKERS,
  SUBJECTIVE_LABELS,
  SUBJECTIVE_PRAISE,
  VAGUE_FILLERS,
  WARM_ENDINGS,
} from './lexicon';

// ── 유틸 ──────────────────────────────────────────────────────────
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const includesAny = (text, list) => list.some((w) => text.includes(w));
const countMatches = (text, list) => list.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(text) {
  return String(text || '')
    .replace(/["“”'‘’]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// ── 차원별 점수 (각 0..1) ─────────────────────────────────────────

// 1) 발화 보존:
//  - 관찰일지: 입력의 발화가 출력에 그대로 인용되어야 한다(누락 시 감점).
//  - 그 외 문서: 발화 인용은 선택이므로, 인용한 발화를 변형하지 않았는지만 본다.
function scoreSpeechPreservation(text, sourceText, documentType) {
  const speeches = extractActualSpeech(sourceText).filter(Boolean);
  const outputQuotes = extractActualSpeech(text).filter(Boolean);

  if (documentType === 'observation') {
    if (speeches.length === 0) return { score: 1, total: 0, preserved: 0 };
    const preserved = speeches.filter((s) => text.includes(s)).length;
    return { score: clamp01(preserved / speeches.length), total: speeches.length, preserved };
  }

  // 비관찰 문서: 출력에 따옴표가 없으면 보존 대상 없음(중립).
  if (outputQuotes.length === 0) return { score: 1, total: 0, preserved: 0 };
  // 출력이 인용한 따옴표는 입력 발화와 일치해야 한다(변형 = 감점).
  const faithful = outputQuotes.filter((q) => speeches.includes(q)).length;
  return { score: clamp01(faithful / outputQuotes.length), total: outputQuotes.length, preserved: faithful };
}

// 2) 사실 충실도: 입력에 부정/거부 사실이 있는데 긍정 스핀으로만 미화하지 않았는가
function scoreFactualConsistency(text, sourceText) {
  const inputHasNegative = includesAny(sourceText, NEGATIVE_FACT_MARKERS);
  const outputHasNegative = includesAny(text, NEGATIVE_FACT_MARKERS);
  const outputSpins = countMatches(text, POSITIVE_SPIN_MARKERS);

  if (!inputHasNegative) {
    // 입력에 부정 사실이 없으면, 근거 없는 긍정 스핀이 있을 때만 가볍게 감점
    return { score: clamp01(1 - outputSpins * 0.1), inputHasNegative, outputHasNegative };
  }
  // 입력에 부정 사실이 있는 경우: 출력이 이를 반영해야 함
  let score = outputHasNegative ? 1 : 0.4; // 부정 사실을 통째로 누락하면 큰 감점
  score -= outputSpins * 0.2; // 부정 사실을 긍정 스핀으로 덮으면 추가 감점
  return { score: clamp01(score), inputHasNegative, outputHasNegative, spins: outputSpins };
}

// 3) 객관성: 라벨·과장 절대어·주관 칭찬이 없을수록 높음
function scoreObjectivity(text) {
  const labels = countMatches(text, SUBJECTIVE_LABELS);
  const overstatements = countMatches(text, ABSOLUTE_OVERSTATEMENTS);
  const praise = countMatches(text, SUBJECTIVE_PRAISE);
  const penalty = labels * 0.34 + overstatements * 0.25 + praise * 0.2;
  return { score: clamp01(1 - penalty), labels, overstatements, praise };
}

// 4) 구체성: 관찰 가능한 동사가 많고 모호어가 적을수록 높음
function scoreConcreteness(text) {
  const sentences = Math.max(1, splitSentences(text).length);
  const concrete = countMatches(text, CONCRETE_OBSERVATION_VERBS);
  const vague = countMatches(text, VAGUE_FILLERS);
  // 문장당 구체 동사 1개를 기준(1.0), 모호어는 감점
  const base = clamp01(concrete / sentences);
  return { score: clamp01(base - vague * 0.12), concrete, vague, sentences };
}

// 5) 문체 일관성: 문서 유형에 맞는 종결어미 비율
function scoreStyle(text, documentType) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { score: 1, formal: 0, warm: 0 };
  const formal = sentences.filter((s) => FORMAL_ENDINGS.some((e) => s.endsWith(e))).length;
  const warm = sentences.filter((s) => WARM_ENDINGS.some((e) => s.endsWith(e))).length;
  const wantsWarm = documentType === 'parent' || documentType === 'notice' || documentType === 'counseling';
  const matched = wantsWarm ? warm : formal;
  return { score: clamp01(matched / sentences.length), formal, warm, sentences: sentences.length };
}

// 6) 반복: 인접 단어/이어지는 2-gram 중복이 적을수록 높음
function scoreNonRepetition(text) {
  const tokens = tokenize(text);
  if (tokens.length < 2) return { score: 1, adjacentDups: 0 };
  let adjacentDups = 0;
  for (let i = 1; i < tokens.length; i += 1) {
    if (tokens[i] === tokens[i - 1] && tokens[i].length >= 2) adjacentDups += 1;
  }
  const penalty = adjacentDups / tokens.length;
  return { score: clamp01(1 - penalty * 4), adjacentDups, tokens: tokens.length };
}

// 7) 분량 적절성: 너무 짧거나(부실) 비정상적으로 길지 않은가
function scoreLength(text) {
  const len = String(text || '').replace(/\s+/g, '').length;
  if (len === 0) return { score: 0, length: 0 };
  if (len < 25) return { score: clamp01(len / 25), length: len };
  if (len > 600) return { score: clamp01(1 - (len - 600) / 1200), length: len };
  return { score: 1, length: len };
}

// ── 문서 유형별 가중치 프로필 ─────────────────────────────────────
// 관찰일지는 사실충실도·발화보존·객관성을 가장 무겁게 본다.
export const QUALITY_PROFILES = {
  observation: {
    speechPreservation: 0.22,
    factualConsistency: 0.26,
    objectivity: 0.18,
    concreteness: 0.16,
    style: 0.08,
    nonRepetition: 0.06,
    length: 0.04,
  },
  evaluation: {
    speechPreservation: 0.16,
    factualConsistency: 0.22,
    objectivity: 0.16,
    concreteness: 0.14,
    style: 0.12,
    nonRepetition: 0.08,
    length: 0.12,
  },
  parent: {
    speechPreservation: 0.20,
    factualConsistency: 0.18,
    objectivity: 0.10,
    concreteness: 0.10,
    style: 0.24,
    nonRepetition: 0.08,
    length: 0.10,
  },
};
QUALITY_PROFILES.notice = QUALITY_PROFILES.parent;
QUALITY_PROFILES.counseling = QUALITY_PROFILES.parent;
QUALITY_PROFILES.support = QUALITY_PROFILES.evaluation;

const DEFAULT_PROFILE = QUALITY_PROFILES.observation;

function gradeFor(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

// ── 메인: 텍스트 품질 점수 ────────────────────────────────────────
export function scoreText(text, { sourceText = '', documentType = 'observation' } = {}) {
  const input = String(sourceText || '');
  const out = String(text || '');
  const profile = QUALITY_PROFILES[documentType] || DEFAULT_PROFILE;

  const dimensions = {
    speechPreservation: scoreSpeechPreservation(out, input, documentType),
    factualConsistency: scoreFactualConsistency(out, input),
    objectivity: scoreObjectivity(out),
    concreteness: scoreConcreteness(out),
    style: scoreStyle(out, documentType),
    nonRepetition: scoreNonRepetition(out),
    length: scoreLength(out),
  };

  let weighted = 0;
  Object.entries(profile).forEach(([key, weight]) => {
    weighted += (dimensions[key]?.score ?? 0) * weight;
  });
  const score = Math.round(clamp01(weighted) * 100);

  const issues = collectIssues(dimensions, documentType);
  const areaLinked = includesAny(out, CURRICULUM_AREAS);

  return {
    score,
    grade: gradeFor(score),
    documentType,
    areaLinked,
    dimensions: Object.fromEntries(
      Object.entries(dimensions).map(([k, v]) => [k, { ...v, weight: profile[k] ?? 0 }]),
    ),
    issues,
  };
}

function collectIssues(dimensions, documentType) {
  const issues = [];
  const push = (code, severity, message) => issues.push({ code, severity, message });

  if (dimensions.speechPreservation.total > 0 && dimensions.speechPreservation.score < 1) {
    push('speech_dropped', 'high', '입력의 실제 발화가 출력에 그대로 보존되지 않았습니다.');
  }
  if (dimensions.factualConsistency.inputHasNegative && !dimensions.factualConsistency.outputHasNegative) {
    push('fact_omitted', 'high', '입력의 부정·거부 사실이 출력에서 누락되었습니다.');
  }
  if (dimensions.factualConsistency.spins > 0 && dimensions.factualConsistency.inputHasNegative) {
    push('positive_spin', 'high', '부정 사실을 근거 없는 긍정 표현으로 미화했습니다.');
  }
  if (dimensions.objectivity.labels > 0) {
    push('subjective_label', 'medium', '주관적 라벨(예: 문제행동/산만)이 포함되어 있습니다.');
  }
  if (dimensions.objectivity.overstatements > 0) {
    push('overstatement', 'medium', '근거 없는 과장 절대어(예: 항상/완벽하게)가 포함되어 있습니다.');
  }
  if (documentType === 'observation' && dimensions.objectivity.praise > 0) {
    push('subjective_praise', 'medium', '관찰일지에 주관적 칭찬어가 포함되어 있습니다.');
  }
  if (dimensions.concreteness.score < 0.34) {
    push('low_concreteness', 'low', '관찰 가능한 구체 행동 묘사가 부족합니다.');
  }
  if (dimensions.nonRepetition.adjacentDups > 0) {
    push('repetition', 'low', '인접한 단어 반복이 있습니다.');
  }
  if (dimensions.length.length > 0 && dimensions.length.length < 25) {
    push('too_short', 'low', '문장이 너무 짧아 내용이 부실합니다.');
  }
  return issues;
}

// ── 골든 샘플 대비 평가 ───────────────────────────────────────────
// 생성 결과가 골든 샘플의 필수 포함/금지 조건과 점수 임계치를 만족하는지 검사.
export function scoreAgainstGolden(generated, golden, { field = 'observation' } = {}) {
  const documentType = golden.documentType || field;
  const sourceText = golden.input?.rawText || '';
  const base = scoreText(generated, { sourceText, documentType });

  const mustInclude = golden.mustInclude || [];
  const mustNotInclude = golden.mustNotInclude || [];
  const missing = mustInclude.filter((m) => !generated.includes(m));
  const violated = mustNotInclude.filter((m) => generated.includes(m));

  const passed = missing.length === 0 && violated.length === 0 && base.score >= (golden.minScore ?? 70);

  return { ...base, golden: golden.id, passed, missing, violated, minScore: golden.minScore ?? 70 };
}
