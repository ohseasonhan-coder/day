// 복사용 관찰일지 — 교사가 수정 없이 그대로 복사·붙여넣기 하는 완성 문서를 만든다.
//   [관찰내용]  실제 관찰(생성된 observation 그대로 — 사실·발화 보존)
//   [배움 읽기]  관찰 사실에서 드러난 흐름을 원아 중심으로 읽음
//   [교사 지원 및 다음 계획]  생성된 support(다음 지원 계획)
//
// 6단계: 생성이 5단 파이프라인으로 위임된다 —
//   입력 → 사실 카드(llm/factCard) → 의미 판정(planner/situationJudge, rules/themes)
//        → 문장 계획(planner/sentencePlanner) → 렌더링(planner/sentenceRenderer)
//        → observationAudit 검수·fallback(이 파일).
// 규칙(테마·금지 주장·표현 변형)은 src/utils/ai/rules/ 선언형 데이터로만 관리한다.
// 원칙: 입력에 없는 행동·발화·감정·또래·성취를 추가하지 않는다. 외부 LLM/서버 없음. 결정론.
import { auditObservationCopy } from './observationAudit';
import { judgeSituation, readSignalCompat } from './planner/situationJudge';
import { buildSentencePlan } from './planner/sentencePlanner';
import { renderLearning, renderSupportHint, topicOf } from './planner/sentenceRenderer';
import { SAFE_LEARNING_VARIANTS } from './rules/themes';

const clean = (s) => String(s || '').trim();
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);

function topicParticle(name) { return topicOf(name); }
function finishSentence(s) {
  let t = clean(s).replace(/\s{2,}/g, ' ');
  if (!t) return '';
  if (!/[.!?]["”']?$/.test(t)) t += '.';
  return t;
}

// 중대 오류 폴백용 안전 문장(결정론 1종 — 검수 재통과 보장)
const SAFE_LEARNING = (t) => SAFE_LEARNING_VARIANTS[0](t);

// 입력에서 감지된 배움 읽기 신호(리포트·테스트용). 미감지 = null(보수적 폴백 사용).
export function readLearningSignal(input) {
  return readSignalCompat(input);
}

// 배움 읽기 — 판정→계획→렌더링 파이프라인 위임(결정론적 변형)
export function buildLearningReading({ input, childName } = {}) {
  const src = clean(input);
  if (!src) return '';
  const plan = buildSentencePlan({ input: src, childName });
  return renderLearning({ plan, input: src });
}

function assemble(observation, learning, support) {
  const sections = [
    ['관찰내용', clean(observation)],
    ['배움 읽기', clean(learning)],
    ['교사 지원 및 다음 계획', clean(support)],
  ].filter(([, body]) => body).map(([label, body]) => [label, finishSentence(body)]);
  if (sections.length === 0) return '';
  return sections.map(([label, body]) => `[${label}]\n${body}`).join('\n\n');
}

// 기존 호환: 문자열만 반환
export function buildCopyReadyObservation({ observation, support, input, childName } = {}) {
  const learning = buildLearningReading({ input: input || observation, childName });
  return assemble(observation, learning, support);
}

// 테마에 지원 변형이 없을 때의 마지막 폴백(계획 문체)
const SUPPORT_FALLBACK = '놀이의 흐름을 살펴 필요한 재료와 시간을 이어서 마련해 준다.';

// 검수 연결판: 생성 직후 감사 → 우선순위(통과/경미 정리/중대 폴백) 적용
// 반환: { copyReady, audit: { ...auditResult, fallbackApplied } }
export function buildAuditedCopyReady({ observation, support, input, childName } = {}) {
  let obs = clean(observation);
  const src = clean(input) || obs;
  const plan = buildSentencePlan({ input: src, childName, ruleObservation: obs, engineSupport: support });
  let learning = renderLearning({ plan, input: src });
  let sup = clean(support);
  if (!sup) {
    // 엔진 support가 없을 때만 테마 기반 다음 계획(계획 문체) — 있는 support는 절대 덮지 않음
    sup = renderSupportHint({ plan, input: src }) || (plan.meta.primary ? SUPPORT_FALLBACK : '');
  }

  let audit = auditObservationCopy({ input, observation: obs, learning, support: sup, childName });
  let fallbackApplied = false;

  if (audit.severity === 'major') {
    fallbackApplied = true;
    // 발화 손실 → 관찰내용에 원문 발화를 그대로 복원(사실 보존)
    if (audit.warnings.includes('speech_lost')) {
      const missing = quotesOf(input).filter((q) => !obs.includes(q));
      if (missing.length) obs = finishSentence(`${obs.replace(/[.]\s*$/, '')} ${missing.map((q) => `"${q}"`).join(' ')}`);
    }
    // 배움 읽기의 중대 문제 → 사실 추가 없는 안전 기본 문장으로 대체
    const LEARN_MAJOR = ['fact_addition_peer', 'fact_addition_speech', 'negative_or_diagnostic', 'josa_error', 'emotion_fabricated', 'intent_speculation', 'development_claim'];
    if (audit.warnings.some((c) => LEARN_MAJOR.includes(c))) {
      learning = SAFE_LEARNING(topicParticle(childName));
    }
    audit = auditObservationCopy({ input, observation: obs, learning, support: sup, childName });
  }

  return { copyReady: assemble(obs, learning, sup), audit: { ...audit, fallbackApplied } };
}

// 문장 계획 열람(검수·테스트·리포트용 — UI 노출 금지)
export function planForInput({ input, childName, observation, support } = {}) {
  return buildSentencePlan({ input, childName, ruleObservation: observation, engineSupport: support });
}

export { judgeSituation };
export default buildCopyReadyObservation;
