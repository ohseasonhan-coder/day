import { lintSurfaceText, overlapRate, polishSurfaceText } from './sentenceLinter';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

const BLOCKED_OPERATIONS = [
  'add_action',
  'add_emotion',
  'add_peer_reaction',
  'add_teacher_support',
  'add_causality',
  'add_development_judgment',
  'infer_hidden_meaning',
];

const LEGACY_GENERIC_MARKERS = [
  '?ㅼ뼇??寃쏀뿕',
  '寃⑸젮?쒕떎',
  '吏덈Ц?쒕떎',
  '?먮즺瑜??쒓났?쒕떎',
  '吏?띿쟻?쇰줈',
];

const LEGACY_REPORT_MARKERS = [
  '諛쒕떖',
  '?λ젰',
  '?μ긽',
  '?깆옣',
  '臾몄젣 ?닿껐',
  '?ы쉶',
  '李쎌쓽',
];

const LEGACY_CONNECTOR_MARKERS = [
  '???덈룄濡?',
  '?섎룄濡?',
  '怨쇱젙?먯꽌',
  '?먮쫫',
  '?댄썑',
  '?ㅼ쓬?먮뒗',
];

function sentenceParts(text = '') {
  return clean(text).split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
}

function markerRepeated(text = '', markers = []) {
  return markers.some((marker) => marker && clean(text).split(marker).length > 2);
}

function repeatedConnector(text = '') {
  const value = clean(text);
  return /(하도록.{0,24}하도록|과정에서.{0,24}과정에서|흐름.{0,24}흐름|수 있도록.{0,24}수 있도록)/.test(value)
    || markerRepeated(value, LEGACY_CONNECTOR_MARKERS);
}

function genericSupport(text = '') {
  const value = clean(text);
  return /(지속적으로 격려한다|다양한 경험을 제공한다|표현할 수 있도록 지원한다|격려한다\.$|질문한다\.$|도와준다\.$)/.test(value)
    || LEGACY_GENERIC_MARKERS.some((marker) => value.includes(marker));
}

function reportLike(text = '') {
  const value = clean(text);
  return /(발달|능력|향상|성장|문제 해결 능력|사회성|창의성)/.test(value)
    || LEGACY_REPORT_MARKERS.some((marker) => value.includes(marker));
}

function tooDense(text = '') {
  const parts = sentenceParts(text);
  return clean(text).length > 128 && parts.length <= 1;
}

function duplicateSpeech(text = '') {
  return /"([^"]+)".*"\1"/.test(text);
}

function repeatedStemRisk(text = '') {
  const words = clean(text).replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 2);
  const stems = words.map((word) => word.replace(/(하였다|했다|한다|하며|하면서|하고|보았다|본다|간다|갔다|되었다|된다)$/g, ''));
  const counts = stems.reduce((acc, stem) => {
    acc[stem] = (acc[stem] || 0) + 1;
    return acc;
  }, {});
  return Object.values(counts).some((count) => count >= 3);
}

function issueToOperations(issue) {
  return ({
    repeated_connector: ['replace_connector', 'delete_duplicate_clause'],
    connector_ending: ['fix_ending'],
    too_dense: ['split_sentence', 'delete_generic_phrase'],
    repeats_observation: ['delete_repeated_clause', 'reorder_clause'],
    repeats_learning: ['delete_repeated_clause', 'compress_sentence'],
    generic_support: ['delete_generic_phrase', 'fix_future_support_ending'],
    report_like: ['delete_generic_phrase'],
    duplicate_speech: ['delete_duplicate_clause', 'move_speech_position'],
    repeated_stem: ['delete_duplicate_clause', 'replace_connector'],
    rhythm_repeated: ['reorder_clause', 'split_sentence'],
  })[issue] || ['polish_sentence'];
}

export function criticCandidate(candidate = {}, context = {}) {
  const text = clean(candidate.text);
  const lint = lintSurfaceText(text, candidate.section, { hasTeacherSupport: context.graph?.flags?.hasTeacherSupport });
  const issues = [];
  lint.issues.forEach((issue) => {
    if (issue.code === 'connector_duplicate') issues.push('repeated_connector');
    if (issue.code === 'connector_ending') issues.push('connector_ending');
    if (issue.code === 'generic_support') issues.push('generic_support');
    if (issue.code === 'repeated_stem') issues.push('repeated_stem');
    if (issue.code === 'needs_sentence_split' || issue.code === 'too_long') issues.push('too_dense');
  });
  if (repeatedConnector(text)) issues.push('repeated_connector');
  if (tooDense(text)) issues.push('too_dense');
  if (candidate.section === 'learning' && context.observation && overlapRate(text, context.observation) > 0.66) issues.push('repeats_observation');
  if (candidate.section === 'support' && context.learning && overlapRate(text, context.learning) > 0.58) issues.push('repeats_learning');
  if (candidate.section === 'support' && genericSupport(text)) issues.push('generic_support');
  if (reportLike(text)) issues.push('report_like');
  if (duplicateSpeech(text)) issues.push('duplicate_speech');
  if (repeatedStemRisk(text)) issues.push('repeated_stem');
  if ((candidate.rhythmPenalty || 0) >= 12) issues.push('rhythm_repeated');

  const critical = lint.issues.some((issue) => issue.code === 'forbidden_claim' || issue.code === 'observation_interpretation')
    || (candidate.section === 'support' && lint.issues.some((issue) => issue.code === 'support_done_without_evidence'));
  const decision = critical ? 'reject' : (issues.length ? 'rewrite' : 'pass');
  return {
    candidateId: candidate.id || '',
    decision,
    issues: unique(issues),
    allowedOperations: unique(issues.flatMap(issueToOperations)),
    blockedOperations: BLOCKED_OPERATIONS,
    metadataOnly: true,
  };
}

function removeDuplicateSentences(text = '') {
  const seen = new Set();
  return sentenceParts(text).filter((sentence) => {
    const key = clean(sentence).replace(/[^\uAC00-\uD7A3]/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' ');
}

function splitDenseSentence(text = '') {
  const value = clean(text);
  if (value.length < 118 || value.includes('. ')) return value;
  const markers = [', 이후', ', 그 뒤', ', 그러면서', ', 다음에는', ', 관찰된', ', ?댄썑', ', ?ㅼ쓬?먮뒗', ', 愿李곕맂'];
  const splitAt = markers
    .map((marker) => value.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? -1;
  if (splitAt < 24) return value;
  return `${value.slice(0, splitAt).replace(/[,\s]+$/, '')}. ${value.slice(splitAt).replace(/^,\s*/, '')}`;
}

function removeGenericPhrases(text = '') {
  return LEGACY_GENERIC_MARKERS.reduce((value, marker) => value.replaceAll(marker, ''), clean(text))
    .replace(/지속적으로\s*/g, '')
    .replace(/다양한 경험을 제공한다\.?/g, '')
    .replace(/긍정적인 상호작용을\s*/g, '')
    .replace(/\s+\./g, '.');
}

function softenRepeatedConnectors(text = '') {
  let value = clean(text)
    .replace(/수 있도록\s+(.{0,24})수 있도록/g, '수 있도록 $1')
    .replace(/하도록\s+(.{0,24})하도록/g, '하도록 $1')
    .replace(/과정에서\s+(.{0,24})과정에서/g, '과정에서 $1')
    .replace(/흐름\s+(.{0,24})흐름/g, '흐름 $1');
  LEGACY_CONNECTOR_MARKERS.forEach((marker) => {
    const parts = value.split(marker);
    if (parts.length > 2) value = `${parts[0]}${marker}${parts.slice(1).join('')}`;
  });
  return value;
}

function normalizeEnding(text = '', section = 'learning') {
  let value = clean(text);
  if (section === 'support') {
    value = value
      .replace(/지원한다\.?$/, '지원해 본다.')
      .replace(/격려한다\.?$/, '상황에 맞는 표현을 함께 확인해 본다.')
      .replace(/질문한다\.?$/, '관찰한 장면을 짧은 말로 함께 확인해 본다.')
      .replace(/도와준다\.?$/, '필요한 부분을 짧게 안내해 본다.');
  }
  value = value
    .replace(/하며\.$/, '하였다.')
    .replace(/하면서\.$/, '하였다.')
    .replace(/보고\.$/, '보았다.')
    .replace(/보며\.$/, '보았다.');
  return value && !/[.!?]["']?$/.test(value) ? `${value}.` : value;
}

function rewriteText(text = '', section = 'learning') {
  return normalizeEnding(
    splitDenseSentence(
      removeGenericPhrases(
        removeDuplicateSentences(
          softenRepeatedConnectors(text),
        ),
      ),
    ),
    section,
  );
}

function subsetOf(next = [], base = []) {
  const allowed = new Set(base || []);
  return (next || []).every((item) => allowed.has(item));
}

export function rewriteCandidate(candidate = {}, critique = {}, context = {}) {
  if (critique.decision === 'reject') {
    return { ...candidate, rewriteRejected: true, selfCritic: critique };
  }
  const originalUnits = candidate.meaningUnitIds || [];
  const originalEvidence = candidate.evidenceIds || [];
  const rewrittenText = rewriteText(candidate.text, candidate.section);
  const polished = polishSurfaceText(rewrittenText, candidate.section, { hasTeacherSupport: context.graph?.flags?.hasTeacherSupport });
  const finalText = clean(polished.text || rewrittenText);
  const next = {
    ...candidate,
    text: finalText,
    evidenceIds: originalEvidence,
    meaningUnitIds: originalUnits,
    rewriteApplied: finalText !== clean(candidate.text),
    rewriteIssuesResolved: Math.max(0, (critique.issues || []).length - criticCandidate({ ...candidate, text: finalText }, context).issues.length),
  };
  if (!subsetOf(next.meaningUnitIds, originalUnits) || !subsetOf(next.evidenceIds, originalEvidence)) {
    return { ...candidate, rewriteRejected: true, selfCritic: critique };
  }
  return next;
}

export function applyRewriteLoop(candidate = {}, context = {}, maxPasses = 2) {
  let current = { ...candidate };
  const critiques = [];
  let appliedCount = 0;
  let resolved = 0;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const critique = criticCandidate(current, context);
    critiques.push(critique);
    if (critique.decision === 'pass') break;
    if (critique.decision === 'reject') {
      return {
        ...current,
        rewriteRejected: true,
        rewritePasses: pass,
        rewriteApplied: appliedCount > 0,
        rewriteIssuesResolved: resolved,
        selfCritic: critique,
        selfCriticHistory: critiques,
      };
    }
    const next = rewriteCandidate(current, critique, context);
    if (next.rewriteRejected) {
      return {
        ...current,
        rewriteRejected: true,
        rewritePasses: pass + 1,
        rewriteApplied: appliedCount > 0,
        rewriteIssuesResolved: resolved,
        selfCritic: critique,
        selfCriticHistory: critiques,
      };
    }
    if (next.rewriteApplied) appliedCount += 1;
    resolved += next.rewriteIssuesResolved || 0;
    current = next;
  }

  const finalCritique = criticCandidate(current, context);
  return {
    ...current,
    rewriteRejected: finalCritique.decision === 'reject',
    rewritePasses: critiques.length,
    rewriteApplied: appliedCount > 0,
    rewriteIssuesResolved: resolved,
    selfCritic: finalCritique,
    selfCriticHistory: critiques,
  };
}

export default applyRewriteLoop;
