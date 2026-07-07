import { DEFAULT_ENGINE, ENGINE_IDS, generateObservationWithEngine, getAdapter, registerAdapter } from './ai/llm/engineAdapter';
import {
  B2_LLM_OUTPUT_SCHEMA,
  buildRestrictedLLMContext,
  buildRestrictedMessages,
  parseRestrictedLLMJson,
  runConstrainedB2LLM,
} from './ai/b2/llmBridge';
import { createAnonymizedLoraCandidate, evaluateLoraReadiness } from './ai/b2/loraDataset';
import { evaluateLLMPromotion } from './ai/b2/qualityGate';
import { SYNC_EXCLUDED_KEYS } from './storage';

const INPUT = '지우가 "다시 할래"라며 무너진 블록 탑을 다시 차근차근 쌓았다.';
const OBS = '지우가 "다시 할래"라며 무너진 블록 탑을 다시 차근차근 쌓았다.';
const GOOD = JSON.stringify({
  learningTheme: 'retry',
  learningReading: '원아 A는 탑이 무너진 뒤에도 다시 시도하며 방법을 이어 갔다.',
  supportAction: 'retry_material',
  supportAndNextPlan: '비슷한 시도를 이어 갈 수 있도록 크기와 형태가 다른 재료를 곁에 마련한다.',
});

function mockAdapter(responses = [GOOD], state = 'ready') {
  let index = 0;
  return {
    name: 'mock-constrained',
    getStatus: jest.fn(async () => ({ state })),
    generate: jest.fn(async () => {
      const value = responses[Math.min(index, responses.length - 1)];
      index += 1;
      if (value instanceof Error) throw value;
      return value;
    }),
  };
}

const generate = (adapter, extra = {}) => generateObservationWithEngine({
  input: INPUT,
  childName: '지우',
  observation: OBS,
  support: '',
  engine: 'private-server-7b',
  adapter,
  reviewMode: true,
  ...extra,
});

describe('B2가 통제하는 문장 엔진 계약', () => {
  test('일반 사용자 기본은 rule-b2이고 엔진 계층이 명시되어 있다', async () => {
    expect(DEFAULT_ENGINE).toBe('rule-b2');
    expect(ENGINE_IDS).toEqual(['rule-b2', 'local-7b', 'private-server-7b', 'private-server-14b', 'auto']);
    const result = await generateObservationWithEngine({ input: INPUT, childName: '지우', observation: OBS });
    expect(result.engineUsed).toBe('rule-b2');
    expect(result.copyReady).toContain('[관찰내용]');
  });

  test('LLM에는 B2 결과와 허용 범위만 전달하고 실제 이름은 비식별화한다', () => {
    const context = buildRestrictedLLMContext({ input: INPUT, childName: '지우', observation: OBS });
    const messages = buildRestrictedMessages(context.llmInput);
    expect(messages[1].content).not.toContain('지우');
    expect(messages[1].content).toContain('원아 A');
    expect(messages[1].content).toContain('allowedLearningThemes');
    expect(messages[1].content).toContain('allowedSupportActions');
    expect(messages[1].content).not.toContain('facts');
    expect(B2_LLM_OUTPUT_SCHEMA.additionalProperties).toBe(false);
  });

  test('설명·코드블록·필드 누락을 허용하지 않는 엄격 JSON 파서다', () => {
    expect(parseRestrictedLLMJson(GOOD).ok).toBe(true);
    expect(parseRestrictedLLMJson(`결과입니다. ${GOOD}`).ok).toBe(false);
    expect(parseRestrictedLLMJson(`\`\`\`json\n${GOOD}\n\`\`\``).ok).toBe(false);
    expect(parseRestrictedLLMJson(JSON.stringify({ learningReading: '문장' })).error).toBe('json_schema_mismatch');
  });

  test('허용 ID와 의미를 지킨 결과만 C안으로 채택하고 관찰내용은 B2 그대로 둔다', async () => {
    const adapter = mockAdapter();
    const result = await generate(adapter);
    expect(result.engineUsed).toBe('private-server-7b');
    expect(result.llmMeta).toMatchObject({ accepted: true, auditPassed: true, learningTheme: 'retry', supportAction: 'retry_material' });
    expect(result.copyReady).toContain(OBS);
    expect(result.copyReady).toContain('지우는 탑이 무너진 뒤에도 다시 시도하며 방법을 이어 갔다.');
    expect(result.b2CopyReady).not.toBe(result.copyReady);
  });

  test.each([
    ['허용되지 않은 테마', { learningTheme: 'leadership' }, 'theme_not_allowed'],
    ['허용되지 않은 지원', { supportAction: 'praise_child' }, 'support_action_not_allowed'],
    ['입력에 없는 또래', { learningReading: '원아 A는 친구와 협력하며 다시 시도했다.' }, 'new_concrete_fact'],
    ['입력에 없는 감정', { learningReading: '원아 A는 즐거운 마음으로 다시 시도했다.' }, 'emotion_fabricated'],
    ['완료된 교사 지원', { supportAndNextPlan: '교사가 다양한 재료를 제공하였다.' }, 'support_completed'],
  ])('%s은 1회 재시도 뒤 B2로 fallback한다', async (_label, overrides, reason) => {
    const invalid = JSON.stringify({ ...JSON.parse(GOOD), ...overrides });
    const adapter = mockAdapter([invalid, invalid]);
    const result = await generate(adapter);
    expect(result.engineUsed).toBe('rule-b2');
    expect(result.copyReady).toBe(result.b2CopyReady);
    expect(result.fallbackReason).toContain(reason);
    expect(adapter.generate).toHaveBeenCalledTimes(2);
  });

  test('JSON 오류는 정확히 한 번만 재시도하고 B2를 유지한다', async () => {
    const adapter = mockAdapter(['설명문', '여전히 설명문']);
    const result = await generate(adapter);
    expect(result.engineUsed).toBe('rule-b2');
    expect(result.fallbackReason).toBe('strict_json_required');
    expect(adapter.generate).toHaveBeenCalledTimes(2);
  });

  test('timeout은 재시도하지 않고 즉시 B2로 전환한다', async () => {
    const adapter = mockAdapter([new Error('server-timeout')]);
    const result = await generate(adapter);
    expect(result.engineUsed).toBe('rule-b2');
    expect(result.fallbackReason).toContain('server-timeout');
    expect(adapter.generate).toHaveBeenCalledTimes(1);
  });

  test('auto는 검토 모드 밖에서 어댑터를 호출하지 않는다', async () => {
    const adapter = mockAdapter();
    const result = await runConstrainedB2LLM({ input: INPUT, childName: '지우', observation: OBS, engine: 'auto', adapter, reviewMode: false });
    expect(result.engineUsed).toBe('rule-b2');
    expect(adapter.getStatus).not.toHaveBeenCalled();
    expect(adapter.generate).not.toHaveBeenCalled();
  });
});

describe('비식별 검토 데이터와 승격 게이트', () => {
  test('LoRA 후보에는 원문 관찰·실명·발화 전문이 남지 않는다', () => {
    const context = buildRestrictedLLMContext({ input: INPUT, childName: '지우', observation: OBS });
    const candidate = createAnonymizedLoraCandidate({
      factCard: context.card,
      plan: context.plan,
      b2Result: context.b2,
      llmResult: { copyReady: `[관찰내용]\n${OBS}\n\n[배움 읽기]\n지우는 "다시 할래"라고 말하며 다시 시도했다.\n\n[교사 지원 및 다음 계획]\n재료를 마련한다.`, auditPassed: true },
      finalResult: { copyReady: context.b2.copyReady, engine: 'rule-b2', editedSections: ['learning'] },
      childName: '지우',
      reasonTags: ['more_natural'],
    });
    const json = JSON.stringify(candidate);
    expect(json).not.toContain(INPUT);
    expect(json).not.toContain('지우');
    expect(json).not.toContain('다시 할래');
    expect(candidate.outputs.llm).not.toHaveProperty('observation');
  });

  test('LoRA와 일반 사용자 승격은 실제 검토 기준을 모두 만족하기 전에는 닫혀 있다', () => {
    expect(evaluateLoraReadiness({}).ready).toBe(false);
    expect(evaluateLLMPromotion({}).eligible).toBe(false);
    const gate = evaluateLLMPromotion({
      reviewedSamples: 100,
      factMismatchRate: 0.5,
      nameOrSpeechErrors: 0,
      exposedMajorAuditErrors: 0,
      b2UseAsIsRate: 60,
      llmUseAsIsRate: 70,
      b2NeedNaturalRate: 20,
      llmNeedNaturalRate: 10,
      longNarrativeImproved: true,
      metaphorImproved: true,
      emotionChangeImproved: true,
      responseP95Ms: 10000,
      fallbackVerified: true,
    });
    expect(gate.eligible).toBe(true);
  });

  test('검토·서버·엔진 키는 백업과 동기화에서 제외된다', () => {
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining([
      'sw_review_entries', 'sw_review_mode', 'sw_b2_sentence_engine',
      'sw_admin_llm_server_model', 'sw_admin_llm_server_model_14b',
    ]));
  });

  test('레거시 어댑터 등록은 확장 호환성으로 유지된다', () => {
    registerAdapter('tmp-test', mockAdapter());
    expect(getAdapter('tmp-test')).toBeTruthy();
    expect(getAdapter('embedded-local-llm')?.name).toBe('embedded-local-llm');
  });
});
