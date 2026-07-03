// 문장 엔진 어댑터(5단계) — UI와 엔진 호출을 분리한다.
//
// 엔진 종류:
//   rule               : 기존 규칙 기반(기본값 — 일반 사용자 경로, 무변경)
//   embedded-local-llm : 앱 내장형 로컬 LLM(WebLLM, 기본 실험 대상)
//   chrome-builtin     : 브라우저 내장 window.LanguageModel(선택적 보조 어댑터 — 주 엔진 아님)
//   auto               : embedded 사용 가능 시 LLM, 실패·미지원이면 rule fallback
//
// 흐름: 입력 → 사실 카드 → LLM 생성(JSON) → 파싱/형식 검사 → observationAudit →
//       통과 시 복사용 3단 반영 / 실패·미지원이면 규칙 기반 B안 fallback(사유는 개발 정보로만).
// 원문·프롬프트·LLM 전문 출력은 어디에도 장기 저장하지 않는다(반환값으로만 전달).
import { buildAuditedCopyReady } from '../copyReadyObservation';
import { extractFactCard } from './factCard';
import { buildMessages, OUTPUT_SCHEMA } from './promptBuilder';
import { parseLLMJson, validateLLMOutput } from './postProcess';
import { embeddedAdapter } from './embeddedLLM';
import { privateServerAdapter } from './privateServerLLM';
import { detectOnDeviceCapability } from '../../ondeviceLLM';

export const ENGINE_IDS = ['rule', 'embedded-local-llm', 'private-server-7b', 'chrome-builtin', 'auto'];
export const DEFAULT_ENGINE = 'rule'; // 일반 사용자 기본 — LLM은 검토 flag에서만 시험

// 브라우저 내장 모델은 "선택적" 어댑터로만 등록(구조화 JSON 생성 미지원 → generate는 미구현 상태 보고).
const chromeAdapter = {
  name: 'chrome-builtin',
  getStatus: async () => {
    const cap = detectOnDeviceCapability();
    return { state: cap.usable ? 'idle' : 'unsupported', progress: 0, error: cap.usable ? '' : '브라우저 내장 AI 없음' };
  },
  prepare: async () => ({ ok: false, error: 'optional-adapter' }),
  generate: async () => { throw new Error('chrome-builtin은 다듬기 전용 보조 어댑터(주 엔진 아님)'); },
  deleteCache: async () => ({ ok: true }),
};

const REGISTRY = {
  'embedded-local-llm': embeddedAdapter,
  'private-server-7b': privateServerAdapter, // 개인 PC 7B 서버(관리자 설정 시에만 ready)
  'chrome-builtin': chromeAdapter,
};
// 테스트·확장용 — mock 어댑터 주입
export function registerAdapter(name, adapter) { REGISTRY[name] = adapter; }
export function getAdapter(name) { return REGISTRY[name] || null; }

const bracket = (label, body) => (body ? `[${label}]\n${String(body).trim()}` : '');
function assembleCopy(observation, learning, support) {
  return [bracket('관찰내용', observation), bracket('배움 읽기', learning), bracket('교사 지원 및 다음 계획', support)]
    .filter(Boolean).join('\n\n');
}

// 관찰일지 생성(엔진 선택형).
// 반환: { copyReady, audit, engineUsed, fallbackReason?, llm?:{learning,support}, ruleCopyReady }
//  - 관찰내용은 항상 규칙 결과(사실 보존 최우선). LLM은 배움 읽기·교사 지원만 담당.
//  - 규칙 기반 B안(buildAuditedCopyReady)은 항상 함께 계산해 비교·fallback에 사용.
export async function generateObservationWithEngine({
  input = '', childName = '', observation = '', support = '',
  engine = DEFAULT_ENGINE, adapter: overrideAdapter = null,
} = {}) {
  // 규칙 기반 B안 — 항상 준비(즉시 제공/fallback/비교용)
  const rule = buildAuditedCopyReady({ observation, support, input, childName });
  const base = { copyReady: rule.copyReady, audit: rule.audit, engineUsed: 'rule', ruleCopyReady: rule.copyReady };

  if (engine === 'rule') return base;

  const adapter = overrideAdapter
    || (engine === 'auto' ? REGISTRY['embedded-local-llm'] : REGISTRY[engine]);
  if (!adapter) return { ...base, fallbackReason: 'engine_not_found' };

  // 상태 확인 — 준비 안 됨/미지원이면 즉시 규칙 결과 제공(오류를 사용자에게 던지지 않음)
  let status;
  try { status = await adapter.getStatus(); } catch { status = { state: 'error' }; }
  if (status.state !== 'ready') {
    return { ...base, fallbackReason: `engine_${status.state || 'unavailable'}` };
  }

  // 사실 카드 → LLM 생성 → 후처리 검증
  try {
    const factCard = extractFactCard({ input, childName });
    const messages = buildMessages(factCard);
    const raw = await adapter.generate({ messages, schema: OUTPUT_SCHEMA });
    const parsed = parseLLMJson(raw);
    if (!parsed.ok) return { ...base, fallbackReason: parsed.error };

    // 관찰내용은 규칙 결과에서 그대로(사실·발화 보존) — 규칙 B안의 관찰내용 섹션 사용
    const obsMatch = rule.copyReady.match(/\[관찰내용\]\n([\s\S]*?)(\n\n\[|$)/);
    const obsSection = (obsMatch ? obsMatch[1] : observation).trim();
    const v = validateLLMOutput({ data: parsed.data, factCard, input, observation: obsSection, childName });
    if (!v.ok) {
      // 중대 오류 → LLM 결과 폐기, 규칙 B안 fallback. 사유는 개발 검토 정보로만.
      if (typeof console !== 'undefined') console.warn('[로컬 LLM 검수 탈락]', v.reasons);
      return { ...base, fallbackReason: v.reasons.join(','), engineUsed: 'rule' };
    }
    return {
      copyReady: assembleCopy(obsSection, v.learning, v.support),
      audit: v.audit,
      engineUsed: adapter.name,
      llm: { learning: v.learning, support: v.support },
      ruleCopyReady: rule.copyReady,
    };
  } catch (e) {
    return { ...base, fallbackReason: `generate_failed:${String(e?.message || e)}` };
  }
}

export default generateObservationWithEngine;
