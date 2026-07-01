// 복사용 관찰일지 — 교사가 수정 없이 그대로 복사·붙여넣기 하는 완성 문서를 만든다.
//   [관찰내용]  실제 관찰(생성된 observation 그대로 — 사실·발화 보존)
//   [배움 읽기]  관찰 사실에서 드러난 놀이 시도·관계·표현·탐색 흐름을 원아 중심으로 읽음
//   [교사 지원 및 다음 계획]  생성된 support(다음 지원 계획)
// 원칙: 입력에 없는 행동·발화·감정·또래·성취를 추가하지 않는다. 외부 LLM/서버 없음.
// (반 단위 평가 composer는 건드리지 않고, 개별 관찰용 '배움 읽기'는 여기서 근거 기반으로 만든다.)

const clean = (s) => String(s || '').trim();

function hasBatchim(name) {
  const last = name.charCodeAt(name.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
}
function topicParticle(name) {
  const n = clean(name);
  if (!n || n === '유아') return '유아는';
  return n + (hasBatchim(n) ? '은' : '는');
}
function finishSentence(s) {
  let t = clean(s).replace(/\s{2,}/g, ' ');
  if (!t) return '';
  if (!/[.!?]["”']?$/.test(t)) t += '.';
  return t;
}

// ── 배움 읽기: 관찰 사실에서 실제 드러난 흐름만 근거로 읽는다 ──────────────────
// 각 신호는 입력(원문)에 실제로 등장한 단서에만 반응한다(사실 추가·과장 없음).
const LEARNING_SIGNALS = [
  { key: 'persist', re: /(다시|무너지|넘어지|끝까지|반복|재시도|여러 번|계속|포기하지)/, needPeer: false,
    make: (t) => `${t} 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.` },
  { key: 'share', re: /(빌려주|나눠|나누어|양보|함께|같이|도와|번갈아|서로)/, needPeer: true,
    make: (t) => `${t} 친구와 마음을 나누고 함께하는 방법을 찾아가며 또래 관계를 넓혀 갔다.` },
  { key: 'express', re: /("[^"]+"|말하|이야기|설명|물어|불렀|노래|표현)/, needPeer: false,
    make: (t) => `${t} 자신의 생각과 느낌을 말과 행동으로 표현하며 놀이를 이끌어 가는 힘을 키워 갔다.` },
  { key: 'explore', re: /(관찰|탐색|비교|살펴|살피|궁금|실험|발견|돋보기|씨앗|달팽이|나뭇잎)/, needPeer: false,
    make: (t) => `${t} 주변을 자세히 살피고 궁금한 점을 탐색하며 알아 가는 즐거움을 경험하였다.` },
  { key: 'selfhelp', re: /(스스로|혼자|정리|치우|덮고|이불|신발|양치|손\s*씻|손씻|가방|컵|옷|지퍼)/, needPeer: false,
    make: (t) => `${t} 일과의 흐름을 이해하고 필요한 일을 스스로 해 보려는 자립의 태도를 보였다.` },
  { key: 'move', re: /(뛰|달리|점프|폴짝|계단|평균대|균형|굴리|던지|공을|훌라후프|구르|기어)/, needPeer: false,
    make: (t) => `${t} 몸을 다양하게 움직이며 균형과 힘을 조절하는 즐거움을 경험하였다.` },
  { key: 'make', re: /(그리|색칠|만들|점토|블록|쌓|접|악기|율동|춤|꾸미|모양)/, needPeer: false,
    make: (t) => `${t} 재료를 자기만의 방식으로 다루며 만들고 표현하는 과정을 즐겼다.` },
];

export function buildLearningReading({ input, childName } = {}) {
  const src = clean(input);
  const topic = topicParticle(childName);
  if (!src) return '';
  const hasPeer = /(친구|또래)/.test(src);
  for (const sig of LEARNING_SIGNALS) {
    if (sig.needPeer && !hasPeer) continue;
    if (sig.re.test(src)) return sig.make(topic);
  }
  return `${topic} 관심 있는 놀이에 몰입하며 자신의 방식으로 경험을 넓혀 갔다.`;
}

// ── 복사용 문서 조립 ──────────────────────────────────────────────────────────
export function buildCopyReadyObservation({ observation, support, input, childName } = {}) {
  const obs = clean(observation);
  const learning = buildLearningReading({ input: input || obs, childName });
  const sup = clean(support);
  const sections = [
    ['관찰내용', obs],
    ['배움 읽기', learning],
    ['교사 지원 및 다음 계획', sup],
  ].filter(([, body]) => body).map(([label, body]) => [label, finishSentence(body)]);
  if (sections.length === 0) return '';
  // 교사가 그대로 복사·붙여넣기: 라벨 블록 + 빈 줄. 점수·내부 라벨 없음.
  return sections.map(([label, body]) => `[${label}]\n${body}`).join('\n\n');
}

export default buildCopyReadyObservation;
