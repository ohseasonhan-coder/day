// Teacher-review baseline frozen from bef4c88. Do not extend this rule set.
// It exists only to compare the pre-stage-6 B output with the current B output.
import { auditObservationCopy } from './observationAudit';

const clean = (s) => String(s || '').trim();
const hashOf = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const pick = (src, list) => list[hashOf(src) % list.length];
const topic = (name) => {
  const n = clean(name);
  if (!n || n === '유아') return '유아는';
  const code = n.charCodeAt(n.length - 1);
  return n + (code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '은' : '는');
};
const finish = (s) => {
  const value = clean(s).replace(/\s{2,}/g, ' ');
  return value && !/[.!?]["”']?$/.test(value) ? `${value}.` : value;
};

const RULES = [
  { key: 'persist', re: /(다시|무너지|넘어지|끝까지|반복|재시도|여러 번|계속|포기하지)/, make: (t, s) => pick(s, [`${t} 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.`, `${t} 잘 되지 않는 순간에도 포기하지 않고 시도를 이어 가며 자신만의 해결 방법을 찾아갔다.`]) },
  { key: 'challenge', re: /(처음 해 보|처음 하는|망설이|망설였|낯설어|어려워하)/, make: (t) => `${t} 낯선 경험 앞에서도 자신의 속도로 시도해 보며 경험의 폭을 넓혀 갔다.` },
  { key: 'recover', re: /(놀랐|놀라|속상|엄마를 찾|아빠를 찾|눈물|울)/, re2: /(안정을 찾|안정감|진정|(곧|이내|다시)[^.]{0,10}집중)/, make: (t) => `${t} 자신의 마음을 표현한 뒤 놀이에 집중하며 스스로 안정을 찾아갔다.` },
  { key: 'share', re: /(빌려주|나눠|나누어|양보|함께|같이|도와|번갈아|서로)/, peer: true, make: (t) => `${t} 친구와 마음을 나누고 함께하는 방법을 찾아가며 또래 관계를 넓혀 갔다.` },
  { key: 'express', re: /("[^"]+"|말하|이야기|설명|물어|불렀|노래|표현)/, make: (t, s) => pick(s, [`${t} 자신의 생각과 느낌을 말과 행동으로 표현하며 놀이를 이끌어 가는 힘을 키워 갔다.`, `${t} 마음속 생각을 말로 풀어내며 놀이에 자신의 의미를 담아 가는 모습을 보였다.`]) },
  { key: 'roleplay', re: /(역할을 맡|역할놀이|의사 역할|엄마 역할|아빠 역할|요리사 역할|가게 놀이|인 척|병원놀이)/, make: (t) => `${t} 맡은 역할이 되어 상황을 상상하고 표현하며 놀이에 의미를 더해 갔다.` },
  { key: 'rules', re: /(차례를 기다|순서를 지키|규칙을 지키|줄을 서서)/, make: (t) => `${t} 놀이에 필요한 순서와 규칙을 이해하고 스스로 지켜 보려는 모습을 보였다.` },
  { key: 'sort', re: /(크기 순|순서대로 늘어놓|순서대로 놓|나란히 늘어놓|분류하|짝을 맞추)/, make: (t) => `${t} 나름의 기준을 세워 순서대로 배열해 보며 탐구하는 즐거움을 경험하였다.` },
  { key: 'change', re: /(색을 섞|섞어 새로운|섞었더니|변하는 것|달라지는 것|새로운 색)/, make: (t) => `${t} 눈앞에서 일어나는 변화에 관심을 보이며 그 과정을 직접 확인하는 탐구를 즐겼다.` },
  { key: 'explore', re: /(관찰|탐색|비교|살펴|살피|궁금|실험|발견|돋보기|씨앗|달팽이|나뭇잎)/, make: (t, s) => pick(s, [`${t} 주변을 자세히 살피고 궁금한 점을 탐색하며 알아 가는 즐거움을 경험하였다.`, `${t} 궁금한 대상을 찬찬히 들여다보며 스스로 답을 찾아가는 탐구의 즐거움을 누렸다.`]) },
  { key: 'selfhelp', re: /(스스로|혼자|정리|치우|덮고|이불|신발|양치|손\s*씻|손씻|가방|컵|옷|지퍼)/, make: (t) => `${t} 일과의 흐름을 이해하고 필요한 일을 스스로 해 보려는 자립의 태도를 보였다.` },
  { key: 'hygiene', re: /(손을 씻|비누|거품을 내|양치질|세수)/, make: (t) => `${t} 몸을 깨끗이 하는 방법을 알고 스스로 실천하는 모습을 보였다.` },
  { key: 'meal', re: /(골고루|채소도|편식하지|한 입 먹|한 입 맛|먹으려고|남기지 않고)/, make: (t) => `${t} 음식을 스스로 챙겨 먹으며 건강한 식생활을 경험해 갔다.` },
  { key: 'move', re: /(뛰|달리|점프|폴짝|계단|평균대|균형|굴리|던지|공을|훌라후프|구르|기어)/, make: (t) => `${t} 몸을 다양하게 움직이며 균형과 힘을 조절하는 즐거움을 경험하였다.` },
  { key: 'aim', re: /(던져 넣|던지며|던져서|던져|과녁|맞히|골대에)/, make: (t) => `${t} 목표한 곳을 향해 힘과 방향을 가늠하며 몸의 움직임을 조절해 보았다.` },
  { key: 'make', re: /(그리|색칠|만들|점토|블록|쌓|접|악기|율동|춤|꾸미|모양)/, make: (t, s) => pick(s, [`${t} 재료를 자기만의 방식으로 다루며 만들고 표현하는 과정을 즐겼다.`, `${t} 손끝으로 재료를 매만지며 떠올린 것을 형태로 만들어 가는 과정에 몰입하였다.`]) },
  { key: 'craft', re: /(찢어|찢으며|콜라주|오려|물감|찍어|스티커|꾸몄)/, make: (t) => `${t} 색과 재료의 느낌을 살피며 자신만의 방식으로 구성해 가는 즐거움을 보였다.` },
];

const SUPPORT = {
  challenge: '충분히 탐색할 시간을 주고, 스스로 고를 수 있는 선택지를 마련해 준다.', recover: '아이의 마음을 말로 읽어 주고, 편안하게 머무를 수 있는 자리를 마련해 둔다.',
  craft: '다양한 재료를 비교하며 고를 수 있게 준비하고, 작품에 담긴 이야기를 나눈다.', make: '다양한 재료를 비교하며 고를 수 있게 준비하고, 작품에 담긴 이야기를 나눈다.',
  hygiene: '스스로 해 보는 시간을 기다려 주고, 필요할 때만 단계적으로 돕는다.', meal: '스스로 해 보는 시간을 기다려 주고, 필요할 때만 단계적으로 돕는다.', selfhelp: '스스로 해 보는 시간을 기다려 주고, 필요할 때만 단계적으로 돕는다.',
  roleplay: '역할을 나누거나 생각을 주고받을 수 있는 놀이 기회를 마련한다.', share: '역할을 나누거나 생각을 주고받을 수 있는 놀이 기회를 마련한다.', rules: '차례와 규칙을 놀이 속에서 자연스럽게 경험할 기회를 이어 간다.',
  sort: '비교하고 확인해 볼 수 있는 재료를 더해 탐구가 이어지도록 돕는다.', change: '비교하고 확인해 볼 수 있는 재료를 더해 탐구가 이어지도록 돕는다.', explore: '비교하고 확인해 볼 수 있는 재료를 더해 탐구가 이어지도록 돕는다.',
  aim: '몸을 조절해 볼 수 있는 놀이를 다양한 난이도로 준비한다.', move: '몸을 조절해 볼 수 있는 놀이를 다양한 난이도로 준비한다.',
};

export function buildStage5ReviewBaseline({ observation = '', support = '', input = '', childName = '' } = {}) {
  const src = clean(input) || clean(observation);
  const hasPeer = /(친구|또래)/.test(src);
  const rule = RULES.find((r) => (!r.peer || hasPeer) && (!r.re2 || r.re2.test(src)) && r.re.test(src));
  const learning = rule ? rule.make(topic(childName), src) : pick(src, [(t) => `${t} 관심 있는 놀이에 몰입하며 자신의 방식으로 경험을 넓혀 갔다.`, (t) => `${t} 놀이의 흐름을 자신의 방식으로 이어 가며 경험을 쌓아 갔다.`])(topic(childName));
  const nextSupport = clean(support) || SUPPORT[rule?.key] || '';
  const sections = { observation: finish(observation), learning: finish(learning), support: finish(nextSupport) };
  const copyText = [['관찰내용', sections.observation], ['배움 읽기', sections.learning], ['교사 지원 및 다음 계획', sections.support]].filter(([, v]) => v).map(([k, v]) => `[${k}]\n${v}`).join('\n\n');
  const audit = auditObservationCopy({ input: src, ...sections, childName });
  return { sections, copyText, audit };
}

export default buildStage5ReviewBaseline;
