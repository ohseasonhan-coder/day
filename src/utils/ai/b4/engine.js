import { auditObservationCopy } from '../observationAudit';
import { parseTargetSections } from '../targetQuality';
import { buildB2FactCard, generateB2 } from '../b2/engine';
import { generateB3 } from '../b3/engine';
import { buildB4EventGraph } from './eventGraph';
import { B4_THEME_LANGUAGE, buildB4DiscoursePlan } from './discoursePlan';
import { B4_MAX_CANDIDATES_PER_SECTION, B4_MIN_CANDIDATES_PER_SECTION, B4_SAFE_SCORE_MIN, getB4StyleProfile } from './config';
import { getB4RecentPatternPenalty, getB4RecentPatterns, getB4RhythmPenalty } from './patternMemory';
import { getTeacherPreferenceWeight } from './teacherPreferenceProfile';
import { createSurfaceCandidates } from './surfaceRealizer';
import { createConstructionCandidates } from './constructionGraph';
import { buildB4MeaningUnits, candidateMeaningEvidenceOk, meaningUnitEvidenceStats, meaningUnitsForSection } from './meaningUnits';
import { applyRewriteLoop } from './selfCritic';
import { buildB4CandidateDiscoursePlans } from './multiDiscoursePlan';
import { buildClaimLedger, compressCandidate, sectionMeaningOverlapSummary } from './semanticCompressor';
import { planContrastiveRanker, scorePlanOutcome } from './planContrastiveRanker';
import { lintSurfaceText, polishSurfaceText, surfaceIssueSummary } from './sentenceLinter';
import { judgeTeacherStyle } from './teacherStyleJudge';
import { contrastiveRankCandidates } from './contrastiveRanker';
import { guardText } from './contextGuard';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];
const finish = (value) => {
  const text = clean(value);
  return text && !/[.!?]["”']?$/.test(text) ? `${text}.` : text;
};
const hash = (value) => { let h = 0; for (const ch of String(value || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

const FORBIDDEN = /(자신감|문제 해결 능력|사회성|발달|향상|뛰어남|우수|완성|이해하였다|배려심|주도성|창의성|정서 조절|극복)/;
const GENERIC_SUPPORT = /(격려한다|질문한다|자료를 제공한다|기회를 제공한다|관찰한다)\.?$/;
const SUPPORT_DONE = /(제공하였다|격려하였다|지원하였다|도와주었다|마련해 주었다|안내하였다)\.?$/;
const BAD_CONNECTORS = /(해 보며\.|수 있도록.{0,18}수 있도록|과정에서.{0,20}과정에서|흐름.{0,20}흐름)/;
const LABELS = ['관찰내용', '배움 읽기', '교사 지원 및 다음 계획'];

function topic(name = '원아') {
  const value = clean(name) || '원아';
  const code = value.charCodeAt(value.length - 1);
  const batchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${batchim ? '은' : '는'}`;
}

function stripSubject(text = '', name = '') {
  const escapedName = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(text)
    .replace(new RegExp(`^${escapedName}(이가|이는|이|가|은|는)?\\s*`), '')
    .replace(/^원아(가|는|은)?\s*/, '')
    .replace(/[.。]$/, '');
}

function tokenList(text = '') {
  return unique(String(text || '').replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/)
    .map((word) => word.replace(/(은|는|이|가|을|를|으로|에서|에게|하며|하고|했다|하였다|한다|본다|보았다)$/, ''))
    .filter((word) => word.length >= 2));
}

function tokenOverlap(a, b) {
  const left = tokenList(a);
  const right = new Set(tokenList(b));
  return left.length ? left.filter((word) => right.has(word) || [...right].some((item) => item.includes(word) || word.includes(item))).length / left.length : 0;
}

function nodeById(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id);
}

function evidenceOf(nodes = []) {
  return unique(nodes.flatMap((node) => node?.evidenceIds || []));
}

function isTeacherSupportFact(fact = {}) {
  const text = String(fact.text || '');
  return fact.type === 'teacher_support' || ['교사', '선생님', '援먯궗', '?좎깮'].some((marker) => marker && text.includes(marker));
}

function meaningRefs(meaningUnits = [], section = 'learning', fallbackEvidence = [], plan = {}) {
  const planIds = ({
    observation: plan.observationMeaningUnitIds,
    learning: plan.learningMeaningUnitIds,
    support: plan.supportMeaningUnitIds,
  })[section] || [];
  const planned = planIds.length ? meaningUnits.filter((unit) => planIds.includes(unit.id)) : [];
  const units = (planned.length ? planned : meaningUnitsForSection(meaningUnits, section)).filter((unit) => (unit.evidenceIds || []).length);
  return {
    meaningUnitIds: units.map((unit) => unit.id),
    evidenceIds: unique([...units.flatMap((unit) => unit.evidenceIds || []), ...fallbackEvidence]),
  };
}

function summarizeNode(node, card) {
  if (!node) return '';
  if (node.type === 'speech') return `"${node.value}"라고 말하였다`;
  return stripSubject(node.value, card.name);
}

function compactObservation(orderNodes, card, styleProfile) {
  const child = topic(card.name);
  const speech = orderNodes.find((node) => node.type === 'speech');
  const actions = orderNodes.filter((node) => node.type !== 'speech').map((node) => summarizeNode(node, card)).filter(Boolean);
  if (!actions.length && speech) return finish(`${child} ${summarizeNode(speech, card)}`);
  const first = actions[0] || stripSubject(card.source, card.name);
  const second = actions[1];
  if (styleProfile === 'concise') {
    return finish(`${child} ${[first, second].filter(Boolean).join(' 뒤 ')}${speech ? `, ${summarizeNode(speech, card)}` : ''}`);
  }
  if (speech) return finish(`${child} ${first}${second ? `, 이후 ${second}` : ''}. 이 과정에서 ${summarizeNode(speech, card)}`);
  return finish(`${child} ${[first, second].filter(Boolean).join(' 뒤 ')}`);
}

function splitTwoObservation(orderNodes, card) {
  const child = topic(card.name);
  const speech = orderNodes.find((node) => node.type === 'speech');
  const actions = orderNodes.filter((node) => node.type !== 'speech').map((node) => summarizeNode(node, card)).filter(Boolean);
  const first = finish(`${child} ${actions.slice(0, 2).join(' 뒤 ') || stripSubject(card.source, card.name)}`);
  if (!speech) return first;
  return `${first} ${finish(`이후 ${summarizeNode(speech, card)}`)}`;
}

function styleConnect(profile) {
  return ({
    objective: { process: '이 과정에서', end: '관찰되었다', support: '다음에는' },
    warm: { process: '그 흐름 안에서', end: '보였다', support: '이후 놀이에서도' },
    concise: { process: '이때', end: '나타났다', support: '다음에는' },
    parent_share: { process: '놀이 중', end: '보였습니다', support: '가정에서도 이어 볼 수 있도록 원에서는' },
    teacher_eval: { process: '해당 장면에서', end: '확인된다', support: '교사는 다음 놀이에서' },
  })[profile] || { process: '이 과정에서', end: '관찰되었다', support: '다음에는' };
}

function learningText(themeId, secondaryTheme, card, profile, variant, focusSummary = '') {
  const lang = B4_THEME_LANGUAGE[themeId] || B4_THEME_LANGUAGE.language;
  const child = topic(card.name);
  const style = styleConnect(profile);
  const secondary = secondaryTheme && B4_THEME_LANGUAGE[secondaryTheme] ? B4_THEME_LANGUAGE[secondaryTheme].learning : '';
  const focus = clean(focusSummary)
    .replace(/(하였다|했다|보았다|말하였다|나타났다)\.?$/, '')
    .replace(/먹음$/, '먹는 모습')
    .replace(/봄$/, '보는 모습')
    .replace(/함$/, '하는 모습')
    .replace(/듦$/, '드는 모습');
  const focusPrefix = focus ? (/(모습|장면)$/.test(focus) ? `${focus}을 보이며` : `${focus}는 과정에서`) : style.process;
  const focusFlow = focus ? (/(모습|장면)$/.test(focus) ? `${focus}을 보이며` : `${focus}며`) : '한 가지 흐름을 이어 가며';
  const rows = [
    `${child} ${lang.learning}.`,
    `${child} ${focusPrefix} ${lang.learning}.`,
    `${child} ${style.process} ${lang.learning}.`,
    `${child} ${lang.learning}${secondary ? ` 또한 ${secondary}` : ''}.`,
    `${child} ${focusFlow} ${lang.learning}.`,
    `${child} 한 가지 흐름을 이어 가며 ${lang.learning}.`,
  ];
  if (profile === 'warm') rows.push(`${child} 자신의 속도로 ${lang.learning}.`);
  if (profile === 'concise') rows.push(`${child} ${lang.claims[0]}.`);
  if (profile === 'parent_share') rows.push(`${child} 놀이 속에서 ${lang.learning}.`);
  if (profile === 'teacher_eval') rows.push(`${child} ${lang.claims[0]}는 점이 관찰된다.`);
  return finish(rows[variant % rows.length]);
}

function supportText(action, card, profile, hasActualSupport, teacherSupportText, variant) {
  const style = styleConnect(profile);
  const actionText = clean(action?.text || '구체적인 행동을 더 관찰한 뒤 다음 지원을 정한다').replace(/[.]$/, '');
  const actual = hasActualSupport && teacherSupportText ? finish(`${stripSubject(teacherSupportText, card.name)}.`) : '';
  const rows = [
    `${style.support} ${actionText}.`,
    `${actionText}.`,
    `현재 놀이 흐름과 연결해 ${actionText}.`,
    `같은 흐름이 이어질 때 ${actionText}.`,
    `관찰된 장면을 바탕으로 ${actionText}.`,
    `아이의 시도 흐름을 유지하며 ${actionText}.`,
  ];
  if (profile === 'warm') rows.push(`아이의 시도를 기다리며 ${actionText}.`);
  if (profile === 'concise') rows.push(`${actionText}.`);
  if (profile === 'parent_share') rows.push(`${style.support} ${actionText}.`);
  if (profile === 'teacher_eval') rows.push(`${style.support} ${actionText}.`);
  const future = finish(rows[variant % rows.length]);
  return actual ? `${actual} ${future}` : future;
}

function fixParticles(text) {
  return clean(text)
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/(은|는)\s+가\s+/g, '$1 ')
    .replace(/말하였다\s*후/g, '말한 뒤')
    .replace(/말하였다\s*뒤/g, '말한 뒤')
    .replace(/말하였다\s*,\s*이후/g, '말한 뒤')
    .replace(/먹음는/g, '먹는')
    .replace(/봄는/g, '보는')
    .replace(/함는/g, '하는')
    .replace(/모습는\s+과정에서/g, '모습을 보이며')
    .replace(/차례를 기다릴 수 있도록.*?줄 앞에서.*?기다릴 수 있도록.*?서 있었다/g, '차례를 기다리며 줄 앞에 서 있었다')
    .replace(/하며\./g, '하였다.')
    .replace(/수 있도록\s+(.{0,18})수 있도록/g, '수 있도록 $1')
    .replace(/과정에서\s+(.{0,16})과정에서/g, '과정에서 $1')
    .replace(/흐름을\s+이어\s+흐름/g, '흐름')
    .replace(/\. \./g, '.');
}

function dedupeSentences(text) {
  const seen = new Set();
  return String(text || '').split(/(?<=[.!?])\s+/).map(clean).filter(Boolean).filter((sentence) => {
    const key = tokenList(sentence).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' ');
}

function dedupeCandidates(candidates = []) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = clean(candidate.text).replace(/[.!?。]/g, '').replace(/\s+/g, ' ');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, B4_MAX_CANDIDATES_PER_SECTION);
}

function ensureCandidateMinimum(candidates = [], seed = {}) {
  const out = [...candidates];
  const base = out[0] || seed;
  const baseText = clean(base.text || seed.text);
  const baseWithoutPeriod = baseText.replace(/[.!?。]$/, '');
  const make = (index, text) => ({
    ...base,
    id: `${seed.idPrefix || 'b4_surface_pad'}_${index + 1}`,
    source: `${base.source || 'surface'}_pad`,
    patternId: base.section === 'support' ? '' : `${base.patternId || 'surface_pad'}_${index + 1}`,
    supportPatternId: base.section === 'support' ? `${base.supportPatternId || 'surface_pad'}_${index + 1}` : '',
    text,
  });
  const variants = [
    ...(seed.variants || []),
    baseText,
    ...(base.section === 'observation' ? [
      `${baseWithoutPeriod} 모습이 관찰되었다.`,
      `${baseWithoutPeriod} 장면이 관찰되었다.`,
      `${baseWithoutPeriod} 행동이 관찰되었다.`,
      `해당 장면에서 ${baseWithoutPeriod}.`,
    ] : []),
    ...(base.section === 'learning' ? [
      `${baseWithoutPeriod} 흐름이 관찰되었다.`,
      `${baseWithoutPeriod} 모습으로 이어졌다.`,
      `${baseWithoutPeriod} 과정이 나타났다.`,
      `이 장면에서 ${baseWithoutPeriod}.`,
    ] : []),
    ...(base.section === 'support' ? [
      `이후에는 ${baseWithoutPeriod}.`,
      `같은 흐름 안에서 ${baseWithoutPeriod}.`,
      `다음 놀이에서는 ${baseWithoutPeriod}.`,
      `관찰된 장면과 연결해 ${baseWithoutPeriod}.`,
    ] : []),
    baseText.replace(/\. 이후 /, '. 그 뒤 '),
    baseText.replace(/이 과정에서 /, '이어 '),
    baseText.replace(/다음에는 /, '이후에는 '),
    baseText.replace(/현재 /, '관찰된 '),
  ].filter(Boolean);
  variants.forEach((text, index) => {
    out.push(make(index, text));
  });
  return dedupeCandidates(out);
}

function selfEditCandidate(candidate, context = {}) {
  let text = finish(dedupeSentences(fixParticles(candidate.text)));
  if (candidate.section === 'learning' && context.observation && tokenOverlap(text, context.observation) > 0.78) {
    const lang = B4_THEME_LANGUAGE[candidate.primaryTheme] || B4_THEME_LANGUAGE.language;
    text = finish(`${topic(context.card.name)} ${lang.learning}.`);
  }
  if (candidate.section === 'support' && context.learning && tokenOverlap(text, context.learning) > 0.72) {
    const action = (B4_THEME_LANGUAGE[candidate.primaryTheme]?.supports || [])[0];
    text = finish(supportText(action, context.card, context.styleProfile, context.graph.flags.hasTeacherSupport, context.teacherSupportText, 1));
  }
  if (GENERIC_SUPPORT.test(text) && candidate.section === 'support') {
    const action = (B4_THEME_LANGUAGE[candidate.primaryTheme]?.supports || [])[0];
    text = finish(supportText(action, context.card, context.styleProfile, context.graph.flags.hasTeacherSupport, context.teacherSupportText, 2));
  }
  if (!context.graph.flags.hasTeacherSupport && candidate.section === 'support') {
    text = text.replace(SUPPORT_DONE, '이어 본다.');
  }
  const hasTeacherSupport = !!context.graph?.flags?.hasTeacherSupport;
  const polished = polishSurfaceText(text, candidate.section, { hasTeacherSupport });
  const polishedCandidate = {
    ...candidate,
    text: finish(polished.text).slice(0, 220),
    surfaceBeforeIssues: polished.beforeIssues,
    surfaceAfterIssues: polished.afterIssues,
    surfaceEditTypes: polished.editTypes,
    surfaceIssueDelta: polished.issueDelta,
  };
  const rewritten = applyRewriteLoop(polishedCandidate, context, 2);
  const compressed = compressCandidate(rewritten, context);
  const finalLint = lintSurfaceText(compressed.text, compressed.section, { hasTeacherSupport });
  return {
    ...compressed,
    surfaceAfterIssues: finalLint.issues,
    surfaceIssueDelta: (polished.beforeIssues || []).length - finalLint.issues.length,
    surfaceEditTypes: unique([
      ...(polished.editTypes || []),
      ...(compressed.selfCritic?.issues || []),
      ...(compressed.rewriteApplied ? ['constrained_rewrite'] : []),
      ...(compressed.rewriteRejected ? ['rewrite_rejected'] : []),
      ...(compressed.semanticCompressed ? ['semantic_compression'] : []),
      ...(compressed.semanticCompressionRejected ? ['semantic_compression_rejected'] : []),
    ]),
  };
}

function observationCandidates({ card, graph, plan, styleProfile, meaningUnits = [] }) {
  const orderNodes = plan.observationOrder.map((id) => nodeById(graph, id)).filter(Boolean);
  const evidenceIds = evidenceOf(orderNodes);
  const refs = meaningRefs(meaningUnits, 'observation', evidenceIds, plan);
  const source = finish(card.source);
  const rows = [
    { patternId: 'obs_discourse_compact', text: compactObservation(orderNodes, card, styleProfile) },
    { patternId: 'obs_discourse_two_sentence', text: splitTwoObservation(orderNodes, card) },
    { patternId: 'obs_focus_event', text: finish(`${topic(card.name)} ${summarizeNode(nodeById(graph, plan.focusEventId), card) || stripSubject(source, card.name)}`) },
    { patternId: 'obs_short_ordered', text: finish(`${topic(card.name)} ${orderNodes.map((node) => summarizeNode(node, card)).filter(Boolean).slice(0, 2).join(' 후 ')}`) },
    { patternId: 'obs_source_preserved', text: source },
    { patternId: 'obs_relation_link', text: finish(`${topic(card.name)} ${orderNodes.map((node) => summarizeNode(node, card)).filter(Boolean).join(', ')}`) },
  ];
  const base = rows.map((row, index) => ({
    id: `b4_observation_${index + 1}`,
    section: 'observation',
    source: 'discourse',
    evidenceIds: refs.evidenceIds,
    meaningUnitIds: refs.meaningUnitIds,
    focusEventId: plan.focusEventId,
    primaryTheme: plan.primaryTheme,
    secondaryTheme: plan.secondaryTheme,
    discourseRelation: plan.relation,
    patternId: row.patternId,
    supportPatternId: '',
    text: row.text,
  }));
  const surface = createSurfaceCandidates({ section: 'observation', card, graph, plan, styleProfile })
    .map((candidate) => ({ ...candidate, evidenceIds: refs.evidenceIds, meaningUnitIds: refs.meaningUnitIds }));
  const construction = createConstructionCandidates({ section: 'observation', card, graph, plan, styleProfile, meaningUnits });
  return ensureCandidateMinimum(dedupeCandidates([...construction, ...surface, ...base]), {
    ...base[0],
    idPrefix: 'b4_observation_pad',
    text: source,
    variants: [
      source,
      finish(`${topic(card.name)} ${summarizeNode(nodeById(graph, plan.focusEventId), card) || stripSubject(source, card.name)}`),
      finish(`${topic(card.name)} ${orderNodes.map((node) => summarizeNode(node, card)).filter(Boolean).slice(0, 2).join(' 후 ')}`),
      finish(`${topic(card.name)} ${stripSubject(source, card.name)}`),
    ],
  });
}

function learningCandidates({ card, graph, plan, styleProfile, meaningUnits = [] }) {
  const evidenceIds = plan.evidenceIds.length ? plan.evidenceIds : evidenceOf(plan.observationOrder.map((id) => nodeById(graph, id)));
  const refs = meaningRefs(meaningUnits, 'learning', evidenceIds, plan);
  const focusSummary = summarizeNode(nodeById(graph, plan.focusEventId), card);
  const rows = Array.from({ length: B4_MIN_CANDIDATES_PER_SECTION + 3 }, (_, index) => ({
    id: `b4_learning_${index + 1}`,
    section: 'learning',
    source: index < 2 ? 'relation_pattern' : 'theme_pattern',
    evidenceIds: refs.evidenceIds,
    meaningUnitIds: refs.meaningUnitIds,
    focusEventId: plan.focusEventId,
    primaryTheme: plan.primaryTheme,
    secondaryTheme: plan.secondaryTheme,
    discourseRelation: plan.relation,
    patternId: [
      `${plan.relation}_learning_core`,
      `${plan.primaryTheme}_focus_compact`,
      `${plan.primaryTheme}_meaning_only`,
      `${plan.primaryTheme}_secondary_link`,
      `${plan.primaryTheme}_discourse_focus`,
      `${plan.primaryTheme}_flow_sentence`,
      `${plan.primaryTheme}_${styleProfile}_tone`,
      `${plan.primaryTheme}_concise`,
      `${plan.primaryTheme}_teacher_eval`,
    ][index],
    supportPatternId: '',
    text: learningText(plan.primaryTheme, plan.secondaryTheme, card, styleProfile, index, focusSummary),
  }));
  const surface = createSurfaceCandidates({ section: 'learning', card, graph, plan, styleProfile })
    .map((candidate) => ({ ...candidate, evidenceIds: refs.evidenceIds, meaningUnitIds: refs.meaningUnitIds }));
  const construction = createConstructionCandidates({ section: 'learning', card, graph, plan, styleProfile, meaningUnits });
  return ensureCandidateMinimum(dedupeCandidates([...construction, ...surface, ...rows]), {
    ...rows[0],
    idPrefix: 'b4_learning_pad',
    variants: rows.map((row) => row.text),
  });
}

function supportCandidates({ card, graph, plan, styleProfile, meaningUnits = [] }) {
  const actions = plan.supportActions || [];
  const teacherSupport = (card.facts || []).find((fact) => isTeacherSupportFact(fact));
  const evidenceIds = unique([...(plan.evidenceIds || []), ...(teacherSupport ? [teacherSupport.id] : [])]);
  const refs = meaningRefs(meaningUnits, 'support', evidenceIds, plan);
  const rows = [];
  actions.forEach((action, actionIndex) => {
    for (let variant = 0; variant < 4; variant += 1) {
      rows.push({
        id: `b4_support_${actionIndex + 1}_${variant + 1}`,
        section: 'support',
        source: variant === 0 ? 'support_focus' : 'plan_pattern',
        evidenceIds: refs.evidenceIds,
        meaningUnitIds: refs.meaningUnitIds,
        focusEventId: plan.focusEventId,
        primaryTheme: plan.primaryTheme,
        secondaryTheme: plan.secondaryTheme,
        discourseRelation: plan.relation,
        patternId: '',
        supportPatternId: `${plan.supportFocus}_${action.id}_${variant + 1}`,
        actionId: action.id,
        text: supportText(action, card, styleProfile, graph.flags.hasTeacherSupport, teacherSupport?.text || '', variant),
      });
    }
  });
  while (rows.length < B4_MIN_CANDIDATES_PER_SECTION) {
    const index = rows.length;
    rows.push({
      id: `b4_support_safe_${index + 1}`,
      section: 'support',
      source: 'safe_minimal',
      evidenceIds: refs.evidenceIds,
      meaningUnitIds: refs.meaningUnitIds,
      focusEventId: plan.focusEventId,
      primaryTheme: plan.primaryTheme,
      secondaryTheme: plan.secondaryTheme,
      discourseRelation: plan.relation,
      patternId: '',
      supportPatternId: `safe_observe_${index + 1}`,
      actionId: 'observe_more',
      text: '구체적인 행동 흐름을 더 관찰한 뒤 확인된 놀이와 연결해 다음 지원을 정한다.',
    });
  }
  const surface = createSurfaceCandidates({ section: 'support', card, graph, plan, styleProfile })
    .map((candidate) => ({ ...candidate, evidenceIds: refs.evidenceIds, meaningUnitIds: refs.meaningUnitIds }));
  const construction = createConstructionCandidates({ section: 'support', card, graph, plan, styleProfile, meaningUnits });
  return ensureCandidateMinimum(dedupeCandidates([...construction, ...surface, ...rows]), {
    ...rows[0],
    idPrefix: 'b4_support_pad',
    variants: rows.map((row) => row.text),
  });
}

function fluencyScore(text = '', section = 'learning', context = {}) {
  let score = 100;
  if (!/[.!?]["”']?$/.test(clean(text))) score -= 25;
  if (text.length < 14) score -= 14;
  if (text.length > 155) score -= Math.min(30, Math.round((text.length - 155) / 4));
  if (BAD_CONNECTORS.test(text)) score -= 30;
  const lint = lintSurfaceText(text, section, { hasTeacherSupport: context.graph?.flags?.hasTeacherSupport });
  score -= Math.min(35, lint.issues.reduce((sum, issue) => sum + issue.weight * 4, 0));
  const repeated = Object.values(tokenList(text).reduce((acc, token) => {
    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {})).filter((count) => count > 1).length;
  score -= Math.min(24, repeated * 8);
  return Math.max(0, score);
}

function specificityScore(candidate, context) {
  const focus = summarizeNode(nodeById(context.graph, candidate.focusEventId), context.card);
  let score = 72;
  if (focus && tokenOverlap(candidate.text, focus) > 0.18) score += 18;
  if (candidate.discourseRelation !== 'single_event') score += 6;
  if (candidate.source === 'safe_minimal') score -= 16;
  if (GENERIC_SUPPORT.test(candidate.text)) score -= 24;
  return Math.max(0, Math.min(100, score));
}

function safetyFor(candidate, context) {
  const reasons = [];
  const allowedEvidence = new Set([...(context.plan.evidenceIds || []), ...context.plan.observationOrder.flatMap((id) => nodeById(context.graph, id)?.evidenceIds || []), ...((context.card.facts || []).map((fact) => fact.id))]);
  if (!candidate.evidenceIds?.length || candidate.evidenceIds.some((id) => !allowedEvidence.has(id) && !String(id).startsWith('speech_'))) reasons.push('missing_evidence');
  if (!candidateMeaningEvidenceOk(candidate)) reasons.push('missing_meaning_unit');
  if (candidate.rewriteRejected) reasons.push('rewrite_rejected');
  if (candidate.semanticCompressionRejected) reasons.push('semantic_compression_rejected');
  if (candidate.primaryTheme && !context.plan.learningFocus.includes(candidate.primaryTheme)) reasons.push('theme_outside_plan');
  if (candidate.discourseRelation !== context.plan.relation) reasons.push('relation_outside_plan');
  if (FORBIDDEN.test(candidate.text)) reasons.push('forbidden_claim');
  if (/친구|또래/.test(candidate.text) && !context.graph.flags.hasPeer) reasons.push('peer_fabrication');
  if (/회복|안정|진정|다시 놀이/.test(candidate.text) && !context.graph.flags.hasRecovery && context.plan.primaryTheme === 'emotion_expression') reasons.push('recovery_fabrication');
  if (candidate.section === 'support' && !context.graph.flags.hasTeacherSupport && SUPPORT_DONE.test(candidate.text)) reasons.push('support_done_without_evidence');
  if (candidate.section === 'observation' && /(느꼈|생각|의도|발달|능력)/.test(candidate.text)) reasons.push('observation_interpretation');
  if (context.graph.flags?.hasDomainTerms || context.graph.flags?.hasObjectThemeRisk) {
    const contextGuard = guardText({ text: candidate.text, input: context.card.source, targetChild: context.card.name });
    if (!contextGuard.ok) reasons.push(...contextGuard.codes);
  }
  const safetyScore = Math.max(0, 100 - reasons.length * 34);
  return { safetyScore, reasons };
}

function scoreCandidate(candidate, context) {
  const edited = selfEditCandidate(candidate, context);
  const safety = safetyFor(edited, context);
  const fluency = fluencyScore(edited.text, edited.section, context);
  const specificity = specificityScore(edited, context);
  const surfaceLint = lintSurfaceText(edited.text, edited.section, { hasTeacherSupport: context.graph.flags.hasTeacherSupport });
  const recentPatterns = context.recentPatterns || getB4RecentPatterns();
  const focusText = summarizeNode(nodeById(context.graph, edited.focusEventId || context.plan.focusEventId), context.card);
  const teacherStyle = judgeTeacherStyle(edited, {
    ...context,
    focusText,
    recentPatterns,
    supportFocus: context.plan.supportFocus,
  });
  const meaningUnitCombination = edited.meaningUnitCombination || (edited.meaningUnitIds || []).join('+') || 'none';
  const expandedRhythm = {
    ...(teacherStyle.rhythm || {}),
    meaningUnitCombination,
    signature: [teacherStyle.rhythm?.signature || '', `mu:${meaningUnitCombination}`].filter(Boolean).join('|'),
  };
  const rhythmPenalty = getB4RhythmPenalty({
    ...edited,
    rhythmSignature: expandedRhythm.signature,
    rhythm: expandedRhythm,
  }, context.plan, context.styleProfile, recentPatterns);
  const supportQuality = teacherStyle.supportQuality;
  const repetitionPenalty = Math.round(tokenOverlap(edited.text, context.otherSection || '') * 34)
    + getB4RecentPatternPenalty({ ...edited, patternId: edited.patternId || edited.supportPatternId }, context.plan, context.styleProfile);
  const safeEnoughForPreference = safety.safetyScore >= B4_SAFE_SCORE_MIN && safety.reasons.length === 0 && fluency >= 72;
  const localPreferenceWeight = getTeacherPreferenceWeight({
    ...edited,
    safe: safeEnoughForPreference,
    patternId: edited.patternId,
    supportPatternId: edited.supportPatternId,
  }, context.plan, context.styleProfile);
  const sectionFit = edited.section === context.section ? 100 : 0;
  let qualityScore = safety.safetyScore * 0.34 + fluency * 0.22 + specificity * 0.18 + sectionFit * 0.12
    - repetitionPenalty;
  qualityScore -= surfaceLint.issues.length * 5;
  qualityScore += Math.round((teacherStyle.score - 70) * 0.28);
  qualityScore -= rhythmPenalty;
  if (edited.section === 'support' && supportQuality) qualityScore += Math.round((supportQuality.score - 70) * 0.22);
  if (edited.rewriteApplied) qualityScore += Math.min(4, edited.rewriteIssuesResolved || 1);
  if (edited.selfCritic?.decision === 'rewrite') qualityScore -= 3;
  if (edited.rewriteRejected) qualityScore -= 40;
  if (edited.semanticCompressed) qualityScore += Math.min(3, edited.compressionDeletedClauseCount || 1);
  if (edited.semanticCompressionRejected) qualityScore -= 36;
  if (context.mode === 'shorter') qualityScore += Math.max(0, 105 - edited.text.length) / 5;
  if (context.mode === 'objective' && !/(따뜻|자연스럽|마음)/.test(edited.text)) qualityScore += 6;
  if (context.mode === 'warm' && /(자신의 속도|놀이 속|기다리며)/.test(edited.text)) qualityScore += 7;
  if (context.mode === 'speech' && context.graph.flags.hasSpeech && /"[^"]+"/.test(edited.text)) qualityScore += 10;
  const sectionPreferred = (hash(`${context.card.source}|${context.section}|${context.styleProfile}`) % Math.max(1, Math.min(6, context.poolSize || 6))) + 1;
  if (edited.id.endsWith(`_${sectionPreferred}`)) qualityScore += 9;
  qualityScore += (hash(`${context.card.source}|${edited.id}|${context.styleProfile}`) % 301) / 100;
  const scored = {
    ...edited,
    safe: safeEnoughForPreference,
    safetyScore: Math.round(safety.safetyScore * 10) / 10,
    fluencyScore: Math.round(fluency * 10) / 10,
    specificityScore: Math.round(specificity * 10) / 10,
    repetitionPenalty,
    rhythmPenalty,
    localPreferenceWeight,
    teacherStyle,
    teacherStyleScore: Math.round(teacherStyle.score * 10) / 10,
    teacherStyleReasons: teacherStyle.reasons,
    teacherStyleBlockedReasons: teacherStyle.blockedReasons,
    rhythm: expandedRhythm,
    rhythmSignature: expandedRhythm.signature || '',
    supportQuality,
    surfaceLint,
    surfaceQualityScore: surfaceLint.score,
    selfCritic: edited.selfCritic,
    selfCriticHistory: edited.selfCriticHistory || [],
    rewriteApplied: !!edited.rewriteApplied,
    rewriteRejected: !!edited.rewriteRejected,
    rewritePasses: edited.rewritePasses || 0,
    rewriteIssuesResolved: edited.rewriteIssuesResolved || 0,
    semanticCompression: edited.semanticCompression,
    semanticCompressed: !!edited.semanticCompressed,
    compressionDeletedClauseCount: edited.compressionDeletedClauseCount || 0,
    semanticCompressionRejected: !!edited.semanticCompressionRejected,
    meaningUnitIds: edited.meaningUnitIds || [],
    meaningUnitCombination,
    qualityScore: Math.round(qualityScore * 10) / 10,
    reasons: safety.reasons,
  };
  return scored;
}

function choose(candidates, context) {
  const recentPatterns = context.recentPatterns || getB4RecentPatterns();
  const scored = candidates.map((candidate) => scoreCandidate(candidate, { ...context, poolSize: candidates.length, recentPatterns }))
    .sort((a, b) => Number(b.safe) - Number(a.safe)
      || b.safetyScore - a.safetyScore
      || b.qualityScore - a.qualityScore
      || a.id.localeCompare(b.id));
  const contrastive = contrastiveRankCandidates(scored, { ...context, recentPatterns });
  return {
    selected: contrastive.selected || scored.find((candidate) => candidate.safe) || null,
    scored,
    rejected: scored.filter((candidate) => !candidate.safe).length,
    contrastive,
  };
}

function assemble(sections) {
  return [
    [LABELS[0], sections.observation],
    [LABELS[1], sections.learning],
    [LABELS[2], sections.support],
  ].filter(([, text]) => clean(text)).map(([label, text]) => `[${label}]\n${finish(text)}`).join('\n\n');
}

function polishCopyReady(copyReady = '', graph = {}) {
  const sections = parseTargetSections(copyReady);
  if (!sections.observation && !sections.learning && !sections.support) return { copyReady, sections };
  const context = { hasTeacherSupport: !!graph.flags?.hasTeacherSupport };
  const polished = {
    observation: sections.observation ? polishSurfaceText(sections.observation, 'observation', context).text : '',
    learning: sections.learning ? polishSurfaceText(sections.learning, 'learning', context).text : '',
    support: sections.support ? polishSurfaceText(sections.support, 'support', context).text : '',
  };
  const next = assemble(polished);
  return { copyReady: next || copyReady, sections: parseTargetSections(next || copyReady) };
}

function varySparseFallback(polishedFallback, graph = {}, reason = '') {
  const sections = { ...(polishedFallback.sections || {}) };
  if (sections.learning || !/(insufficient_information|safe_observation_not_found)/.test(reason || '')) return polishedFallback;
  const supportVariants = [
    '구체적인 행동이 더 관찰될 때까지 살펴본 뒤 확인된 놀이 흐름을 이어 본다.',
    '사용한 재료와 행동이 확인될 때까지 추가로 관찰한 뒤 다음 지원을 정한다.',
    '어떤 놀이와 자료를 사용했는지 더 살펴본 뒤 필요한 지원을 정한다.',
    '머문 공간과 실제 행동이 확인될 때까지 짧게 더 관찰해 본다.',
    '말, 행동, 함께한 대상을 추가로 확인한 뒤 다음 지원 방향을 정한다.',
    '확인된 사실을 더 모은 뒤 관찰 기록과 지원 계획을 다시 정리한다.',
  ];
  supportVariants.push(
    '관찰된 행동이 더 확인될 때까지 현재 내용만 짧게 남기고 다음 장면을 살펴본다.',
    '놀이 맥락과 사용한 자료가 확인되면 그 흐름에 맞춰 지원 방향을 정한다.',
    '구체적인 행동 단서가 더 모이면 배움 읽기와 지원 계획을 다시 정리한다.',
    '현재 확인된 내용만 기록하고, 이어지는 말이나 행동을 추가로 관찰한다.',
    '발화나 행동의 맥락이 더 분명해질 때까지 관찰을 이어 간다.',
    '함께한 대상과 사용한 자료가 확인되면 필요한 지원을 다시 판단한다.',
    '짧은 기록으로 남기고, 다음 놀이 장면에서 반복되는 행동이 있는지 살펴본다.',
    '추가 장면이 확인되면 관찰 사실을 바탕으로 지원 계획을 구체화한다.',
    '지금은 확인된 사실만 유지하고, 다음 기록에서 놀이 흐름을 보완한다.',
    '행동의 시작과 이어진 과정을 더 확인한 뒤 필요한 지원을 정한다.',
  );
  const variantSeed = `${graph.source || ''}|${reason}|${(graph.factsShape || []).join(',')}|${graph.nodes?.length || 0}`;
  sections.support = supportVariants[hash(variantSeed) % supportVariants.length];
  const copyReady = assemble(sections);
  return { copyReady, sections: parseTargetSections(copyReady) };
}

function graphForTrace(graph = {}) {
  return {
    factsShape: graph.factsShape || [],
    themeIds: graph.themeIds || [],
    sparse: !!graph.sparse,
    flags: graph.flags || {},
    domainTermIds: graph.domainTermIds || [],
    objectMentionRoles: graph.objectMentionRoles || [],
    episodeTrace: graph.episodeTrace || null,
    nodes: (graph.nodes || []).map((node) => ({
      id: node.id,
      type: node.type,
      tags: node.tags || [],
      evidenceIds: node.evidenceIds || [],
      metadataOnly: true,
    })),
    edges: (graph.edges || []).map((edge) => ({
      from: edge.from,
      to: edge.to,
      type: edge.type,
      evidenceIds: edge.evidenceIds || [],
      metadataOnly: true,
    })),
    metadataOnly: true,
  };
}

function sanitizePlanContrastive(metadata = null) {
  if (!metadata) return null;
  return {
    winnerPlanId: metadata.winnerPlanId || '',
    rejectedPlanIds: metadata.rejectedPlanIds || [],
    reasons: metadata.reasons || [],
    rejectedReasons: metadata.rejectedReasons || {},
    comparisons: metadata.comparisons || [],
    selectedScore: metadata.selectedScore || 0,
    baselineScore: metadata.baselineScore || 0,
    metadataOnly: true,
  };
}

function fallbackB4({ b3, b2, graph, plan, reason, mode, styleProfile, meaningUnits = [] }) {
  const fallback = b3 || b2;
  const polishedFallback = varySparseFallback(polishCopyReady(fallback.copyReady, graph), graph, reason);
  return {
    ...fallback,
    copyReady: polishedFallback.copyReady,
    sections: polishedFallback.sections,
    b2: b2 || fallback.b2,
    b3,
    b2CopyReady: fallback.b2CopyReady || b2?.copyReady || fallback.copyReady,
    b4CopyReady: '',
    b4Trace: {
      engine: 'rule-b4',
      mode,
      styleProfile,
      fallbackApplied: true,
      fallbackReason: reason,
      fallbackDiagnostic: { fallback: true, fallbackReason: reason, source: 'b4_single_plan', metadataOnly: true },
      eventGraph: graphForTrace(graph),
      discoursePlan: plan,
      meaningUnits,
      meaningUnitStats: meaningUnitEvidenceStats(meaningUnits),
      discoursePlanCreated: !!plan && !plan.sparse,
      candidateCount: 0,
      rejectedCandidates: 0,
      candidateRejectRate: 0,
      learningPatternId: '',
      supportPatternId: '',
      selectedCandidateIds: [],
      relation: plan?.relation || '',
      themeIds: plan?.learningFocus || b2?.plan?.meta?.themeIds || [],
      sectionEvidence: fallback.trace?.sectionEvidence || b2?.trace?.sectionEvidence || {},
    },
  };
}

function runPlanOutcome({ card, graph, plan, meaningUnits, mode, styleProfile }) {
  const observationPool = observationCandidates({ card, graph, plan, styleProfile, meaningUnits });
  const observationChoice = choose(observationPool, { card, graph, plan, meaningUnits, styleProfile, mode, section: 'observation' });
  if (!observationChoice.selected) return { valid: false, plan, reason: 'safe_observation_not_found' };

  const observationLedger = buildClaimLedger({ observation: observationChoice.selected });
  const learningPool = learningCandidates({ card, graph, plan, styleProfile, meaningUnits });
  const learningChoice = choose(learningPool, {
    card,
    graph,
    plan,
    meaningUnits,
    styleProfile,
    mode,
    section: 'learning',
    observation: observationChoice.selected.text,
    otherSection: observationChoice.selected.text,
    claimLedger: observationLedger,
  });
  if (!learningChoice.selected) return { valid: false, plan, reason: 'safe_learning_not_found', observationChoice };

  const learningLedger = buildClaimLedger({ observation: observationChoice.selected, learning: learningChoice.selected });
  const supportPool = supportCandidates({ card, graph, plan, styleProfile, meaningUnits });
  const supportChoice = choose(supportPool, {
    card,
    graph,
    plan,
    meaningUnits,
    styleProfile,
    mode,
    section: 'support',
    observation: observationChoice.selected.text,
    learning: learningChoice.selected.text,
    otherSection: `${observationChoice.selected.text} ${learningChoice.selected.text}`,
    teacherSupportText: (card.facts || []).find((fact) => isTeacherSupportFact(fact))?.text || '',
    claimLedger: learningLedger,
  });
  if (!supportChoice.selected) return { valid: false, plan, reason: 'safe_support_not_found', observationChoice, learningChoice };

  const sections = {
    observation: observationChoice.selected.text,
    learning: learningChoice.selected.text,
    support: supportChoice.selected.text,
  };
  const audit = auditObservationCopy({ input: card.source, observation: sections.observation, learning: sections.learning, support: sections.support, childName: card.name });
  const selectedChoices = [observationChoice.selected, learningChoice.selected, supportChoice.selected];
  const ownMajor = [observationChoice, learningChoice, supportChoice].some((choice) => choice.selected.reasons.length);
  const valid = audit.severity !== 'major' && !ownMajor;
  return {
    valid,
    reason: valid ? '' : `audit:${audit.warnings.join(',') || 'candidate_reason'}`,
    plan,
    observationChoice,
    learningChoice,
    supportChoice,
    selectedChoices,
    selectedBySection: {
      observation: observationChoice.selected,
      learning: learningChoice.selected,
      support: supportChoice.selected,
    },
    sections,
    audit,
    total: observationChoice.scored.length + learningChoice.scored.length + supportChoice.scored.length,
    rejected: observationChoice.rejected + learningChoice.rejected + supportChoice.rejected,
    claimLedger: buildClaimLedger({
      observation: observationChoice.selected,
      learning: learningChoice.selected,
      support: supportChoice.selected,
    }),
    sectionMeaningOverlap: sectionMeaningOverlapSummary({
      observation: observationChoice.selected,
      learning: learningChoice.selected,
      support: supportChoice.selected,
    }),
  };
}

function buildB4ResultFromOutcome({ outcome, b2, b3, graph, basePlan, meaningUnits, meaningStats, mode, styleProfile, planRank }) {
  const { plan, observationChoice, learningChoice, supportChoice, selectedChoices, sections, audit } = outcome;
  const total = outcome.total;
  const rejected = outcome.rejected;
  const contrastiveBySection = {
    observation: observationChoice.contrastive,
    learning: learningChoice.contrastive,
    support: supportChoice.contrastive,
  };
  const contrastiveChangedFromScoreTop = Object.values(contrastiveBySection).some((item) => item?.changedFromScoreTop);
  const contrastiveComparisons = Object.fromEntries(Object.entries(contrastiveBySection).map(([section, item]) => [section, (item?.comparisons || []).map((row) => ({
    winner: row.winner,
    winnerId: row.winnerId,
    loserId: row.loserId,
    reasons: row.reasons,
    blockedReasons: row.blockedReasons,
    scores: row.scores,
    metadataOnly: true,
  }))]));
  const mergeCounts = (items = [], key) => items.reduce((acc, item) => {
    Object.entries(item?.[key] || {}).forEach(([reason, count]) => {
      acc[reason] = (acc[reason] || 0) + count;
    });
    return acc;
  }, {});
  const teacherStyleReasonCounts = selectedChoices.reduce((acc, choice) => {
    (choice.teacherStyleReasons || []).forEach((reason) => { acc[reason] = (acc[reason] || 0) + 1; });
    return acc;
  }, {});
  const teacherStyleBlockedReasonCounts = selectedChoices.reduce((acc, choice) => {
    (choice.teacherStyleBlockedReasons || []).forEach((reason) => { acc[reason] = (acc[reason] || 0) + 1; });
    return acc;
  }, {});
  const surfaceSummary = surfaceIssueSummary(sections, { hasTeacherSupport: graph.flags.hasTeacherSupport });
  const surfaceBeforeIssueCount = selectedChoices.reduce((sum, choice) => sum + (choice.surfaceBeforeIssues || []).length, 0);
  const surfaceAfterIssueCount = selectedChoices.reduce((sum, choice) => sum + (choice.surfaceAfterIssues || []).length, 0);
  const rewriteAppliedCount = selectedChoices.filter((choice) => choice.rewriteApplied).length;
  const allScored = [observationChoice, learningChoice, supportChoice].flatMap((choice) => choice.scored || []);
  const rewriteRejectedCount = allScored.filter((candidate) => candidate.rewriteRejected).length;
  const rewriteIssuesResolved = selectedChoices.reduce((sum, choice) => sum + (choice.rewriteIssuesResolved || 0), 0);
  const compressionAppliedCount = selectedChoices.filter((choice) => choice.semanticCompressed).length;
  const compressionDeletedClauseCount = selectedChoices.reduce((sum, choice) => sum + (choice.compressionDeletedClauseCount || 0), 0);
  const compressionRejectedCount = allScored.filter((candidate) => candidate.semanticCompressionRejected).length;
  const selfCriticIssueCounts = allScored
    .flatMap((candidate) => candidate.selfCritic?.issues || [])
    .reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {});
  const selectedMeaningUnitIds = {
    observation: observationChoice.selected.meaningUnitIds || [],
    learning: learningChoice.selected.meaningUnitIds || [],
    support: supportChoice.selected.meaningUnitIds || [],
  };
  const selectedEvidenceLinked = selectedChoices.filter((choice) => candidateMeaningEvidenceOk(choice)).length;
  const constructionCandidateCount = allScored.filter((candidate) => candidate.source === 'construction_graph').length;
  const constructionSelectedCount = selectedChoices.filter((choice) => choice.source === 'construction_graph').length;
  const planScore = scorePlanOutcome(outcome);
  const assembled = assemble(sections);
  return {
    copyReady: assembled,
    b2CopyReady: b2.copyReady,
    b4CopyReady: assembled,
    audit: { ...audit, fallbackApplied: false },
    sections: parseTargetSections(assembled),
    b2,
    b3,
    engineUsed: 'rule-b4',
    fallbackReason: '',
    questions: [],
    b4Trace: {
      engine: 'rule-b4',
      mode,
      styleProfile,
      fallbackApplied: false,
      fallbackReason: '',
      fallbackDiagnostic: planRank?.fallbackApplied
        ? { fallback: true, fallbackReason: planRank.fallbackReason || '', source: 'b4_single_plan', metadataOnly: true }
        : { fallback: false, fallbackReason: '', source: 'b4_multi_plan', metadataOnly: true },
      eventGraph: graphForTrace(graph),
      discoursePlan: plan,
      baseDiscoursePlan: basePlan,
      candidateDiscoursePlan: {
        id: plan.id || 'plan_base_01',
        focusType: plan.focusType || 'base_single_plan',
        semanticFootprint: plan.semanticFootprint || {},
        observationEvidenceIds: plan.observationEvidenceIds || plan.evidenceIds || [],
        learningMeaningUnitIds: plan.learningMeaningUnitIds || [],
        supportMeaningUnitIds: plan.supportMeaningUnitIds || [],
        excludedMeaningUnitIds: plan.excludedMeaningUnitIds || [],
        blockedClaims: plan.blockedClaims || [],
        metadataOnly: true,
      },
      candidateDiscoursePlans: planRank?.candidateDiscoursePlans || [],
      candidateDiscoursePlanCount: planRank?.candidateDiscoursePlanCount || 1,
      candidateDiscoursePlanAverage: planRank?.candidateDiscoursePlanCount || 1,
      planContrastiveRankerApplied: !!planRank,
      planContrastive: sanitizePlanContrastive(planRank?.metadata),
      multiPlanFallbackApplied: !!planRank?.fallbackApplied,
      multiPlanFallbackReason: planRank?.fallbackReason || '',
      planScore: planScore.total,
      planScoreMetrics: planScore.metrics,
      meaningUnits,
      meaningUnitStats: meaningStats,
      meaningUnitCount: meaningStats.total,
      meaningUnitEvidenceLinkRate: meaningStats.linkRate,
      meaningUnitSectionCounts: meaningStats.sectionCounts,
      meaningUnitClauseEvidenceRate: Math.round((selectedEvidenceLinked / Math.max(1, selectedChoices.length)) * 1000) / 10,
      discoursePlanCreated: true,
      focusEventId: plan.focusEventId,
      secondaryEventId: plan.secondaryEventId,
      relation: plan.relation,
      discourseRelation: plan.relation,
      themeIds: plan.learningFocus,
      primaryTheme: plan.primaryTheme,
      secondaryTheme: plan.secondaryTheme,
      supportFocus: plan.supportFocus,
      candidateCount: total,
      observationCandidateCount: observationChoice.scored.length,
      learningCandidateCount: learningChoice.scored.length,
      supportCandidateCount: supportChoice.scored.length,
      rejectedCandidates: rejected,
      candidateRejectRate: total ? Math.round((rejected / total) * 1000) / 10 : 0,
      observationPatternId: observationChoice.selected.patternId,
      learningPatternId: learningChoice.selected.patternId,
      supportPatternId: supportChoice.selected.supportPatternId,
      selectedCandidateIds: [observationChoice.selected.id, learningChoice.selected.id, supportChoice.selected.id],
      selectedMeaningUnitIds,
      selectedScores: { observation: observationChoice.selected.qualityScore, learning: learningChoice.selected.qualityScore, support: supportChoice.selected.qualityScore },
      selectedSafetyScores: { observation: observationChoice.selected.safetyScore, learning: learningChoice.selected.safetyScore, support: supportChoice.selected.safetyScore },
      selectedPreferenceWeights: { observation: observationChoice.selected.localPreferenceWeight || 0, learning: learningChoice.selected.localPreferenceWeight || 0, support: supportChoice.selected.localPreferenceWeight || 0 },
      sentenceRealizerApplied: true,
      constructionGraphApplied: constructionCandidateCount > 0,
      constructionCandidateCount,
      constructionSelectedCount,
      contrastiveRankerApplied: true,
      contrastiveChangedFromScoreTop,
      contrastiveComparisons,
      contrastiveReasonCounts: mergeCounts(Object.values(contrastiveBySection), 'reasonCounts'),
      contrastiveBlockedReasonCounts: mergeCounts(Object.values(contrastiveBySection), 'blockedReasonCounts'),
      contrastSetApplied: Object.values(contrastiveBySection).some((item) => item?.contrastSetApplied),
      teacherStyleReasonCounts,
      teacherStyleBlockedReasonCounts,
      rhythmSignatures: {
        observation: observationChoice.selected.rhythmSignature,
        learning: learningChoice.selected.rhythmSignature,
        support: supportChoice.selected.rhythmSignature,
      },
      supportQuality: {
        score: supportChoice.selected.supportQuality?.score || 0,
        reasons: supportChoice.selected.supportQuality?.reasons || [],
      },
      surfaceQuality: {
        beforeIssueCount: surfaceBeforeIssueCount,
        afterIssueCount: surfaceAfterIssueCount,
        selectedIssueCount: surfaceSummary.totalIssues,
        issueTypes: surfaceSummary.countByType,
        selectedEditTypes: unique(selectedChoices.flatMap((choice) => choice.surfaceEditTypes || [])),
        selectedPatternSources: selectedChoices.map((choice) => choice.source),
      },
      semanticCompression: {
        appliedCount: compressionAppliedCount,
        rejectedCount: compressionRejectedCount,
        deletedClauseCount: compressionDeletedClauseCount,
        sectionMeaningOverlap: outcome.sectionMeaningOverlap,
        claimLedger: outcome.claimLedger,
        selectedClauseLedgers: {
          observation: observationChoice.selected.semanticCompression?.clauseLedger || [],
          learning: learningChoice.selected.semanticCompression?.clauseLedger || [],
          support: supportChoice.selected.semanticCompression?.clauseLedger || [],
        },
      },
      constrainedRewrite: {
        appliedCount: rewriteAppliedCount,
        rejectedCount: rewriteRejectedCount,
        issuesResolved: rewriteIssuesResolved,
        issueCounts: selfCriticIssueCounts,
        selectedDecisions: {
          observation: observationChoice.selected.selfCritic?.decision || '',
          learning: learningChoice.selected.selfCritic?.decision || '',
          support: supportChoice.selected.selfCritic?.decision || '',
        },
      },
      rewriteAppliedCount,
      rewriteRejectedCount,
      rewriteIssuesResolved,
      selfCriticIssueCounts,
      sectionEvidence: {
        observation: observationChoice.selected.evidenceIds,
        learning: learningChoice.selected.evidenceIds,
        support: supportChoice.selected.evidenceIds,
      },
      metadataOnly: true,
    },
  };
}

function generateB4CoreSingle({ input = '', childName = '', observation = '', fallbackCopyReady = '', mode = 'default', styleProfile = getB4StyleProfile() } = {}) {
  const b2 = generateB2({ input, childName, observation, fallbackCopyReady, mode: 'default' });
  const b3 = generateB3({ input, childName, observation, fallbackCopyReady: b2.copyReady, mode: 'default' });
  const card = buildB2FactCard({ input, childName });
  const graph = buildB4EventGraph({ card, b2Plan: b2.plan });
  const plan = buildB4DiscoursePlan({ graph, card });
  const meaningUnits = buildB4MeaningUnits({ card, graph, plan });
  const meaningStats = meaningUnitEvidenceStats(meaningUnits);
  if (graph.flags?.needsTargetChild) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'target_child_required', mode, styleProfile });
  if (mode === 'facts_only') {
    const factsOnly = generateB2({ input, childName, observation, fallbackCopyReady, mode: 'facts_only' });
    return {
      ...factsOnly,
      b2,
      b3,
      b2CopyReady: b2.copyReady,
      b4CopyReady: factsOnly.copyReady,
      engineUsed: 'rule-b4',
      b4Trace: { engine: 'rule-b4', mode, styleProfile, eventGraph: graphForTrace(graph), discoursePlan: plan, meaningUnits, meaningUnitStats: meaningStats, fallbackApplied: false, selectedCandidateIds: [], learningPatternId: '', supportPatternId: '', themeIds: plan.learningFocus },
    };
  }
  if (plan.sparse) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'insufficient_information', mode, styleProfile });

  const observationPool = observationCandidates({ card, graph, plan, styleProfile, meaningUnits });
  const observationChoice = choose(observationPool, { card, graph, plan, styleProfile, mode, section: 'observation' });
  if (!observationChoice.selected) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'safe_observation_not_found', mode, styleProfile });

  const learningPool = learningCandidates({ card, graph, plan, styleProfile, meaningUnits });
  const learningChoice = choose(learningPool, { card, graph, plan, styleProfile, mode, section: 'learning', observation: observationChoice.selected.text, otherSection: observationChoice.selected.text });
  if (!learningChoice.selected) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'safe_learning_not_found', mode, styleProfile });

  const supportPool = supportCandidates({ card, graph, plan, styleProfile, meaningUnits });
  const supportChoice = choose(supportPool, {
    card,
    graph,
    plan,
    styleProfile,
    mode,
    section: 'support',
    observation: observationChoice.selected.text,
    learning: learningChoice.selected.text,
    otherSection: `${observationChoice.selected.text} ${learningChoice.selected.text}`,
    teacherSupportText: (card.facts || []).find((fact) => isTeacherSupportFact(fact))?.text || '',
  });
  if (!supportChoice.selected) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'safe_support_not_found', mode, styleProfile });

  const sections = {
    observation: observationChoice.selected.text,
    learning: learningChoice.selected.text,
    support: supportChoice.selected.text,
  };
  const audit = auditObservationCopy({ input: card.source, observation: sections.observation, learning: sections.learning, support: sections.support, childName: card.name });
  const ownMajor = [observationChoice, learningChoice, supportChoice].some((choice) => choice.selected.reasons.length);
  if (audit.severity === 'major' || ownMajor) {
    return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: `audit:${audit.warnings.join(',')}`, mode, styleProfile });
  }
  const total = observationChoice.scored.length + learningChoice.scored.length + supportChoice.scored.length;
  const rejected = observationChoice.rejected + learningChoice.rejected + supportChoice.rejected;
  const selectedChoices = [observationChoice.selected, learningChoice.selected, supportChoice.selected];
  const contrastiveBySection = {
    observation: observationChoice.contrastive,
    learning: learningChoice.contrastive,
    support: supportChoice.contrastive,
  };
  const contrastiveChangedFromScoreTop = Object.values(contrastiveBySection).some((item) => item?.changedFromScoreTop);
  const contrastiveComparisons = Object.fromEntries(Object.entries(contrastiveBySection).map(([section, item]) => [section, (item?.comparisons || []).map((row) => ({
    winner: row.winner,
    winnerId: row.winnerId,
    loserId: row.loserId,
    reasons: row.reasons,
    blockedReasons: row.blockedReasons,
    scores: row.scores,
    metadataOnly: true,
  }))]));
  const mergeCounts = (items = [], key) => items.reduce((acc, item) => {
    Object.entries(item?.[key] || {}).forEach(([reason, count]) => {
      acc[reason] = (acc[reason] || 0) + count;
    });
    return acc;
  }, {});
  const teacherStyleReasonCounts = selectedChoices.reduce((acc, choice) => {
    (choice.teacherStyleReasons || []).forEach((reason) => { acc[reason] = (acc[reason] || 0) + 1; });
    return acc;
  }, {});
  const teacherStyleBlockedReasonCounts = selectedChoices.reduce((acc, choice) => {
    (choice.teacherStyleBlockedReasons || []).forEach((reason) => { acc[reason] = (acc[reason] || 0) + 1; });
    return acc;
  }, {});
  const surfaceSummary = surfaceIssueSummary(sections, { hasTeacherSupport: graph.flags.hasTeacherSupport });
  const surfaceBeforeIssueCount = selectedChoices.reduce((sum, choice) => sum + (choice.surfaceBeforeIssues || []).length, 0);
  const surfaceAfterIssueCount = selectedChoices.reduce((sum, choice) => sum + (choice.surfaceAfterIssues || []).length, 0);
  const rewriteAppliedCount = selectedChoices.filter((choice) => choice.rewriteApplied).length;
  const rewriteRejectedCount = [observationChoice, learningChoice, supportChoice]
    .flatMap((choice) => choice.scored || [])
    .filter((candidate) => candidate.rewriteRejected).length;
  const rewriteIssuesResolved = selectedChoices.reduce((sum, choice) => sum + (choice.rewriteIssuesResolved || 0), 0);
  const selfCriticIssueCounts = [observationChoice, learningChoice, supportChoice]
    .flatMap((choice) => choice.scored || [])
    .flatMap((candidate) => candidate.selfCritic?.issues || [])
    .reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {});
  const selectedMeaningUnitIds = {
    observation: observationChoice.selected.meaningUnitIds || [],
    learning: learningChoice.selected.meaningUnitIds || [],
    support: supportChoice.selected.meaningUnitIds || [],
  };
  const selectedEvidenceLinked = selectedChoices.filter((choice) => candidateMeaningEvidenceOk(choice)).length;
  const constructionCandidateCount = [observationChoice, learningChoice, supportChoice]
    .flatMap((choice) => choice.scored || [])
    .filter((candidate) => candidate.source === 'construction_graph').length;
  const constructionSelectedCount = selectedChoices.filter((choice) => choice.source === 'construction_graph').length;
  return {
    copyReady: assemble(sections),
    b2CopyReady: b2.copyReady,
    b4CopyReady: assemble(sections),
    audit: { ...audit, fallbackApplied: false },
    sections: parseTargetSections(assemble(sections)),
    b2,
    b3,
    engineUsed: 'rule-b4',
    fallbackReason: '',
    questions: [],
    b4Trace: {
      engine: 'rule-b4',
      mode,
      styleProfile,
      fallbackApplied: false,
      fallbackReason: '',
      eventGraph: graphForTrace(graph),
      discoursePlan: plan,
      meaningUnits,
      meaningUnitStats: meaningStats,
      meaningUnitCount: meaningStats.total,
      meaningUnitEvidenceLinkRate: meaningStats.linkRate,
      meaningUnitSectionCounts: meaningStats.sectionCounts,
      meaningUnitClauseEvidenceRate: Math.round((selectedEvidenceLinked / Math.max(1, selectedChoices.length)) * 1000) / 10,
      discoursePlanCreated: true,
      focusEventId: plan.focusEventId,
      secondaryEventId: plan.secondaryEventId,
      relation: plan.relation,
      discourseRelation: plan.relation,
      themeIds: plan.learningFocus,
      primaryTheme: plan.primaryTheme,
      secondaryTheme: plan.secondaryTheme,
      supportFocus: plan.supportFocus,
      candidateCount: total,
      observationCandidateCount: observationChoice.scored.length,
      learningCandidateCount: learningChoice.scored.length,
      supportCandidateCount: supportChoice.scored.length,
      rejectedCandidates: rejected,
      candidateRejectRate: total ? Math.round((rejected / total) * 1000) / 10 : 0,
      observationPatternId: observationChoice.selected.patternId,
      learningPatternId: learningChoice.selected.patternId,
      supportPatternId: supportChoice.selected.supportPatternId,
      selectedCandidateIds: [observationChoice.selected.id, learningChoice.selected.id, supportChoice.selected.id],
      selectedMeaningUnitIds,
      selectedScores: { observation: observationChoice.selected.qualityScore, learning: learningChoice.selected.qualityScore, support: supportChoice.selected.qualityScore },
      selectedSafetyScores: { observation: observationChoice.selected.safetyScore, learning: learningChoice.selected.safetyScore, support: supportChoice.selected.safetyScore },
      selectedPreferenceWeights: { observation: observationChoice.selected.localPreferenceWeight || 0, learning: learningChoice.selected.localPreferenceWeight || 0, support: supportChoice.selected.localPreferenceWeight || 0 },
      sentenceRealizerApplied: true,
      constructionGraphApplied: constructionCandidateCount > 0,
      constructionCandidateCount,
      constructionSelectedCount,
      contrastiveRankerApplied: true,
      contrastiveChangedFromScoreTop,
      contrastiveComparisons,
      contrastiveReasonCounts: mergeCounts(Object.values(contrastiveBySection), 'reasonCounts'),
      contrastiveBlockedReasonCounts: mergeCounts(Object.values(contrastiveBySection), 'blockedReasonCounts'),
      contrastSetApplied: Object.values(contrastiveBySection).some((item) => item?.contrastSetApplied),
      teacherStyleReasonCounts,
      teacherStyleBlockedReasonCounts,
      rhythmSignatures: {
        observation: observationChoice.selected.rhythmSignature,
        learning: learningChoice.selected.rhythmSignature,
        support: supportChoice.selected.rhythmSignature,
      },
      supportQuality: {
        score: supportChoice.selected.supportQuality?.score || 0,
        reasons: supportChoice.selected.supportQuality?.reasons || [],
      },
      surfaceQuality: {
        beforeIssueCount: surfaceBeforeIssueCount,
        afterIssueCount: surfaceAfterIssueCount,
        selectedIssueCount: surfaceSummary.totalIssues,
        issueTypes: surfaceSummary.countByType,
        selectedEditTypes: unique(selectedChoices.flatMap((choice) => choice.surfaceEditTypes || [])),
        selectedPatternSources: selectedChoices.map((choice) => choice.source),
      },
      constrainedRewrite: {
        appliedCount: rewriteAppliedCount,
        rejectedCount: rewriteRejectedCount,
        issuesResolved: rewriteIssuesResolved,
        issueCounts: selfCriticIssueCounts,
        selectedDecisions: {
          observation: observationChoice.selected.selfCritic?.decision || '',
          learning: learningChoice.selected.selfCritic?.decision || '',
          support: supportChoice.selected.selfCritic?.decision || '',
        },
      },
      rewriteAppliedCount,
      rewriteRejectedCount,
      rewriteIssuesResolved,
      selfCriticIssueCounts,
      sectionEvidence: {
        observation: observationChoice.selected.evidenceIds,
        learning: learningChoice.selected.evidenceIds,
        support: supportChoice.selected.evidenceIds,
      },
      metadataOnly: true,
    },
  };
}

function generateB4Core({ input = '', childName = '', observation = '', fallbackCopyReady = '', mode = 'default', styleProfile = getB4StyleProfile() } = {}) {
  if (mode === 'facts_only') return generateB4CoreSingle({ input, childName, observation, fallbackCopyReady, mode, styleProfile });
  const b2 = generateB2({ input, childName, observation, fallbackCopyReady, mode: 'default' });
  const b3 = generateB3({ input, childName, observation, fallbackCopyReady: b2.copyReady, mode: 'default' });
  const card = buildB2FactCard({ input, childName });
  const graph = buildB4EventGraph({ card, b2Plan: b2.plan });
  const plan = buildB4DiscoursePlan({ graph, card });
  const meaningUnits = buildB4MeaningUnits({ card, graph, plan });
  const meaningStats = meaningUnitEvidenceStats(meaningUnits);
  if (graph.flags?.needsTargetChild) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'target_child_required', mode, styleProfile });
  if (plan.sparse) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: 'insufficient_information', mode, styleProfile });

  const baseline = runPlanOutcome({ card, graph, plan, meaningUnits, mode, styleProfile });
  if (!baseline.valid) return fallbackB4({ b3, b2, graph, plan, meaningUnits, reason: baseline.reason, mode, styleProfile });

  const candidatePlans = buildB4CandidateDiscoursePlans({ graph, basePlan: plan, meaningUnits });
  const candidatePlanSummaries = candidatePlans.map((candidatePlan) => ({
    id: candidatePlan.id,
    focusType: candidatePlan.focusType,
    focusEventId: candidatePlan.focusEventId,
    secondaryEventId: candidatePlan.secondaryEventId,
    learningMeaningUnitIds: candidatePlan.learningMeaningUnitIds || [],
    supportMeaningUnitIds: candidatePlan.supportMeaningUnitIds || [],
    semanticFootprint: candidatePlan.semanticFootprint || {},
    metadataOnly: true,
  }));

  const singlePlanResult = (fallbackReason) => buildB4ResultFromOutcome({
    outcome: baseline,
    b2,
    b3,
    graph,
    basePlan: plan,
    meaningUnits,
    meaningStats,
    mode,
    styleProfile,
    planRank: {
      candidateDiscoursePlans: candidatePlanSummaries,
      candidateDiscoursePlanCount: candidatePlans.length || 1,
      fallbackApplied: true,
      fallbackReason,
      metadata: null,
    },
  });

  if (candidatePlans.length < 2) return singlePlanResult('not_enough_candidate_plans');

  const rankingMode = 'default';
  const rankingStyleProfile = 'objective';
  const rankBaseline = (mode === rankingMode && styleProfile === rankingStyleProfile)
    ? baseline
    : runPlanOutcome({ card, graph, plan, meaningUnits, mode: rankingMode, styleProfile: rankingStyleProfile });
  const rankOutcomes = (mode === rankingMode && styleProfile === rankingStyleProfile)
    ? candidatePlans.map((candidatePlan) => runPlanOutcome({ card, graph, plan: candidatePlan, meaningUnits, mode, styleProfile }))
    : candidatePlans.map((candidatePlan) => runPlanOutcome({ card, graph, plan: candidatePlan, meaningUnits, mode: rankingMode, styleProfile: rankingStyleProfile }));
  if (!rankOutcomes.some((outcome) => outcome.valid)) return singlePlanResult('all_candidate_plans_failed_audit');

  const ranked = planContrastiveRanker(rankOutcomes, { baseline: rankBaseline.valid ? rankBaseline : baseline });
  const selectedPlanId = ranked.selected?.plan?.id || baseline.plan?.id;
  const actualOutcomes = (mode === rankingMode && styleProfile === rankingStyleProfile)
    ? rankOutcomes
    : candidatePlans.map((candidatePlan) => runPlanOutcome({ card, graph, plan: candidatePlan, meaningUnits, mode, styleProfile }));
  const selected = actualOutcomes.find((outcome) => outcome.valid && outcome.plan?.id === selectedPlanId) || baseline;
  const selectedScore = scorePlanOutcome(selected).total;
  const baselineScore = scorePlanOutcome(baseline).total;
  const useBaseline = !ranked.selected || selectedScore + 1 < baselineScore;
  const finalOutcome = useBaseline ? baseline : selected;
  return buildB4ResultFromOutcome({
    outcome: finalOutcome,
    b2,
    b3,
    graph,
    basePlan: plan,
    meaningUnits,
    meaningStats,
    mode,
    styleProfile,
    planRank: {
      candidateDiscoursePlans: candidatePlanSummaries,
      candidateDiscoursePlanCount: candidatePlans.length,
      fallbackApplied: useBaseline && ((finalOutcome.plan?.id || 'plan_base_01') !== (selected.plan?.id || '')),
      fallbackReason: useBaseline ? 'quality_below_single_plan' : '',
      metadata: ranked,
    },
  });
}

function mergeAdjustedSections(base, adjusted, mode, input, childName) {
  const sections = {
    observation: base.sections.observation,
    learning: mode === 'support' ? base.sections.learning : adjusted.sections.learning,
    support: mode === 'learning' ? base.sections.support : adjusted.sections.support,
  };
  const audit = auditObservationCopy({ input, observation: sections.observation, learning: sections.learning, support: sections.support, childName });
  if (audit.severity === 'major') return base;
  return { ...adjusted, copyReady: assemble(sections), b4CopyReady: assemble(sections), sections, audit: { ...audit, fallbackApplied: false } };
}

export function generateB4(options = {}) {
  const mode = options.mode || 'default';
  const styleProfile = options.styleProfile || (mode === 'shorter' ? 'concise' : (mode === 'warm' ? 'warm' : (mode === 'objective' ? 'objective' : getB4StyleProfile())));
  const base = generateB4Core({ ...options, mode: mode === 'facts_only' ? 'facts_only' : 'default', styleProfile });
  if (mode === 'default' || mode === 'facts_only' || base.engineUsed !== 'rule-b4') return base;
  const adjusted = generateB4Core({ ...options, mode, styleProfile });
  if (adjusted.engineUsed !== 'rule-b4') return base;
  return mergeAdjustedSections(base, adjusted, mode, options.input || '', options.childName || '');
}

export function adjustB4(options = {}) {
  return generateB4(options);
}

export default generateB4;
