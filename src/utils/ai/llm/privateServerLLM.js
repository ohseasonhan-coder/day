// 개인 PC 7B 서버 어댑터(5.5단계 POC) — 관리자가 지정한 "본인 소유 PC"의 OpenAI 호환 서버
// (예: Ollama http://localhost:11434/v1, LM Studio http://localhost:1234/v1)로만 요청한다.
//
//  - 서버 주소가 설정되지 않으면 상태 'unsupported' → 엔진 흐름이 자동으로 규칙 B안 fallback.
//  - 요청 본문에는 사실 카드 기반 messages만 담기며(원문 자유 전달 없음), 제3자 외부 서비스로 보내지 않는다.
//    주소는 관리자만 설정하고 일반 교사 화면에는 노출하지 않는다(동기화·백업 제외 키).
//  - 응답은 postProcess(JSON 파싱→금지어→audit) 검증을 그대로 통과해야만 문서 필드에 들어간다.
export const PRIVATE_SERVER_KEYS = {
  URL: 'sw_admin_llm_server_url',     // 예: http://localhost:11434/v1
  MODEL: 'sw_admin_llm_server_model', // 예: qwen2.5:7b-instruct
};

export function getServerConfig() {
  try {
    return {
      url: String(localStorage.getItem(PRIVATE_SERVER_KEYS.URL) || '').trim().replace(/\/$/, ''),
      model: String(localStorage.getItem(PRIVATE_SERVER_KEYS.MODEL) || '').trim() || 'qwen2.5:7b-instruct',
    };
  } catch { return { url: '', model: '' }; }
}
export function setServerConfig({ url, model } = {}) {
  try {
    if (url != null) localStorage.setItem(PRIVATE_SERVER_KEYS.URL, String(url).trim());
    if (model != null) localStorage.setItem(PRIVATE_SERVER_KEYS.MODEL, String(model).trim());
  } catch {}
}

async function ping(url) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 2500) : null;
  try {
    const res = await fetch(`${url}/models`, { method: 'GET', signal: ctrl?.signal });
    return res.ok;
  } catch { return false; }
  finally { if (timer) clearTimeout(timer); }
}

export const privateServerAdapter = {
  name: 'private-server-7b',
  getStatus: async () => {
    const { url } = getServerConfig();
    if (!url) return { state: 'unsupported', progress: 0, error: '서버 미설정(관리자 설정 필요)' };
    const ok = await ping(url);
    return ok ? { state: 'ready', progress: 100, error: '' } : { state: 'error', progress: 0, error: '서버 연결 실패' };
  },
  prepare: async () => {
    const { url } = getServerConfig();
    if (!url) return { ok: false, error: 'unsupported' };
    const ok = await ping(url);
    return ok ? { ok: true } : { ok: false, error: '서버 연결 실패' };
  },
  // messages → 텍스트(JSON 기대). 프롬프트·응답은 저장하지 않고 반환만.
  generate: async ({ messages } = {}) => {
    const { url, model } = getServerConfig();
    if (!url) throw new Error('server-not-configured');
    const res = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 320, stream: false }),
    });
    if (!res.ok) throw new Error(`server-http-${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  },
  deleteCache: async () => ({ ok: true }), // 서버 측 모델은 앱이 관리하지 않음
};

export default privateServerAdapter;
