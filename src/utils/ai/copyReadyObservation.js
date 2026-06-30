// 복사용 관찰일지 — 이미 생성된 결과 필드를 "관찰내용 / 배움 읽기 / 교사 지원 및 다음 계획"
// 3단 라벨로 묶어, 교사가 그대로 복사해 붙여넣기 좋은 형태로 만든다.
// (새 문장을 생성하지 않는다. observation/evaluation/support를 조합만 한다.)

const clean = (s) => String(s || '').trim();

export function buildCopyReadyObservation({ observation, evaluation, support } = {}) {
  const sections = [
    ['관찰내용', clean(observation)],
    ['배움 읽기', clean(evaluation)],
    ['교사 지원 및 다음 계획', clean(support)],
  ].filter(([, body]) => body);
  if (sections.length === 0) return '';
  return sections.map(([label, body]) => `[${label}]\n${body}`).join('\n\n');
}

export default buildCopyReadyObservation;
