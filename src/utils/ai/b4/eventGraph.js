import { extractB3FactsShape } from '../b3/caseSearch';
import { detectSituationTypes } from './contextGuard';
import { detectChildcareDomainTerms, domainThemeIds, safeEpisodeTrace, segmentChildcareEpisodes } from './childcareDomainGuard';
import { detectObjectMentionRoles, hasBlockPlayEvidence, safeObjectMentionTrace } from './objectMentionGuard';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

const SIGNALS = [
  { tag: 'retry', theme: 'retry', re: /(다시|재시도|또 해|계속|반복|무너지|실패|쓰러지|안 되|고쳐|바꾸어|바꿔)/ },
  { tag: 'material', theme: 'make', re: /(블록|점토|종이|물감|가위|풀|테이프|모래|나무|돌|재료|작품|만들|쌓|붙이|그리|오리|구성)/ },
  { tag: 'exploration', theme: 'change_explore', re: /(관찰|살펴|돋보기|탐색|비교|분류|변화|움직|색이|크기|냄새|궁금|왜|어떻게)/ },
  { tag: 'speech', theme: 'language', re: /("[^"]+"|“[^”]+”|말하|물어|설명|이야기|표현)/ },
  { tag: 'peer', theme: 'peer_share', re: /(친구|또래|같이|함께|나누|건네|빌려|주고받|번갈|순서|차례)/ },
  { tag: 'conflict', theme: 'conflict', re: /(다투|밀|빼앗|속상|울|화|미안|사과|갈등|부딪)/ },
  { tag: 'apology', theme: 'conflict', re: /(미안|사과)/ },
  { tag: 'turn_waiting', theme: 'rules', re: /(기다|차례|순서|규칙|줄을|번갈)/ },
  { tag: 'self_care', theme: 'selfhelp', re: /(스스로|혼자|정리|치우|신발|옷|손을 씻|식판|식사|양치|배변|일상)/ },
  { tag: 'roleplay', theme: 'roleplay', re: /(역할|손님|주인|의사|엄마|아빠|가게|병원|요리사|캠핑놀이|놀이하자)/ },
  { tag: 'movement', theme: 'movement', re: /(뛰|걷|기어|오르|미끄럼|균형|공을|던지|잡|점프|구르|몸)/ },
  { tag: 'emotion', theme: 'emotion_expression', re: /(속상|울|웃|놀라|무서|기분|화가|짜증|아쉬워|기뻐|걱정)/ },
  { tag: 'recovery', theme: 'emotion_recovery', re: /(진정|괜찮|다시.{0,12}시작|다시 놀이|안정|웃으며|참여|돌아와|돌아왔|이어 갔|이어갔)/ },
  { tag: 'story', theme: 'story', re: /(그 다음|그러고|처음|마지막|이야기|장면|상상|라고 하며|라고 말하며)/ },
  { tag: 'help', theme: 'peer_help', re: /(도와|알려|잡아 주|건네주|해 줄래|도움|부탁)/ },
];

function materialSignalAllowed(source = '') {
  const src = clean(source);
  if (/(벽돌\s*블록|벽돌블록|블럭|블록)/.test(src) && !hasBlockPlayEvidence(src)) {
    return !/(위에|위로|어디다|어디에|어디로|놓지|놓자|두지|둘까|받침|카메라|의자|자리|위치|옆에|내려놓|옮기)/.test(src);
  }
  return true;
}

export function extractB4Speech(text = '') {
  return Array.from(String(text || '').matchAll(/["“”']([^"“”']+)["“”']/g))
    .map((match, index) => ({ id: `speech_${index + 1}`, text: clean(match[1]), evidence: clean(match[1]) }))
    .filter((item) => item.text);
}

export function detectB4Signals(text = '') {
  const source = clean(text);
  const domainTags = domainThemeIds(source).map((theme) => theme.replace('basic_life_habit', 'self_care'));
  const signalTags = SIGNALS.filter((signal) => {
    if (source.includes('공수') && signal.tag === 'movement' && !/(공을|공놀이|공으로)/.test(source)) return false;
    if (signal.tag === 'material' && !materialSignalAllowed(source)) return false;
    return signal.re.test(source);
  }).map((signal) => signal.tag);
  return unique([...signalTags, ...domainTags]);
}

export function detectB4Themes(text = '', b2ThemeIds = []) {
  const source = clean(text);
  const detected = SIGNALS.filter((signal) => {
    if (source.includes('공수') && signal.theme === 'movement' && !/(공을|공놀이|공으로)/.test(source)) return false;
    if (signal.tag === 'material' && !materialSignalAllowed(source)) return false;
    return signal.re.test(source);
  }).map((signal) => signal.theme);
  const themes = unique([...detected, ...domainThemeIds(source), ...(b2ThemeIds || [])]);
  if (themes.includes('emotion_recovery')) return themes.filter((id) => id !== 'emotion_expression');
  return themes;
}

function nodeScore(node) {
  const tags = node.tags || [];
  let score = 0;
  if (tags.includes('retry')) score += 18;
  if (tags.includes('conflict')) score += 18;
  if (tags.includes('speech')) score += 15;
  if (tags.includes('peer')) score += 14;
  if (tags.includes('material') || tags.includes('exploration')) score += 10;
  if (tags.includes('self_care') || tags.includes('roleplay')) score += 9;
  if (node.value.length > 14) score += 8;
  if (node.type === 'speech') score += 12;
  return score;
}

function hasTag(nodes, tag) {
  return nodes.some((node) => (node.tags || []).includes(tag));
}

function firstNode(nodes, tag) {
  return nodes.find((node) => (node.tags || []).includes(tag));
}

export function buildB4EventGraph({ card = {}, b2Plan = {} } = {}) {
  const source = clean(card.source || '');
  const domainTerms = detectChildcareDomainTerms(source);
  const objectMentionRoles = detectObjectMentionRoles(source);
  const episodeTrace = safeEpisodeTrace(segmentChildcareEpisodes({ input: source, targetChild: card.name }));
  const facts = (card.facts || []).filter((fact) => clean(fact.text));
  const b2ThemeIds = b2Plan.meta?.themeIds || [];
  const factsShape = extractB3FactsShape(card);
  const speech = unique([...(card.speech || []), ...extractB4Speech(source)].map((item) => JSON.stringify({
    id: item.id,
    text: clean(item.text),
    evidence: clean(item.evidence || item.text),
  }))).map((item) => JSON.parse(item));

  const nodes = [
    { id: 'child', type: 'child', label: card.name || '원아 A', evidenceIds: [] },
  ];
  if (/(친구|또래)/.test(source) || factsShape.includes('peer_interaction')) {
    nodes.push({ id: 'peer', type: 'peer', label: '친구', evidenceIds: facts.filter((fact) => /(친구|또래)/.test(fact.text)).map((fact) => fact.id) });
  }
  if (/(교사|선생님)/.test(source) || factsShape.includes('actual_teacher_support')) {
    nodes.push({ id: 'teacher', type: 'teacher', label: '교사', evidenceIds: facts.filter((fact) => /(교사|선생님)/.test(fact.text)).map((fact) => fact.id) });
  }

  facts.slice(0, 8).forEach((fact, index) => {
    const tags = unique([...detectB4Signals(fact.normalized || fact.text), ...(fact.type === 'teacher_support' ? ['teacher_support'] : [])]);
    nodes.push({
      id: `event_${index + 1}`,
      type: fact.type === 'teacher_support' ? 'teacher_support' : 'action',
      value: clean(fact.text),
      evidenceIds: [fact.id],
      tags,
      score: nodeScore({ type: 'action', value: clean(fact.text), tags }),
    });
  });

  speech.forEach((item, index) => {
    nodes.push({
      id: `speech_${index + 1}`,
      type: 'speech',
      value: item.text,
      evidenceIds: [item.id],
      tags: ['speech', /같이|함께|줄래|해 줄래|빌려|미안|사과/.test(item.text) ? 'peer' : 'language'],
      score: 14,
    });
  });

  const actionNodes = nodes.filter((node) => node.type === 'action' || node.type === 'teacher_support');
  const edges = [];
  actionNodes.forEach((node, index) => {
    if (actionNodes[index + 1]) edges.push({ from: node.id, to: actionNodes[index + 1].id, type: 'sequence', evidenceIds: unique([...node.evidenceIds, ...actionNodes[index + 1].evidenceIds]) });
  });
  const retryNode = firstNode(actionNodes, 'retry');
  const materialNode = firstNode(actionNodes, 'material');
  const explorationNode = firstNode(actionNodes, 'exploration');
  const selfCareNode = firstNode(actionNodes, 'self_care');
  const conflictNode = firstNode(actionNodes, 'conflict');
  const apologyNode = firstNode(actionNodes, 'apology');
  const emotionNode = firstNode(actionNodes, 'emotion');
  const recoveryNode = firstNode(actionNodes, 'recovery');
  const peerNode = firstNode(actionNodes, 'peer');
  const speechNode = nodes.find((node) => node.type === 'speech');

  if ((factsShape.includes('failed_attempt') || /(무너지|안 되|실패|쓰러지)/.test(source)) && retryNode) {
    edges.push({ from: actionNodes[0]?.id || retryNode.id, to: retryNode.id, type: 'retry_after_setback', evidenceIds: retryNode.evidenceIds });
  }
  if (speechNode && (retryNode || peerNode || actionNodes[0])) {
    edges.push({ from: (retryNode || peerNode || actionNodes[0]).id, to: speechNode.id, type: speechNode.tags.includes('peer') ? 'action_to_peer_interaction' : 'action_to_expression', evidenceIds: unique([...(retryNode || peerNode || actionNodes[0]).evidenceIds, ...speechNode.evidenceIds]) });
  }
  if (peerNode && !edges.some((edge) => edge.type === 'action_to_peer_interaction')) {
    edges.push({ from: actionNodes[0]?.id || peerNode.id, to: peerNode.id, type: 'action_to_peer_interaction', evidenceIds: peerNode.evidenceIds });
  }
  if (materialNode || explorationNode) {
    const node = explorationNode || materialNode;
    edges.push({ from: actionNodes[0]?.id || node.id, to: node.id, type: 'action_to_material_exploration', evidenceIds: node.evidenceIds });
  }
  if (selfCareNode) edges.push({ from: actionNodes[0]?.id || selfCareNode.id, to: selfCareNode.id, type: 'action_to_self_care', evidenceIds: selfCareNode.evidenceIds });
  if (conflictNode && apologyNode) edges.push({ from: conflictNode.id, to: apologyNode.id, type: 'conflict_to_apology', evidenceIds: unique([...conflictNode.evidenceIds, ...apologyNode.evidenceIds]) });
  if (emotionNode && recoveryNode) edges.push({ from: emotionNode.id, to: recoveryNode.id, type: 'emotion_to_recovery', evidenceIds: unique([...emotionNode.evidenceIds, ...recoveryNode.evidenceIds]) });

  const genericSparse = /^(?:[\uAC00-\uD7A3]{1,5}(?:이|가|은|는)?\s*)?(?:교실에 있었다|오늘 등원했다|등원했다|놀았다|놀이했다|오전 자유놀이를 했다)\.?$/.test(source);
  const themeIds = genericSparse ? [] : detectB4Themes(source, b2ThemeIds);
  const sparse = genericSparse || source.length < 8 || (!themeIds.length && actionNodes.length <= 1 && !speech.length);
  return {
    source,
    nodes,
    edges: unique(edges.map((edge) => JSON.stringify(edge))).map((edge) => JSON.parse(edge)),
    factsShape,
    themeIds,
    sparse,
    domainTermIds: domainTerms.map((term) => term.id),
    objectMentionRoles: safeObjectMentionTrace(objectMentionRoles),
    episodeTrace,
    // 상황 유형(전이·갈등/시범 등) — 문서 맥락 불일치 테마 차단(contextGuard)의 판정 근거
    situationTypes: detectSituationTypes(source),
    flags: {
      hasPeer: /(친구|또래)/.test(source) || factsShape.includes('peer_interaction') || hasTag(actionNodes, 'peer'),
      hasSpeech: speech.length > 0,
      hasTeacherSupport: /(교사|선생님)/.test(source) || factsShape.includes('actual_teacher_support'),
      hasEmotion: hasTag(actionNodes, 'emotion'),
      hasRecovery: hasTag(actionNodes, 'recovery'),
      hasDomainTerms: domainTerms.length > 0,
      hasObjectMentionRoles: objectMentionRoles.length > 0,
      hasObjectThemeRisk: objectMentionRoles.some((role) => role.blockedTheme),
      needsTargetChild: episodeTrace.status === 'target_child_required',
    },
  };
}

export default buildB4EventGraph;
