const unique = (values) => [...new Set(values.filter(Boolean))];

export const B4_THEME_LANGUAGE = {
  retry: {
    claims: ['다시 시도함', '방법을 바꾸어 이어 감'],
    blocked: ['자신감 향상', '문제 해결 능력 향상'],
    learning: '방법을 바꾸어 시도를 이어 갔다',
    supportFocus: 'retry_flow',
    supports: [
      { id: 'retry_time', text: '다시 시도해 볼 시간을 충분히 두고, 필요한 경우 재료의 위치나 수량을 조정해 본다' },
      { id: 'retry_material_choice', text: '같은 놀이를 이어 갈 수 있도록 크기나 형태가 다른 재료를 가까이에 마련한다' },
    ],
  },
  make: {
    claims: ['재료를 다루어 형태를 구성함', '사용한 재료로 표현함'],
    blocked: ['창의성이 향상됨', '완성도가 높음'],
    learning: '재료를 다루어 형태를 구성해 보았다',
    supportFocus: 'material_construction',
    supports: [
      { id: 'make_materials', text: '현재 사용한 재료와 연결되는 다른 재료를 한두 가지 더 제안해 구성 흐름을 이어 본다' },
      { id: 'make_display', text: '만든 것을 놓아 볼 공간을 마련해 다음 구성으로 이어지게 한다' },
    ],
  },
  change_explore: {
    claims: ['대상의 변화나 특징을 살펴봄', '관찰을 이어 감'],
    blocked: ['탐구력이 뛰어남', '원리를 이해함'],
    learning: '대상의 특징과 변화를 살펴보았다',
    supportFocus: 'exploration_flow',
    supports: [
      { id: 'explore_compare', text: '관찰한 전후 모습이나 차이를 비교해 볼 수 있는 자료를 함께 놓아 본다' },
      { id: 'explore_tool', text: '탐색을 이어 갈 수 있도록 돋보기나 사진 자료를 가까이에 둔다' },
    ],
  },
  question: {
    claims: ['궁금한 점을 말로 표현함', '확인하고 싶은 내용을 질문함'],
    blocked: ['탐구 능력이 향상됨', '원인을 이해함'],
    learning: '궁금한 점을 말로 표현했다',
    supportFocus: 'question_flow',
    supports: [
      { id: 'question_record', text: '나온 질문을 짧게 되짚고 함께 확인해 볼 수 있는 자료를 연결한다' },
      { id: 'question_wait', text: '질문 뒤 바로 답을 주기보다 아이가 다시 살펴볼 시간을 둔다' },
    ],
  },
  language: {
    claims: ['경험이나 생각을 말로 표현함', '직접 발화로 내용을 전함'],
    blocked: ['언어 발달이 향상됨', '표현력이 우수함'],
    learning: '자신의 경험이나 생각을 말로 표현했다',
    supportFocus: 'language_flow',
    supports: [
      { id: 'language_echo', text: '아이가 말한 내용을 짧게 되짚어 다음 표현으로 이어질 시간을 둔다' },
      { id: 'language_record', text: '말한 내용을 그림이나 사진과 연결해 다시 표현해 볼 기회를 마련한다' },
    ],
  },
  peer_share: {
    claims: ['친구와 함께하거나 나눔', '차례와 역할을 주고받음'],
    blocked: ['사회성이 발달함', '배려심이 있음'],
    learning: '친구와 함께하는 흐름 안에서 차례와 역할을 경험했다',
    supportFocus: 'shared_play',
    supports: [
      { id: 'peer_roles', text: '함께 사용하는 자료와 역할을 짧게 확인해 주고 주고받는 흐름을 이어 본다' },
      { id: 'peer_materials', text: '친구와 함께 쓰기 좋은 자료를 충분히 마련해 차례를 경험하게 한다' },
    ],
  },
  conflict: {
    claims: ['갈등 상황에서 말이나 행동으로 조정함', '사과나 다시 시작하는 행동이 관찰됨'],
    blocked: ['갈등을 해결함', '사회성이 발달함'],
    learning: '갈등 상황에서 말이나 행동으로 상황을 조정해 보았다',
    supportFocus: 'conflict_restart',
    supports: [
      { id: 'conflict_words', text: '서로의 말과 행동을 짧게 확인한 뒤 원하는 것을 말로 표현할 수 있도록 돕는다' },
      { id: 'conflict_restart', text: '놀이를 다시 시작할 수 있는 순서나 역할을 함께 정해 본다' },
    ],
  },
  rules: {
    claims: ['차례나 순서를 기다림', '정해진 흐름을 따름'],
    blocked: ['준법성이 있음', '사회성이 발달함'],
    learning: '차례와 순서를 확인하며 놀이 흐름을 이어 갔다',
    supportFocus: 'turn_taking',
    supports: [
      { id: 'rules_visual', text: '차례를 확인할 수 있는 간단한 표시를 두어 기다리는 흐름을 다시 경험하게 한다' },
      { id: 'rules_repeat', text: '같은 순서가 반복되는 짧은 놀이를 마련해 차례를 주고받게 한다' },
    ],
  },
  selfhelp: {
    claims: ['일상 행동을 스스로 해 봄', '필요한 순서를 직접 시도함'],
    blocked: ['자립심이 완성됨', '생활습관이 형성됨'],
    learning: '일상에서 필요한 행동을 스스로 해 보았다',
    supportFocus: 'self_care_flow',
    supports: [
      { id: 'selfhelp_wait', text: '스스로 해 볼 시간을 먼저 두고 필요한 단계에서만 짧게 도와준다' },
      { id: 'selfhelp_cue', text: '행동 순서를 스스로 확인할 수 있는 간단한 단서를 가까이에 둔다' },
    ],
  },
  roleplay: {
    claims: ['역할에 맞는 상황을 표현함', '놀이 장면을 이어 감'],
    blocked: ['상상력이 뛰어남', '주도성이 높음'],
    learning: '역할에 맞는 말과 행동으로 놀이 장면을 이어 갔다',
    supportFocus: 'role_flow',
    supports: [
      { id: 'role_props', text: '현재 역할과 연결되는 소품을 한두 가지 더해 다음 장면을 이어 본다' },
      { id: 'role_turn', text: '역할이 바뀌거나 이어지는 순간을 짧게 확인해 놀이 흐름을 확장한다' },
    ],
  },
  movement: {
    claims: ['몸의 움직임과 방향을 조절함', '움직임을 반복해 봄'],
    blocked: ['운동 능력이 향상됨', '대근육이 발달함'],
    learning: '몸의 움직임과 방향을 조절해 보았다',
    supportFocus: 'movement_flow',
    supports: [
      { id: 'movement_space', text: '같은 움직임을 안전하게 반복해 볼 수 있도록 충분한 공간을 확보한다' },
      { id: 'movement_choice', text: '높이와 거리가 다른 움직임 선택지를 마련해 스스로 조절해 보게 한다' },
    ],
  },
  emotion_expression: {
    claims: ['관찰된 말과 행동으로 마음을 표현함'],
    blocked: ['감정을 조절함', '안정을 찾음', '회복함'],
    learning: '관찰된 말과 행동으로 현재의 마음을 표현했다',
    supportFocus: 'emotion_space',
    supports: [
      { id: 'emotion_name', text: '관찰된 말과 행동을 짧게 되짚어 마음을 표현할 시간을 둔다' },
      { id: 'emotion_space', text: '표현을 서두르지 않도록 편안히 머물 수 있는 자리를 마련한다' },
    ],
  },
  emotion_recovery: {
    claims: ['마음을 표현한 뒤 다시 행동을 이어 감'],
    blocked: ['정서 조절 능력이 향상됨', '불안을 극복함'],
    learning: '마음을 표현한 뒤 다시 놀이 흐름으로 돌아왔다',
    supportFocus: 'recovery_flow',
    supports: [
      { id: 'recovery_pace', text: '다시 시작하는 속도를 기다리며 이전 놀이 흐름으로 자연스럽게 연결한다' },
      { id: 'recovery_choice', text: '다시 선택할 수 있는 익숙한 자료나 자리를 가까이에 둔다' },
    ],
  },
  compare: {
    claims: ['기준에 따라 비교하거나 나눔', '순서나 차이를 살펴봄'],
    blocked: ['수학적 능력이 향상됨', '개념을 이해함'],
    learning: '자신이 정한 기준에 따라 비교하거나 나누어 보았다',
    supportFocus: 'compare_flow',
    supports: [
      { id: 'compare_set', text: '같은 기준으로 다시 비교해 볼 수 있도록 크기나 색이 다른 자료를 함께 놓는다' },
      { id: 'compare_words', text: '아이가 사용한 비교 기준을 말로 되짚어 다른 기준도 살펴보게 한다' },
    ],
  },
  story: {
    claims: ['사건이나 말을 순서 있게 이어 감'],
    blocked: ['서사 능력이 발달함', '상상력이 뛰어남'],
    learning: '사건과 말을 순서에 따라 이어 갔다',
    supportFocus: 'story_flow',
    supports: [
      { id: 'story_record', text: '이어진 이야기를 그림이나 사진 순서로 남겨 다음 장면을 덧붙이게 한다' },
      { id: 'story_prompt', text: '마지막 장면을 짧게 되짚고 다음에 이어질 장면을 기다린다' },
    ],
  },
  peer_help: {
    claims: ['도움을 요청하거나 주고받음'],
    blocked: ['배려심이 있음', '협동성이 발달함'],
    learning: '필요한 도움을 말이나 행동으로 주고받았다',
    supportFocus: 'help_flow',
    supports: [
      { id: 'help_words', text: '도움이 필요한 순간 사용할 수 있는 짧은 말을 상황 속에서 함께 확인한다' },
      { id: 'help_roles', text: '서로 도울 수 있는 역할이 있는 놀이를 마련해 도움을 주고받게 한다' },
    ],
  },
};

const THEME_PRIORITY = [
  'conflict', 'emotion_recovery', 'emotion_expression', 'retry', 'question', 'peer_share',
  'peer_help', 'rules', 'change_explore', 'roleplay', 'make', 'story', 'selfhelp',
  'movement', 'compare', 'language',
];

function nodeById(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id);
}

function relationScore(edge) {
  return ({
    conflict_to_apology: 95,
    emotion_to_recovery: 90,
    retry_after_setback: 88,
    action_to_peer_interaction: 82,
    action_to_expression: 76,
    action_to_material_exploration: 72,
    action_to_self_care: 70,
    sequence: 45,
  })[edge.type] || 40;
}

function chooseThemes(graph) {
  const themes = unique(graph.themeIds || []);
  return themes.sort((a, b) => THEME_PRIORITY.indexOf(a) - THEME_PRIORITY.indexOf(b))
    .filter((id) => B4_THEME_LANGUAGE[id]);
}

function chooseFocusEvent(graph) {
  const relationEdges = [...(graph.edges || [])].sort((a, b) => relationScore(b) - relationScore(a));
  const relationFocus = relationEdges.map((edge) => nodeById(graph, edge.to)).find((node) => node && (node.type === 'action' || node.type === 'speech' || node.type === 'teacher_support'));
  if (relationFocus) return relationFocus;
  return [...(graph.nodes || [])]
    .filter((node) => node.type === 'action' || node.type === 'speech' || node.type === 'teacher_support')
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.id.localeCompare(b.id))[0] || null;
}

function chooseSecondaryEvent(graph, focus) {
  if (!focus) return null;
  const connected = (graph.edges || [])
    .filter((edge) => edge.from === focus.id || edge.to === focus.id)
    .map((edge) => nodeById(graph, edge.from === focus.id ? edge.to : edge.from))
    .filter((node) => node && node.id !== focus.id && !['child', 'peer', 'teacher'].includes(node.type));
  return connected.sort((a, b) => (b.score || 0) - (a.score || 0) || a.id.localeCompare(b.id))[0] || null;
}

function chooseRelation(graph, focus, secondary) {
  const direct = (graph.edges || []).find((edge) =>
    focus && secondary && ((edge.from === focus.id && edge.to === secondary.id) || (edge.to === focus.id && edge.from === secondary.id)));
  if (direct) return direct.type;
  const top = [...(graph.edges || [])].sort((a, b) => relationScore(b) - relationScore(a))[0];
  return top?.type || 'single_event';
}

function orderedObservationIds(graph, focus, secondary) {
  const ids = [];
  const sequenceBefore = (graph.edges || []).find((edge) => edge.type === 'sequence' && edge.to === focus?.id);
  if (sequenceBefore) ids.push(sequenceBefore.from);
  if (focus?.id) ids.push(focus.id);
  if (secondary?.id) ids.push(secondary.id);
  return unique(ids).slice(0, 3);
}

export function buildB4DiscoursePlan({ graph = {}, card = {} } = {}) {
  const themes = chooseThemes(graph);
  const focus = chooseFocusEvent(graph);
  const secondary = chooseSecondaryEvent(graph, focus);
  const relation = chooseRelation(graph, focus, secondary);
  const primaryTheme = themes[0] || null;
  const secondaryTheme = themes[1] || null;
  const language = B4_THEME_LANGUAGE[primaryTheme] || null;
  const secondaryLanguage = B4_THEME_LANGUAGE[secondaryTheme] || null;
  const focusEvidence = unique([...(focus?.evidenceIds || []), ...(secondary?.evidenceIds || [])]);
  const order = orderedObservationIds(graph, focus, secondary);

  return {
    focusEventId: focus?.id || '',
    secondaryEventId: secondary?.id || '',
    relation,
    observationOrder: order,
    primaryTheme,
    secondaryTheme,
    learningFocus: [primaryTheme, secondaryTheme].filter(Boolean),
    supportFocus: language?.supportFocus || 'observe_more',
    allowedClaims: unique([...(language?.claims || []), ...(secondaryLanguage?.claims || []).slice(0, 1)]),
    blockedClaims: unique([
      '입력에 없는 감정',
      '입력에 없는 또래 반응',
      '발달 진단',
      '교사 지원 완료형 표현',
      ...(language?.blocked || []),
      ...(secondaryLanguage?.blocked || []),
      ...((graph.flags?.hasRecovery || primaryTheme !== 'emotion_expression') ? [] : ['감정 회복 단정']),
    ]),
    supportActions: language?.supports || [{ id: 'observe_more', text: '구체적인 행동이 더 관찰될 때까지 확인한 뒤 다음 지원을 정한다' }],
    evidenceIds: focusEvidence,
    omittedEventIds: (graph.nodes || []).filter((node) => /^event_|^speech_/.test(node.id) && !order.includes(node.id)).map((node) => node.id),
    sparse: graph.sparse || !primaryTheme || !focus,
    maxSentences: 2,
    graphSummary: {
      nodeCount: (graph.nodes || []).length,
      edgeCount: (graph.edges || []).length,
      relationTypes: unique((graph.edges || []).map((edge) => edge.type)),
      sourceFactCount: (card.facts || []).length,
    },
  };
}

export default buildB4DiscoursePlan;
