// 알림장/부모 전달(notice/parentMessage) 전용 문장 조립기.
// 입력 핵심 요소(extractEvaluationElements)를 부모 친화 문체(습니다/주세요)로 풀어낸다.
//
// 원칙: 외부 API/서버 없음. 입력에 없는 긍정 변화·감정을 만들지 않는다.
//       아이의 실제 발화는 원문 그대로 보존한다. 부정 사실은 없애지 말고 부드럽게 전달한다.
//       교사 지원 후 변화는 입력에 변화/반응이 있을 때만 작성한다.
import { extractEvaluationElements } from './evaluationComposer';

function hasBatchim(word) {
  const s = String(word || '');
  if (!s) return false;
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
function nameSubject(name) {
  const n = String(name || '').trim();
  if (!n) return '오늘 아이는';
  return `오늘 ${n}${hasBatchim(n) ? '이는' : '는'}`;
}

const CORE_ACTION_BY_AREA = {
  '신체운동·건강': '몸을 움직이며',
  예술경험: '자유롭게 표현하며',
  자연탐구: '관심 있게 살펴보며',
  의사소통: '생각을 말로 표현하며',
  사회관계: '친구와 어울리며',
};
const HOME_LINK_BY_AREA = {
  '신체운동·건강': '가정에서도 몸을 움직이는 놀이를 함께 즐겨 주세요.',
  예술경험: '가정에서도 자유롭게 표현하는 시간을 가져 주세요.',
  자연탐구: '가정에서도 산책하며 주변을 함께 살펴봐 주세요.',
  의사소통: '가정에서도 그림책을 함께 읽으며 이야기 나눠 주세요.',
  사회관계: '가정에서도 친구와 어울린 이야기를 함께 나눠 주세요.',
};

function materialPhrase(el) {
  if (el.materials.length >= 2) return `${el.materials[0]}와 ${el.materials[1]}`;
  if (el.materials.length === 1) return el.materials[0];
  return el.activity || '오늘의 놀이';
}
function homeLink(el) {
  return HOME_LINK_BY_AREA[el.curriculumArea] || '가정에서도 오늘의 경험을 함께 이야기 나눠 주세요.';
}
function speechClause(el) {
  return el.speeches[0] ? `"${el.speeches[0]}"라고 말하며 ` : '';
}
// 입력에 변화/반응이 있고 교사 지원이 있을 때만 '변화' 패턴을 쓴다(긍정 변화 날조 방지).
function hasGenuineChange(el) {
  return Boolean(el.teacherSupport) && (el.childResponse || /(다시|시도|완성|해냈|성공|점차|이어|바꾸)/.test(el.parsed?.rawText || ''));
}

// 패턴 A — 긍정적 놀이 참여
function patternPositive(el) {
  const mat = materialPhrase(el);
  const core = el.isSafetyEducation ? '안전 약속을 알아보며' : (CORE_ACTION_BY_AREA[el.curriculumArea] || '관심 있게 참여하며');
  const interaction = el.peerCollaboration ? '친구와 함께' : (el.teacherSupport ? '교사와 함께' : '활동에 몰입하며');
  return [
    `${nameSubject(el.childName)} ${mat}에 관심을 보이며 ${speechClause(el)}${core} 참여하는 모습을 보였습니다.`,
    `${interaction} 즐겁게 경험을 이어 갔습니다.`,
    homeLink(el),
  ].join(' ');
}

// 패턴 B — 교사 지원 후 변화 (입력에 변화가 있을 때만)
function patternChange(el) {
  const mat = materialPhrase(el);
  return [
    `${nameSubject(el.childName)} ${mat} 활동에서 처음에는 도움이 필요한 모습이 있었습니다.`,
    `교사의 안내를 통해 ${speechClause(el)}새롭게 시도해 보는 경험을 하였고, 조금씩 스스로 해 보는 모습을 보였습니다.`,
    homeLink(el),
  ].join(' ');
}

// 패턴 C — 소극적 참여/거부/감정 (사실을 부드럽게 전달)
function patternGentle(el) {
  const mat = materialPhrase(el);
  const type = el.difficulty?.type;
  let firstLine;
  if (type === 'emotion') {
    firstLine = `${nameSubject(el.childName)} ${mat} 과정에서 속상한 마음을 표현하는 모습이 있었습니다.`;
  } else {
    firstLine = `${nameSubject(el.childName)} ${mat}에 바로 참여하기보다 주변을 천천히 살펴보는 모습이 있었습니다.`;
  }
  const name = String(el.childName || '아이').trim();
  return [
    firstLine,
    '교사의 안내와 격려 속에서 상황을 천천히 경험하며, 편안하게 참여할 수 있도록 곁에서 도왔습니다.',
    `가정에서도 ${name}의 속도를 존중하며 함께 기다려 주세요.`,
  ].join(' ');
}

// 패턴 D — 또래 갈등/조율
function patternPeerConflict(el) {
  return [
    `${nameSubject(el.childName)} 친구와 놀이하는 과정에서 서로의 생각을 강하게 표현하며 조율해 보는 경험을 하였습니다.`,
    `교사의 도움을 받아 ${speechClause(el)}친구의 표현을 듣고 상황에 맞는 말과 행동을 시도해 보았습니다.`,
    '가정에서도 차례와 양보에 대해 함께 이야기 나눠 주세요.',
  ].join(' ');
}

export function composeNotice({ childName, input, categories, curriculum } = {}) {
  const el = extractEvaluationElements({ childName, input, categories });
  el.childName = childName;

  let body;
  if (el.difficulty?.type === 'conflict') body = patternPeerConflict(el);
  else if (el.difficulty) body = patternGentle(el);
  else if (hasGenuineChange(el)) body = patternChange(el);
  else body = patternPositive(el);

  if (curriculum?.item && !body.includes(curriculum.item)) {
    const item = String(curriculum.item).replace(/[.。]\s*$/, '');
    body += ` 오늘의 경험은 「${item}」 내용과도 이어집니다.`;
  }
  return body.replace(/\s+/g, ' ').trim();
}

export default composeNotice;
