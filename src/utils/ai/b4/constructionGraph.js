import { B4_THEME_LANGUAGE } from './discoursePlan';
import { buildB4SentencePlan, summarizeNode, topic } from './surfaceRealizer';
import { meaningUnitsForSection } from './meaningUnits';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

function nodeById(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id);
}

function unitByType(units = [], type) {
  return units.find((unit) => unit.type === type);
}

function evidenceOf(units = []) {
  return unique(units.flatMap((unit) => unit.evidenceIds || []));
}

function render(pattern = '', vars = {}) {
  return clean(pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => vars[key] || ''));
}

function finish(value = '') {
  const text = clean(value);
  return text && !/[.!?]["']?$/.test(text) ? `${text}.` : text;
}

function actionSummary(graph, plan, card) {
  const focus = nodeById(graph, plan.focusEventId);
  const secondary = nodeById(graph, plan.secondaryEventId);
  const values = [focus, secondary].map((node) => summarizeNode(node, card)).filter(Boolean);
  return values[0] || clean(card.source || '');
}

function supportAction(plan) {
  return clean((plan.supportActions || [])[0]?.text || (B4_THEME_LANGUAGE[plan.primaryTheme]?.supports || [])[0]?.text || 'observed flow support');
}

function learningMeaning(plan) {
  return clean((B4_THEME_LANGUAGE[plan.primaryTheme] || {}).learning || 'observed meaning connected to play');
}

export const TEACHER_APPROVED_CONSTRUCTION_BANK = [
  {
    id: 'construction_retry_process',
    section: 'learning',
    theme: 'retry',
    discourseRelation: 'retry_after_setback',
    meaningUnitTypes: ['retry'],
    skeleton: '{childTopic} {focusProcess} {learningMeaning}.',
    shortSkeleton: '{childTopic} {learningMeaning}.',
    twoSentenceSkeleton: '{childTopic} {focusAction}. {learningMeaning}.',
    objectiveSkeleton: '{childTopic} {focusProcess} 시도를 이어 갔다.',
    warmSkeleton: '{childTopic} {focusProcess} 놀이를 이어 갔다.',
    blockedClaims: ['confidence_growth', 'problem_solving_ability_growth'],
    qualityTags: ['teacher_style', 'safe', 'process'],
    verified: true,
  },
  {
    id: 'construction_explore_change',
    section: 'learning',
    theme: 'change_explore',
    discourseRelation: 'action_to_material_exploration',
    meaningUnitTypes: ['exploration'],
    skeleton: '{childTopic} {focusProcess} 변화와 특징을 살펴보았다.',
    shortSkeleton: '{childTopic} 탐색을 이어 갔다.',
    twoSentenceSkeleton: '{childTopic} {focusAction}. 변화에 다시 주의를 기울였다.',
    objectiveSkeleton: '{childTopic} 관찰한 내용을 행동으로 확인해 보았다.',
    warmSkeleton: '{childTopic} 궁금한 지점을 따라 탐색을 이어 갔다.',
    blockedClaims: ['scientific_inquiry_ability_growth'],
    qualityTags: ['teacher_style', 'safe', 'specific'],
    verified: true,
  },
  {
    id: 'construction_make_material',
    section: 'learning',
    theme: 'make',
    discourseRelation: 'action_to_material_exploration',
    meaningUnitTypes: ['eventChange'],
    skeleton: '{childTopic} {focusProcess} 재료의 형태를 구성해 보았다.',
    shortSkeleton: '{childTopic} 재료를 사용해 구성해 보았다.',
    twoSentenceSkeleton: '{childTopic} {focusAction}. 재료의 형태를 바꾸어 표현했다.',
    objectiveSkeleton: '{childTopic} 재료를 연결하며 형태를 만들었다.',
    warmSkeleton: '{childTopic} 재료를 다루며 표현을 이어 갔다.',
    blockedClaims: ['creativity_growth', 'high_completion_quality'],
    qualityTags: ['teacher_style', 'safe', 'specific'],
    verified: true,
  },
  {
    id: 'construction_language_speech',
    section: 'learning',
    theme: 'language',
    discourseRelation: 'action_to_expression',
    meaningUnitTypes: ['directSpeech', 'eventChange'],
    skeleton: '{childTopic} {speechText} 표현하며 {learningMeaning}.',
    shortSkeleton: '{childTopic} 말로 경험을 표현했다.',
    twoSentenceSkeleton: '{childTopic} {speechText}. 경험한 내용을 말로 연결했다.',
    objectiveSkeleton: '{childTopic} 직접 발화로 관찰한 내용을 나타냈다.',
    warmSkeleton: '{childTopic} 자신의 표현으로 장면을 이어 갔다.',
    blockedClaims: ['language_development_growth'],
    qualityTags: ['teacher_style', 'safe', 'speech'],
    verified: true,
  },
  {
    id: 'construction_peer_flow',
    section: 'learning',
    theme: 'peer_share',
    discourseRelation: 'action_to_peer_interaction',
    meaningUnitTypes: ['peerInteraction'],
    skeleton: '{childTopic} {focusProcess} 또래와 놀이 흐름을 함께 이어 갔다.',
    shortSkeleton: '{childTopic} 또래와 놀이에 참여했다.',
    twoSentenceSkeleton: '{childTopic} {focusAction}. 또래와 같은 흐름 안에서 놀이했다.',
    objectiveSkeleton: '{childTopic} 또래와 같은 자료나 역할을 나누었다.',
    warmSkeleton: '{childTopic} 친구와 함께하는 놀이 흐름에 머물렀다.',
    blockedClaims: ['social_development', 'consideration_trait'],
    qualityTags: ['teacher_style', 'safe', 'peer'],
    verified: true,
  },
  {
    id: 'construction_conflict_adjust',
    section: 'learning',
    theme: 'conflict',
    discourseRelation: 'conflict_to_apology',
    meaningUnitTypes: ['relationshipRepair'],
    skeleton: '{childTopic} {focusProcess} 상황을 다시 조정해 보았다.',
    shortSkeleton: '{childTopic} 갈등 상황을 조정해 보았다.',
    twoSentenceSkeleton: '{childTopic} {focusAction}. 이후 놀이 흐름을 다시 살펴보았다.',
    objectiveSkeleton: '{childTopic} 말과 행동으로 상황을 조정했다.',
    warmSkeleton: '{childTopic} 관계 안에서 다시 이어 갈 방법을 경험했다.',
    blockedClaims: ['conflict_resolved', 'social_development'],
    qualityTags: ['teacher_style', 'safe', 'relationship'],
    verified: true,
  },
  {
    id: 'construction_support_future',
    section: 'support',
    theme: '*',
    discourseRelation: '*',
    meaningUnitTypes: ['nextSupportPossibility'],
    skeleton: '다음에는 관찰된 놀이 흐름과 연결해 {supportAction}.',
    shortSkeleton: '{supportAction}.',
    twoSentenceSkeleton: '관찰된 행동 흐름을 먼저 살펴본다. 이후 {supportAction}.',
    objectiveSkeleton: '관찰된 행동 흐름에 맞추어 {supportAction}.',
    warmSkeleton: '같은 놀이 흐름 안에서 {supportAction}.',
    blockedClaims: ['generic_support_only', 'completed_support_without_evidence'],
    qualityTags: ['teacher_style', 'safe', 'support'],
    verified: true,
  },
  {
    id: 'construction_support_choice',
    section: 'support',
    theme: '*',
    discourseRelation: '*',
    meaningUnitTypes: ['nextSupportPossibility'],
    skeleton: '관찰된 장면이 이어질 때 선택지나 자료를 조정해 {supportAction}.',
    shortSkeleton: '선택지와 자료를 조정해 {supportAction}.',
    twoSentenceSkeleton: '{focusAction} 장면을 다시 확인한다. 필요한 경우 선택지나 자료를 조정한다.',
    objectiveSkeleton: '상황에 맞는 자료와 순서를 마련해 본다.',
    warmSkeleton: '아이가 이어 가는 방향을 기다리며 자료와 순서를 조정해 본다.',
    blockedClaims: ['generic_support_only', 'completed_support_without_evidence'],
    qualityTags: ['teacher_style', 'safe', 'support_specific'],
    verified: true,
  },
  {
    id: 'construction_observation_compact',
    section: 'observation',
    theme: '*',
    discourseRelation: '*',
    meaningUnitTypes: ['observationAction'],
    skeleton: '{childTopic} {focusAction}.',
    shortSkeleton: '{childTopic} {focusAction}.',
    twoSentenceSkeleton: '{childTopic} {focusAction}. {secondAction}.',
    objectiveSkeleton: '{childTopic} {focusAction}.',
    warmSkeleton: '{childTopic} {focusAction}.',
    blockedClaims: ['interpret_observation'],
    qualityTags: ['teacher_style', 'safe', 'fact_record'],
    verified: true,
  },
];

export const TEACHER_APPROVED_CONSTRUCTION_REQUIREMENTS = [
  'section',
  'theme',
  'discourseRelation',
  'requiredClaims',
  'blockedClaims',
  'meaningUnitTypes',
  'evidenceConditions',
  'skeleton',
  'shortSkeleton',
  'twoSentenceSkeleton',
  'objectiveSkeleton',
  'warmSkeleton',
  'forbiddenExpressions',
  'regressionTestStatus',
];

export function validateTeacherApprovedConstructionProposal(row = {}) {
  const missing = TEACHER_APPROVED_CONSTRUCTION_REQUIREMENTS.filter((key) => {
    const value = row[key];
    if (Array.isArray(value)) return value.length === 0;
    return !String(value || '').trim();
  });
  const copiedTeacherText = !!row.teacherEditedText || !!row.rawTeacherMemo || !!row.generatedFullText || !!row.sourceRecordText;
  const passedRegression = row.regressionTestStatus === 'passed';
  return {
    ok: missing.length === 0 && !copiedTeacherText && passedRegression,
    missing,
    copiedTeacherText,
    passedRegression,
    metadataOnly: true,
  };
}

export const CONSTRUCTION_GRAPH = [
  { id: 'observation_action_to_speech', section: 'observation', startTypes: ['observationAction'], nextTypes: ['directSpeech'], connectors: ['after', 'with'], endingPatterns: ['fact_record'], maxClauses: 2, styleProfile: '*', requiredEvidence: true, blockedClaims: ['interpret_observation'], lengthRange: [20, 120] },
  { id: 'learning_retry_peer_flow', section: 'learning', startTypes: ['retry'], nextTypes: ['peerInteraction'], connectors: ['then', 'while'], endingPatterns: ['meaning_flow'], maxClauses: 2, styleProfile: '*', requiredEvidence: true, blockedClaims: ['confidence_growth', 'social_development'], lengthRange: [28, 115] },
  { id: 'learning_explore_speech_flow', section: 'learning', startTypes: ['exploration'], nextTypes: ['directSpeech'], connectors: ['with_speech'], endingPatterns: ['meaning_flow'], maxClauses: 2, styleProfile: '*', requiredEvidence: true, blockedClaims: ['ability_growth'], lengthRange: [28, 115] },
  { id: 'learning_relationship_repair', section: 'learning', startTypes: ['relationshipRepair'], nextTypes: ['directSpeech'], connectors: ['after'], endingPatterns: ['meaning_flow'], maxClauses: 2, styleProfile: '*', requiredEvidence: true, blockedClaims: ['conflict_resolved'], lengthRange: [28, 115] },
  { id: 'support_learning_to_future', section: 'support', startTypes: ['nextSupportPossibility'], nextTypes: ['actualTeacherSupport'], connectors: ['future'], endingPatterns: ['future_plan'], maxClauses: 2, styleProfile: '*', requiredEvidence: true, blockedClaims: ['completed_support_without_evidence'], lengthRange: [30, 135] },
];

function matchedBankRows(section, plan, units) {
  return TEACHER_APPROVED_CONSTRUCTION_BANK.filter((row) => {
    if (row.section !== section) return false;
    if (row.theme !== '*' && row.theme !== plan.primaryTheme && row.theme !== plan.secondaryTheme) return false;
    if (row.discourseRelation !== '*' && row.discourseRelation !== plan.relation) return false;
    return row.meaningUnitTypes.some((type) => units.some((unit) => unit.type === type));
  });
}

function varsFor({ card, graph, plan, styleProfile }) {
  const sentencePlan = buildB4SentencePlan({ card, graph, plan, styleProfile });
  const focusAction = actionSummary(graph, plan, card);
  const secondary = summarizeNode(nodeById(graph, plan.secondaryEventId), card);
  return {
    ...sentencePlan,
    childTopic: topic(card.name),
    focusAction,
    secondAction: secondary,
    focusProcess: sentencePlan.focusProcess || focusAction,
    speechText: sentencePlan.speechText,
    supportAction: supportAction(plan),
    learningMeaning: learningMeaning(plan),
  };
}

function buildFromBank(row, units, context, index) {
  const selectedUnits = row.meaningUnitTypes.flatMap((type) => units.filter((unit) => unit.type === type)).slice(0, 2);
  const vars = varsFor(context);
  const skeletons = [
    ['skeleton', row.skeleton],
    ['short', row.shortSkeleton],
    ['two_sentence', row.twoSentenceSkeleton],
    ['objective', row.objectiveSkeleton],
    ['warm', row.warmSkeleton],
  ];
  return skeletons.map(([kind, pattern], variantIndex) => ({
    id: `b4_construct_${row.id}_${kind}_${index + variantIndex}`,
    section: row.section,
    source: 'construction_graph',
    evidenceIds: evidenceOf(selectedUnits),
    meaningUnitIds: selectedUnits.map((unit) => unit.id),
    focusEventId: context.plan.focusEventId,
    primaryTheme: context.plan.primaryTheme,
    secondaryTheme: context.plan.secondaryTheme,
    discourseRelation: context.plan.relation,
    patternId: row.section === 'support' ? '' : `${row.id}_${kind}`,
    supportPatternId: row.section === 'support' ? `${row.id}_${kind}` : '',
    actionId: row.section === 'support' ? (context.plan.supportActions || [])[0]?.id || 'construction_support' : '',
    text: finish(render(pattern, vars)),
    constructionId: row.id,
    constructionVariant: kind,
    meaningUnitCombination: selectedUnits.map((unit) => unit.type).join('+'),
    qualityTags: row.qualityTags,
  }));
}

function buildGraphSpecific(section, units, context) {
  const vars = varsFor(context);
  const candidates = [];
  const directSpeech = unitByType(units, 'directSpeech');
  const retry = unitByType(units, 'retry');
  const peer = unitByType(units, 'peerInteraction');
  const exploration = unitByType(units, 'exploration');
  const support = unitByType(units, 'nextSupportPossibility');

  if (section === 'learning' && retry && peer) {
    const selected = [retry, peer];
    candidates.push({
      id: 'b4_construct_retry_peer_split',
      section,
      source: 'construction_graph',
      evidenceIds: evidenceOf(selected),
      meaningUnitIds: selected.map((unit) => unit.id),
      focusEventId: context.plan.focusEventId,
      primaryTheme: context.plan.primaryTheme,
      secondaryTheme: context.plan.secondaryTheme,
      discourseRelation: context.plan.relation,
      patternId: 'construct_retry_peer_split',
      supportPatternId: '',
      text: finish(`${vars.childTopic} ${vars.focusProcess} 놀이를 이어 갔다. 또래와 같은 흐름 안에서 차례나 역할을 경험했다.`),
      constructionId: 'retry_to_peer_flow',
      constructionVariant: 'two_sentence',
      meaningUnitCombination: 'retry+peerInteraction',
    });
  }

  if (section === 'learning' && exploration && directSpeech && vars.speechText) {
    const selected = [exploration, directSpeech];
    candidates.push({
      id: 'b4_construct_explore_speech',
      section,
      source: 'construction_graph',
      evidenceIds: evidenceOf(selected),
      meaningUnitIds: selected.map((unit) => unit.id),
      focusEventId: context.plan.focusEventId,
      primaryTheme: context.plan.primaryTheme,
      secondaryTheme: context.plan.secondaryTheme,
      discourseRelation: context.plan.relation,
      patternId: 'construct_explore_speech',
      supportPatternId: '',
      text: finish(`${vars.childTopic} ${vars.speechText} 말하며 관찰한 변화에 주의를 기울였다.`),
      constructionId: 'explore_to_speech',
      constructionVariant: 'speech_focus',
      meaningUnitCombination: 'exploration+directSpeech',
    });
  }

  if (section === 'support' && support) {
    const selected = [support];
    candidates.push({
      id: 'b4_construct_support_flow_specific',
      section,
      source: 'construction_graph',
      evidenceIds: evidenceOf(selected),
      meaningUnitIds: selected.map((unit) => unit.id),
      focusEventId: context.plan.focusEventId,
      primaryTheme: context.plan.primaryTheme,
      secondaryTheme: context.plan.secondaryTheme,
      discourseRelation: context.plan.relation,
      patternId: '',
      supportPatternId: 'construct_support_flow_specific',
      actionId: context.plan.supportActions?.[0]?.id || 'construction_support',
      text: finish('관찰된 놀이 흐름이 이어질 수 있도록 자료, 순서, 선택지를 조정해 본다.'),
      constructionId: 'support_learning_to_future',
      constructionVariant: 'specific_future',
      meaningUnitCombination: 'nextSupportPossibility',
    });
  }
  return candidates;
}

export function createConstructionCandidates({ section, card = {}, graph = {}, plan = {}, styleProfile = 'objective', meaningUnits = [] } = {}) {
  const units = meaningUnitsForSection(meaningUnits, section);
  if (!units.length) return [];
  const context = { section, card, graph, plan, styleProfile };
  const bankRows = matchedBankRows(section, plan, units);
  const bankCandidates = bankRows.flatMap((row, index) => buildFromBank(row, units, context, index * 10));
  const graphCandidates = buildGraphSpecific(section, units, context);
  const seen = new Set();
  return [...graphCandidates, ...bankCandidates]
    .filter((candidate) => candidate.text && candidate.evidenceIds.length && candidate.meaningUnitIds.length)
    .filter((candidate) => {
      const key = clean(candidate.text);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export default createConstructionCandidates;
