// Google Gemini API 어댑터 — 관리자가 API 키를 직접 설정하고 엔진을 'gemini'로
// 선택했을 때만 쓰인다(기본 엔진은 여전히 규칙 기반 rule-b2 — 미설정 시 아무 것도 바뀌지 않음).
//
// privateServerLLM.js(로컬 7B, 관리자 본인 PC로만 요청)와 달리 이 어댑터는
// 실제로 인터넷을 통해 Google 서버(generativelanguage.googleapis.com)로 요청을 보낸다.
// 그래서 b2/llmBridge.js는 이 어댑터(external: true)로 보내기 직전 대상 원아 이름을
// '원아 A'로, 그 외 다른 원아 이름은 '친구1/친구2...'로 치환하고(externalPrivacyGuard.js),
// 응답을 받은 뒤 원래 이름으로 복원한다. 전송 내용도 원문 전체가 아니라
// buildRestrictedLLMContext가 만든 제한된 JSON(허용 테마·지원 id + 짧은 문장 자리)뿐이며,
// 응답은 기존 postProcess/observationAudit 검수를 통과해야 문서에 반영되고
// 실패 시 자동으로 규칙 엔진(rule-b2) 결과로 대체된다.
// API 키는 localStorage에만 저장하며 기기 간 동기화·백업 대상에서 제외한다(storage.js SYNC_EXCLUDED_KEYS).
export const GEMINI_KEYS = {
  API_KEY: 'sw_admin_gemini_api_key',
  MODEL: 'sw_admin_gemini_model',
};

export const GEMINI_DEFAULTS = {
  model: 'gemini-2.5-flash',
  timeoutMs: 30000,
  retries: 0,
  temperature: 0.2,
  maxTokens: 400,
};

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function getGeminiConfig() {
  try {
    return {
      apiKey: String(localStorage.getItem(GEMINI_KEYS.API_KEY) || '').trim(),
      model: String(localStorage.getItem(GEMINI_KEYS.MODEL) || '').trim() || GEMINI_DEFAULTS.model,
    };
  } catch { return { apiKey: '', model: GEMINI_DEFAULTS.model }; }
}

export function setGeminiConfig({ apiKey, model } = {}) {
  try {
    if (apiKey != null) localStorage.setItem(GEMINI_KEYS.API_KEY, String(apiKey).trim());
    if (model != null) localStorage.setItem(GEMINI_KEYS.MODEL, String(model).trim());
  } catch {}
}

export function clearGeminiConfig() {
  try {
    localStorage.removeItem(GEMINI_KEYS.API_KEY);
    localStorage.removeItem(GEMINI_KEYS.MODEL);
  } catch {}
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GEMINI_DEFAULTS.timeoutMs) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { ...options, signal: ctrl?.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('gemini-timeout');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// OpenAI 스타일 messages([{role, content}]) → Gemini contents/systemInstruction 형식으로 변환.
function toGeminiRequest(messages = [], { schema, temperature, maxTokens } = {}) {
  const systemParts = [];
  const contents = [];
  messages.forEach((m) => {
    if (m.role === 'system') systemParts.push(String(m.content || ''));
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] });
  });
  const body = {
    contents: contents.length ? contents : [{ role: 'user', parts: [{ text: '' }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(schema ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (systemParts.length) body.systemInstruction = { parts: [{ text: systemParts.join('\n') }] };
  return body;
}

function extractText(json) {
  const candidate = json?.candidates?.[0];
  if (!candidate) return '';
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') return '';
  return (candidate.content?.parts || []).map((p) => p?.text || '').join('').trim();
}

async function ping(apiKey) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/models?key=${encodeURIComponent(apiKey)}`, { method: 'GET' }, 6000);
    return res.ok;
  } catch { return false; }
}

export const geminiAdapter = {
  name: 'gemini',
  // 인터넷을 통해 Google 서버로 요청 — b2/llmBridge.js가 이 값을 보고 다른 원아 이름까지
  // 추가로 비식별화한다(로컬 전용 어댑터는 이 처리를 적용하지 않는다).
  external: true,
  getStatus: async () => {
    const { apiKey } = getGeminiConfig();
    if (!apiKey) return { state: 'unsupported', progress: 0, error: 'Gemini API 키 미설정' };
    const ok = await ping(apiKey);
    return ok ? { state: 'ready', progress: 100, error: '' } : { state: 'error', progress: 0, error: 'Gemini 연결 실패(키 또는 네트워크 확인)' };
  },
  prepare: async () => {
    const { apiKey } = getGeminiConfig();
    if (!apiKey) return { ok: false, error: 'unsupported' };
    const ok = await ping(apiKey);
    return ok ? { ok: true } : { ok: false, error: 'Gemini 연결 실패' };
  },
  // messages → 텍스트(JSON 기대). 프롬프트·응답은 저장하지 않고 반환만 한다.
  generate: async ({
    messages, schema, model: modelOverride,
    timeoutMs = GEMINI_DEFAULTS.timeoutMs, retries = GEMINI_DEFAULTS.retries,
    temperature = GEMINI_DEFAULTS.temperature, maxTokens = GEMINI_DEFAULTS.maxTokens,
  } = {}) => {
    const { apiKey, model: configuredModel } = getGeminiConfig();
    if (!apiKey) throw new Error('gemini-not-configured');
    const model = String(modelOverride || configuredModel).trim();
    const body = toGeminiRequest(messages, { schema, temperature, maxTokens });
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetchWithTimeout(
          `${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
          timeoutMs,
        );
        if (!res.ok) throw new Error(`gemini-http-${res.status}`);
        const json = await res.json();
        const text = extractText(json);
        if (!text) throw new Error('gemini-empty-output');
        return text;
      } catch (error) {
        lastError = error;
        const retryable = /gemini-http-5|gemini-empty-output/i.test(String(error?.message || error));
        if (!retryable || attempt >= retries) break;
      }
    }
    throw lastError || new Error('gemini-generate-failed');
  },
  deleteCache: async () => ({ ok: true }), // 원격 모델은 앱이 관리하지 않음(설정만 삭제)
};

export default geminiAdapter;
