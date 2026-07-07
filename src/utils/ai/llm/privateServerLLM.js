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
  MODEL_14B: 'sw_admin_llm_server_model_14b',
};

export const PRIVATE_SERVER_DEFAULTS = {
  timeoutMs: 75000,
  retries: 1,
  temperature: 0.2,
  maxTokens: 160,
};

// 설정이 비어 있을 때 자동 감지할 "같은 PC" 표준 주소(Ollama, LM Studio).
// 로컬호스트만 후보로 두므로 외부로 나가는 요청이 아니며, 감지 실패 시 조용히 규칙 엔진만 쓴다.
export const DEFAULT_SERVER_CANDIDATES = ['http://localhost:11434/v1', 'http://127.0.0.1:11434/v1', 'http://localhost:1234/v1'];
let _autoUrl = null;      // 세션 내 자동 감지 캐시(저장하지 않음 — 서버가 꺼졌을 수 있어 매 세션 재확인)
let _autoChecked = false;

export function getServerConfig() {
  try {
    return {
      url: String(localStorage.getItem(PRIVATE_SERVER_KEYS.URL) || '').trim().replace(/\/$/, ''),
      model: String(localStorage.getItem(PRIVATE_SERVER_KEYS.MODEL) || '').trim() || 'qwen2.5:7b-instruct',
      model14b: String(localStorage.getItem(PRIVATE_SERVER_KEYS.MODEL_14B) || '').trim() || 'qwen2.5:14b-instruct',
    };
  } catch { return { url: '', model: 'qwen2.5:7b-instruct', model14b: 'qwen2.5:14b-instruct' }; }
}
export function setServerConfig({ url, model, model14b } = {}) {
  try {
    if (url != null) localStorage.setItem(PRIVATE_SERVER_KEYS.URL, String(url).trim());
    if (model != null) localStorage.setItem(PRIVATE_SERVER_KEYS.MODEL, String(model).trim());
    if (model14b != null) localStorage.setItem(PRIVATE_SERVER_KEYS.MODEL_14B, String(model14b).trim());
  } catch {}
  _autoUrl = null; _autoChecked = false; // 관리자 변경 시 자동 감지 캐시 초기화
}

// 관리자 설정 URL이 있으면 그대로, 없으면 로컬 표준 주소를 1회 탐지(설정 0회 지원).
// AI 기능을 실제로 쓸 때만 호출되므로 앱 시작 성능에는 영향 없음.
export async function resolveServerUrl() {
  const { url } = getServerConfig();
  if (url) return url;
  if (_autoChecked) return _autoUrl;
  _autoChecked = true;
  for (const cand of DEFAULT_SERVER_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop
    if (await ping(cand)) { _autoUrl = cand; return cand; }
  }
  _autoUrl = null;
  return null;
}
// 테스트용 — 자동 감지 캐시 초기화
export function __resetAutoDetect() { _autoUrl = null; _autoChecked = false; }

async function ping(url) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 2500) : null;
  try {
    const res = await fetch(`${url}/models`, { method: 'GET', signal: ctrl?.signal });
    return res.ok;
  } catch { return false; }
  finally { if (timer) clearTimeout(timer); }
}

export async function listServerModels() {
  const url = await resolveServerUrl();
  if (!url) return [];
  try {
    const res = await fetchWithTimeout(`${url}/models`, { method: 'GET' }, 3000);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data || json?.models || []).map((item) => String(item?.id || item?.name || item || '')).filter(Boolean);
  } catch { return []; }
}

export async function hasServerModel(model) {
  const target = String(model || '').trim().toLowerCase();
  if (!target) return false;
  const models = await listServerModels();
  return models.some((item) => item.toLowerCase() === target || item.toLowerCase().startsWith(`${target}:`));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = PRIVATE_SERVER_DEFAULTS.timeoutMs) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { ...options, signal: ctrl?.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('server-timeout');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const privateServerAdapter = {
  name: 'private-server-7b',
  getStatus: async () => {
    const configured = getServerConfig().url;
    const url = await resolveServerUrl(); // 미설정이면 로컬 표준 주소 자동 감지
    if (!url) return { state: 'unsupported', progress: 0, error: '로컬 AI 서버 없음(같은 PC에서 Ollama 실행 시 자동 연결)' };
    if (configured) {
      const ok = await ping(url);
      return ok ? { state: 'ready', progress: 100, error: '' } : { state: 'error', progress: 0, error: '서버 연결 실패' };
    }
    return { state: 'ready', progress: 100, error: '' }; // 자동 감지분은 감지 시점에 이미 ping 통과
  },
  prepare: async () => {
    const url = await resolveServerUrl();
    if (!url) return { ok: false, error: 'unsupported' };
    const ok = await ping(url);
    return ok ? { ok: true } : { ok: false, error: '서버 연결 실패' };
  },
  // messages → 텍스트(JSON 기대). 프롬프트·응답은 저장하지 않고 반환만.
  generate: async ({ messages, schema, model: modelOverride, timeoutMs = PRIVATE_SERVER_DEFAULTS.timeoutMs, retries = PRIVATE_SERVER_DEFAULTS.retries, temperature = PRIVATE_SERVER_DEFAULTS.temperature, maxTokens = PRIVATE_SERVER_DEFAULTS.maxTokens } = {}) => {
    const { model: configuredModel } = getServerConfig();
    const model = String(modelOverride || configuredModel).trim();
    const url = await resolveServerUrl();
    if (!url) throw new Error('server-not-configured');
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetchWithTimeout(`${url}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
            response_format: schema ? { type: 'json_object' } : undefined,
          }),
        }, timeoutMs);
        if (!res.ok) throw new Error(`server-http-${res.status}`);
        const j = await res.json();
        const content = j?.choices?.[0]?.message?.content || '';
        if (!content.trim()) throw new Error('server-empty-output');
        return content;
      } catch (error) {
        lastError = error;
        // timeout은 서버에서 이전 생성을 계속 수행할 수 있어 재시도하면 큐가 길어진다. 즉시 B안으로 전환한다.
        const retryable = /fetch|network|server-http-5|empty-output/i.test(String(error?.message || error))
          && !/timeout/i.test(String(error?.message || error));
        if (!retryable || attempt >= retries) break;
      }
    }
    throw lastError || new Error('server-generate-failed');
  },
  deleteCache: async () => ({ ok: true }), // 서버 측 모델은 앱이 관리하지 않음
};

export default privateServerAdapter;
