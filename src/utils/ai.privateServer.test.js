import { privateServerAdapter, setServerConfig } from './ai/llm/privateServerLLM';

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

