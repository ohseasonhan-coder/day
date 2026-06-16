// 보육일지 평가(evaluation/dailyReport) 전용 문장 조립기.
// 입력 메모에서 핵심 소재·활동·또래·교사 지원·변화·감정·어려움을 추출하여
// 사실을 보존한 평가 문장을 패턴 A/B/C/D로 생성한다.
//
// 원칙: 외부 API/서버 없음. 입력에 없는 사실을 만들지 않는다.
//       아이의 실제 발화는 원문 그대로 보존한다. 부정 사실은 부드럽게 인정한다.
//       내부 라벨("놀이 흐름:" 등)은 최종 출력에 남기지 않는다.
import { parseInput } from '../inputParser';

// ── 한글 조사 헬퍼 ────────────────────────────────────────────────
function hasBatchim(word) {
  const s = String(word || '');
  if (!s) return false;
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
const eul = (w) => `${w}${hasBatchim(w) ? '을' : '를'}`;
const gwa = (w) => `${w}${hasBatchim(w) ? '과' : '와'}`;

// ── 입력에서 핵심 요소 추출용 사전 ────────────────────────────────
// 긴 표현을 먼저 두어 '인라인스케이트'가 '스케이트'보다 우선 매칭되게 한다.
const ACTIVITY_TERMS = [
  '실내자유놀이', '자유놀이', '바깥놀이', '쌓기놀이', '역할놀이', '병원놀이', '모래놀이', '물놀이',
  '소방대피훈련', '대피훈련', '교통안전교육', '안전교육', '책 읽기', '음률 활동', '음률',
  '미술 활동', '미술', '게임 활동', '게임', '산책', '간식', '점심', '낮잠', '정리정돈', '정리',
];
const SAFETY_ACTIVITIES = ['소방대피훈련', '대피훈련', '교통안전교육', '안전교육'];
const PLAY_MATERIALS = [
  '인라인스케이트', '스케이트', '평균대', '무당벌레', '돋보기', '청진기', '주사위', '그림책',
  '블록', '팽이', '물감', '크레파스', '점토', '나뭇잎', '개미', '자동차', '가위', '종이',
  '악기', '구슬', '집게', '텐트', '그릇', '모래', '그리기', '그림', '책', '공',
];
const SAFETY_TERMS = ['비상벨', '소방대피', '대피', '횡단보도', '안전 공간', '안전'];

const DIFFICULTY_TYPES = [
  { type: 'refuse', re: /(거부|거절|싫|안 하|안하|하지 않|참여하지|안 할래|권했지만|권했으나)/, look: '활동 참여가 아직 편안하지 않은 모습', changed: '상황을 살펴보고 참여를 시도하는 경험', direction: '아이의 속도를 존중하며 편안하게 참여하도록 돕는 지원' },
  { type: 'conflict', re: /(싸웠|싸움|빼앗|잡아당|밀어|밀었|내 거|서로 가지|다투)/, look: '또래와 의견을 조율하는 데 시간이 필요한 모습', changed: '상대의 표현을 듣고 조정해 보는 경험', direction: '또래와 마음을 나누고 조율하는 경험에 대한 지원' },
  { type: 'passive', re: /(지켜보기만|멀리서|소극|머뭇|다가가지|혼자서만)/, look: '놀이에 다가가는 데 시간이 필요한 모습', changed: '놀이에 다가가 함께해 보는 경험', direction: '편안하게 참여하도록 곁에서 돕는 지원' },
  { type: 'emotion', re: /(울었|울먹|눈물|속상|떼를|울음)/, look: '속상한 마음을 표현하는 모습', changed: '마음을 가라앉히고 안정을 찾는 경험', direction: '감정을 말로 표현하도록 돕는 지원' },
];

const SUPPORT_ACTIONS = [
  { key: '중재', noun: '중재', verb: '마음을 들어 주고 중재하는' },
  { key: '읽어', noun: '공감', verb: '마음을 읽어 주는' },
  { key: '토닥', noun: '정서적 지지', verb: '정서적으로 지지하는' },
  { key: '제안', noun: '제안', verb: '함께 방법을 제안하는' },
  { key: '안내', noun: '안내', verb: '안내하는' },
  { key: '권유', noun: '권유', verb: '권유하는' },
  { key: '권했', noun: '권유', verb: '권유하는' },
  { key: '격려', noun: '격려', verb: '격려하는' },
  { key: '잡아', noun: '지지', verb: '곁에서 지지하는' },
  { key: '도와', noun: '도움', verb: '도움을 주는' },
  { key: '도움', noun: '도움', verb: '도움을 주는' },
  { key: '지원', noun: '지원', verb: '지원하는' },
];

const AREA_BY_CATEGORY = {
  사회관계: '사회관계', 의사소통: '의사소통', 예술경험: '예술경험', 자연탐구: '자연탐구',
  '신체운동·건강': '신체운동·건강', 신체운동: '신체운동·건강', 기본생활습관: '신체운동·건강',
  안전: '신체운동·건강', 놀이: '사회관계',
};
// 소재가 영역을 강하게 지시하는 경우(분류기 오류보다 우선)
const STRONG_MATERIAL_AREA = [
  { re: /(개미|무당벌레|나뭇잎|돋보기|모래|물감놀이)/, area: '자연탐구' },
  { re: /(물감|크레파스|점토|그리기|그림|악기)/, area: '예술경험' },
  { re: /(평균대|인라인스케이트|스케이트)/, area: '신체운동·건강' },
  { re: /(그림책|청진기|병원놀이)/, area: '의사소통' },
];
const AREA_BY_MATERIAL = [
  { re: /(물감|크레파스|점토|그리기|그림|악기|음률)/, area: '예술경험' },
  { re: /(개미|무당벌레|나뭇잎|돋보기|모래|물놀이|관찰|탐색|숫자|세었|세며)/, area: '자연탐구' },
  { re: /(평균대|스케이트|공|달리|뛰|균형|체조|손 씻|배변|낮잠)/, area: '신체운동·건강' },
  { re: /(그림책|책 읽기|이야기|질문)/, area: '의사소통' },
  { re: /(역할놀이|병원놀이|친구|또래|차례|양보|규칙)/, area: '사회관계' },
];
const ACTION_BY_AREA = {
  '신체운동·건강': '몸을 움직이며 조절', 예술경험: '재료를 탐색하고 표현', 자연탐구: '관찰하고 탐색',
  의사소통: '생각을 말로 표현', 사회관계: '또래와 어울리며 놀이',
};

// ── 추출 헬퍼 ─────────────────────────────────────────────────────
function findFirst(text, terms) {
  for (const term of terms) if (text.includes(term)) return term;
  return '';
}
function collectMaterials(text) {
  const found = [];
  for (const m of PLAY_MATERIALS) {
    if (text.includes(m) && !found.some((f) => f.includes(m) || m.includes(f))) found.push(m);
    if (found.length >= 2) break;
  }
  return found;
}
function resolveArea(text, categories) {
  // 1) 소재가 영역을 강하게 지시하면 분류기보다 우선한다.
  for (const { re, area } of STRONG_MATERIAL_AREA) if (re.test(text)) return area;
  // 2) 분류기 카테고리
  for (const c of categories || []) if (AREA_BY_CATEGORY[c]) return AREA_BY_CATEGORY[c];
  // 3) 일반 소재/맥락 기반
  for (const { re, area } of AREA_BY_MATERIAL) if (re.test(text)) return area;
  return '사회관계';
}
function resolveSupport(text) {
  for (const s of SUPPORT_ACTIONS) if (text.includes(s.key)) return s;
  return null;
}
function resolveDifficulty(text) {
  for (const d of DIFFICULTY_TYPES) if (d.re.test(text)) return d;
  return null;
}
function safetyActionPhrase(text) {
  if (/(대피|연기|낮은 자세)/.test(text)) return '낮은 자세로 안전하게 대피하는 방법';
  if (/(줄|손을 잡|손잡|이동)/.test(text)) return '질서를 지켜 이동하는 방법';
  if (/(횡단보도|멈춰|멈추|좌우)/.test(text)) return '멈추고 좌우를 살피는 방법';
  return '상황에 맞게 안전하게 행동하는 방법';
}

// 요구된 명명 필드로 핵심 요소를 노출한다.
export function extractEvaluationElements({ childName, input, categories } = {}) {
  const text = String(input || '');
  const parsed = parseInput({ childName, rawText: text });
  const activity = findFirst(text, ACTIVITY_TERMS);
  const materials = collectMaterials(text);
  const safetyTerm = findFirst(text, SAFETY_TERMS);
  const isSafetyEducation = SAFETY_ACTIVITIES.includes(activity) || /(소방대피|대피훈련|안전교육|교통안전)/.test(text);
  const peerInteraction = parsed.peerInteraction.length > 0 || /(친구|또래|함께|같이)/.test(text);
  // 단순 또래 '언급'과 실제 '협력'을 구분한다(끝에 소개·인사만 한 경우는 협력이 아님).
  const peerCollaboration = /(함께|같이|협력|나눠|나누어|번갈아|역할을 나|서로)/.test(text);
  const teacherSupport = resolveSupport(text);
  const difficulty = resolveDifficulty(text);
  const childResponse = parsed.changes[0] || '';
  const emotion = parsed.emotions[0] || '';
  // 안전교육은 신체운동·건강(안전), 정서·또래 어려움은 사회관계 영역으로 본다.
  let curriculumArea;
  if (isSafetyEducation) curriculumArea = '신체운동·건강';
  else if (difficulty) curriculumArea = '사회관계';
  else curriculumArea = resolveArea(text, categories);
  return {
    parsed,
    activity,
    materials,
    peerInteraction,
    peerCollaboration,
    teacherSupport,
    childResponse,
    safetySupport: safetyTerm || (isSafetyEducation ? '안전 약속' : ''),
    isSafetyEducation,
    emotion,
    difficulty,
    curriculumArea,
    speeches: parsed.actualSpeech,
  };
}

function materialPhrase(materials, fallbackActivity) {
  if (materials.length >= 2) return `${gwa(materials[0])} ${materials[1]}`;
  if (materials.length === 1) return materials[0];
  return fallbackActivity || '다양한 놀잇감';
}

// ── 패턴 조립 (내부 라벨 없이 자연스러운 문단) ────────────────────
// 패턴 A — 일반 놀이 확장
function patternPlayExpansion(el) {
  const mat = materialPhrase(el.materials, el.activity);
  const action = ACTION_BY_AREA[el.curriculumArea] || '탐색';
  const expandTarget = el.safetySupport ? '안전한 놀이 환경' : el.peerInteraction ? '또래와의 상호작용' : '놀이의 확장';
  const supportVerb = el.teacherSupport ? el.teacherSupport.verb : '자료와 공간을 마련해 주는';
  const ctx = el.activity ? `${el.activity} 시간에 ` : '';
  return [
    `${ctx}유아들은 ${eul(mat)} 활용하여 ${action}하며 놀이에 참여하였다.`,
    `교사는 ${supportVerb} 지원을 통해 ${eul(expandTarget)} 도왔으며, 이는 ${el.curriculumArea} 영역의 발달 경험과 연결된다.`,
  ].join(' ');
}

// 패턴 B — 또래 상호작용
function patternPeerInteraction(el) {
  const mat = materialPhrase(el.materials, el.activity);
  const ctx = el.activity || '놀이 상황';
  const interaction = el.materials.length
    ? `${eul(mat)} 함께 사용하며 생각을 나누는 상호작용`
    : '서로의 생각을 나누고 역할을 조율하는 상호작용';
  const supportVerb = el.teacherSupport ? el.teacherSupport.verb : '곁에서 함께하며 지지하는';
  return [
    `${ctx}에서 유아들은 또래의 놀이에 관심을 보이며 ${eul(interaction)} 경험하였다.`,
    `이 과정에서 ${el.curriculumArea} 영역과 관련된 경험이 이루어졌고, 교사는 ${supportVerb} 지원을 제공하였다.`,
  ].join(' ');
}

// 패턴 C — 어려움/소극적 참여 (부드러운 사실 인정)
function patternDifficulty(el) {
  const d = el.difficulty;
  const ctxBase = el.activity || (el.materials[0] && `${el.materials[0]} 활동`) || '놀이';
  const supportNoun = el.teacherSupport ? el.teacherSupport.noun : '안내';
  return [
    `${ctxBase}에서 ${d.look}이 관찰되었으나, 교사의 ${eul(supportNoun)} 통해 유아가 ${eul(d.changed)} 하였다.`,
    `이후에도 유아가 안정적으로 참여할 수 있도록 ${eul(d.direction)} 지속적으로 제공할 필요가 있다.`,
  ].join(' ');
}

// 패턴 D — 안전교육
function patternSafetyEducation(el) {
  const topic = el.activity || el.safetySupport || '안전 약속';
  const practice = safetyActionPhrase(el.parsed?.rawText || '');
  const supportVerb = el.teacherSupport ? el.teacherSupport.verb : '안내하는';
  // 비상벨·횡단보도 등 구체적 안전 소재가 있으면 보존한다.
  const concrete = el.safetySupport && !['안전', '안전 약속'].includes(el.safetySupport) ? el.safetySupport : '';
  const learnClause = concrete ? `${concrete}의 쓰임과 안전 약속을 알아보고` : '안전 약속을 알아보고';
  return [
    `유아들은 ${eul(topic)} 통해 ${learnClause}, ${practice}을 직접 경험하였다.`,
    `교사는 ${supportVerb} 지원을 통해 유아가 상황에 맞는 안전 행동을 익힐 수 있도록 도왔으며, 이는 ${el.curriculumArea} 영역의 경험과 연결된다.`,
  ].join(' ');
}

// ── 메인 ──────────────────────────────────────────────────────────
export function composeEvaluation({ childName, input, categories, curriculum } = {}) {
  const el = extractEvaluationElements({ childName, input, categories });
  let body;
  if (el.difficulty) body = patternDifficulty(el);
  else if (el.isSafetyEducation) body = patternSafetyEducation(el);
  else if (el.peerCollaboration) body = patternPeerInteraction(el);
  else body = patternPlayExpansion(el);

  if (curriculum?.item && !body.includes(curriculum.item)) {
    const item = String(curriculum.item).replace(/[.。]\s*$/, '');
    body += ` 이는 ${curriculum.source || '표준보육과정'}의 '${item}' 내용과 연결지어 볼 수 있다.`;
  }
  return body.replace(/\s+/g, ' ').trim();
}

export default composeEvaluation;
