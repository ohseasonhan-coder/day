const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

function nodeById(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id);
}

function evidenceOf(nodes = [], fallback = []) {
  return unique([
    ...nodes.flatMap((node) => node?.evidenceIds || []),
    ...fallback,
  ]);
}

function relationTypeToMeaning(edgeType = '', theme = '') {
  if (edgeType === 'retry_after_setback' || theme === 'retry') return 'retry';
  if (edgeType === 'action_to_material_exploration' || theme === 'change_explore' || theme === 'compare') return 'exploration';
  if (edgeType === 'action_to_peer_interaction' || theme === 'peer_share' || theme === 'peer_help') return 'peerInteraction';
  if (edgeType === 'conflict_to_apology' || theme === 'conflict') return 'relationshipRepair';
  if (edgeType === 'action_to_self_care' || theme === 'selfhelp') return 'selfCare';
  if (edgeType === 'emotion_to_recovery' || theme === 'emotion_recovery') return 'emotionRecovery';
  if (theme === 'emotion_expression') return 'emotionCue';
  return 'eventChange';
}

function allowedExpressionsForTheme(theme = '') {
  return ({
    retry: ['retry_continue', 'try_again', 'adjust_method'],
    change_explore: ['observe_change', 'continue_exploration', 'compare_detail'],
    compare: ['compare_by_criterion', 'sort_or_group'],
    make: ['construct_shape', 'connect_materials'],
    language: ['express_with_words', 'name_observation'],
    question: ['ask_question', 'check_curiosity'],
    peer_share: ['share_play_flow', 'take_part_with_peer'],
    peer_help: ['ask_or_offer_help', 'exchange_help'],
    conflict: ['adjust_situation_with_words', 'restart_after_conflict'],
    rules: ['wait_turn', 'follow_sequence'],
    selfhelp: ['try_daily_routine', 'follow_simple_sequence'],
    movement: ['adjust_body_movement', 'try_movement_again'],
    roleplay: ['extend_role_scene', 'use_role_language'],
    emotion_expression: ['express_observed_feeling_signal'],
    emotion_recovery: ['return_to_play_flow'],
    story: ['connect_story_sequence'],
  })[theme] || ['connect_observed_flow'];
}

function blockedExpressionsForTheme(theme = '') {
  const common = ['diagnose_development', 'infer_hidden_emotion', 'add_peer_reaction', 'add_teacher_support'];
  return unique([
    ...common,
    ...({
      retry: ['confidence_growth', 'problem_solving_ability_growth'],
      peer_share: ['social_development', 'consideration_trait'],
      peer_help: ['cooperation_trait', 'empathy_growth'],
      conflict: ['conflict_resolved', 'social_development'],
      emotion_expression: ['emotion_regulation', 'recovery_without_evidence'],
      emotion_recovery: ['emotion_control_ability_growth'],
      make: ['creativity_growth', 'high_completion_quality'],
      language: ['language_development_growth'],
      movement: ['motor_ability_growth'],
      selfhelp: ['independence_completed'],
      compare: ['math_ability_growth'],
      change_explore: ['scientific_inquiry_ability_growth'],
    })[theme] || [],
  ]);
}

function makeUnit(base, fallbackEvidence = []) {
  const evidenceIds = unique([...(base.evidenceIds || []), ...fallbackEvidence]);
  if (!evidenceIds.length) return null;
  return {
    canCombineWith: [],
    cannotCombineWith: [],
    allowedExpressions: [],
    blockedExpressions: ['add_new_fact', 'add_new_emotion', 'add_new_support'],
    priority: 3,
    ...base,
    evidenceIds,
  };
}

export function buildB4MeaningUnits({ card = {}, graph = {}, plan = {} } = {}) {
  const orderNodes = (plan.observationOrder || []).map((id) => nodeById(graph, id)).filter(Boolean);
  const fallbackEvidence = evidenceOf(orderNodes, plan.evidenceIds || []);
  const units = [];

  orderNodes.forEach((node, index) => {
    const type = node.type === 'speech' ? 'directSpeech' : 'observationAction';
    const unit = makeUnit({
      id: `mu_observation_${index + 1}`,
      section: 'observation',
      type,
      theme: plan.primaryTheme || '',
      claim: type === 'directSpeech' ? 'direct speech preserved' : 'observed action preserved',
      sourceNodeIds: [node.id],
      evidenceIds: node.evidenceIds,
      priority: index + 1,
      allowedExpressions: type === 'directSpeech' ? ['quote_preserved', 'speech_connected_to_action'] : ['fact_recorded', 'sequence_preserved'],
      blockedExpressions: ['interpret_observation', 'add_motive', 'add_emotion'],
    }, fallbackEvidence);
    if (unit) units.push(unit);
  });

  const speechNodes = (graph.nodes || []).filter((node) => node.type === 'speech' && !orderNodes.some((item) => item.id === node.id));
  speechNodes.slice(0, 1).forEach((node, index) => {
    const unit = makeUnit({
      id: `mu_speech_extra_${index + 1}`,
      section: 'learningReading',
      type: 'directSpeech',
      theme: plan.primaryTheme || 'language',
      claim: 'direct speech connected to meaning',
      sourceNodeIds: [node.id],
      evidenceIds: node.evidenceIds,
      priority: 2,
      allowedExpressions: ['quote_preserved', 'speech_meaning_link'],
      blockedExpressions: ['change_quote_meaning', 'add_speech'],
    }, fallbackEvidence);
    if (unit) units.push(unit);
  });

  const relationEdges = graph.edges || [];
  const primaryEdge = relationEdges.find((edge) => edge.type === plan.relation) || relationEdges[0];
  const relationNodes = primaryEdge
    ? [nodeById(graph, primaryEdge.from), nodeById(graph, primaryEdge.to)].filter(Boolean)
    : orderNodes;
  const learningEvidence = evidenceOf(relationNodes, fallbackEvidence);
  const learningType = relationTypeToMeaning(plan.relation, plan.primaryTheme);
  const learningUnit = makeUnit({
    id: `mu_learning_${learningType}`,
    section: 'learningReading',
    type: learningType,
    theme: plan.primaryTheme || '',
    claim: allowedExpressionsForTheme(plan.primaryTheme)[0] || 'allowed learning meaning',
    sourceNodeIds: relationNodes.map((node) => node.id),
    evidenceIds: learningEvidence,
    priority: 1,
    canCombineWith: ['directSpeech', 'peerInteraction', 'eventChange'],
    cannotCombineWith: plan.primaryTheme === 'emotion_expression' ? ['emotionRecovery'] : [],
    allowedExpressions: allowedExpressionsForTheme(plan.primaryTheme),
    blockedExpressions: blockedExpressionsForTheme(plan.primaryTheme),
  }, fallbackEvidence);
  if (learningUnit) units.push(learningUnit);

  if (plan.secondaryTheme) {
    const secondaryType = relationTypeToMeaning('', plan.secondaryTheme);
    const secondaryUnit = makeUnit({
      id: `mu_learning_secondary_${secondaryType}`,
      section: 'learningReading',
      type: secondaryType,
      theme: plan.secondaryTheme,
      claim: allowedExpressionsForTheme(plan.secondaryTheme)[0] || 'secondary allowed meaning',
      sourceNodeIds: relationNodes.map((node) => node.id),
      evidenceIds: learningEvidence,
      priority: 2,
      canCombineWith: [learningType],
      cannotCombineWith: [],
      allowedExpressions: allowedExpressionsForTheme(plan.secondaryTheme),
      blockedExpressions: blockedExpressionsForTheme(plan.secondaryTheme),
    }, fallbackEvidence);
    if (secondaryUnit) units.push(secondaryUnit);
  }

  const teacherSupportNodes = (graph.nodes || []).filter((node) => node.type === 'teacher_support');
  teacherSupportNodes.slice(0, 1).forEach((node, index) => {
    const unit = makeUnit({
      id: `mu_actual_teacher_support_${index + 1}`,
      section: 'support',
      type: 'actualTeacherSupport',
      theme: plan.primaryTheme || '',
      claim: 'actual support preserved',
      sourceNodeIds: [node.id],
      evidenceIds: node.evidenceIds,
      priority: 1,
      allowedExpressions: ['actual_support_recorded'],
      blockedExpressions: ['add_new_support_action', 'change_support_completion'],
    }, fallbackEvidence);
    if (unit) units.push(unit);
  });

  (plan.supportActions || []).slice(0, 2).forEach((action, index) => {
    const unit = makeUnit({
      id: `mu_next_support_${action.id || index + 1}`,
      section: 'support',
      type: 'nextSupportPossibility',
      theme: plan.primaryTheme || '',
      claim: clean(action.text || action.id || 'next support possibility'),
      actionId: action.id || '',
      sourceNodeIds: relationNodes.map((node) => node.id),
      evidenceIds: learningEvidence,
      priority: index + 1,
      canCombineWith: ['actualTeacherSupport', learningType],
      cannotCombineWith: [],
      allowedExpressions: ['future_support_plan', 'connect_to_observed_flow'],
      blockedExpressions: ['completed_support_without_evidence', 'generic_support_only'],
    }, fallbackEvidence);
    if (unit) units.push(unit);
  });

  return unique(units.map((unit) => JSON.stringify(unit))).map((unit) => JSON.parse(unit));
}

export function meaningUnitsForSection(units = [], section = 'learning') {
  const sectionName = section === 'learning' ? 'learningReading' : section;
  return units.filter((unit) => unit.section === sectionName || (section === 'support' && unit.section === 'learningReading'));
}

export function meaningUnitEvidenceStats(units = []) {
  const linked = units.filter((unit) => (unit.evidenceIds || []).length);
  return {
    total: units.length,
    linked: linked.length,
    linkRate: units.length ? Math.round((linked.length / units.length) * 1000) / 10 : 100,
    sectionCounts: units.reduce((acc, unit) => {
      acc[unit.section] = (acc[unit.section] || 0) + 1;
      return acc;
    }, {}),
  };
}

export function candidateMeaningEvidenceOk(candidate = {}) {
  return !!(candidate.meaningUnitIds || []).length && !!(candidate.evidenceIds || []).length;
}

export default buildB4MeaningUnits;
