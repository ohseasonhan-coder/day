import {
  privateServerAdapter, setServerConfig, resolveServerUrl, __resetAutoDetect, DEFAULT_SERVER_CANDIDATES,
} from './ai/llm/privateServerLLM';
import { runConstrainedB2LLM } from './ai/b2/llmBridge';

describe('private-server-7b 오류 처리', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    setServerConfig({ url: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('서버 미실행은 연결 실패 상태로 보고한다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused'));
    const status = await privateServerAdapter.getStatus();
    expect(status.state).toBe('error');
  });

  test('timeout은 재시도 큐를 만들지 않고 즉시 오류로 끝낸다', async () => {
    global.fetch = jest.fn((url, options = {}) => new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    await expect(privateServerAdapter.generate({ messages: [], timeoutMs: 10, retries: 1 }))
      .rejects.toThrow('server-timeout');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('일시적 5xx는 1회 재시도 후 성공한다', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"learningReading":"가온은 다시 시도하며 방법을 찾아갔다.","supportAndNextPlan":"충분히 시도할 시간과 재료를 제공한다."}' } }] }),
      });
    const output = await privateServerAdapter.generate({ messages: [], retries: 1 });
    expect(output).toContain('learningReading');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('auto 모델 우선순위', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('검토 모드 auto는 준비된 14B를 7B보다 먼저 선택한다', async () => {
    setServerConfig({
      url: 'http://localhost:11434/v1',
      model: 'qwen2.5:7b-instruct',
      model14b: 'qwen2.5:14b-instruct',
    });
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).endsWith('/models')) {
        return { ok: true, json: async () => ({ data: [{ id: 'qwen2.5:14b-instruct' }, { id: 'qwen2.5:7b-instruct' }] }) };
      }
      const body = JSON.parse(options.body || '{}');
      expect(body.model).toBe('qwen2.5:14b-instruct');
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({
          learningTheme: 'retry',
          learningReading: '원아 A는 탑이 무너진 뒤에도 다시 시도하며 방법을 이어 갔다.',
          supportAction: 'retry_material',
          supportAndNextPlan: '비슷한 시도를 이어 갈 수 있도록 크기와 형태가 다른 재료를 곁에 마련한다.',
        }) } }] }),
      };
    });
    const input = '지우가 탑이 무너지자 다시 차근차근 쌓았다.';
    const result = await runConstrainedB2LLM({ input, childName: '지우', observation: input, engine: 'auto', reviewMode: true });
    expect(result.engineUsed).toBe('private-server-14b');
    expect(result.llmMeta.accepted).toBe(true);
  });
});

describe('로컬 서버 자동 감지(설정 0회)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();       // 관리자 URL 미설정 상태
    __resetAutoDetect();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('주소 미설정이어도 같은 PC 표준 주소를 자동 감지해 ready가 된다', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const url = await resolveServerUrl();
    expect(DEFAULT_SERVER_CANDIDATES).toContain(url);
    const status = await privateServerAdapter.getStatus();
    expect(status.state).toBe('ready');
  });

  test('로컬 서버가 없으면 unsupported → 규칙 엔진 fallback 경로', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('refused'));
    expect(await resolveServerUrl()).toBeNull();
    const status = await privateServerAdapter.getStatus();
    expect(status.state).toBe('unsupported');
  });

  test('감지는 세션당 1회만 시도한다(재호출 시 추가 네트워크 없음)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('refused'));
    await resolveServerUrl();
    const calls = global.fetch.mock.calls.length; // 후보 주소 수만큼
    await resolveServerUrl();
    await privateServerAdapter.getStatus();
    expect(global.fetch.mock.calls.length).toBe(calls);
  });

  test('관리자 설정 주소가 있으면 자동 감지 없이 그 주소를 쓴다', async () => {
    setServerConfig({ url: 'http://192.168.0.10:11434/v1' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    expect(await resolveServerUrl()).toBe('http://192.168.0.10:11434/v1');
  });

  test('관리자가 설정을 바꾸면 감지 캐시가 초기화된다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('refused'));
    expect(await resolveServerUrl()).toBeNull();     // 감지 실패 캐시
    setServerConfig({ url: '' });                    // 저장(초기화 트리거)
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    expect(await resolveServerUrl()).not.toBeNull(); // 재감지 성공
  });
});
