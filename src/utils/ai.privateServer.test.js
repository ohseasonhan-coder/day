import {
  privateServerAdapter, setServerConfig, resolveServerUrl, __resetAutoDetect, DEFAULT_SERVER_CANDIDATES,
} from './ai/llm/privateServerLLM';

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

