// 사진 → 관찰 초안 문장(Gemini Vision 전용, opt-in) — "사진 기록" 화면에서만 쓴다.
// 이 앱의 다른 AI 기능과 달리 로컬 규칙 엔진 대체 경로가 없다(사진을 "읽는" 로컬 기능이 없음).
// 그래서 관리자가 sw_admin_gemini_vision_enabled를 명시적으로 켜지 않으면 절대 호출되지 않는다.
// 결과는 항상 교사가 검토·수정할 초안일 뿐 — 이후 processRecord()의 rawText로 들어가면서
// 기존 규칙/감사 파이프라인을 그대로 통과한다(이 모듈 자체는 감사하지 않는다).
import { geminiAdapter, getGeminiConfig, isGeminiVisionEnabled } from './geminiLLM';

const SYSTEM_PROMPT = [
  '너는 한국 어린이집 사진 속 활동을 짧게 서술하는 도우미다.',
  '규칙:',
  '1) 사진에 실제로 보이는 활동·놀이감·행동만 서술하라. 보이지 않는 것은 추측하지 마라.',
  '2) 아이의 이름, 신원, 얼굴·외모 특징은 절대 언급하지 마라 — "아이가", "유아가"로만 지칭하라.',
  '3) 감정이나 발달 수준을 단정하지 마라(예: "즐거워 보인다"까지는 괜찮지만 "발달이 빠르다"는 금지).',
  '4) 한국어로 1~2문장, 보육 기록에 어울리는 담백한 문체로 써라.',
  '5) 결과 문장만 출력하고 설명이나 머리말을 붙이지 마라.',
].join('\n');

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

export async function generatePhotoObservationDraft({ imageDataUrl, classroomContext = {} } = {}) {
  if (!isGeminiVisionEnabled()) return { error: 'vision-not-enabled' };
  const { apiKey } = getGeminiConfig();
  if (!apiKey) return { error: 'gemini-not-configured' };

  const match = DATA_URL_RE.exec(String(imageDataUrl || ''));
  if (!match) return { error: 'invalid-image' };
  const [, mimeType, data] = match;

  const userText = classroomContext?.classAge
    ? `학급 연령: 만 ${classroomContext.classAge}세. 사진 속 아이의 활동을 서술해줘.`
    : '사진 속 아이의 활동을 서술해줘.';

  try {
    const text = await geminiAdapter.generate({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      image: { mimeType, data },
      temperature: 0.3,
      maxTokens: 200,
      timeoutMs: 20000,
    });
    return { text: text.trim() };
  } catch (error) {
    return { error: error?.message || 'gemini-vision-failed' };
  }
}

export default generatePhotoObservationDraft;
