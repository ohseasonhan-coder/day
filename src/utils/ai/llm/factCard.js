// 사실 카드 추출·정규화(6단계 확장) — 생성 파이프라인과 LLM 어댑터가 공유하는 "사실의 단일 원천".
// 규칙(정규식)만 사용, 외부 호출 없음. 입력에 근거가 없으면 빈 값으로 둔다(추정 금지).
//
// 3분리 원칙:
//   observedFacts  — 실제로 관찰된 사실(행동·발화·재료·장소·시간·또래·실지원)
//   safeMeanings   — 규칙으로 안전하게 읽을 수 있는 의미(테마 라벨)
//   forbidden      — 절대 추정하면 안 되는 내용(입력 부재 기반 자동 산출)
import { readSignalCompat } from '../planner/situationJudge';

const clean = (s) => String(s || '').trim();
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);

// 놀이 재료·상황 사전(관찰 메모에서 실제 등장한 것만 담는다)
const MATERIALS = ['블록', '크레파스', '색종이', '물감', '한지', '점토', '이불', '콩주머니', '훌라후프',
  '돋보기', '낙엽', '씨앗', '그림책', '악기', '미끄럼틀', '계단', '평균대', '공', '바구니', '스티커',
  '도화지', '비누', '가위', '풀', '모래', '물', '자동차', '인형', '퍼즐', '숟가락', '컵', '가방', '신발'];
const PLACES = ['쌓기 영역', '역할 영역', '미술 영역', '바깥놀이터', '놀이터', '교실', '화장실', '식당', '마당', '텃밭', '모래놀이터', '낮잠', '급식', '간식'];
const DAILY = ['낮잠', '급식', '간식', '식사', '정리', '등원', '하원', '손 씻기', '양치'];

const EMOTION_WORDS = /(기뻐|슬퍼|화나|무서워|속상|즐거워|신나|뿌듯|아쉬워|놀라|웃으|울)/;
const RECOVERY_WORDS = /(안정을 찾|진정|괜찮아|(곧|이내|다시)[^.]{0,10}집중)/;
const TIME_FLOW = /(먼저|그 뒤|그리고 나서|다음에|이후|~하자|하다가|한참|잠시 후|끝난 뒤)/;

// 신호 → 다음 놀이 가능성 힌트(관찰된 흐름의 연장선만 — 새 사실 아님)
const NEXT_HINT = {
  persist: '비슷한 도전을 이어 갈 수 있는 재료 확장',
  challenge: '스스로 고를 수 있는 선택지와 충분한 탐색 시간',
  recover: '편안하게 머무를 수 있는 놀이 환경',
  conflict: '마음을 말로 정리하고 놀이를 다시 시작할 기회',
  share: '역할을 나누거나 생각을 주고받는 놀이 기회',
  roleplay: '역할·소품을 넓힐 수 있는 상상놀이 확장',
  rules: '순서와 규칙을 자연스럽게 경험하는 놀이',
  sort: '비교·분류를 이어 갈 수 있는 자료',
  change: '변화를 확인해 볼 수 있는 재료',
  question: '질문을 놀이로 되돌려 줄 자료',
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

// 반환: 기존 필드 + 6단계 확장 필드(전부 하위 호환)
export function extractFactCard({ input = '', childName = '' } = {}) {
  const src = clean(input);
  const nameMatch = src.match(/^([가-힣A-Z]{1,4}(?:원아)?)(?:이가|가|는|은)/);
  const name = clean(childName) || (nameMatch ? nameMatch[1] : '유아');
  const speeches = quotesOf(src);
  // 행동: 발화를 자리표시자로 치환한 사실 문장(원문 서술을 정규화 — 새 해석 없음)
  const actions = src.replace(/"[^"]*"(라며|라고|하며|이라고)?\s*/g, '').split(/(?<=[.!?])\s+/)
    .map((s) => clean(s)).filter(Boolean).slice(0, 3);
  const materials = MATERIALS.filter((m) => src.includes(m));
  const place = PLACES.find((p) => src.includes(p)) || '';
  const dailyLife = DAILY.filter((d) => src.includes(d));
  const timeFlow = TIME_FLOW.test(src);
  const peers = /(친구|또래)/.test(src) ? [(src.match(/[^.]*(친구|또래)[^.]*/) || ['또래 상호작용'])[0].trim()] : [];
  const supMatch = src.match(/(교사|선생님)[^."]{0,30}/);
  const teacherSupport = supMatch ? clean(supMatch[0]) : null;
  const emotionCues = EMOTION_WORDS.test(src) ? (src.match(EMOTION_WORDS) || []).slice(0, 1) : [];
  const recoveryCues = RECOVERY_WORDS.test(src) ? ['회복 단서 있음'] : [];
  const signal = readSignalCompat(src);
  const nextPossibility = signal ? (NEXT_HINT[signal.key] || null) : null;
  // 문장에 반드시 보존해야 하는 핵심(발화 전체 + 고유 재료명)
  const mustKeep = [...speeches, ...materials.slice(0, 2)];

  const forbidden = ['감정·의도·발달 수준 추정 금지', '진단·평가·낙인·과장 금지', '입력에 없는 행동·발화 창작 금지'];
  if (peers.length === 0) forbidden.push('또래·친구 상호작용 언급 금지(입력에 없음)');
  if (!teacherSupport) forbidden.push('교사 지원을 이미 제공한 것처럼 과거형으로 쓰지 말 것(다음 계획으로만)');
  if (emotionCues.length === 0) forbidden.push('감정 상태 서술 금지(입력에 감정 표현 없음)');
  if (emotionCues.length > 0 && recoveryCues.length === 0) forbidden.push('"안정을 찾았다" 등 회복 서술 금지(회복 단서 없음)');

  const styleRules = [
    '교사가 바로 복사·붙여넣기 가능한 완결된 문장(종결부호 포함)으로 쓸 것',
    `배움 읽기는 반드시 "${name}"의 이름으로 시작하고 관찰 행동에 근거해 해석할 것`,
    '관찰내용을 그대로 반복하지 말 것',
    '금지 표현: "유아들은", "활용하여", "놀이에 참여하였다", "발달 경험과 연결된다", "영역과 연결지어"',
    '교사 지원 및 다음 계획은 현재형 계획 문체(~한다/~돕는다)로 끝맺을 것',
    '각 항목은 1~2문장, 전체 220자 이내',
  ];

  return {
    // 기존 필드(하위 호환)
    name, actions, speeches, materials, peers, teacherSupport, nextPossibility, forbidden, styleRules,
    // 6단계 확장
    place, dailyLife, timeFlow, emotionCues, recoveryCues, mustKeep,
    observedFacts: { actions, speeches, materials, place, dailyLife, peers, teacherSupport, timeFlow },
    safeMeanings: signal ? [signal.label] : [],
  };
}

export default extractFactCard;
