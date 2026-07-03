// 사실 카드 추출·정규화(5단계) — LLM에는 원문 자유 전달 대신 이 카드만 넘긴다.
// 규칙 엔진(정규식)만 사용, 외부 호출 없음. 추정 금지 요소를 함께 산출해 프롬프트에서 강제한다.
import { readLearningSignal } from '../copyReadyObservation';

const clean = (s) => String(s || '').trim();
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);

// 놀이 재료·상황 사전(관찰 메모에서 실제 등장한 것만 담는다)
const MATERIALS = ['블록', '크레파스', '색종이', '물감', '한지', '점토', '이불', '콩주머니', '훌라후프',
  '돋보기', '낙엽', '씨앗', '그림책', '악기', '미끄럼틀', '계단', '평균대', '공', '바구니', '스티커',
  '도화지', '비누', '가위', '풀', '모래', '물', '자동차', '인형', '퍼즐', '숟가락', '컵', '가방', '신발'];

const EMOTION_WORDS = /(기뻐|슬퍼|화나|무서워|속상|즐거워|신나|뿌듯|아쉬워|놀라|웃으|울)/;

// 신호 → 다음 놀이 가능성 힌트(관찰된 흐름의 연장선만 — 새 사실 아님)
const NEXT_HINT = {
  persist: '비슷한 도전을 이어 갈 수 있는 재료 확장',
  challenge: '스스로 고를 수 있는 선택지와 충분한 탐색 시간',
  recover: '편안하게 머무를 수 있는 놀이 환경',
  share: '역할을 나누거나 생각을 주고받는 놀이 기회',
  roleplay: '역할·소품을 넓힐 수 있는 상상놀이 확장',
  rules: '순서와 규칙을 자연스럽게 경험하는 놀이',
  sort: '비교·분류를 이어 갈 수 있는 자료',
  change: '변화를 확인해 볼 수 있는 재료',
  explore: '관찰을 이어 갈 도구와 자료',
  selfhelp: '스스로 해 보는 시간을 기다리는 지원',
  hygiene: '스스로 해 보는 시간을 기다리는 지원',
  meal: '스스로 시도할 기회 유지',
  move: '난이도를 조절한 신체 놀이',
  aim: '난이도를 조절한 조준 놀이',
  make: '재료 선택권을 넓힌 만들기',
  craft: '재료 선택권을 넓힌 구성 놀이',
  express: '생각을 표현할 대화·기록 기회',
};

// 반환: { name, actions[], speeches[], materials[], peers[], teacherSupport|null,
//         nextPossibility|null, forbidden[], styleRules[] }
export function extractFactCard({ input = '', childName = '' } = {}) {
  const src = clean(input);
  const nameMatch = src.match(/^([가-힣A-Z]{1,4}(?:원아)?)(?:이가|가|는|은)/);
  const name = clean(childName) || (nameMatch ? nameMatch[1] : '유아');
  const speeches = quotesOf(src);
  // 행동: 발화를 자리표시자로 치환한 사실 문장(원문 서술을 정규화 — 새 해석 없음)
  const actions = src.replace(/"[^"]*"(라며|라고|하며|이라고)?\s*/g, '').split(/(?<=[.!?])\s+/)
    .map((s) => clean(s)).filter(Boolean).slice(0, 3);
  const materials = MATERIALS.filter((m) => src.includes(m));
  const peers = /(친구|또래)/.test(src) ? [(src.match(/[^.]*(친구|또래)[^.]*/) || ['또래 상호작용'])[0].trim()] : [];
  const supMatch = src.match(/(교사|선생님)[^."]{0,30}/);
  const teacherSupport = supMatch ? clean(supMatch[0]) : null;
  const signal = readLearningSignal(src);
  const nextPossibility = signal ? (NEXT_HINT[signal.key] || null) : null;

  const forbidden = ['감정·의도·발달 수준 추정 금지', '진단·평가·낙인·과장 금지', '입력에 없는 행동·발화 창작 금지'];
  if (peers.length === 0) forbidden.push('또래·친구 상호작용 언급 금지(입력에 없음)');
  if (!teacherSupport) forbidden.push('교사 지원을 이미 제공한 것처럼 과거형으로 쓰지 말 것(다음 계획으로만)');
  if (!EMOTION_WORDS.test(src)) forbidden.push('감정 상태 서술 금지(입력에 감정 표현 없음)');

  const styleRules = [
    '교사가 바로 복사·붙여넣기 가능한 완결된 문장(종결부호 포함)으로 쓸 것',
    `배움 읽기는 반드시 "${name}"의 이름으로 시작하고 관찰 행동에 근거해 해석할 것`,
    '관찰내용을 그대로 반복하지 말 것',
    '금지 표현: "유아들은", "활용하여", "놀이에 참여하였다", "발달 경험과 연결된다", "영역과 연결지어"',
    '교사 지원 및 다음 계획은 현재형 계획 문체(~한다/~돕는다)로 끝맺을 것',
    '각 항목은 1~2문장, 전체 220자 이내',
  ];

  return { name, actions, speeches, materials, peers, teacherSupport, nextPossibility, forbidden, styleRules };
}

export default extractFactCard;
