// 5단계 회귀 — 앱 내장형 로컬 LLM 엔진: 사실 카드 → LLM(JSON) → audit → fallback 흐름.
// 실제 모델 추론 없이 mock 어댑터로 검증(CI에서 모델 다운로드 없음).
import { extractFactCard } from './ai/llm/factCard';
import { buildMessages, OUTPUT_SCHEMA } from './ai/llm/promptBuilder';
import { parseLLMJson, validateLLMOutput } from './ai/llm/postProcess';
import { generateObservationWithEngine, DEFAULT_ENGINE, registerAdapter, getAdapter } from './ai/llm/engineAdapter';
import { createMockAdapter } from './ai/llm/mockLLM';
import { SYNC_EXCLUDED_KEYS } from './storage';

const INPUT = '지우가 "다시 할래"라며 무너진 블록 탑을 다시 차근차근 쌓았다.';
const OBS = '지우가 "다시 할래"라며 무너진 블록 탑을 다시 차근차근 쌓았다.';
const SUP = '다양한 크기의 블록을 제공하고 시도 과정을 말로 짚어 준다.';
const GOOD_JSON = JSON.stringify({
  learningReading: '지우는 뜻대로 되지 않아도 다시 시도하며 스스로 방법을 찾아가는 끈기를 보였다.',
  supportAndNextPlan: '무너짐을 견디는 넓은 받침 블록을 더하고, 다시 세우는 과정을 말로 격려한다.',
});
const gen = (opts) => generateObservationWithEngine({ input: INPUT, childName: '지우', observation: OBS, support: SUP, ...opts });

describe('사실 카드 추출(원문 자유 전달 금지)', () => {
  test('이름·발화·재료·행동을 담고, 없는 요소는 금지 목록으로', () => {
    const fc = extractFactCard({ input: INPUT, childName: '지우' });
    expect(fc.name).toBe('지우');
    expect(fc.speeches).toEqual(['다시 할래']);
    expect(fc.materials).toContain('블록');
    expect(fc.actions.join(' ')).toContain('쌓았다');
    expect(fc.peers).toEqual([]);                                   // 입력에 또래 없음
    expect(fc.forbidden.join(' ')).toMatch(/또래.*금지/);            // → 또래 언급 금지
    expect(fc.forbidden.join(' ')).toMatch(/과거형으로 쓰지 말/);    // 교사 지원 없음 → 단정 금지
  });
  test('프롬프트는 사실 카드 필드만 직렬화하고 JSON 스키마를 강제', () => {
    const msgs = buildMessages(extractFactCard({ input: INPUT, childName: '지우' }));
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('JSON');
    expect(msgs[1].content).toContain('직접 발화');
    expect(OUTPUT_SCHEMA.required).toEqual(['learningReading', 'supportAndNextPlan']);
  });
});

describe('엔진 선택과 fallback', () => {
  test('기본 엔진은 rule(일반 사용자 경로 무변경)', async () => {
    expect(DEFAULT_ENGINE).toBe('rule');
    const r = await gen({});
    expect(r.engineUsed).toBe('rule');
    expect(r.copyReady).toContain('[배움 읽기]');
  });

  test('미지원 기기(unsupported) → 규칙 fallback + 사유 기록', async () => {
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ state: 'unsupported' }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toBe('engine_unsupported');
    expect(r.copyReady).toContain('"다시 할래"');                   // 규칙 결과 정상 제공
  });

  test('모델 초기화 실패(error) → 규칙 fallback', async () => {
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ state: 'error' }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toBe('engine_error');
  });

  test('생성 중 예외 → 규칙 fallback', async () => {
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ failGenerate: true }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toMatch(/generate_failed/);
  });

  test('JSON 파싱 실패 → 규칙 fallback', async () => {
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: '죄송하지만 JSON이 아닙니다' }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toBe('json_not_found');
  });
});

describe('사실 보존 차단(LLM 결과 폐기 조건)', () => {
  test('입력에 없는 또래 상호작용 추가 → 차단·fallback', async () => {
    const bad = JSON.stringify({ learningReading: '지우는 친구와 함께 협력하며 놀이를 이어 갔다.', supportAndNextPlan: '블록을 더 제공한다.' });
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: bad }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toContain('fact_addition_peer');
  });

  test('입력에 없는 발화 창작 → 차단', async () => {
    const bad = JSON.stringify({ learningReading: '지우는 "내가 최고야"라고 말하며 끈기를 보였다.', supportAndNextPlan: '블록을 제공한다.' });
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: bad }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toContain('fact_addition_speech');
  });

  test('금지 표현 재도입 → 차단', async () => {
    const bad = JSON.stringify({ learningReading: '유아들은 블록을 활용하여 놀이에 참여하였다.', supportAndNextPlan: '블록을 제공한다.' });
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: bad }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toContain('banned_phrase');
  });

  test('합쇼체·상투 성취 문체(습니다/기회를 얻었다) → 차단(실검증 반영)', async () => {
    const bad = JSON.stringify({ learningReading: '지우는 개미의 움직임을 관찰하여 이해하는 기회를 얻었다.', supportAndNextPlan: '도구를 제공하여 관찰을 이어가도록 돕는다.' });
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: bad }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toContain('style_mismatch');
  });

  test('이름·조사 오류 → 차단(audit major)', async () => {
    const bad = JSON.stringify({ learningReading: '지우은 다시 시도하며 끈기를 보였다.', supportAndNextPlan: '블록을 제공한다.' });
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: bad }) });
    expect(r.engineUsed).toBe('rule');
    expect(r.fallbackReason).toContain('josa_error');
  });

  test('직접 발화는 관찰내용(규칙 결과)에 항상 보존 — LLM이 훼손 불가', async () => {
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: GOOD_JSON }) });
    expect(r.copyReady).toContain('"다시 할래"');                    // 관찰내용은 규칙 결과 사용
    expect(r.engineUsed).toBe('mock-llm');
  });
});

describe('정상 LLM 출력 → 복사용 3단 반영', () => {
  test('LLM 배움 읽기·지원이 3단 구조에 들어가고 규칙 B안도 함께 반환(비교·미덮어쓰기)', async () => {
    const r = await gen({ engine: 'auto', adapter: createMockAdapter({ response: GOOD_JSON }) });
    expect(r.engineUsed).toBe('mock-llm');
    expect(r.copyReady).toContain('[관찰내용]');
    expect(r.copyReady).toContain('[배움 읽기]\n지우는 뜻대로 되지 않아도');
    expect(r.copyReady).toContain('[교사 지원 및 다음 계획]');
    expect(r.llm.learning).toContain('끈기');
    expect(r.ruleCopyReady).toContain('[배움 읽기]');                // 규칙 B안 별도 보존
    expect(r.audit.severity).not.toBe('major');
  });

  test('과도한 길이·기계적 반복은 후처리에서 차단', () => {
    const long = validateLLMOutput({ data: { learningReading: '가'.repeat(300), supportAndNextPlan: '나' }, factCard: {}, input: INPUT, observation: OBS, childName: '지우' });
    expect(long.ok).toBe(false);
    expect(long.reasons).toContain('too_long');
    const rep = validateLLMOutput({ data: { learningReading: '블록 블록 블록 놀이를 이어 갔다.', supportAndNextPlan: '블록을 제공한다.' }, factCard: { speeches: [] }, input: INPUT, observation: OBS, childName: '지우' });
    expect(rep.ok).toBe(false);
    expect(rep.reasons.join(',')).toContain('repetition');
  });

  test('관대한 JSON 추출(코드블록·머리말 방어)', () => {
    expect(parseLLMJson('결과입니다:\n```json\n{"learningReading":"a","supportAndNextPlan":"b"}\n```').ok).toBe(true);
    expect(parseLLMJson('').error).toBe('empty_output');
    expect(parseLLMJson('{broken').error).toBe('json_not_found');
  });
});

describe('개인정보·설정 안전', () => {
  test('검토·LLM 관련 키는 동기화 제외 목록에 있고 모델 경로가 번들 소스에 없음', () => {
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining(['sw_review_entries', 'sw_review_mode']));
    // 엔진 흐름은 원문·프롬프트·LLM 전문을 localStorage에 저장하지 않는다(반환값 전달만).
  });
  test('어댑터 레지스트리에 embedded/chrome-builtin이 분리 등록되어 있음', () => {
    expect(getAdapter('embedded-local-llm')?.name).toBe('embedded-local-llm');
    expect(getAdapter('chrome-builtin')?.name).toBe('chrome-builtin'); // 선택적 보조 어댑터
    registerAdapter('tmp-test', createMockAdapter({}));
    expect(getAdapter('tmp-test')).toBeTruthy();
  });
});
