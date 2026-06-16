import { extractActualSpeech } from './inputParser';
import { applyPositiveRephrase, removeUnsupportedClaims, softenRecordText } from './normalizationRules';

// 주관적 평가어 → 객관적 관찰 표현 (사실 왜곡이 아니라 '단정/칭찬'을 관찰 사실로 환원)
const OBJECTIVE_REPLACEMENTS = [
  [/잘했다/g, '참여하는 모습을 보였다'],
  [/훌륭했다/g, '관심을 보였다'],
  [/문제가 있었다/g, '지원이 필요한 상황이 관찰되었다'],
];

// 부모 알림장용 — 부정 단정을 부드럽게 (부모 전달 문장에만 적용)
const WARM_NOTICE_REPLACEMENTS = [
  [/지원이 필요한 상황이 관찰되었다/g, '교사의 도움을 받으며 조절해 보는 시간이 있었습니다'],
  [/거부하였다/g, '아직 참여가 편안하지 않은 모습이 있었습니다'],
  [/울었다/g, '속상한 마음을 표현했습니다'],
];

// 보고서/평가 문체 — 종결만 문어체로 (의미·사실은 그대로)
const REPORT_STYLE_REPLACEMENTS = [
  [/했습니다/g, '하였다'],
  [/있었습니다/g, '있었다'],
  [/보였습니다/g, '보였다'],
  [/도왔습니다/g, '지원하였다'],
];

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 필드별 guard 정책 — 관찰일지는 사실 보존 최우선, 부모/상담은 순화 허용
export const GUARD_POLICIES = {
  // 관찰일지/일화기록: 순화·긍정 재구성 금지 (객관적 사실 보존).
  // 단, 근거 없는 과장 절대어(항상/완벽하게 등) 제거는 사실 충실도를 높이므로 허용.
  observation: { softening: false, positiveRephrase: false, removeUnsupported: true, preserveSpeech: true },
  // 부모 알림장: 부드러운 순화 허용
  parent:      { softening: true,  positiveRephrase: true,  removeUnsupported: true,  preserveSpeech: true },
  // 상담자료: 순화 허용 + 단정 라벨 회피
  counseling:  { softening: true,  positiveRephrase: true,  removeUnsupported: true,  preserveSpeech: true },
  // 평가: 과장 없이 최소 순화만 (긍정 재구성 금지)
  evaluation:  { softening: true,  positiveRephrase: false, removeUnsupported: true,  preserveSpeech: true },
  // 교사 지원계획: 평가와 동일 — 최소 순화, 긍정 재구성 금지
  support:     { softening: true,  positiveRephrase: false, removeUnsupported: true,  preserveSpeech: true },
};

// 실제 발화는 절대 변형하지 않는다. 변형된 흔적이 있으면 '조용히' 원문 발화로 복원하고,
// 발화가 아예 없는 필드(평가·지원 등)에는 어떤 설명 문장도 덧붙이지 않는다.
export function restoreSpeech(text, sourceText) {
  let output = String(text || '');
  const speeches = extractActualSpeech(sourceText);
  for (const speech of speeches) {
    if (!speech) continue;
    if (output.includes(speech)) continue; // 원문 발화 그대로 보존됨 → 손대지 않음
    // 발화의 앞부분이 변형된 형태로 남아 있을 때만 조용히 원문으로 복원
    const head = speech.slice(0, Math.min(speech.length, 5));
    if (head.length >= 3) {
      const corrupted = new RegExp(`["“'‘]${escapeRegExp(head)}[^"”'’]{0,40}["”'’]`, 'g');
      output = output.replace(corrupted, `"${speech}"`);
    }
    // 발화가 전혀 없으면 → 그 필드엔 발화가 없는 게 정상. 아무것도 추가하지 않는다.
  }
  return output;
}

// 정책에 따라 가드 규칙을 선택 적용
function guardWithPolicy(text, policy, { sourceText = '' } = {}) {
  let output = String(text || '');
  if (policy.softening) output = softenRecordText(output);
  if (policy.positiveRephrase) output = applyPositiveRephrase(output);
  if (policy.removeUnsupported) output = removeUnsupportedClaims(output);
  if (policy.preserveSpeech) output = restoreSpeech(output, sourceText);
  return output.replace(/\s+/g, ' ').trim();
}

// 기본 가드(하위 호환) — 부모 전달 문장 수준의 순화 + 발화 보존 (메타 문장 추가 안 함)
export function guardText(text, options = {}) {
  return guardWithPolicy(text, GUARD_POLICIES.parent, options);
}

// 관찰일지/지원 등 '객관 사실' 텍스트: 순화·긍정 재구성 없이 주관 평가어만 관찰 표현으로 환원
export function makeObjectiveText(text, options = {}) {
  let output = guardWithPolicy(text, GUARD_POLICIES.observation, options);
  OBJECTIVE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

// 부모 알림장: 부드러운 순화
export function makeWarmNoticeText(text, options = {}) {
  let output = guardWithPolicy(text, GUARD_POLICIES.parent, options);
  WARM_NOTICE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

// 보고서/평가 문체: 최소 순화(긍정 재구성 없음) + 종결 문어체
export function makeReportStyleText(text, options = {}) {
  let output = guardWithPolicy(text, GUARD_POLICIES.evaluation, options);
  REPORT_STYLE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

// 필드별로 서로 다른 정책을 적용해 최종 결과를 보정
export function guardRecordResult(result, { sourceText = '' } = {}) {
  if (!result || typeof result !== 'object') return result;
  const guarded = { ...result };
  const fieldPolicy = {
    observation: GUARD_POLICIES.observation, // 관찰일지: 사실 보존 (순화 금지)
    evaluation: GUARD_POLICIES.evaluation,   // 평가: 최소 순화
    parent: GUARD_POLICIES.parent,           // 부모 알림장: 순화 허용
    support: GUARD_POLICIES.support,         // 지원계획: 최소 순화
  };
  Object.entries(fieldPolicy).forEach(([key, policy]) => {
    if (typeof guarded[key] === 'string') {
      guarded[key] = guardWithPolicy(guarded[key], policy, { sourceText });
    }
  });
  return guarded;
}
