// LLM 프롬프트 빌더(5단계) — 사실 카드만 입력으로 사용하고, JSON 구조 출력만 허용한다.
// 원문 관찰기록 전체를 자유 텍스트로 넘기지 않는다(사실 카드 필드만 직렬화).

// LLM 출력 JSON 스키마 — 이 두 필드 외에는 허용하지 않는다.
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    learningReading: { type: 'string', description: '배움 읽기 1~2문장' },
    supportAndNextPlan: { type: 'string', description: '교사 지원 및 다음 계획 1~2문장(현재형 계획 문체)' },
  },
  required: ['learningReading', 'supportAndNextPlan'],
  additionalProperties: false,
};

const SYSTEM = [
  '너는 한국 어린이집·유치원 관찰일지의 "배움 읽기"와 "교사 지원 및 다음 계획"을 쓰는 보조 작가다.',
  '입력으로는 사실 카드만 주어진다. 사실 카드에 없는 행동·발화·감정·또래 반응·교사 지원을 절대 추가하지 마라.',
  '진단·평가·낙인·과장 표현을 쓰지 마라. 아이를 존중하는 따뜻하고 전문적인 문체를 유지하라.',
  '다음 표현은 금지: "유아들은", "활용하여", "놀이에 참여하였다", "발달 경험과 연결된다", "영역과 연결지어".',
  '교사 지원이 사실 카드에 없으면 이미 했다고 쓰지 말고 "다음 계획"으로만 표현하라.',
  '출력은 반드시 JSON 하나만: {"learningReading": "...", "supportAndNextPlan": "..."} — 설명·머리말·코드블록 금지.',
].join('\n');

function line(label, v) {
  if (v == null) return `${label}: (없음)`;
  if (Array.isArray(v)) return `${label}: ${v.length ? v.join(' | ') : '(없음)'}`;
  return `${label}: ${v}`;
}

// 사실 카드 → chat messages ([{role,content},...])
export function buildMessages(factCard = {}) {
  const user = [
    '아래 사실 카드만 근거로 관찰일지의 두 항목을 작성하라.',
    '',
    line('원아 표시 이름', factCard.name),
    line('실제 행동(사실)', factCard.actions),
    line('직접 발화(글자 그대로 보존 대상)', factCard.speeches),
    line('놀이 재료·상황', factCard.materials),
    line('또래 상호작용', factCard.peers),
    line('실제 교사 지원', factCard.teacherSupport),
    line('다음 놀이 가능성(참고)', factCard.nextPossibility),
    '',
    '추정 금지 요소:',
    ...(factCard.forbidden || []).map((f) => `- ${f}`),
    '',
    '작성 규칙:',
    ...(factCard.styleRules || []).map((r) => `- ${r}`),
    '',
    'JSON만 출력:',
  ].join('\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}

export default buildMessages;
