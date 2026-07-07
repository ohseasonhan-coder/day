import { B4_THEME_LANGUAGE } from './discoursePlan';

const unique = (values) => [...new Set(values.filter(Boolean))];

function nodeById(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id);
}

function evidenceOf(nodes = [], fallback = []) {
  return unique([...nodes.flatMap((node) => node?.evidenceIds || []), ...fallback]);
}

function nodesForEdge(graph, edge = {}) {
  return [nodeById(graph, edge.from), nodeById(graph, edge.to)].filter(Boolean);
}

function meaningIds(units = [], predicate, limit = 2) {
  return units.filter(predicate).slice(0, limit).map((unit) => unit.id);
}

function themeForFocus(basePlan = {}, graph = {}, focus = {}, preferred = '') {
  const themes = unique([preferred, ...(graph.themeIds || []), basePlan.primaryTheme, basePlan.secondaryTheme]);
  const tags = focus?.tags || [];
  if (tags.includes('retry') && themes.includes('retry')) return 'retry';
  if ((tags.includes('peer') || preferred === 'peer_share') && themes.includes('peer_share')) return 'peer_share';
  if ((tags.includes('conflict') || tags.includes('apology')) && themes.includes('conflict')) return 'conflict';
  if (tags.includes('self_care') && themes.includes('selfhelp')) return 'selfhelp';
  if ((tags.includes('material') || preferred === 'make') && themes.includes('make')) return 'make';
  if ((tags.includes('exploration') || preferred === 'change_explore') && themes.includes('change_explore')) return 'change_explore';
  if (tags.includes('speech') && themes.includes('language')) return 'language';
  return themes.find((theme) => B4_THEME_LANGUAGE[theme]) || basePlan.primaryTheme || '';
}

function semanticFootprint(graph = {}, focus = {}, secondary = {}, relation = '') {
  const nodes = [focus, secondary].filter(Boolean);
  const tags = unique(nodes.flatMap((node) => node.tags || []));
  return {
    actions: unique(tags.filter((tag) => ['retry', 'material', 'exploration', 'self_care', 'conflict', 'apology', 'peer'].includes(tag))),
    speech: nodes.some((node) => node.type === 'speech') || !!graph.flags?.hasSpeech,
    peerInteraction: tags.includes('peer') || relation === 'action_to_peer_interaction',
    change: ['retry_after_setback', 'action_to_material_exploration', 'emotion_to_recovery'].includes(relation),
  };
}

function buildCandidate({ id, focusType, relation, focus, secondary, primaryTheme, basePlan, graph, meaningUnits, score }) {
  if (!focus || !B4_THEME_LANGUAGE[primaryTheme]) return null;
  const secondaryNode = secondary && secondary.id !== focus.id ? secondary : null;
  const order = unique([secondaryNode?.id, focus.id]).filter(Boolean).slice(0, 2);
  const nodes = order.map((nodeId) => nodeById(graph, nodeId)).filter(Boolean);
  const evidenceIds = evidenceOf(nodes, basePlan.evidenceIds || []);
  if (!evidenceIds.length) return null;
  const language = B4_THEME_LANGUAGE[primaryTheme] || {};
  const secondaryTheme = basePlan.secondaryTheme && basePlan.secondaryTheme !== primaryTheme ? basePlan.secondaryTheme : null;
  const secondaryLanguage = secondaryTheme ? B4_THEME_LANGUAGE[secondaryTheme] : null;
  const observationMeaningUnitIds = meaningIds(meaningUnits, (unit) =>
    unit.section === 'observation' && (unit.sourceNodeIds || []).some((nodeId) => order.includes(nodeId)), 3);
  const learningMeaningUnitIds = meaningIds(meaningUnits, (unit) =>
    unit.section === 'learningReading' && (unit.theme === primaryTheme || (unit.sourceNodeIds || []).some((nodeId) => order.includes(nodeId))), 2);
  const fallbackLearning = meaningIds(meaningUnits, (unit) => unit.section === 'learningReading', 2);
  const supportMeaningUnitIds = meaningIds(meaningUnits, (unit) =>
    unit.section === 'support' && (!unit.theme || unit.theme === primaryTheme || unit.theme === basePlan.primaryTheme), 2);
  const allScoped = unique([...observationMeaningUnitIds, ...learningMeaningUnitIds, ...supportMeaningUnitIds, ...fallbackLearning]);
  return {
    ...basePlan,
    id,
    candidateDiscoursePlan: true,
    focusEventId: focus.id,
    secondaryEventId: secondaryNode?.id || '',
    focusType,
    relation,
    observationOrder: order,
    primaryTheme,
    secondaryTheme,
    learningFocus: [primaryTheme, secondaryTheme].filter(Boolean),
    supportFocus: language.supportFocus || basePlan.supportFocus,
    allowedClaims: unique([...(language.claims || []), ...(secondaryLanguage?.claims || []).slice(0, 1)]),
    blockedClaims: unique([...(basePlan.blockedClaims || []), ...(language.blocked || []), ...(secondaryLanguage?.blocked || [])]),
    supportActions: language.supports || basePlan.supportActions,
    evidenceIds,
    observationEvidenceIds: evidenceIds,
    observationMeaningUnitIds,
    learningMeaningUnitIds: learningMeaningUnitIds.length ? learningMeaningUnitIds : fallbackLearning,
    supportMeaningUnitIds,
    excludedMeaningUnitIds: meaningUnits.map((unit) => unit.id).filter((idValue) => !allScoped.includes(idValue)),
    semanticFootprint: semanticFootprint(graph, focus, secondaryNode, relation),
    planPriorityScore: score,
  };
}

function edgeByType(graph, type) {
  return (graph.edges || []).find((edge) => edge.type === type);
}

function firstNodeWithTag(graph, tag) {
  return (graph.nodes || []).find((node) => (node.tags || []).includes(tag) && !['child', 'peer', 'teacher'].includes(node.type));
}

function baseCandidate(basePlan, graph, meaningUnits) {
  const focus = nodeById(graph, basePlan.focusEventId);
  const secondary = nodeById(graph, basePlan.secondaryEventId);
  return buildCandidate({
    id: 'plan_base_01',
    focusType: 'base_single_plan',
    relation: basePlan.relation || 'single_event',
    focus,
    secondary,
    primaryTheme: basePlan.primaryTheme,
    basePlan,
    graph,
    meaningUnits,
    score: 72,
  });
}

export function buildB4CandidateDiscoursePlans({ graph = {}, basePlan = {}, meaningUnits = [] } = {}) {
  if (basePlan.sparse || !basePlan.focusEventId) return [];
  const candidates = [baseCandidate(basePlan, graph, meaningUnits)];
  const retryEdge = edgeByType(graph, 'retry_after_setback');
  if (retryEdge) {
    const [from, to] = nodesForEdge(graph, retryEdge);
    candidates.push(buildCandidate({
      id: 'plan_process_change_01',
      focusType: 'process_change',
      relation: retryEdge.type,
      focus: to || from,
      secondary: from,
      primaryTheme: themeForFocus(basePlan, graph, to || from, 'retry'),
      basePlan,
      graph,
      meaningUnits,
      score: 94,
    }));
  }

  const speech = (graph.nodes || []).find((node) => node.type === 'speech');
  if (speech) {
    const edge = (graph.edges || []).find((item) => item.to === speech.id || item.from === speech.id);
    const pair = nodesForEdge(graph, edge);
    candidates.push(buildCandidate({
      id: 'plan_direct_speech_01',
      focusType: 'direct_speech',
      relation: edge?.type || 'action_to_expression',
      focus: speech,
      secondary: pair.find((node) => node.id !== speech.id) || nodeById(graph, basePlan.focusEventId),
      primaryTheme: themeForFocus(basePlan, graph, speech, graph.flags?.hasPeer ? 'peer_share' : 'language'),
      basePlan,
      graph,
      meaningUnits,
      score: 86,
    }));
  }

  const peerEdge = edgeByType(graph, 'action_to_peer_interaction');
  if (peerEdge) {
    const [from, to] = nodesForEdge(graph, peerEdge);
    candidates.push(buildCandidate({
      id: 'plan_peer_interaction_01',
      focusType: 'peer_interaction',
      relation: peerEdge.type,
      focus: to || from,
      secondary: from,
      primaryTheme: themeForFocus(basePlan, graph, to || from, 'peer_share'),
      basePlan,
      graph,
      meaningUnits,
      score: 88,
    }));
  }

  const materialEdge = edgeByType(graph, 'action_to_material_exploration');
  if (materialEdge) {
    const [from, to] = nodesForEdge(graph, materialEdge);
    const materialNode = firstNodeWithTag(graph, 'material') || to || from;
    const preferredTheme = (graph.themeIds || []).includes('make') ? 'make' : 'change_explore';
    candidates.push(buildCandidate({
      id: preferredTheme === 'make' ? 'plan_material_make_01' : 'plan_explore_compare_01',
      focusType: preferredTheme === 'make' ? 'material_construction' : 'explore_compare',
      relation: materialEdge.type,
      focus: materialNode,
      secondary: from,
      primaryTheme: themeForFocus(basePlan, graph, materialNode, preferredTheme),
      basePlan,
      graph,
      meaningUnits,
      score: 84,
    }));
  }

  const selfCare = firstNodeWithTag(graph, 'self_care');
  if (selfCare) {
    candidates.push(buildCandidate({
      id: 'plan_self_care_01',
      focusType: 'self_care',
      relation: 'action_to_self_care',
      focus: selfCare,
      secondary: null,
      primaryTheme: 'selfhelp',
      basePlan,
      graph,
      meaningUnits,
      score: 82,
    }));
  }

  const conflictEdge = edgeByType(graph, 'conflict_to_apology');
  if (conflictEdge) {
    const [from, to] = nodesForEdge(graph, conflictEdge);
    candidates.push(buildCandidate({
      id: 'plan_conflict_adjust_01',
      focusType: 'conflict_adjustment',
      relation: conflictEdge.type,
      focus: to || from,
      secondary: from,
      primaryTheme: 'conflict',
      basePlan,
      graph,
      meaningUnits,
      score: 92,
    }));
  }

  const objectiveFocus = nodeById(graph, basePlan.focusEventId);
  candidates.push(buildCandidate({
    id: 'plan_objective_short_01',
    focusType: 'short_objective',
    relation: basePlan.relation || 'single_event',
    focus: objectiveFocus,
    secondary: null,
    primaryTheme: basePlan.primaryTheme,
    basePlan,
    graph,
    meaningUnits,
    score: 76,
  }));

  const seen = new Set();
  return candidates
    .filter(Boolean)
    .filter((plan) => {
      const key = [plan.focusType, plan.focusEventId, plan.secondaryEventId, plan.primaryTheme].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.planPriorityScore || 0) - (a.planPriorityScore || 0) || a.id.localeCompare(b.id))
    .slice(0, 4);
}

export default buildB4CandidateDiscoursePlans;
