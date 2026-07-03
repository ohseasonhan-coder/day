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
  '한국 보육 관찰일지의 배움 읽기와 다음 지원을 쓴다.',
  '카드에 없는 행동·말·감정·또래·교사 지원은 추가하지 않는다.',
  '진단·낙인·과장과 유아들은/활용하여/놀이에 참여하였다 표현은 금지한다.',
  '실제 교사 지원이 없으면 지원은 현재형 계획으로만 쓴다.',
  '한국어 한 문장씩 쓴다. 각 값은 반드시 20~45자이며 주어·행동 근거·의미를 포함한다.',
  '배움은 이름+관찰 근거+의미로, 지원은 "~할 수 있도록 ... 제공한다/돕는다" 계획형으로 끝낸다.',
  '배움 읽기에는 행동 문장을 그대로 복사하지 말고 행동에서 드러난 배움의 의미만 쓴다.',
  '지원은 매번 대화 기회만 쓰지 말고 카드의 행동·재료·다음가능성에 맞게 구체화한다.',
  '했습니다/하였다/얻었다/것입니다 문체는 쓰지 않는다.',
  'JSON만 출력한다: {"learningReading":"","supportAndNextPlan":""}',
].join('\n');

function line(label, v) {
  if (v == null) return `${label}: (없음)`;
  if (Array.isArray(v)) return `${label}: ${v.length ? v.join(' | ') : '(없음)'}`;
  return `${label}: ${v}`;
}

// 사실 카드 → chat messages ([{role,content},...])
export function buildMessages(factCard = {}) {
  const user = [
    line('이름', factCard.name),
    line('행동', factCard.actions),
    line('직접 발화', factCard.speeches),
    line('재료', factCard.materials),
    line('또래', factCard.peers),
    line('실제지원', factCard.teacherSupport),
    line('다음가능성', factCard.nextPossibility),
    (factCard.peers || []).length ? '' : '또래 언급 금지',
    factCard.teacherSupport ? '' : '지원 과거형 금지',
    '두 값 모두 비우지 말 것. 이름으로 시작. 관찰 반복 금지. 문장 끝에 마침표. JSON만.',
  ].filter(Boolean).join('\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}

export default buildMessages;
