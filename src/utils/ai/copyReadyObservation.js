// 복사용 관찰일지 — 교사가 수정 없이 그대로 복사·붙여넣기 하는 완성 문서를 만든다.
//   [관찰내용]  실제 관찰(생성된 observation 그대로 — 사실·발화 보존)
//   [배움 읽기]  관찰 사실에서 드러난 놀이 시도·관계·표현·탐색 흐름을 원아 중심으로 읽음
//   [교사 지원 및 다음 계획]  생성된 support(다음 지원 계획)
// 원칙: 입력에 없는 행동·발화·감정·또래·성취를 추가하지 않는다. 외부 LLM/서버 없음.
// buildAuditedCopyReady: 생성 직후 observationAudit로 검수하고, 중대 문제는 사실 보존 폴백을 적용한다.
import { auditObservationCopy } from './observationAudit';

const clean = (s) => String(s || '').trim();
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);

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
// 3단계 확장: 정서·도전/안정 회복/역할·상상/차례·규칙/분류·배열/변화 탐구/위생·식습관/조준 놀이/구성(콜라주·물감).
// 원칙 유지: 입력에 해당 단서가 실제로 있을 때만 발화하며(re, 필요 시 re2 동시 충족),
// 신호 미감지 시 보수적 SAFE 폴백. 같은 입력 → 같은 출력(입력 해시 기반 결정론적 변형).
const hashOf = (s) => { let h = 0; const str = String(s || ''); for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); };
const pickBy = (src, arr) => arr[hashOf(src) % arr.length];

const LEARNING_SIGNALS = [
  { key: 'persist', label: '재시도·끈기', re: /(다시|무너지|넘어지|끝까지|반복|재시도|여러 번|계속|포기하지)/, needPeer: false,
    make: (t) => `${t} 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.` },
  // A. 정서·도전·시도 — 망설임/처음/낯섦/어려움 단서가 있을 때만. 격려·도움 언급은 입력에 실제 있을 때만 반영.
  { key: 'challenge', label: '정서·도전', re: /(처음 해 보|처음 하는|망설이|망설였|낯설어|어려워하)/, needPeer: false,
    make: (t, src) => {
      const opening = /망설/.test(src) ? '잠시 망설였지만' : /어려워하/.test(src) ? '어려움을 느끼면서도' : '낯선 경험 앞에서도';
      const helped = /(격려|도움을 받아|응원)/.test(src) ? ' 격려 속에서' : '';
      return `${t} ${opening}${helped} 자신의 속도로 시도해 보며 경험의 폭을 넓혀 갔다.`;
    } },
  // A'. 정서·안정 회복 — 감정 단서 + 회복 단서가 모두 입력에 있을 때만(불안 해소·자신감 향상 단정 금지).
  { key: 'recover', label: '정서·안정', re: /(놀랐|놀라|속상|엄마를 찾|아빠를 찾|눈물|울)/, re2: /(안정을 찾|안정감|진정|(곧|이내|다시)[^.]{0,10}집중)/, needPeer: false,
    make: (t, src) => (/(안정을 찾|안정감|진정)/.test(src)
      ? `${t} 놀라거나 흔들린 마음을 추스르고 다시 안정을 찾아가는 모습을 보였다.`
      : `${t} 자신의 마음을 표현한 뒤 놀이에 집중하며 스스로 안정을 찾아갔다.`) },
  { key: 'share', label: '또래·나눔', re: /(빌려주|나눠|나누어|양보|함께|같이|도와|번갈아|서로)/, needPeer: true,
    make: (t) => `${t} 친구와 마음을 나누고 함께하는 방법을 찾아가며 또래 관계를 넓혀 갔다.` },
  { key: 'express', label: '표현·발화', re: /("[^"]+"|말하|이야기|설명|물어|불렀|노래|표현)/, needPeer: false,
    make: (t) => `${t} 자신의 생각과 느낌을 말과 행동으로 표현하며 놀이를 이끌어 가는 힘을 키워 갔다.` },
  // D'. 역할·상상 — 역할 단서가 있을 때만. 또래 언급은 입력에 있을 때만.
  { key: 'roleplay', label: '역할·상상', re: /(역할을 맡|역할놀이|의사 역할|엄마 역할|아빠 역할|요리사 역할|가게 놀이|인 척|병원놀이)/, needPeer: false,
    make: (t, src) => (/(친구|또래)/.test(src)
      ? `${t} 맡은 역할이 되어 친구와 상황을 주고받으며 상상놀이를 풍부하게 이어 갔다.`
      : `${t} 맡은 역할이 되어 상황을 상상하고 표현하며 놀이에 의미를 더해 갔다.`) },
  // E'. 차례·규칙 — 사회성 향상 단정 금지, 관찰된 실천만 재진술.
  { key: 'rules', label: '차례·규칙', re: /(차례를 기다|순서를 지키|규칙을 지키|줄을 서서)/, needPeer: false,
    make: (t) => `${t} 놀이에 필요한 순서와 규칙을 이해하고 스스로 지켜 보려는 모습을 보였다.` },
  // 탐구 계열: 분류·배열 / 변화 확인 — 기준·변화 단서가 입력에 있을 때만.
  { key: 'sort', label: '분류·배열', re: /(크기 순|순서대로 늘어놓|순서대로 놓|나란히 늘어놓|분류하|짝을 맞추)/, needPeer: false,
    make: (t) => `${t} 나름의 기준을 세워 순서대로 배열해 보며 탐구하는 즐거움을 경험하였다.` },
  { key: 'change', label: '변화·탐구', re: /(색을 섞|섞어 새로운|섞었더니|변하는 것|달라지는 것|새로운 색)/, needPeer: false,
    make: (t) => `${t} 눈앞에서 일어나는 변화에 관심을 보이며 그 과정을 직접 확인하는 탐구를 즐겼다.` },
  { key: 'explore', label: '탐색', re: /(관찰|탐색|비교|살펴|살피|궁금|실험|발견|돋보기|씨앗|달팽이|나뭇잎)/, needPeer: false,
    make: (t) => `${t} 주변을 자세히 살피고 궁금한 점을 탐색하며 알아 가는 즐거움을 경험하였다.` },
  { key: 'selfhelp', label: '자립', re: /(스스로|혼자|정리|치우|덮고|이불|신발|양치|손\s*씻|손씻|가방|컵|옷|지퍼)/, needPeer: false,
    make: (t) => `${t} 일과의 흐름을 이해하고 필요한 일을 스스로 해 보려는 자립의 태도를 보였다.` },
  // C'. 위생·식습관 — 활용형 보강(손을 씻/비누/거품). "습관 확립" 단정 금지.
  { key: 'hygiene', label: '위생·자조', re: /(손을 씻|비누|거품을 내|양치질|세수)/, needPeer: false,
    make: (t) => `${t} 몸을 깨끗이 하는 방법을 알고 스스로 실천하는 모습을 보였다.` },
  { key: 'meal', label: '식습관', re: /(골고루|채소도|편식하지|한 입 먹|한 입 맛|먹으려고|남기지 않고)/, needPeer: false,
    make: (t, src) => (/(골고루|채소)/.test(src)
      ? `${t} 골고루 먹어 보려는 마음으로 음식을 스스로 시도하며 건강한 식습관을 경험해 갔다.`
      : `${t} 음식을 스스로 챙겨 먹으며 건강한 식생활을 경험해 갔다.`) },
  { key: 'move', label: '신체', re: /(뛰|달리|점프|폴짝|계단|평균대|균형|굴리|던지|공을|훌라후프|구르|기어)/, needPeer: false,
    make: (t) => `${t} 몸을 다양하게 움직이며 균형과 힘을 조절하는 즐거움을 경험하였다.` },
  // 신체 보강: 조준·투척 활용형(던져/맞히) — move 미매치 시에만.
  { key: 'aim', label: '조준·조절', re: /(던져 넣|던지며|던져서|던져|과녁|맞히|골대에)/, needPeer: false,
    make: (t) => `${t} 목표한 곳을 향해 힘과 방향을 가늠하며 몸의 움직임을 조절해 보았다.` },
  { key: 'make', label: '만들기', re: /(그리|색칠|만들|점토|블록|쌓|접|악기|율동|춤|꾸미|모양)/, needPeer: false,
    make: (t) => `${t} 재료를 자기만의 방식으로 다루며 만들고 표현하는 과정을 즐겼다.` },
  // B'. 구성·표상 보강: 콜라주·찢기·붙이기·물감·활용형(꾸몄/찍어) — make 미매치 시에만.
  { key: 'craft', label: '구성·표상', re: /(찢어|찢으며|콜라주|오려|물감|찍어|스티커|꾸몄)/, needPeer: false,
    make: (t, src) => pickBy(src, [
      `${t} 색과 재료의 느낌을 살피며 자신만의 방식으로 구성해 가는 즐거움을 보였다.`,
      `${t} 재료를 다루는 자신만의 방식으로 생각과 느낌을 나타내는 표현을 즐겼다.`,
    ]) },
];
const SAFE_LEARNING = (t) => `${t} 관심 있는 놀이에 몰입하며 자신의 방식으로 경험을 넓혀 갔다.`;
// 미감지 폴백 변형(의미 동등·결정론적) — 같은 입력은 항상 같은 문장.
const SAFE_POOL = [
  SAFE_LEARNING,
  (t) => `${t} 놀이의 흐름을 자신의 방식으로 이어 가며 경험을 쌓아 갔다.`,
];

// 입력에서 감지된 배움 읽기 신호(리포트·테스트용). 미감지 = null(보수적 폴백 사용).
export function readLearningSignal(input) {
  const src = clean(input);
  if (!src) return null;
  const hasPeer = /(친구|또래)/.test(src);
  for (const sig of LEARNING_SIGNALS) {
    if (sig.needPeer && !hasPeer) continue;
    if (sig.re2 && !sig.re2.test(src)) continue;
    if (sig.re.test(src)) return { key: sig.key, label: sig.label };
  }
  return null;
}

export function buildLearningReading({ input, childName } = {}) {
  const src = clean(input);
  const topic = topicParticle(childName);
  if (!src) return '';
  const hasPeer = /(친구|또래)/.test(src);
  for (const sig of LEARNING_SIGNALS) {
    if (sig.needPeer && !hasPeer) continue;
    if (sig.re2 && !sig.re2.test(src)) continue;
    if (sig.re.test(src)) return sig.make(topic, src);
  }
  return pickBy(src, SAFE_POOL)(topic);
}

function assemble(observation, learning, support) {
  const sections = [
    ['관찰내용', clean(observation)],
    ['배움 읽기', clean(learning)],
    ['교사 지원 및 다음 계획', clean(support)],
  ].filter(([, body]) => body).map(([label, body]) => [label, finishSentence(body)]);
  if (sections.length === 0) return '';
  return sections.map(([label, body]) => `[${label}]\n${body}`).join('\n\n');
}

// 기존 호환: 문자열만 반환
export function buildCopyReadyObservation({ observation, support, input, childName } = {}) {
  const learning = buildLearningReading({ input: input || observation, childName });
  return assemble(observation, learning, support);
}

// 신호별 다음 계획 힌트 — 엔진 support가 비어 있을 때만 사용(있는 support는 절대 덮지 않음).
// 전부 계획 문체("~한다")이며 실제 제공한 지원처럼 단정하지 않는다.
const SUPPORT_HINTS = {
  challenge: '충분히 탐색할 시간을 주고, 스스로 고를 수 있는 선택지를 마련해 준다.',
  recover: '아이의 마음을 말로 읽어 주고, 편안하게 머무를 수 있는 자리를 마련해 둔다.',
  craft: '다양한 재료를 비교하며 고를 수 있게 준비하고, 작품에 담긴 이야기를 나눈다.',
  make: '다양한 재료를 비교하며 고를 수 있게 준비하고, 작품에 담긴 이야기를 나눈다.',
  hygiene: '스스로 해 보는 시간을 기다려 주고, 필요할 때만 단계적으로 돕는다.',
  meal: '스스로 해 보는 시간을 기다려 주고, 필요할 때만 단계적으로 돕는다.',
  selfhelp: '스스로 해 보는 시간을 기다려 주고, 필요할 때만 단계적으로 돕는다.',
  roleplay: '역할을 나누거나 생각을 주고받을 수 있는 놀이 기회를 마련한다.',
  share: '역할을 나누거나 생각을 주고받을 수 있는 놀이 기회를 마련한다.',
  rules: '차례와 규칙을 놀이 속에서 자연스럽게 경험할 기회를 이어 간다.',
  sort: '비교하고 확인해 볼 수 있는 재료를 더해 탐구가 이어지도록 돕는다.',
  change: '비교하고 확인해 볼 수 있는 재료를 더해 탐구가 이어지도록 돕는다.',
  explore: '비교하고 확인해 볼 수 있는 재료를 더해 탐구가 이어지도록 돕는다.',
  aim: '몸을 조절해 볼 수 있는 놀이를 다양한 난이도로 준비한다.',
  move: '몸을 조절해 볼 수 있는 놀이를 다양한 난이도로 준비한다.',
};

// 검수 연결판: 생성 직후 감사 → 우선순위(통과/경미 정리/중대 폴백) 적용
// 반환: { copyReady, audit: { ...auditResult, fallbackApplied } }
export function buildAuditedCopyReady({ observation, support, input, childName } = {}) {
  let obs = clean(observation);
  let learning = buildLearningReading({ input: input || obs, childName });
  let sup = clean(support);
  if (!sup) {
    const sig = readLearningSignal(input || obs);
    if (sig && SUPPORT_HINTS[sig.key]) sup = SUPPORT_HINTS[sig.key];
  }

  let audit = auditObservationCopy({ input, observation: obs, learning, support: sup, childName });
  let fallbackApplied = false;

  if (audit.severity === 'major') {
    fallbackApplied = true;
    // 발화 손실 → 관찰내용에 원문 발화를 그대로 복원(사실 보존)
    if (audit.warnings.includes('speech_lost')) {
      const missing = quotesOf(input).filter((q) => !obs.includes(q));
      if (missing.length) obs = finishSentence(`${obs.replace(/[.]\s*$/, '')} ${missing.map((q) => `"${q}"`).join(' ')}`);
    }
    // 배움 읽기의 중대 문제 → 사실 추가 없는 안전 기본 문장으로 대체
    const LEARN_MAJOR = ['fact_addition_peer', 'fact_addition_speech', 'negative_or_diagnostic', 'josa_error'];
    if (audit.warnings.some((c) => LEARN_MAJOR.includes(c))) {
      learning = SAFE_LEARNING(topicParticle(childName));
    }
    audit = auditObservationCopy({ input, observation: obs, learning, support: sup, childName });
  }

  return { copyReady: assemble(obs, learning, sup), audit: { ...audit, fallbackApplied } };
}

export default buildCopyReadyObservation;
