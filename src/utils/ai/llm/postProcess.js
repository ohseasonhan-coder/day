// LLM 출력 후처리(5단계) — JSON 파싱 → 형식·길이·반복·금지어 검사 → observationAudit 사실 검수.
// 어떤 단계든 중대 문제면 LLM 결과를 폐기하고 규칙 기반 B안 fallback 사유를 돌려준다.
import { auditObservationCopy } from '../observationAudit';

const clean = (s) => String(s || '').trim();
const BANNED = [/유아들은/, /활용하여/, /놀이에 참여하였다/, /발달 경험과 연결/, /영역과 연결지어/, /영역의 발달/];
const FOREIGN_SCRIPT = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/;

// 관대한 JSON 추출: 본문에서 첫 {...} 블록을 찾아 파싱(코드블록·머리말 방어)
export function parseLLMJson(text) {
  const raw = clean(text);
  if (!raw) return { ok: false, error: 'empty_output' };
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'json_not_found' };
  try {
    const data = JSON.parse(m[0]);
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'json_parse_failed' };
  }
}

function repeatedToken(text) {
  const tokens = String(text).replace(/[^가-힣\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
  const c = {};
  for (const w of tokens) { c[w] = (c[w] || 0) + 1; if (c[w] >= 3) return w; }
  return null;
}

// 반환: { ok, learning, support, audit, reasons[] } — ok=false면 fallback 대상
export function validateLLMOutput({ data = {}, factCard = {}, input = '', observation = '', childName = '' } = {}) {
  const reasons = [];
  const learning = clean(data.learningReading);
  const support = clean(data.supportAndNextPlan);

  // 1) 빈값·형식
  if (!learning || !support) reasons.push('empty_field');
  // 2) 과도한 길이(복붙 부적합) / 지나치게 짧음
  if (learning.length > 260 || support.length > 260) reasons.push('too_long');
  if ((learning && learning.length < 15) || (support && support.length < 15)) reasons.push('too_short');
  // 3) 기계적 반복
  const rep = repeatedToken(`${learning} ${support}`);
  if (rep) reasons.push(`repetition:${rep}`);
  // 4) 금지 표현 재도입
  if (BANNED.some((re) => re.test(learning) || re.test(support))) reasons.push('banned_phrase');
  if (FOREIGN_SCRIPT.test(learning) || FOREIGN_SCRIPT.test(support)) reasons.push('foreign_script');
  // 5) 사실 카드에 없는 발화 창작(따옴표 비교)
  const outQuotes = Array.from(`${learning} ${support}`.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
  const known = factCard.speeches || [];
  if (outQuotes.some((q) => !known.includes(q))) reasons.push('fact_addition_speech');

  // 6) observationAudit — 사실·안전 검수(또래 창작/발화 손실/낙인/조사/지원 단정 등)
  const audit = auditObservationCopy({ input, observation, learning, support, childName });
  audit.warnings.forEach((code) => { if (!reasons.includes(code)) reasons.push(code); });
  return { ok: reasons.length === 0 && audit.ok, learning, support, audit, reasons };
}

export default validateLLMOutput;
