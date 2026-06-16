const FRAME_TEXT = {
  peer_conflict: ({ name, action, teacher, change }) =>
    `${name}는 또래와의 상호작용 중 ${action} 교사는 상황을 확인하고 감정을 말로 표현하도록 도왔다. ${change}`,
  cooperative_play: ({ name, action, teacher, change }) =>
    `${name}는 놀이 흐름 속에서 ${action} ${teacher} ${change}`,
  health_care: ({ name, action, teacher, change }) =>
    `${name}는 일과 중 건강 상태와 관련하여 ${action} ${teacher} ${change}`,
  safety_incident: ({ name, action, teacher, change }) =>
    `${name}는 안전과 관련된 상황에서 ${action} 교사는 상태를 확인하고 안전한 방법을 안내하였다. ${change}`,
  self_help: ({ name, action, teacher, change }) =>
    `${name}는 일상생활 상황에서 ${action} ${teacher} ${change}`,
  expression: ({ name, action, teacher, change }) =>
    `${name}는 표현 활동 중 ${action} ${teacher} ${change}`,
  inquiry: ({ name, action, teacher, change }) =>
    `${name}는 탐색 과정에서 ${action} ${teacher} ${change}`,
  general_observation: ({ name, action, teacher, change }) =>
    `${name}는 ${action} ${teacher} ${change}`,
};

const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

export function buildObservationFrame({ parsedInput, scene, selectedSentence } = {}) {
  const name = parsedInput?.childName || '유아';
  const action = clean(parsedInput?.actions?.join(' ') || parsedInput?.normalizedText || '기록된 상황을 보였다.');
  const teacher = clean(parsedInput?.teacherSupport?.join(' ') || selectedSentence?.text || '교사는 유아의 반응을 관찰하며 필요한 지원을 제공하였다.');
  const change = clean(parsedInput?.changes?.join(' '));
  const frame = FRAME_TEXT[scene?.primary?.id] || FRAME_TEXT.general_observation;
  return clean(frame({ name, action, teacher, change }));
}

export { FRAME_TEXT as OBSERVATION_FRAMES };
