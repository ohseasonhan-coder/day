// Gemini 어댑터 통합 회귀 — 기본 비활성(키 없으면 규칙 엔진), 대상 원아 이름 치환·복원(기존
// 로컬 엔진과 동일), 인터넷으로 나가는 경로에 한해 다른 원아 이름까지 추가 비식별화되는지 검증한다.
import { GEMINI_KEYS, GEMINI_DEFAULTS, getGeminiConfig, setGeminiConfig, clearGeminiConfig, geminiAdapter } from './ai/llm/geminiLLM';
import { anonymizeOtherChildNames, restoreOtherChildNames } from './ai/llm/externalPrivacyGuard';
import { B2_LLM_ENGINES, DEFAULT_B2_ENGINE, setB2SentenceEngine, getB2SentenceEngine } from './ai/b2/config';
import { buildRestrictedLLMContext, runConstrainedB2LLM } from './ai/b2/llmBridge';
import { SYNC_EXCLUDED_KEYS } from './storage';

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sw_session', JSON.stringify({ userId: 't1' }));
  localStorage.setItem('sw_t1_children', JSON.stringify([{ id: 'c1', name: '지우' }, { id: 'c2', name: '도윤' }]));
  localStorage.setItem('sw_t1_classes', JSON.stringify([]));
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('Gemini 설정 — 기본 비활성, 동기화 제외', () => {
  test('설정 전 기본값은 빈 키·기본 모델이며 API 키 미설정 시 unsupported로 즉시 규칙 fallback', async () => {
    expect(getGeminiConfig()).toEqual({ apiKey: '', model: GEMINI_DEFAULTS.model });
    const status = await geminiAdapter.getStatus();
    expect(status.state).toBe('unsupported');
  });

  test('저장한 설정은 localStorage에서만 조회되고 동기화·백업 제외 목록에 포함된다', () => {
    setGeminiConfig({ apiKey: 'test-key-123', model: 'gemini-2.5-flash' });
    expect(getGeminiConfig()).toEqual({ apiKey: 'test-key-123', model: 'gemini-2.5-flash' });
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining([GEMINI_KEYS.API_KEY, GEMINI_KEYS.MODEL]));
    clearGeminiConfig();
    expect(getGeminiConfig().apiKey).toBe('');
  });

  test('B2 문장 엔진 목록에 gemini가 있고 관리자가 선택·해제할 수 있다(기본은 rule-b2)', () => {
    expect(B2_LLM_ENGINES).toContain('gemini');
    expect(getB2SentenceEngine()).toBe(DEFAULT_B2_ENGINE);
    expect(setB2SentenceEngine('gemini')).toBe('gemini');
    expect(getB2SentenceEngine()).toBe('gemini');
  });
});

describe('키만 저장하면 별도 선택 없이 자동으로 Gemini를 쓴다', () => {
  test('엔진을 한 번도 고른 적 없어도 키를 저장하면 자동으로 gemini가 된다', () => {
    expect(getB2SentenceEngine()).toBe(DEFAULT_B2_ENGINE); // 키 저장 전에는 그대로 규칙 엔진
    setGeminiConfig({ apiKey: 'auto-key-123', model: 'gemini-2.5-flash' });
    expect(getB2SentenceEngine()).toBe('gemini'); // setB2SentenceEngine을 호출하지 않았는데도 자동 전환
  });

  test('키를 지우면 다시 규칙 엔진으로 자동 복귀한다', () => {
    setGeminiConfig({ apiKey: 'auto-key-123' });
    expect(getB2SentenceEngine()).toBe('gemini');
    clearGeminiConfig();
    expect(getB2SentenceEngine()).toBe(DEFAULT_B2_ENGINE);
  });

  test('관리자가 명시적으로 규칙 엔진을 선택하면 키가 있어도 그 선택이 우선한다', () => {
    setGeminiConfig({ apiKey: 'auto-key-123' });
    expect(getB2SentenceEngine()).toBe('gemini');
    setB2SentenceEngine('rule-b2');
    expect(getB2SentenceEngine()).toBe('rule-b2'); // 명시적 선택은 키가 있어도 자동 전환보다 우선
  });
});

describe('다른 원아 이름 비식별화 유틸(externalPrivacyGuard)', () => {
  test('대상 원아 외 이름은 라벨로 치환되고, 응답 문자열에서 원래 이름으로 복원된다', () => {
    const input = '지우가 도윤이와 블록을 쌓다가 "다시 해보자"라고 말했다.';
    const messages = [{ role: 'user', content: JSON.stringify({ observation: input }) }];
    const { messages: anonymized, nameMap } = anonymizeOtherChildNames(messages, { input, targetChild: '지우' });
    expect(nameMap.length).toBeGreaterThan(0);
    expect(anonymized[0].content).not.toContain('도윤');
    expect(anonymized[0].content).toContain('친구1');

    const restored = restoreOtherChildNames('학습: 원아 A는 친구1과 함께 블록을 쌓았다.', nameMap);
    expect(restored).toContain('도윤');
    expect(restored).not.toContain('친구1');
  });

  test('대상 원아만 등장하면 치환할 이름이 없다', () => {
    const soloInput = '지우가 혼자 블록을 쌓았다.';
    const { messages, nameMap } = anonymizeOtherChildNames([{ role: 'user', content: soloInput }], { input: soloInput, targetChild: '지우' });
    expect(nameMap).toEqual([]);
    expect(messages[0].content).toBe(soloInput);
  });
});

describe('gemini 엔진 통합(runConstrainedB2LLM)', () => {
  test('API 키 미설정 시 네트워크 호출 없이 규칙 엔진(rule-b2) 결과로 대체된다', async () => {
    global.fetch = jest.fn();
    const input = '지우가 탑이 무너지자 다시 차근차근 쌓았다.';
    const result = await runConstrainedB2LLM({ input, childName: '지우', observation: input, engine: 'gemini' });
    expect(result.engineUsed).toBe('rule-b2');
    expect(result.fallbackReason).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('검수를 통과하는 응답이면 gemini 결과를 쓰고, 대상 원아 라벨은 원래 이름으로 복원된다', async () => {
    setGeminiConfig({ apiKey: 'test-key-123', model: 'gemini-2.5-flash' });
    setB2SentenceEngine('gemini');
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/models?')) return { ok: true }; // 연결 확인(getStatus) ping
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({
              learningTheme: 'retry',
              learningReading: '원아 A는 탑이 무너진 뒤에도 다시 시도하며 방법을 이어 갔다.',
              supportAction: 'retry_material',
              supportAndNextPlan: '비슷한 시도를 이어 갈 수 있도록 크기와 형태가 다른 재료를 곁에 마련한다.',
            }) }] },
          }],
        }),
      };
    });
    const input = '지우가 탑이 무너지자 다시 차근차근 쌓았다.';
    const result = await runConstrainedB2LLM({ input, childName: '지우', observation: input, engine: 'gemini' });
    expect(result.engineUsed).toBe('gemini');
    expect(result.llmMeta.accepted).toBe(true);
    expect(result.llm.learning).toContain('지우');
    expect(result.llm.learning).not.toContain('원아 A');
  });

  test('사전조건 — 다른 원아 실명은 원래 관찰문에 나타난다(무엇을 가리는지 확인용)', () => {
    const input = '지우가 도윤이와 함께 탑을 쌓다가 탑이 무너지자 다시 차근차근 쌓았다.';
    const ctx = buildRestrictedLLMContext({ input, childName: '지우', observation: input });
    expect(ctx.llmInput.observation).toContain('도윤');
  });

  test('실제 전송 페이로드(외부 인터넷 경로)에는 다른 원아의 실명이 들어가지 않는다', async () => {
    setGeminiConfig({ apiKey: 'test-key-123', model: 'gemini-2.5-flash' });
    let sentBody = '';
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).includes('/models?')) return { ok: true };
      sentBody = options.body || '';
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"incomplete":"schema mismatch on purpose"}' }] } }] }) };
    });
    const input = '지우가 도윤이와 함께 탑을 쌓다가 탑이 무너지자 다시 차근차근 쌓았다.';
    const result = await runConstrainedB2LLM({ input, childName: '지우', observation: input, engine: 'gemini' });
    expect(global.fetch).toHaveBeenCalled();
    expect(sentBody).not.toContain('도윤');
    // 스키마 불일치 응답 → 안전하게 규칙 엔진 결과로 대체(외부 실패가 문서 품질을 해치지 않음)
    expect(result.engineUsed).toBe('rule-b2');
  });

  test('processRecord와 동일한 방식(engine: getB2SentenceEngine())으로 호출해도 키만 있으면 자동으로 gemini를 쓴다', async () => {
    setGeminiConfig({ apiKey: 'test-key-123', model: 'gemini-2.5-flash' });
    // 관리자가 드롭다운을 건드리지 않은 상태 — publicApi.js가 실제로 하는 것과 동일하게 호출
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/models?')) return { ok: true };
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({
              learningTheme: 'retry',
              learningReading: '원아 A는 탑이 무너진 뒤에도 다시 시도하며 방법을 이어 갔다.',
              supportAction: 'retry_material',
              supportAndNextPlan: '비슷한 시도를 이어 갈 수 있도록 크기와 형태가 다른 재료를 곁에 마련한다.',
            }) }] },
          }],
        }),
      };
    });
    const input = '지우가 탑이 무너지자 다시 차근차근 쌓았다.';
    const result = await runConstrainedB2LLM({ input, childName: '지우', observation: input, engine: getB2SentenceEngine() });
    expect(result.engineUsed).toBe('gemini');
    expect(result.llmMeta.accepted).toBe(true);
  });

  test('로컬 전용 엔진(private-server-7b)에는 다른 원아 이름 추가 비식별화가 적용되지 않는다', async () => {
    const { setServerConfig } = await import('./ai/llm/privateServerLLM');
    setServerConfig({ url: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct' });
    let sentBody = '';
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).endsWith('/models')) return { ok: true, json: async () => ({ data: [] }) };
      sentBody = options.body || '';
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"incomplete":"schema mismatch on purpose"}' } }] }) };
    });
    const input = '지우가 도윤이와 함께 탑을 쌓다가 탑이 무너지자 다시 차근차근 쌓았다.';
    await runConstrainedB2LLM({ input, childName: '지우', observation: input, engine: 'private-server-7b' });
    // 같은 PC로만 나가는 경로이므로 대상 원아만 '원아 A'로 치환되고, 다른 원아 실명은 그대로 전송된다
    expect(sentBody).toContain('도윤');
  });
});
