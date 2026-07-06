// 문장 렌더링(6단계) — 계획 객체 안의 내용만 자연스럽게 표현한다(새 의미 추가 금지).
// 변형 선택은 입력+이름 해시로 결정론적: 같은 입력 = 항상 같은 문장, 다른 아이/상황 = 자연스러운 분산.
import { SAFE_LEARNING_VARIANTS } from '../rules/themes';
import { hasBannedPhrase, findBlockedClaims } from '../rules/blockedClaims';

export const hashOf = (s) => { let h = 0; const str = String(s || ''); for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); };
export const pickBy = (seedText, arr) => arr[hashOf(seedText) % arr.length];

function hasBatchim(name) {
  const last = name.charCodeAt(name.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
}
export function topicOf(name) {
  const n = String(name || '').trim();
  if (!n || n === '유아') return '유아는';
  return n + (hasBatchim(n) ? '은' : '는');
}

// 배움 읽기 렌더링: primary 변형(결정론) + (공존 시) secondary 보조 문장.
// 렌더 결과가 금지 주장/금지 표현을 포함하면 그 변형을 버리고 안전한 첫 변형으로 강등한다.
export function renderLearning({ plan, input = '' } = {}) {
  const { primary, secondary, name } = plan?.meta || {};
  const t = topicOf(name);
  const seed = `${input}|${name}`;

  const safe = () => pickBy(seed, SAFE_LEARNING_VARIANTS)(t);
  if (!primary) return safe();

  // 감정만 있고 회복 단서가 없는 입력: '즐겼다/즐거움' 계열 변형은 감정과 상충 → 중립 변형만 사용
  let pool = primary.learningVariants;
  if (plan?.meta?.emotionOnly) {
    const neutral = pool.filter((v) => !/즐/.test(v(t, input)));
    if (neutral.length === 0) return safe();
    pool = neutral;
  }
  let sentence = pickBy(seed, pool)(t, input);
  // 렌더 가드: 계획에 없는 의미(금지 주장·금지 표현)가 섞이면 변형 폐기
  if (hasBannedPhrase(sentence) || findBlockedClaims(sentence, input).some((c) => c.severity === 'major')) {
    sentence = primary.learningVariants[0](t, input);
  }
  // secondary 보조 문장(짧게 1개) — 전체 200자 이내에서만
  if (secondary && secondary.secondary) {
    const extra = secondary.secondary(t, input);
    if (extra && (sentence.length + extra.length + 1) <= 200 && !hasBannedPhrase(extra)) {
      sentence = `${sentence} ${extra}`;
    }
  }
  return sentence;
}

// 지원 계획 렌더링: 엔진 support가 있으면 그대로(무파괴). 없을 때만 테마 기반 계획 문장.
// 실제 지원 입력이 없으면 완료형이 아닌 계획 문체만 나온다(테마 supportVariants가 계획형으로 통일).
export function renderSupportHint({ plan, input = '' } = {}) {
  const { primary, name } = plan?.meta || {};
  if (!primary || !primary.supportVariants?.length) return '';
  return pickBy(`${input}|${name}|sup`, primary.supportVariants);
}

export default renderLearning;
