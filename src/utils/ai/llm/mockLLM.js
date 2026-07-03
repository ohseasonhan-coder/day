// 테스트용 mock 어댑터 — CI에서 모델 다운로드 없이 엔진 흐름을 검증한다(실 추론 없음).
export function createMockAdapter({ state = 'ready', response = '', failGenerate = false, prepareOk = true } = {}) {
  return {
    name: 'mock-llm',
    getStatus: async () => ({ state, progress: state === 'ready' ? 100 : 0, error: state === 'error' ? 'mock-error' : '' }),
    prepare: async () => (prepareOk ? { ok: true } : { ok: false, error: 'mock-prepare-failed' }),
    generate: async () => {
      if (failGenerate) throw new Error('mock-generate-failed');
      return typeof response === 'function' ? response() : response;
    },
    deleteCache: async () => ({ ok: true }),
  };
}
export default createMockAdapter;
