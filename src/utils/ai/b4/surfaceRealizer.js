import { B4_THEME_LANGUAGE } from './discoursePlan';
import { getApprovedPhraseBank } from './approvedPhraseBank';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

export function topic(name = '원아') {
  const value = clean(name) || '원아';
  const code = value.charCodeAt(value.length - 1);
  const batchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${batchim ? '은' : '는'}`;
}

export function stripSubject(text = '', name = '') {
  const escapedName = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(text)
    .replace(new RegExp(`^${escapedName}(이가|이는|이|가|은|는)?\\s*`), '')
    .replace(/^원아(가|는|은)?\s*/, '')
    .replace(/[.。]$/, '');
}

function nodeById(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id);
}

function evidenceOf(nodes = []) {
  return unique(nodes.flatMap((node) => node?.evidenceIds || []));
}

function speechText(node) {
  if (!node?.value) return '';
  return `"${node.value}"라고 말하였다`;
}

export function summarizeNode(node, card = {}) {
  if (!node) return '';
  if (node.type === 'speech') return speechText(node);
  return stripSubject(node.value, card.name);
}

function normalizeAction(value = '') {
  return clean(value)
    .replace(/하였다$/, '했다')
    .replace(/보았다$/, '보았다')
    .replace(/먹음$/, '먹는 모습')
    .replace(/쌓음$/, '쌓는 모습')
    .replace(/봄$/, '보는 모습')
    .replace(/함$/, '하는 모습')
    .replace(/듦$/, '드는 모습')
    .replace(/[.。]$/, '');
}

function asProcess(value = '') {
  const text = normalizeAction(value);
  if (!text) return '';
  if (/(모습|장면)$/.test(text)) return `${text}을 보이며`;
  if (/(했다|보았다|말했다|기다렸다|만들었다|쌓았다|놓았다|정리했다|참여했다|시작했다)$/.test(text)) {
    return `${text.replace(/(했다|보았다|말했다|기다렸다|만들었다|쌓았다|놓았다|정리했다|참여했다|시작했다)$/, '')}하며`;
  }
  if (/(하며|보며|두고|잡고|놓고)$/.test(text)) return text;
  return `${text}하며`;
}

function evidenceIdsForPlan(graph, plan) {
  const orderNodes = (plan.observationOrder || []).map((id) => nodeById(graph, id)).filter(Boolean);
  return {
    observation: evidenceOf(orderNodes),
    learning: plan.evidenceIds?.length ? plan.evidenceIds : evidenceOf(orderNodes),
    support: plan.evidenceIds?.length ? plan.evidenceIds : evidenceOf(orderNodes),
  };
}

export function buildB4SentencePlan({ card = {}, graph = {}, plan = {}, styleProfile = 'objective' } = {}) {
  const orderNodes = (plan.observationOrder || []).map((id) => nodeById(graph, id)).filter(Boolean);
  const actionNodes = orderNodes.filter((node) => node.type !== 'speech');
  const speechNode = orderNodes.find((node) => node.type === 'speech') || (graph.nodes || []).find((node) => node.type === 'speech');
  const focusNode = nodeById(graph, plan.focusEventId) || actionNodes[0] || speechNode;
  const secondaryNode = nodeById(graph, plan.secondaryEventId);
  const firstAction = normalizeAction(summarizeNode(actionNodes[0] || focusNode, card));
  const secondAction = normalizeAction(summarizeNode(actionNodes[1] || secondaryNode, card));
  const focusAction = normalizeAction(summarizeNode(focusNode, card));
  const primaryLanguage = B4_THEME_LANGUAGE[plan.primaryTheme] || {};
  const supportAction = clean((plan.supportActions || [])[0]?.text || primaryLanguage.supports?.[0]?.text || '구체적인 행동이 더 관찰될 때까지 살펴본 뒤 다음 지원을 정한다');
  const evidenceIds = evidenceIdsForPlan(graph, plan);

  return {
    child: clean(card.name || '원아'),
    topic: topic(card.name),
    firstAction,
    secondAction,
    focusAction,
    focusProcess: asProcess(focusAction) || '관찰된 흐름 안에서',
    focusActionConnector: asProcess(focusAction) || '다시 시도하며',
    speechText: speechNode ? speechText(speechNode) : '',
    supportAction,
    learningMeaning: primaryLanguage.learning || '',
    primaryTheme: plan.primaryTheme,
    secondaryTheme: plan.secondaryTheme,
    relation: plan.relation || 'single_event',
    styleProfile,
    hasSpeech: !!speechNode,
    hasPeer: !!graph.flags?.hasPeer,
    hasTeacherSupport: !!graph.flags?.hasTeacherSupport,
    evidenceIds,
  };
}

function render(pattern, sentencePlan) {
  return clean(pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => sentencePlan[key] || ''));
}

function isCandidateUsable(section, text, sentencePlan) {
  if (!text || /\{[a-zA-Z0-9_]+\}/.test(text)) return false;
  if (section === 'observation' && text.includes('이후') && !sentencePlan.secondAction) return false;
  if (text.includes('이 과정에서') && !sentencePlan.speechText) return false;
  if (/친구/.test(text) && !sentencePlan.hasPeer) return false;
  return true;
}

function sectionSource(section) {
  return ({
    observation: 'surface_observation',
    learning: 'surface_learning',
    support: 'surface_support',
  })[section] || 'surface';
}

export function createSurfaceCandidates({ section, card = {}, graph = {}, plan = {}, styleProfile = 'objective', mode = 'default' } = {}) {
  const sentencePlan = buildB4SentencePlan({ card, graph, plan, styleProfile });
  const bank = getApprovedPhraseBank({
    section,
    primaryTheme: plan.primaryTheme,
    secondaryTheme: plan.secondaryTheme,
    relation: plan.relation,
  });
  const sourceEvidence = sentencePlan.evidenceIds[section] || [];
  const rows = bank.map((item) => ({
    id: `b4_surface_${item.id}`,
    section,
    source: sectionSource(section),
    evidenceIds: sourceEvidence,
    focusEventId: plan.focusEventId,
    primaryTheme: plan.primaryTheme,
    secondaryTheme: plan.secondaryTheme,
    discourseRelation: plan.relation,
    patternId: section === 'support' ? '' : item.id,
    supportPatternId: section === 'support' ? item.id : '',
    actionId: section === 'support' ? (plan.supportActions || [])[0]?.id || 'surface_support' : '',
    text: render(item.pattern, sentencePlan),
    phraseBankId: item.id,
    surfaceType: item.length,
    mode,
  })).filter((item) => isCandidateUsable(section, item.text, sentencePlan));

  const seen = new Set();
  return rows.filter((row) => {
    const key = row.text.replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default createSurfaceCandidates;
