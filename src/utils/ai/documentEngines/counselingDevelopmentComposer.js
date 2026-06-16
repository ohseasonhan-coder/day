// 상담자료(counseling)·발달평가(development) 전용 문장 조립기.
// 입력 핵심 요소(extractEvaluationElements)를 전문적이고 부드러운 문체로 풀어낸다.
//
// 원칙: 외부 API/서버 없음. 입력에 없는 문제행동·발달지연·감정·가정환경을 만들지 않는다.
//       단일 사건을 반복 성향처럼 과장하지 않는다('최근 ~한 모습' 수준으로 서술).
//       아이를 부정적으로 단정하지 않고, 성장 가능성과 지원 방향을 함께 적는다.
//       아이의 실제 발화는 원문 그대로 보존한다.
import { extractEvaluationElements } from './evaluationComposer';

function hasBatchim(word) {
  const s = String(word || '');
  if (!s) return false;
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
const eul = (w) => `${w}${hasBatchim(w) ? '을' : '를'}`;
const neun = (w) => `${w}${hasBatchim(w) ? '은' : '는'}`;

const OBSERVED_BY_AREA = {
  '신체운동·건강': '몸을 다양하게 움직이며 조절하는 모습',
  예술경험: '재료를 탐색하며 자신의 방식으로 표현하는 모습',
  자연탐구: '주변을 관찰하고 궁금한 점을 탐색하는 모습',
  의사소통: '자신의 생각을 말과 행동으로 표현하는 모습',
  사회관계: '또래와 어울리며 생각을 나누는 모습',
};
const GROWTH_TRY_BY_AREA = {
  '신체운동·건강': '새로운 동작에 도전하는',
  예술경험: '다양한 표현을 시도하는',
  자연탐구: '관찰과 탐색을 넓혀 가는',
  의사소통: '표현을 확장해 가는',
  사회관계: '또래와 조율하는 경험을 넓혀 가는',
};
const SUPPORT_DIRECTION_BY_AREA = {
  '신체운동·건강': '다양한 신체 활동 기회',
  예술경험: '풍부한 표현 재료와 기회',
  자연탐구: '탐구를 이어 갈 환경',
  의사소통: '언어와 상호작용 기회',
  사회관계: '또래와 어울릴 다양한 기회',
};
const HOME_LINK_BY_AREA = {
  '신체운동·건강': '몸을 움직이는 놀이',
  예술경험: '자유롭게 표현하는 시간',
  자연탐구: '자연을 함께 관찰하는 경험',
  의사소통: '책을 매개로 한 대화',
  사회관계: '또래와 어울릴 기회',
};

function materialPhrase(el) {
  if (el.materials.length >= 2) return `${el.materials[0]}와 ${el.materials[1]}`;
  if (el.materials.length === 1) return el.materials[0];
  return el.activity || '놀이';
}
function context(el) {
  return el.activity || materialPhrase(el);
}
function nameOf(el) {
  const n = String(el.childName || '').trim();
  return n || '유아';
}
function speechClause(el) {
  return el.speeches[0] ? ` 놀이 과정에서 "${el.speeches[0]}"라고 표현하기도 하였습니다.` : '';
}

// ── 상담자료 ──────────────────────────────────────────────────────
export function composeCounseling({ childName, input, categories, curriculum } = {}) {
  const el = extractEvaluationElements({ childName, input, categories });
  el.childName = childName;
  const name = nameOf(el);
  const supportNoun = el.teacherSupport ? el.teacherSupport.noun : '안내와 격려';
  const home = HOME_LINK_BY_AREA[el.curriculumArea] || '꾸준한 관심과 격려';

  let body;
  if (el.difficulty) {
    const d = el.difficulty;
    body = [
      `${neun(name)} 최근 ${context(el)}에서 ${eul(d.look)} 보였습니다.`,
      `교사의 안내를 통해 ${eul(d.changed)} 하였으며, 앞으로도 ${eul(d.direction)} 지속적으로 제공할 예정입니다.`,
      '가정에서도 아이의 속도를 존중하며 함께 기다려 주시면 좋겠습니다.',
    ].join(' ');
  } else {
    const observed = OBSERVED_BY_AREA[el.curriculumArea] || '관심 있게 참여하는 모습';
    const grow = GROWTH_TRY_BY_AREA[el.curriculumArea] || '경험을 넓혀 가는';
    body = [
      `${neun(name)} 최근 ${context(el)}에서 ${eul(observed)} 보이고 있습니다.${speechClause(el)}`,
      `교사의 ${supportNoun} 속에서 ${grow} 경험이 이루어지고 있으며, 가정에서도 ${eul(home)} 함께 도와주시면 좋겠습니다.`,
    ].join(' ');
  }

  if (curriculum?.item && !body.includes(curriculum.item)) {
    const item = String(curriculum.item).replace(/[.。]\s*$/, '');
    body += ` 원에서는 '${item}'과 관련한 경험을 함께 지원하고 있습니다.`;
  }
  return body.replace(/\s+/g, ' ').trim();
}

// ── 발달평가 ──────────────────────────────────────────────────────
export function composeDevelopment({ childName, input, categories, curriculum } = {}) {
  const el = extractEvaluationElements({ childName, input, categories });
  el.childName = childName;
  const name = nameOf(el);
  const supportNoun = el.teacherSupport ? el.teacherSupport.noun : '안내와 지원';
  const dir = SUPPORT_DIRECTION_BY_AREA[el.curriculumArea] || '다양한 경험 기회';

  let body;
  if (el.difficulty) {
    const d = el.difficulty;
    body = [
      `${el.curriculumArea} 영역 측면에서 ${eul(d.look)} 살펴볼 수 있었으며, ${context(el)} 속에서 아이의 시도와 반응을 확인할 수 있었습니다.`,
      `이후에도 ${eul(d.direction)} 통해 발달 경험을 확장해 갈 수 있도록 돕겠습니다.`,
    ].join(' ');
  } else {
    const observed = OBSERVED_BY_AREA[el.curriculumArea] || '관심 있게 참여하는 모습';
    const grow = GROWTH_TRY_BY_AREA[el.curriculumArea] || '경험을 넓혀 가는';
    body = [
      `${neun(name)} ${context(el)}에서 ${eul(observed)} 보이며 ${el.curriculumArea} 영역과 관련된 발달 경험을 하고 있습니다.`,
      `교사의 ${supportNoun} 속에서 ${grow} 모습이 나타나며, 앞으로 ${eul(dir)} 제공할 필요가 있습니다.`,
    ].join(' ');
  }

  if (curriculum?.item && !body.includes(curriculum.item)) {
    const item = String(curriculum.item).replace(/[.。]\s*$/, '');
    body += ` 이는 ${curriculum.source || '표준보육과정'}의 '${item}' 발달 경험과 연결됩니다.`;
  }
  return body.replace(/\s+/g, ' ').trim();
}
