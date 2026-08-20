// 사진 → 관찰 초안(photoObservation.js) 회귀 — opt-in 게이트, 이미지 파싱, 요청 페이로드, 실패 처리.
import { setGeminiConfig, setGeminiVisionEnabled, isGeminiVisionEnabled } from './ai/llm/geminiLLM';
import { generatePhotoObservationDraft } from './ai/llm/photoObservation';

const originalFetch = global.fetch;
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const DATA_URL = `data:image/png;base64,${TINY_PNG_B64}`;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('opt-in 게이트 — 둘 다 켜져 있어야 실제로 호출된다', () => {
  test('사진 분석을 켜지 않았으면 네트워크 호출 없이 vision-not-enabled', async () => {
    setGeminiConfig({ apiKey: 'test-key-123' });
    global.fetch = jest.fn();
    const result = await generatePhotoObservationDraft({ imageDataUrl: DATA_URL });
    expect(result.error).toBe('vision-not-enabled');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('사진 분석은 켰지만 Gemini API 키가 없으면 gemini-not-configured', async () => {
    setGeminiVisionEnabled(true);
    global.fetch = jest.fn();
    const result = await generatePhotoObservationDraft({ imageDataUrl: DATA_URL });
    expect(result.error).toBe('gemini-not-configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('토글 상태는 localStorage에 남고 SYNC_EXCLUDED_KEYS에 포함된다', async () => {
    const { SYNC_EXCLUDED_KEYS } = await import('./storage');
    const { GEMINI_KEYS } = await import('./ai/llm/geminiLLM');
    expect(isGeminiVisionEnabled()).toBe(false);
    setGeminiVisionEnabled(true);
    expect(isGeminiVisionEnabled()).toBe(true);
    expect(SYNC_EXCLUDED_KEYS).toContain(GEMINI_KEYS.VISION_ENABLED);
    setGeminiVisionEnabled(false);
    expect(isGeminiVisionEnabled()).toBe(false);
  });
});

describe('이미지 형식 검증', () => {
  test('data: URL 형식이 아니면 invalid-image', async () => {
    setGeminiVisionEnabled(true);
    setGeminiConfig({ apiKey: 'test-key-123' });
    global.fetch = jest.fn();
    const result = await generatePhotoObservationDraft({ imageDataUrl: 'not-a-data-url' });
    expect(result.error).toBe('invalid-image');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('정상 호출 — 요청 페이로드에 이미지가 실리는지, 응답을 그대로 반환하는지', () => {
  test('inlineData 파트에 mimeType·base64가 정확히 담기고, 결과 문장을 반환한다', async () => {
    setGeminiVisionEnabled(true);
    setGeminiConfig({ apiKey: 'test-key-123', model: 'gemini-2.5-flash' });
    let sentBody = null;
    global.fetch = jest.fn(async (url, options = {}) => {
      sentBody = JSON.parse(options.body || '{}');
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '아이가 블록을 쌓으며 놀이하고 있다.' }] } }] }),
      };
    });
    const result = await generatePhotoObservationDraft({ imageDataUrl: DATA_URL, classroomContext: { classAge: 4 } });
    expect(result.text).toBe('아이가 블록을 쌓으며 놀이하고 있다.');
    const userTurn = sentBody.contents.find((c) => c.role === 'user');
    const imagePart = userTurn.parts.find((p) => p.inlineData);
    expect(imagePart.inlineData.mimeType).toBe('image/png');
    expect(imagePart.inlineData.data).toBe(TINY_PNG_B64);
    expect(sentBody.systemInstruction.parts[0].text).toContain('이름');
  });
});

describe('실패 처리 — 절대 throw하지 않고 error를 반환한다', () => {
  test('Gemini HTTP 오류는 예외 대신 {error}로 반환된다', async () => {
    setGeminiVisionEnabled(true);
    setGeminiConfig({ apiKey: 'test-key-123' });
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 }));
    const result = await generatePhotoObservationDraft({ imageDataUrl: DATA_URL });
    expect(result.error).toBeTruthy();
    expect(result.text).toBeUndefined();
  });
});
