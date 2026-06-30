// 복사용 관찰일지 — 이미 생성된 결과 필드를 "관찰내용 / 배움 읽기 / 교사 지원 및 다음 계획"
// 3단으로 묶어, 교사가 그대로 복사·붙여넣기로 끝낼 수 있는 형태로 만든다.
// (새 문장을 생성하지 않는다. observation/evaluation/support를 조합·정리만 한다. 외부 LLM 없음.)

const clean = (s) => String(s || '').trim();

function hasBatchim(name) {
  const last = name.charCodeAt(name.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
}

// 배움 읽기(평가) 문장을 해당 원아 중심으로 자연스럽게 다듬는다.
// - 비개인화 표현('유아들은/유아들/유아가')을 원아 이름으로 치환
// - 템플릿 중복('놀이하며 놀이에 참여') 정리
function refineLearning(text, childName) {
  let out = clean(text);
  if (!out) return '';
  const name = clean(childName);
  if (name && name !== '유아') {
    const topic = name + (hasBatchim(name) ? '은' : '는');
    const subjp = name + (hasBatchim(name) ? '이가' : '가');
    out = out
      .replace(/유아들은/g, topic)
      .replace(/유아는/g, topic)
      .replace(/유아들이/g, subjp)
      .replace(/유아가/g, subjp)
      .replace(/유아들/g, name);
  }
  // 흔한 템플릿 중복·군더더기 정리
  out = out
    .replace(/놀이하며\s*놀이에 참여하였다/g, '놀이에 참여하였다')
    .replace(/하며\s*놀이에 참여하였다/g, '하며 참여하였다')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out;
}

export function buildCopyReadyObservation({ observation, evaluation, support, childName } = {}) {
  const sections = [
    ['관찰내용', clean(observation)],
    ['배움 읽기', refineLearning(evaluation, childName)],
    ['교사 지원 및 다음 계획', clean(support)],
  ].filter(([, body]) => body);
  if (sections.length === 0) return '';
  // v3 검수 양식과 동일한 "라벨: 내용" 줄 형식 — 그대로 복사해 붙여넣기 좋게
  return sections.map(([label, body]) => `${label}: ${body}`).join('\n');
}

export default buildCopyReadyObservation;
