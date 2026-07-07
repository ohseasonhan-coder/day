// 앱 내장형 로컬 LLM 어댑터(5단계 POC) — WebLLM(@mlc-ai/web-llm, Apache-2.0) 기반.
//
//  - 추론은 전부 사용자 기기의 WebGPU에서 실행된다. 사용자 입력·프롬프트·결과는 외부로 전송되지 않는다.
//  - 모델 가중치는 Git/번들에 넣지 않는다. 최초 "엔진 준비" 시 MLC CDN에서 1회 내려받아
//    브라우저 Cache Storage에 저장되고, 이후에는 오프라인 캐시로 로드된다(삭제 버튼 제공).
//  - 런타임 JS(@mlc-ai/web-llm)는 dynamic import 지연 청크 — 평소 번들·초기 로딩에 영향 없음.
//  - 미지원(WebGPU 없음)·초기화 실패 시 이 어댑터는 상태만 보고하고, 흐름은 규칙 엔진으로 fallback.
//
// 모델: Qwen2.5-1.5B-Instruct(q4f16_1, MLC 변환본) — Apache-2.0, 한국어 생성 가능한 최소급 모델.
// 저장 공간 부족·다운로드 실패는 상태로 구분해 UI에 전달한다.
export const EMBEDDED_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

// 엔진 상태: idle(미준비) | need-download(모델 다운로드 필요) | preparing(준비 중) |
//           ready(사용 가능) | unsupported(기기 미지원) | error(메모리·초기화 실패)
let _state = 'idle';
let _progress = 0;      // 0~100 (preparing 중)
let _error = '';
let _engine = null;     // MLCEngine 인스턴스
let _preparing = null;  // 중복 prepare 방지

export function isWebGPUSupported() {
  try { return typeof navigator !== 'undefined' && !!navigator.gpu; } catch { return false; }
}

async function loadRuntime() {
  // 지연 로드 — 이 시점에만 web-llm 청크를 가져온다.
  return import('@mlc-ai/web-llm');
}

export async function getEmbeddedStatus() {
  if (!isWebGPUSupported()) return { state: 'unsupported', progress: 0, error: 'WebGPU 미지원 기기' };
  if (_engine) return { state: 'ready', progress: 100, error: '' };
  if (_state === 'preparing') return { state: 'preparing', progress: _progress, error: '' };
  if (_state === 'error') return { state: 'error', progress: 0, error: _error };
  // 캐시에 모델이 있으면 초기화만 필요(need-download 아님)
  try {
    const webllm = await loadRuntime();
    const cached = await webllm.hasModelInCache(EMBEDDED_MODEL_ID);
    return { state: cached ? 'idle' : 'need-download', progress: 0, error: '' };
  } catch {
    return { state: 'need-download', progress: 0, error: '' };
  }
}

// 모델 준비(다운로드+초기화). onProgress(percent, text) 콜백으로 UI에 상태 전달.
export function prepareEmbedded(onProgress) {
  if (_engine) return Promise.resolve({ ok: true });
  if (_preparing) return _preparing;
  if (!isWebGPUSupported()) return Promise.resolve({ ok: false, error: 'unsupported' });
  _state = 'preparing'; _progress = 0; _error = '';
  _preparing = (async () => {
    try {
      const webllm = await loadRuntime();
      _engine = await webllm.CreateMLCEngine(EMBEDDED_MODEL_ID, {
        initProgressCallback: (p) => {
          _progress = Math.round((p?.progress || 0) * 100);
          try { onProgress?.(_progress, p?.text || ''); } catch {}
        },
      });
      _state = 'ready';
      return { ok: true };
    } catch (e) {
      _state = 'error';
      const msg = String(e?.message || e || 'init-failed');
      // 저장 공간 부족/메모리 부족을 구분해 UI에 전달
      _error = /quota|storage/i.test(msg) ? '저장 공간 부족' : /memory|oom|device/i.test(msg) ? '메모리 부족 또는 GPU 초기화 실패' : msg;
      _engine = null;
      return { ok: false, error: _error };
    } finally {
      _preparing = null;
    }
  })();
  return _preparing;
}

// 사실 카드 기반 messages → JSON 문자열 생성(구조화 출력 유도)
export async function generateEmbedded({ messages, schema } = {}) {
  if (!_engine) throw new Error('engine-not-ready');
  const req = {
    messages,
    temperature: 0.4,
    top_p: 0.9,
    max_tokens: 300,
  };
  // WebLLM 구조화 출력(XGrammar) — 스키마 강제. 미지원 버전이면 프롬프트 유도 + 후처리 파싱으로 방어.
  if (schema) {
    try { req.response_format = { type: 'json_object', schema: JSON.stringify(schema) }; } catch {}
  }
  const out = await _engine.chat.completions.create(req);
  return out?.choices?.[0]?.message?.content || '';
}

// 모델 캐시 삭제(기기 저장 공간 반환) + 엔진 해제
export async function deleteEmbeddedModel() {
  try { await _engine?.unload?.(); } catch {}
  _engine = null; _state = 'idle'; _progress = 0; _error = '';
  try {
    const webllm = await loadRuntime();
    if (webllm.deleteModelAllInfoInCache) await webllm.deleteModelAllInfoInCache(EMBEDDED_MODEL_ID);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// engineAdapter가 쓰는 표준 어댑터 형태
export const embeddedAdapter = {
  name: 'embedded-local-llm',
  getStatus: getEmbeddedStatus,
  prepare: prepareEmbedded,
  generate: generateEmbedded,
  deleteCache: deleteEmbeddedModel,
};

export default embeddedAdapter;
