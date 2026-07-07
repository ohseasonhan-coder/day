import { auditObservationCopy } from '../observationAudit';
import { parseTargetSections } from '../targetQuality';
import { B2_KEYS } from './config';
import { B2_THEMES } from './themes';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const finish = (value) => {
  const text = clean(value);
  return text && !/[.!?]["”']?$/.test(text) ? `${text}.` : text;
};
const hash = (value) => { let h = 0; for (const ch of String(value || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const unique = (items) => [...new Set(items.filter(Boolean))];
const quotes = (text) => Array.from(String(text || '').matchAll(/["“]([^"”]+)["”]/g)).map((m) => m[1]);
const BANNED = /(유아들은|활용하여|놀이에 참여하였다|발달 경험과 연결|영역의 발달|향상되었다|기회를 얻었다|이해하는 모습을 보였다|창의력이 뛰어|사회성이 발달|표현력이 향상|관찰하여 이해|할 것이다)/;

function topic(name) {
  const value = clean(name) || '유아';
  const code = value.charCodeAt(value.length - 1);
  const batchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${batchim ? '은' : '는'}`;
}

function normalizeForMatch(input) {
  return clean(input)
    .replace(/기다렷/g, '기다렸').replace(/햇/g, '했').replace(/됫/g, '됐')
    .replace(/([가-힣])함(?=\s|$)/g, '$1했다').replace(/안\s*함/g, '하지 않았다');
}

function factType(text) {
  if (/["“][^"”]+["”]|말하|물어|설명/.test(text)) return 'speech_action';
  if (/교사|선생님/.test(text)) return 'teacher_support';
  if (/친구|또래/.test(text)) return 'peer_action';
  if (/울|속상|화나|무서워|놀랐|웃었/.test(text)) return 'emotion_action';
  return 'action';
}

export function buildB2FactCard({ input = '', childName = '' } = {}) {
  const source = clean(input);
  const normalized = normalizeForMatch(source);
  const clauses = source.split(/(?<=[.!?])\s+|\s*,\s*|\s*그리고\s*|\s*그 뒤\s*/).map(clean).filter(Boolean);
  const facts = clauses.slice(0, 8).map((text, index) => ({
    id: `fact_${index + 1}`,
    type: factType(text),
    text,
    evidence: text,
    normalized: normalizeForMatch(text),
  }));
  if (!facts.length && source) facts.push({ id: 'fact_1', type: 'action', text: source, evidence: source, normalized });
  const speech = quotes(source).map((text, index) => ({ id: `speech_${index + 1}`, text, evidence: text }));
  const hasEmotion = /(울|눈물|속상|화나|짜증|무서워|놀랐|아쉬워|기뻐|웃었)/.test(normalized);
  const hasRecovery = /(진정|안정을 찾|괜찮아|다시.{0,10}집중)/.test(normalized);
  const sparse = normalized.length < 8 || /^(유아|[가-힣]{1,4}(이|가|은|는)?)?\s*(교실에 있었다|놀았다|울었다|미술 활동(을)? 했다|등원했다)[.]?$/.test(normalized);
  return {
    name: clean(childName) || '유아', source, normalized, facts, speech,
    flags: { sparse, hasPeer: /친구|또래/.test(normalized), hasTeacherSupport: /교사|선생님/.test(normalized), hasEmotion, hasRecovery },
    forbiddenClaims: [
      '입력에 없는 감정', '입력에 없는 의도·계획', '발달 수준 진단', '근거 없는 또래 반응',
      ...(!hasRecovery ? ['감정 회복 단정'] : []),
      ...(!/교사|선생님/.test(normalized) ? ['교사 지원 완료형 표현'] : []),
    ],
  };
}

function evidenceFor(theme, card) {
  return card.facts.filter((fact) => theme.trigger.test(fact.normalized)
    || (theme.id === 'emotion_expression' && /놀라(?!워)/.test(fact.normalized))).map((fact) => fact.id);
}

export function judgeB2Themes(card) {
  const matches = B2_THEMES.map((theme) => {
    const evidenceIds = evidenceFor(theme, card);
    const required = !theme.requiredEvidence || theme.requiredEvidence.test(card.normalized);
    const excluded = theme.excludedEvidence && theme.excludedEvidence.test(card.normalized);
    if (!evidenceIds.length || !required || excluded) return null;
    const speechBonus = card.speech.length && ['language', 'question', 'story', 'peer_help'].includes(theme.id) ? 8 : 0;
    return { ...theme, evidenceIds, score: theme.priority + evidenceIds.length * 4 + speechBonus };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected = [];
  for (const candidate of matches) {
    if (selected.some((item) => item.conflictThemes.includes(candidate.id) || candidate.conflictThemes.includes(item.id))) continue;
    if (!selected.length || selected[0].coexistThemes.includes(candidate.id) || candidate.coexistThemes.includes(selected[0].id)) selected.push(candidate);
    if (selected.length === 2) break;
  }
  return { ranked: matches, primary: selected[0] || null, secondary: selected[1] || null };
}

export function buildB2SentencePlan({ card, judgment, observation = '' } = {}) {
  const themes = [judgment.primary, judgment.secondary].filter(Boolean);
  const evidenceIds = unique(themes.flatMap((theme) => theme.evidenceIds));
  return {
    observationPlan: { orderedFacts: card.facts.map((fact) => fact.id), speechIds: card.speech.map((item) => item.id), maxSentences: 2, sourceText: finish(observation || card.source) },
    learningPlan: {
      primaryTheme: judgment.primary?.id || null,
      secondaryTheme: judgment.secondary?.id || null,
      allowedClaims: unique(themes.flatMap((theme) => theme.allowedClaims)),
      evidenceIds,
      claimLimit: card.flags.sparse ? 0 : Math.min(2, themes.length || 1),
      blockedClaims: unique([...card.forbiddenClaims, ...themes.flatMap((theme) => theme.blockedClaims)]),
    },
    supportPlan: {
      actualSupportIds: card.facts.filter((fact) => fact.type === 'teacher_support').map((fact) => fact.id),
      nextSupportActions: unique((judgment.primary?.allowedSupportActions || []).map((item) => item.id)),
      evidenceIds: judgment.primary?.evidenceIds || card.facts.slice(0, 1).map((fact) => fact.id),
      mustUseFutureTense: true,
      blockedClaims: ['교사 지원 완료형 표현'],
    },
    meta: { sparse: card.flags.sparse, themeIds: themes.map((theme) => theme.id), name: card.name },
  };
}

function actionSummary(card, max = 54) {
  const first = card.facts[0]?.text || card.source;
  return clean(first).replace(new RegExp(`^${card.name}(이가|이|가|은|는)?\\s*`), '').replace(/[.]$/, '').slice(0, max);
}

function claimText(themeId) {
  return ({
    retry: '다시 시도하며 방법을 이어 갔다', change_explore: '대상과 변화를 자세히 살펴보았다', make: '재료를 다루어 형태로 표현했다',
    question: '궁금한 점을 말로 물었다', language: '자신의 생각을 말로 표현했다', roleplay: '역할에 맞는 상황을 표현했다',
    peer_share: '친구와 나누거나 함께하는 행동을 이어 갔다', conflict: '갈등 상황에서 말과 행동으로 관계를 조정해 보았다',
    rules: '차례와 순서를 지키며 놀이를 이어 갔다', selfhelp: '일상에서 필요한 행동을 스스로 해 보았다', movement: '힘과 방향을 조절하며 움직였다',
    emotion_expression: '관찰된 말과 행동으로 마음을 표현했다', emotion_recovery: '마음을 표현한 뒤 다시 행동을 이어 갔다',
    compare: '자신이 정한 기준으로 비교하고 배열했다', story: '사건과 말을 순서 있게 이어 갔다', peer_help: '도움을 요청하거나 행동으로 도움을 주었다',
  })[themeId] || '관찰된 행동을 자신의 방식으로 이어 갔다';
}

function learningCandidates(card, plan, judgment, mode) {
  if (plan.meta.sparse || !judgment.primary || mode === 'facts_only') return [];
  const t = topic(card.name);
  const action = actionSummary(card);
  const primaryClaim = claimText(judgment.primary.id);
  const secondaryClaim = judgment.secondary ? claimText(judgment.secondary.id) : '';
  const speech = card.speech[0]?.text;
  const evidenceIds = plan.learningPlan.evidenceIds;
  const base = [
    { skeletonId: 'action_claim', text: `${t} ${action}. 이 과정에서 ${primaryClaim}.` },
    { skeletonId: 'sequence_claim', text: `${t} ${action}. 이 장면에서 ${primaryClaim}.` },
    { skeletonId: 'claim_ground', text: `${t} 관찰된 장면에서 ${primaryClaim}.` },
    { skeletonId: 'process_flow', text: `${t} ${primaryClaim}.` },
  ];
  if (speech) base.push({ skeletonId: 'speech_claim', text: `${t} “${speech}”라고 말하며 ${primaryClaim}.` });
  if (secondaryClaim) base.push({ skeletonId: 'two_claims', text: `${t} ${primaryClaim}. 또한 ${secondaryClaim}.` });
  return base.map((candidate, index) => ({ ...candidate, id: `learning_${index + 1}`, section: 'learning', evidenceIds, themeId: judgment.primary.id, text: finish(candidate.text), mode }));
}

function observationCandidates(card, observation) {
  const evidenceIds = card.facts.map((fact) => fact.id);
  const ordered = card.facts.map((fact) => fact.text).join(' ');
  const compact = card.facts.slice(0, 2).map((fact) => fact.text).join(' ');
  return unique([finish(observation || card.source), finish(ordered), finish(compact)]).map((text, index) => ({
    id: `observation_${index + 1}`, section: 'observation', skeletonId: index === 0 ? 'rule_preserved' : 'fact_ordered', evidenceIds, text,
  }));
}

function supportCandidates(card, plan, judgment, mode) {
  if (mode === 'facts_only') return [];
  if (plan.meta.sparse || !judgment.primary) {
    const evidenceIds = card.facts.slice(0, 1).map((fact) => fact.id);
    return [
      { id: 'support_sparse_1', section: 'support', skeletonId: 'observe_more', actionId: 'observe_more', evidenceIds, text: '구체적인 행동이 더 관찰될 때까지 살펴본 뒤 확인된 놀이 흐름을 이어 본다.' },
      { id: 'support_sparse_2', section: 'support', skeletonId: 'observe_detail', actionId: 'observe_more', evidenceIds, text: '사용한 재료와 말, 함께한 대상을 추가로 관찰한 뒤 다음 지원을 정한다.' },
      { id: 'support_sparse_3', section: 'support', skeletonId: 'observe_next', actionId: 'observe_more', evidenceIds, text: '다음 기록에서 구체적인 행동과 사용한 자료를 확인한 뒤 놀이 지원을 이어 본다.' },
    ];
  }
  const actions = judgment.primary.allowedSupportActions || [];
  const evidenceIds = plan.supportPlan.evidenceIds;
  const rows = [];
  actions.forEach((action, index) => {
    rows.push({ id: `support_${index + 1}_a`, section: 'support', skeletonId: 'direct_action', actionId: action.id, evidenceIds, text: action.text });
    rows.push({ id: `support_${index + 1}_b`, section: 'support', skeletonId: 'flow_action', actionId: action.id, evidenceIds, text: finish(`관찰된 흐름을 이어 갈 수 있도록 ${action.text.replace(/[.]$/, '')}`) });
  });
  return rows;
}

function localWeight(candidate) {
  try {
    const entries = JSON.parse(localStorage.getItem(B2_KEYS.REVIEW_DATA) || '[]');
    return entries.filter((entry) => entry.variant === 'B2' && entry.skeletonId === candidate.skeletonId)
      .reduce((sum, entry) => sum + ((entry.selections || []).includes('use_as_is') ? 4 : 0) - ((entry.selections || []).includes('fact_mismatch') ? 12 : 0) - ((entry.selections || []).includes('need_natural') ? 3 : 0) - ((entry.selections || []).includes('need_support_plan') ? 3 : 0), 0);
  } catch { return 0; }
}

function tokenOverlap(a, b) {
  const tokens = (value) => unique(String(value || '').replace(/[^가-힣\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 2));
  const left = tokens(a); const right = new Set(tokens(b));
  return left.length ? left.filter((word) => right.has(word)).length / left.length : 0;
}

function scoreCandidate(candidate, { card, observation, otherSection = '', mode }) {
  const reasons = [];
  let score = 100;
  const knownEvidence = new Set(card.facts.map((fact) => fact.id));
  if (!candidate.evidenceIds?.length || candidate.evidenceIds.some((id) => !knownEvidence.has(id))) { score -= 100; reasons.push('missing_evidence'); }
  if (BANNED.test(candidate.text)) { score -= 50; reasons.push('banned_phrase'); }
  if (!/[.!?]["”']?$/.test(candidate.text)) { score -= 15; reasons.push('incomplete'); }
  if (candidate.text.length > 180) { score -= 18; reasons.push('too_long'); }
  if (candidate.section === 'learning' && tokenOverlap(candidate.text, observation) > 0.78) { score -= 18; reasons.push('observation_repeat'); }
  if (otherSection && tokenOverlap(candidate.text, otherSection) > 0.7) { score -= 16; reasons.push('section_repeat'); }
  if (card.flags.sparse && candidate.section === 'learning') { score -= 100; reasons.push('sparse_overclaim'); }
  if (mode === 'shorter') score -= Math.max(0, candidate.text.length - 70) / 3;
  if (mode === 'objective' && /(즐거움|마음|힘을|태도)/.test(candidate.text)) score -= 12;
  if (mode === 'speech' && card.speech.length && !candidate.text.includes(card.speech[0].text)) score -= 25;
  if (mode === 'shorter' && candidate.skeletonId === 'process_flow') score += 8;
  if (mode === 'objective' && candidate.skeletonId === 'claim_ground') score += 8;
  if (mode === 'warm' && ['action_claim', 'flow_action'].includes(candidate.skeletonId)) score += 7;
  if (mode === 'learning' && ['sequence_claim', 'two_claims'].includes(candidate.skeletonId)) score += 9;
  if (mode === 'support' && candidate.section === 'support') score += Math.min(10, candidate.text.length / 12);
  if (['default', 'support'].includes(mode) && candidate.section === 'learning') {
    const preferred = `learning_${(hash(card.normalized) % 4) + 1}`;
    if (candidate.id === preferred) score += 4;
  }
  if (['default', 'learning', 'speech'].includes(mode) && candidate.section === 'support') {
    const preferredIndex = hash(`${card.normalized}|support`) % 2;
    if (candidate.id === `support_${preferredIndex + 1}_a`) score += 4;
  }
  score += localWeight(candidate);
  score += (hash(`${card.normalized}|${candidate.id}`) % 7) / 100;
  return { ...candidate, score: Math.round(score * 10) / 10, reasons, safe: score >= 70 && !reasons.includes('missing_evidence') };
}

function choose(candidates, context) {
  const scored = candidates.map((candidate) => scoreCandidate(candidate, context)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { selected: scored.find((candidate) => candidate.safe) || null, scored, rejected: scored.filter((candidate) => !candidate.safe).length };
}

function assemble(sections) {
  return [['관찰내용', sections.observation], ['배움 읽기', sections.learning], ['교사 지원 및 다음 계획', sections.support]]
    .filter(([, text]) => clean(text)).map(([label, text]) => `[${label}]\n${finish(text)}`).join('\n\n');
}

export function auditB2({ card, plan, sections, selected }) {
  const base = auditObservationCopy({ input: card.source, observation: sections.observation, learning: sections.learning, support: sections.support, childName: card.name });
  const warnings = [...base.warnings];
  const known = new Set(card.facts.map((fact) => fact.id));
  [selected.observation, selected.learning, selected.support].filter(Boolean).forEach((candidate) => {
    if (!candidate.evidenceIds?.length || candidate.evidenceIds.some((id) => !known.has(id))) warnings.push('b2_missing_evidence');
  });
  if (card.flags.sparse && sections.learning) warnings.push('b2_sparse_overclaim');
  if (plan.meta.themeIds.length && selected.learning && !plan.meta.themeIds.includes(selected.learning.themeId)) warnings.push('b2_theme_mismatch');
  if (BANNED.test(`${sections.learning} ${sections.support}`)) warnings.push('banned_phrase');
  const uniqueWarnings = unique(warnings);
  const major = uniqueWarnings.some((code) => base.details.some((detail) => detail.code === code && detail.severity === 'major') || /^b2_/.test(code));
  return { ...base, ok: uniqueWarnings.length === 0, severity: major ? 'major' : (uniqueWarnings.length ? 'minor' : 'none'), warnings: uniqueWarnings, evidenceLinked: !uniqueWarnings.includes('b2_missing_evidence') };
}

export function generateB2({ input = '', childName = '', observation = '', fallbackCopyReady = '', mode = 'default' } = {}) {
  const card = buildB2FactCard({ input, childName });
  const judgment = judgeB2Themes(card);
  if (!judgment.primary) card.flags.sparse = true;
  const plan = buildB2SentencePlan({ card, judgment, observation });
  const observationText = finish(observation || card.source);
  const observationPool = observationCandidates(card, observationText);
  const observationSelected = observationPool[0]; // rule observation is immutable; alternatives are audit/report candidates only.
  const learningPool = learningCandidates(card, plan, judgment, mode);
  const learningChoice = choose(learningPool, { card, observation: observationText, mode });
  const supportPool = supportCandidates(card, plan, judgment, mode);
  const supportChoice = choose(supportPool, { card, observation: observationText, otherSection: learningChoice.selected?.text || '', mode });
  const sections = {
    observation: observationText,
    learning: learningChoice.selected?.text || '',
    support: supportChoice.selected?.text || '',
  };
  let audit = auditB2({ card, plan, sections, selected: { observation: observationSelected, learning: learningChoice.selected, support: supportChoice.selected } });
  if (audit.severity === 'minor') {
    const nextLearning = learningChoice.scored.filter((candidate) => candidate.safe && candidate.id !== learningChoice.selected?.id)[0] || learningChoice.selected;
    const nextSupport = supportChoice.scored.filter((candidate) => candidate.safe && candidate.id !== supportChoice.selected?.id)[0] || supportChoice.selected;
    const rerendered = { observation: observationText, learning: nextLearning?.text || '', support: nextSupport?.text || '' };
    const rerenderedAudit = auditB2({ card, plan, sections: rerendered, selected: { observation: observationSelected, learning: nextLearning, support: nextSupport } });
    if (rerenderedAudit.warnings.length < audit.warnings.length) {
      Object.assign(sections, rerendered);
      audit = rerenderedAudit;
    }
  }
  let copyReady = assemble(sections);
  let fallbackApplied = false;
  if (audit.severity === 'major' || !copyReady) {
    fallbackApplied = true;
    copyReady = fallbackCopyReady || assemble({ observation: observationText, learning: '', support: '추가로 관찰한 뒤 확인된 놀이 흐름을 이어 본다.' });
    const fallback = parseTargetSections(copyReady);
    audit = auditObservationCopy({ input: card.source, observation: fallback.observation, learning: fallback.learning, support: fallback.support, childName: card.name });
  }
  const totalCandidates = observationPool.length + learningChoice.scored.length + supportChoice.scored.length;
  const rejectedCandidates = learningChoice.rejected + supportChoice.rejected;
  const evidenceUsed = unique([...(learningChoice.selected?.evidenceIds || []), ...(supportChoice.selected?.evidenceIds || [])]);
  return {
    copyReady,
    audit: { ...audit, fallbackApplied },
    sections: parseTargetSections(copyReady),
    plan,
    questions: card.flags.sparse ? ['어떤 재료를 사용했나요?', '친구나 교사와 주고받은 말이나 행동이 있었나요?'] : [],
    trace: {
      factCount: card.facts.length,
      evidenceIds: evidenceUsed,
      evidenceCoverage: evidenceUsed.length && card.facts.length ? Math.min(100, Math.round((evidenceUsed.length / card.facts.length) * 100)) : 0,
      themeIds: plan.meta.themeIds,
      skeletonId: learningChoice.selected?.skeletonId || '',
      supportSkeletonId: supportChoice.selected?.skeletonId || '',
      learningVariantId: learningChoice.selected?.id || '',
      supportVariantId: supportChoice.selected?.id || '',
      candidateCount: totalCandidates,
      rejectedCandidates,
      candidateRejectRate: totalCandidates ? Math.round((rejectedCandidates / totalCandidates) * 100) : 0,
      sparse: card.flags.sparse,
      mode,
      observationVariantId: observationSelected.id,
      sectionEvidence: {
        observation: observationSelected.evidenceIds,
        learning: learningChoice.selected?.evidenceIds || [],
        support: supportChoice.selected?.evidenceIds || [],
      },
    },
  };
}

export function adjustB2(options = {}) {
  return generateB2(options);
}

export default generateB2;
