// ── 온디바이스 LLM "자연스럽게 다듬기" (실험실, 데스크탑) ─────────────────────
// 크롬 내장 Prompt API(Gemini Nano)를 사용해 기기 안에서만 문장을 다듬는다.
// 외부 서버/외부 LLM API로 데이터를 보내지 않는다(브라우저 내장 모델).
// 기존 규칙 엔진은 그대로 두고, 이 모듈은 "선택적 후처리"로만 동작한다.
import { scoreText } from './ai/qualityScorer';

const SCORE_DOCTYPE = { observation: 'observation', parent: 'notice', notice: 'notice', evaluation: 'dailyReport', support: 'support' };

// 사실 보존 가드: 다듬은 결과가 원문의 사실/아이 발화를 바꾸면 false(→ 규칙 문장 유지).
// 순수 함수(LLM 없이 검증 가능). 모든 자동 다듬기는 이 가드를 통과해야 적용된다.
export function passesFactGuard({ memo = '', original = '', refined = '', docType = 'observation' } = {}) {
  const out = String(refined || '').trim();
  if (!out) return false;
  const base = String(original || '');
  // 1) 발화 보존: 원문 따옴표 속 아이 말이 다듬은 결과에 그대로 남아야 한다.
  const quotes = Array.from(String(memo).matchAll(/"([^"]+)"/g)).map((m) => m[1]);
  if (!quotes.every((q) => out.includes(q))) return false;
  // 2) 환각으로 과도하게 길어지는 경우 거부
  if (base && out.length > base.length * 2.2 + 40) return false;
  // 3) 사실 보존 점수: 원문(규칙 문장) 대비 크게 떨어지면 거부
  const dt = SCORE_DOCTYPE[docType] || 'observation';
  try {
    const b = scoreText(base, { input: memo, documentType: dt }).detail.factPreservation;
    const r = scoreText(out, { input: memo, documentType: dt }).detail.factPreservation;
    if (r < b - 3) return false;
  } catch {}
  return true;
}

// 크롬 Prompt API는 버전에 따라 window.LanguageModel 또는 window.ai.languageModel 로 노출된다.
function getLM() {
  if (typeof window === 'undefined') return null;
  return window.LanguageModel || window.ai?.languageModel || null;
}

export function isDesktopEnv() {
  try {
    const ua = navigator.userAgent || '';
    const mobile = /iPhone|iPad|Android.*Mobile|Mobile|iPod/i.test(ua);
    return !mobile;
  } catch { return false; }
}

// 이 기기에서 온디바이스 LLM이 가능한지(무거운 로딩 없이 감지만).
export function detectOnDeviceCapability() {
  let webgpu = false, promptApi = false;
  try { webgpu = !!navigator.gpu; } catch {}
  try { promptApi = !!getLM(); } catch {}
  // 무료 온디바이스 AI(브라우저 내장)가 있는 기기면 어디서든 사용 가능 — 데스크탑으로 한정하지 않는다.
  // (지금은 사실상 PC 크롬/엣지지만, 모바일이 지원을 추가하면 자동으로 켜진다.)
  return { webgpu, promptApi, desktop: isDesktopEnv(), usable: promptApi };
}

// 모델이 실제로 쓸 수 있는 상태인지(다운로드 필요/불가 포함).
// 반환: 'available' | 'downloadable' | 'downloading' | 'unavailable'
export async function checkModelAvailability() {
  const LM = getLM();
  if (!LM) return 'unavailable';
  try {
    if (typeof LM.availability === 'function') {
      return await LM.availability();
    }
    // 구버전: capabilities().available = 'readily'|'after-download'|'no'
    if (typeof LM.capabilities === 'function') {
      const caps = await LM.capabilities();
      const a = caps?.available;
      if (a === 'readily') return 'available';
      if (a === 'after-download') return 'downloadable';
      return 'unavailable';
    }
  } catch {}
  return 'unavailable';
}

const SYSTEM_PROMPT = [
  '너는 한국 어린이집·유치원 보육교사의 관찰 메모를 자연스러운 한국어 문장으로 다듬는 도우미다.',
  '규칙:',
  '1) 메모에 없는 사실을 새로 지어내지 마라. 인물·행동·상황을 바꾸지 마라.',
  '2) 따옴표 안의 아이 말은 글자 그대로 보존하라.',
  '3) 부정적 낙인·진단·비교 표현을 쓰지 마라.',
  '4) 1~3문장으로 간결하게, 보육 문서에 어울리는 따뜻하고 전문적인 문체로.',
  '5) 결과 문장만 출력하고 설명·머리말을 붙이지 마라.',
].join('\n');

let _session = null;
let _preparing = null;

// 모델 세션을 만든다(필요 시 크롬이 내장 모델을 1회 준비). onProgress(0~100)로 진행률 보고.
async function createSession(onProgress) {
  const LM = getLM();
  if (!LM || typeof LM.create !== 'function') return null;
  const opts = { initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }] };
  if (onProgress) {
    opts.monitor = (m) => {
      try { m.addEventListener('downloadprogress', (e) => onProgress(Math.round((e.loaded || 0) * 100))); } catch {}
    };
  }
  try { return await LM.create(opts); }
  catch { return await LM.create({ systemPrompt: SYSTEM_PROMPT }); } // 구버전 시그니처
}

async function getSession() {
  if (_session) return _session;
  try { _session = await createSession(); } catch { _session = null; }
  return _session;
}

// 백그라운드 사전 준비 — 앱에서 미리 1회 호출해 두면, 사용자가 누를 때 기다리지 않는다.
// 반환: { ok } | { ok:false, error }. 중복 호출은 같은 작업을 공유한다.
export function prepareModel(onProgress) {
  if (_session) return Promise.resolve({ ok: true });
  if (_preparing) return _preparing;
  _preparing = (async () => {
    const LM = getLM();
    if (!LM) return { ok: false, error: 'unsupported' };
    try {
      const avail = await checkModelAvailability();
      if (avail === 'unavailable') return { ok: false, error: 'unavailable' };
      _session = await createSession(onProgress);
      return _session ? { ok: true } : { ok: false, error: 'create-failed' };
    } catch (e) {
      return { ok: false, error: e?.message || 'prepare-failed' };
    } finally {
      _preparing = null;
    }
  })();
  return _preparing;
}

// 모델이 추가 다운로드 없이 바로 쓸 수 있는 상태인지.
export async function isModelReady() {
  if (_session) return true;
  try { return (await checkModelAvailability()) === 'available'; } catch { return false; }
}

// 규칙 엔진이 만든 문장을 자연스럽게 다시 쓴다.
// 반환: { ok, text } | { ok:false, error }
export async function refineSentence({ text, memo, docType } = {}) {
  const base = String(text || '').trim();
  if (!base) return { ok: false, error: '다듬을 문장이 없어요.' };
  const session = await getSession();
  if (!session) return { ok: false, error: '이 브라우저에서는 온디바이스 AI를 쓸 수 없어요.' };
  const typeKo = ({ observation: '관찰일지', notice: '알림장', parent: '알림장', evaluation: '보육일지 평가', consult: '상담자료', develop: '발달평가' })[docType] || '보육 문서';
  const user = [
    `문서 유형: ${typeKo}`,
    memo ? `원본 메모(사실 근거): ${String(memo).trim()}` : '',
    `다듬을 문장: ${base}`,
    '위 "다듬을 문장"을 규칙에 맞게 자연스럽게 다시 써줘.',
  ].filter(Boolean).join('\n');
  try {
    const out = await session.prompt(user);
    const refined = String(out || '').trim().replace(/^["“]|["”]$/g, '').trim();
    if (!refined) return { ok: false, error: '결과가 비었어요.' };
    // 사실 보존 가드: 사실/발화가 바뀌면 적용하지 않고 규칙 문장 유지
    if (!passesFactGuard({ memo, original: base, refined, docType })) {
      return { ok: false, error: '사실 보존을 위해 규칙 문장을 유지했어요.', guarded: true };
    }
    return { ok: true, text: refined };
  } catch (e) {
    return { ok: false, error: e?.message || '다듬기에 실패했어요.' };
  }
}

export function destroyOnDeviceSession() {
  try { _session?.destroy?.(); } catch {}
  _session = null;
}
