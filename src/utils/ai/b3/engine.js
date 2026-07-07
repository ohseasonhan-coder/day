import { auditObservationCopy } from '../observationAudit';
import { buildB2FactCard, buildB2SentencePlan, generateB2, judgeB2Themes } from '../b2/engine';
import { B2_THEME_BY_ID } from '../b2/themes';
import { B3_KEYS, B3_SAFE_SCORE_MIN } from './config';
import { B3_LEARNING_SKELETONS, B3_SUPPORT_SKELETONS, B3_THEME_LANGUAGE } from './caseLibrary';
import { findSimilarB3Cases } from './caseSearch';

const BANNED = /(유아들은|활용하여|놀이에 참여하였다|발달 경험과 연결|영역의 발달|향상되었다|기회를 얻었다|창의력이 뛰어|사회성이 발달|표현력이 향상|할 것이다)/;
const OVERCLAIM = /(자신감|리더십|창의력|사회성|배려심|협동심|발달 수준|능력이|의도하|마음먹|분명히 이해|정서 조절)/;
const SUPPORT_DONE = /(지원하였|지원했|도와주었|제공하였|제공했|격려하였|마련해 주었|계획하였|계획했)/;
const OBJECT_TERMS = ['블록', '자동차', '점토', '물감', '종이', '가위', '퍼즐', '돋보기', '나뭇잎', '잎', '곤충', '애벌레', '꽃', '돌', '모래', '물', '공', '평균대', '미끄럼틀', '그네', '식판', '신발', '지퍼', '책', '그림', '사진', '텐트', '우산'];

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const finish = (value) => {
  const text = clean(value);
  return text && !/[.!?]["”']?$/.test(text) ? `${text}.` : text;
};
const unique = (values) => [...new Set(values.filter(Boolean))];
const hash = (value) => { let h = 0; for (const ch of String(value || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const tokenList = (value) => unique(String(value || '').replace(/[^가-힣\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 2));
const tokenOverlap = (a, b) => {
  const left = tokenList(a); const right = new Set(tokenList(b));
  return left.length ? left.filter((word) => right.has(word)).length / left.length : 0;
};

function topic(name) {
  const value = clean(name) || '유아';
  const code = value.charCodeAt(value.length - 1);
  const batchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${value}${batchim ? '은' : '는'}`;
}

function objectWithParticle(value) {
  const text = clean(value);
  if (!text) return '';
  const code = text.charCodeAt(text.length - 1);
  const batchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return `${text}${batchim ? '을' : '를'}`;
}

function renderSkeleton(skeleton, slots) {
  return finish(String(skeleton || '')
    .replaceAll('{child}은/는', slots.childTopic)
    .replaceAll('{childTopic}', slots.childTopic)
    .replaceAll('{child}', slots.child)
    .replaceAll('{context}', slots.context)
    .replaceAll('{scene}', slots.scene)
    .replaceAll('{meaningShort}', slots.meaningShort)
    .replaceAll('{meaning}', slots.meaning)
    .replaceAll('{flow}', slots.flow)
    .replaceAll('{supportAction}', slots.supportAction)
    .replaceAll('{speech}', slots.speech));
}

function sceneSlots(card, themeId) {
  const object = OBJECT_TERMS.find((term) => card.normalized.includes(term)) || '';
  const target = objectWithParticle(object);
  const failed = /(무너지|실패|안 되|틀리|잘못)/.test(card.normalized);
  const emotionContext = /울|눈물/.test(card.normalized) ? '울음이 나타난 장면에서'
    : (/귀를 막/.test(card.normalized) ? '귀를 막는 행동이 나타난 장면에서' : (/웃/.test(card.normalized) ? '웃는 표정이 나타난 장면에서' : '말과 행동이 나타난 장면에서'));
  const ruleContext = /차례|기다/.test(card.normalized) ? '자신의 차례를 기다리는 동안'
    : (/줄을 서/.test(card.normalized) ? '줄을 서서 기다리는 과정에서' : '정해진 순서를 확인하는 동안');
  const rows = {
    retry: [failed ? '뜻대로 되지 않은 뒤에도' : (target ? `${target} 다시 다루는 과정에서` : '놀이를 계속하는 과정에서'), failed ? '뜻대로 되지 않은 뒤 다시 시도하는 행동을 이어 갔다' : '하던 놀이를 멈추지 않고 다시 시도했다'],
    change_explore: [target ? `${target} 살펴보는 과정에서` : '대상을 살펴보는 과정에서', target ? `${target} 자세히 살펴보았다` : '대상의 변화를 자세히 살펴보았다'],
    make: [target ? `${target} 다루는 과정에서` : '재료를 다루는 과정에서', target ? `${target} 사용해 구성을 이어 갔다` : '사용한 재료로 구성을 이어 갔다'],
    question: ['궁금한 점을 말로 묻는 과정에서', '궁금한 내용을 질문으로 나타냈다'],
    language: ['경험을 말로 전하는 과정에서', '관찰하거나 경험한 내용을 말로 전했다'],
    roleplay: ['맡은 역할에 따라 놀이하는 과정에서', '역할에 맞는 말과 행동을 이어 갔다'],
    peer_share: ['친구와 자료를 주고받는 과정에서', '친구와 나누거나 함께하는 행동을 이어 갔다'],
    conflict: ['친구와의 상황을 다시 조정하는 과정에서', '갈등 상황에서 말이나 행동을 나타냈다'],
    rules: [ruleContext, '자신의 차례를 기다린 뒤 행동을 이어 갔다'],
    selfhelp: ['일상생활 중', '생활에 필요한 행동을 스스로 이어 갔다'],
    movement: ['몸의 힘과 방향을 조절하는 과정에서', '움직이는 힘과 방향을 바꾸어 보았다'],
    emotion_expression: [emotionContext, '말이나 표정, 행동으로 마음을 표현했다'],
    emotion_recovery: ['마음을 표현한 뒤 다시 행동하는 과정에서', '관찰된 회복 단서 뒤 놀이를 다시 시작했다'],
    compare: ['기준에 따라 대상을 살펴보는 과정에서', '대상을 비교하고 순서에 따라 놓아 보았다'],
    story: ['사건과 말을 차례로 이어 가는 과정에서', '앞뒤 장면을 연결해 이야기를 이어 갔다'],
    peer_help: ['도움을 주고받는 과정에서', '필요한 도움을 말이나 행동으로 주고받았다'],
  };
  const [context, scene] = rows[themeId] || ['관찰된 행동을 이어 가는 과정에서', '관찰된 행동을 이어 갔다'];
  return { object, context, scene };
}

function buildSlots(card, judgment, meaning, supportAction = '') {
  const language = B3_THEME_LANGUAGE[judgment.primary?.id] || { flow: '놀이 흐름' };
  const scene = sceneSlots(card, judgment.primary?.id);
  return {
    child: card.name,
    childTopic: topic(card.name),
    context: scene.context,
    scene: scene.scene,
    meaning,
    meaningShort: meaning,
    flow: language.flow,
    supportAction: clean(supportAction).replace(/[.]$/, ''),
    speech: card.speech[0]?.text || '',
    object: scene.object,
  };
}

function getLocalRows() {
  try { return JSON.parse(localStorage.getItem(B3_KEYS.REVIEW_DATA) || '[]'); } catch { return []; }
}

export function getB3FeedbackWeight(candidate, themeIds, rows = getLocalRows()) {
  const themesKey = [...themeIds].sort().join('|');
  const relevant = rows.filter((entry) => entry.variant === 'B3'
    && (!entry.themeIds?.length || [...entry.themeIds].sort().join('|') === themesKey)
    && (entry.learningPatternId === candidate.patternId || entry.supportPatternId === candidate.patternId));
  const raw = relevant.reduce((sum, entry) => {
    const selected = entry.selections || [];
    return sum + (selected.includes('use_as_is') ? 6 : 0)
      - (selected.includes('minor_wording') ? 2 : 0)
      - (selected.includes('need_natural') ? 5 : 0)
      - (selected.includes('need_support_plan') ? 5 : 0)
      - (selected.includes('fact_mismatch') ? 30 : 0);
  }, 0);
  return Math.max(-30, Math.min(12, raw));
}

function recentPatternPenalty(candidate, rows = getLocalRows()) {
  return rows.slice(0, 30).filter((entry) => entry.variant === 'B3'
    && (entry.selectedCandidateId === candidate.id || entry.learningPatternId === candidate.patternId || entry.supportPatternId === candidate.patternId)).length * 2;
}

function naturalnessScore(text) {
  let score = 100;
  if (text.length < 18) score -= 12;
  if (text.length > 145) score -= Math.min(30, Math.round((text.length - 145) / 3));
  if (/과정에서.{0,12}과정에서|수 있도록.*수 있도록|흐름을 위해.{0,15}흐름/.test(text)) score -= 28;
  if (/(시도).{0,35}\1|(관찰된).{0,35}\2|(차례).{0,35}\3|(행동).{0,35}\4/.test(text)) score -= 18;
  if (/([가-힣]{2,})\s+\1/.test(text)) score -= 18;
  const repeated = Object.values(tokenList(text).reduce((counts, token) => {
    const stem = token.replace(/(에서|으로|하며|했다|한다|보았다|이어|과정)$/, '');
    if (stem.length >= 2) counts[stem] = (counts[stem] || 0) + (text.split(stem).length - 1);
    return counts;
  }, {})).filter((count) => count >= 2).length;
  score -= Math.min(30, repeated * 12);
  if (!/[.!?]["”']?$/.test(text)) score -= 20;
  return Math.max(0, score);
}

function scoreB3Candidate(candidate, context) {
  const { card, plan, b2, mode, otherSection = '' } = context;
  const known = new Set(card.facts.map((fact) => fact.id));
  const evidenceCoverage = candidate.evidenceIds?.length && candidate.evidenceIds.every((id) => known.has(id)) ? 100 : 0;
  const themeFit = candidate.section === 'support'
    ? (plan.supportPlan.nextSupportActions.includes(candidate.actionId) ? 100 : 0)
    : (plan.meta.themeIds.includes(candidate.themeId) ? 100 : 0);
  const forbiddenPenalty = BANNED.test(candidate.text) ? 100 : 0;
  const overclaimPenalty = OVERCLAIM.test(candidate.text) || (candidate.section === 'support' && SUPPORT_DONE.test(candidate.text)) ? 100 : 0;
  const audit = auditObservationCopy({
    input: card.source,
    observation: b2.sections.observation,
    learning: candidate.section === 'learning' ? candidate.text : b2.sections.learning,
    support: candidate.section === 'support' ? candidate.text : b2.sections.support,
    childName: card.name,
  });
  const sectionFit = candidate.section === 'learning' ? (!SUPPORT_DONE.test(candidate.text) ? 100 : 0) : 100;
  const naturalnessHeuristic = naturalnessScore(candidate.text);
  const specificity = candidate.specific ? 100 : (candidate.source === 'theme' ? 78 : 68);
  const repetitionPenalty = Math.round(tokenOverlap(candidate.text, candidate.section === 'learning' ? b2.sections.observation : otherSection) * 32)
    + recentPatternPenalty(candidate);
  const supportPracticality = candidate.section === 'support'
    ? (/마련|둔다|기다|확보|남겨|되돌려|짚어|돕|이어/.test(candidate.text) ? 100 : 72)
    : 100;
  const safetyScore = Math.max(0, evidenceCoverage * 0.4 + themeFit * 0.25
    + (forbiddenPenalty ? 0 : 20) + (overclaimPenalty ? 0 : 15) - (audit.severity === 'major' ? 100 : 0));
  let qualityScore = evidenceCoverage * 0.18 + themeFit * 0.16 + sectionFit * 0.12
    + naturalnessHeuristic * 0.18 + specificity * 0.14 + supportPracticality * 0.12
    - repetitionPenalty - forbiddenPenalty - overclaimPenalty;
  if (mode === 'shorter') qualityScore += Math.max(0, 100 - candidate.text.length) / 5;
  if (mode === 'objective' && !/(마음|따뜻|편안)/.test(candidate.text)) qualityScore += 10;
  if (mode === 'warm' && ['case', 'peer', 'speech'].includes(candidate.source)) qualityScore += 8;
  if (candidate.source === 'case' && naturalnessHeuristic >= 90) qualityScore += 5 + Math.min(10, Math.max(0, (candidate.caseScore || 58) - 58) / 5);
  if (candidate.section === 'learning' && candidate.source === 'speech') qualityScore += 8;
  if (candidate.section === 'learning' && candidate.source === 'peer') qualityScore += 4;
  if (mode === 'learning' && candidate.section === 'learning' && candidate.source === 'case') qualityScore += 10;
  if (mode === 'support' && candidate.section === 'support' && candidate.specific) qualityScore += 12;
  if (mode === 'speech' && candidate.section === 'learning' && candidate.source === 'speech') qualityScore += 24;
  if (candidate.section === 'learning' && naturalnessHeuristic >= 85) {
    const preferredPattern = B3_LEARNING_SKELETONS[hash(`${card.normalized}|pattern`) % B3_LEARNING_SKELETONS.length].id;
    if (candidate.patternId === preferredPattern) qualityScore += 16;
    const preferredMeaning = (hash(`${card.normalized}|meaning`) % 3) + 1;
    if (candidate.id.endsWith(`_${preferredMeaning}`)) qualityScore += 7;
  }
  if (candidate.section === 'support' && naturalnessHeuristic >= 85) {
    const preferredPattern = B3_SUPPORT_SKELETONS[hash(`${card.normalized}|support-pattern`) % B3_SUPPORT_SKELETONS.length].id;
    if (candidate.patternId === preferredPattern) qualityScore += 10;
  }
  const feedbackWeight = getB3FeedbackWeight(candidate, plan.meta.themeIds);
  qualityScore += feedbackWeight;
  qualityScore += (hash(`${card.normalized}|${candidate.id}`) % 401) / 100;
  const reasons = unique([
    !evidenceCoverage && 'missing_evidence',
    !themeFit && 'theme_mismatch',
    forbiddenPenalty && 'forbidden_claim',
    overclaimPenalty && 'overclaim',
    audit.severity === 'major' && 'major_audit',
    repetitionPenalty >= 25 && 'repetition',
    naturalnessHeuristic < 70 && 'awkward_style',
  ]);
  return {
    ...candidate,
    safe: safetyScore >= B3_SAFE_SCORE_MIN && audit.severity !== 'major',
    safetyScore: Math.round(safetyScore * 10) / 10,
    qualityScore: Math.round(qualityScore * 10) / 10,
    metrics: { evidenceCoverage, themeFit, sectionFit, naturalnessHeuristic, specificity, repetitionPenalty, forbiddenPenalty, overclaimPenalty, supportPracticality, feedbackWeight },
    reasons,
    audit,
  };
}

function rankCandidates(candidates, context) {
  const scored = candidates.map((candidate) => scoreB3Candidate(candidate, context))
    .sort((a, b) => Number(b.safe) - Number(a.safe) || b.safetyScore - a.safetyScore || b.qualityScore - a.qualityScore || a.id.localeCompare(b.id));
  return { scored, selected: scored.find((candidate) => candidate.safe) || null, rejected: scored.filter((candidate) => !candidate.safe).length };
}

function learningCandidates(card, plan, judgment, caseSearch) {
  const language = B3_THEME_LANGUAGE[judgment.primary?.id];
  if (!language) return [];
  const evidenceIds = plan.learningPlan.evidenceIds;
  const candidates = [];
  B3_LEARNING_SKELETONS.forEach((pattern, patternIndex) => {
    language.meanings.forEach((meaning, meaningIndex) => {
      const slots = buildSlots(card, judgment, meaning);
      candidates.push({
        id: `b3_learning_theme_${patternIndex + 1}_${meaningIndex + 1}`,
        section: 'learning', source: 'theme', patternId: pattern.id, skeletonId: pattern.id,
        themeId: judgment.primary.id, evidenceIds, specific: pattern.id.includes('context') || pattern.id.includes('scene'),
        text: renderSkeleton(pattern.text, slots),
      });
    });
  });
  caseSearch.matches.forEach((item, index) => {
    const meaning = language.meanings[index % language.meanings.length];
    const slots = buildSlots(card, judgment, meaning);
    if (item.learningSkeleton.includes('{speech}') && !slots.speech) return;
    candidates.push({
      id: `b3_learning_case_${item.id}`,
      section: 'learning', source: 'case', caseId: item.id, patternId: item.learningPatternId, skeletonId: item.learningPatternId,
      themeId: judgment.primary.id, evidenceIds, caseScore: item.score, specific: true, text: renderSkeleton(item.learningSkeleton, slots),
    });
  });
  if (card.speech.length) {
    const slots = buildSlots(card, judgment, language.meanings[hash(card.normalized) % language.meanings.length]);
    candidates.push({ id: 'b3_learning_speech', section: 'learning', source: 'speech', patternId: 'speech_grounded', skeletonId: 'speech_grounded', themeId: judgment.primary.id, evidenceIds, specific: true, text: renderSkeleton('{child}은/는 “{speech}”라고 말하며 {meaning}.', slots) });
  }
  if (card.flags.hasPeer) {
    const slots = buildSlots(card, judgment, language.meanings[(hash(card.normalized) + 1) % language.meanings.length]);
    candidates.push({ id: 'b3_learning_peer', section: 'learning', source: 'peer', patternId: 'peer_grounded', skeletonId: 'peer_grounded', themeId: judgment.primary.id, evidenceIds, specific: true, text: renderSkeleton('{child}은/는 친구와 함께한 상황에서 {meaning}.', slots) });
  }
  return unique(candidates.map((candidate) => JSON.stringify(candidate))).map((item) => JSON.parse(item));
}

function supportCandidates(card, plan, judgment, caseSearch) {
  const theme = B2_THEME_BY_ID[judgment.primary?.id];
  const evidenceIds = plan.supportPlan.evidenceIds;
  const candidates = [];
  (theme?.allowedSupportActions || []).forEach((action, actionIndex) => {
    B3_SUPPORT_SKELETONS.forEach((pattern, patternIndex) => {
      const slots = buildSlots(card, judgment, '', action.text);
      candidates.push({
        id: `b3_support_theme_${actionIndex + 1}_${patternIndex + 1}`,
        section: 'support', source: 'theme', patternId: pattern.id, skeletonId: pattern.id,
        actionId: action.id, evidenceIds, specific: pattern.id !== 'support_direct', text: renderSkeleton(pattern.text, slots),
      });
    });
  });
  caseSearch.matches.forEach((item, index) => {
    const action = (theme?.allowedSupportActions || [])[index % Math.max(1, theme?.allowedSupportActions?.length || 1)];
    if (!action) return;
    const slots = buildSlots(card, judgment, '', action.text);
    candidates.push({
      id: `b3_support_case_${item.id}`,
      section: 'support', source: 'case', caseId: item.id, patternId: item.supportPatternId, skeletonId: item.supportPatternId,
      actionId: action.id, evidenceIds, caseScore: item.score, specific: true, text: renderSkeleton(item.supportSkeleton, slots),
    });
  });
  return unique(candidates.map((candidate) => JSON.stringify(candidate))).map((item) => JSON.parse(item));
}

function assemble(sections) {
  return [['관찰내용', sections.observation], ['배움 읽기', sections.learning], ['교사 지원 및 다음 계획', sections.support]]
    .filter(([, text]) => clean(text)).map(([label, text]) => `[${label}]\n${finish(text)}`).join('\n\n');
}

function sparseQuestions(card) {
  const rows = [];
  if (!OBJECT_TERMS.some((term) => card.normalized.includes(term))) rows.push('아이가 어떤 재료나 놀잇감을 사용했나요?');
  if (!card.flags.hasPeer) rows.push('친구와 나눈 말이나 행동이 있었나요?');
  if (!card.flags.hasTeacherSupport) rows.push('교사가 도와준 부분이 있었나요?');
  return rows.slice(0, 2);
}

function fallbackB3(b2, caseSearch, reason, mode) {
  return {
    copyReady: b2.copyReady,
    b2CopyReady: b2.copyReady,
    audit: b2.audit,
    sections: b2.sections,
    b2,
    engineUsed: 'rule-b2',
    fallbackReason: reason,
    questions: b2.questions.slice(0, 2),
    trace: {
      engine: 'rule-b3', mode, fallbackApplied: true, fallbackReason: reason,
      themeIds: b2.plan.meta.themeIds, factsShape: caseSearch?.factsShape || [],
      caseSearchSuccess: !!caseSearch?.success, similarCaseIds: caseSearch?.matches?.map((item) => item.id) || [],
      caseTopScore: caseSearch?.topScore || 0, caseLibraryUsed: false,
      candidateCount: 0, rejectedCandidates: 0, candidateRejectRate: 0,
      learningPatternId: '', supportPatternId: '', selectedCandidateIds: [],
    },
  };
}

function generateB3Core({ input = '', childName = '', observation = '', fallbackCopyReady = '', mode = 'default', documentType = 'observation' } = {}) {
  const b2 = generateB2({ input, childName, observation, fallbackCopyReady, mode: 'default' });
  const card = buildB2FactCard({ input, childName });
  const judgment = judgeB2Themes(card);
  if (!judgment.primary) card.flags.sparse = true;
  const plan = buildB2SentencePlan({ card, judgment, observation: b2.sections.observation });
  if (card.flags.sparse || !judgment.primary) {
    const fallback = fallbackB3(b2, null, 'insufficient_information', mode);
    fallback.questions = sparseQuestions(card);
    return fallback;
  }
  const caseSearch = findSimilarB3Cases({ card, plan, documentType });
  if (!caseSearch.success) return fallbackB3(b2, caseSearch, 'similar_case_not_found', mode);

  const learningPool = learningCandidates(card, plan, judgment, caseSearch);
  const learning = rankCandidates(learningPool, { card, plan, b2, mode });
  const supportPool = supportCandidates(card, plan, judgment, caseSearch);
  const support = rankCandidates(supportPool, { card, plan, b2, mode, otherSection: learning.selected?.text || '' });
  if (!learning.selected || !support.selected) return fallbackB3(b2, caseSearch, 'safe_candidate_not_found', mode);

  const sections = { observation: b2.sections.observation, learning: learning.selected.text, support: support.selected.text };
  const audit = auditObservationCopy({ input: card.source, observation: sections.observation, learning: sections.learning, support: sections.support, childName: card.name });
  if (audit.severity === 'major') return fallbackB3(b2, caseSearch, `audit:${audit.warnings.join(',')}`, mode);

  const total = learning.scored.length + support.scored.length;
  const rejected = learning.rejected + support.rejected;
  return {
    copyReady: assemble(sections),
    b2CopyReady: b2.copyReady,
    audit: { ...audit, fallbackApplied: false },
    sections,
    b2,
    engineUsed: 'rule-b3',
    fallbackReason: '',
    questions: [],
    trace: {
      engine: 'rule-b3', mode, fallbackApplied: false, fallbackReason: '',
      themeIds: plan.meta.themeIds, factsShape: caseSearch.factsShape,
      caseSearchSuccess: true, similarCaseIds: caseSearch.matches.map((item) => item.id), caseTopScore: caseSearch.topScore,
      caseLibraryUsed: learning.selected.source === 'case' || support.selected.source === 'case',
      candidateCount: total, learningCandidateCount: learning.scored.length, supportCandidateCount: support.scored.length,
      rejectedCandidates: rejected, candidateRejectRate: total ? Math.round((rejected / total) * 100) : 0,
      learningPatternId: learning.selected.patternId, supportPatternId: support.selected.patternId,
      selectedCandidateIds: [learning.selected.id, support.selected.id],
      selectedScores: { learning: learning.selected.qualityScore, support: support.selected.qualityScore },
      selectedSafetyScores: { learning: learning.selected.safetyScore, support: support.selected.safetyScore },
      selectedMetrics: { learning: learning.selected.metrics, support: support.selected.metrics },
      sectionEvidence: { observation: card.facts.map((fact) => fact.id), learning: learning.selected.evidenceIds, support: support.selected.evidenceIds },
    },
  };
}

function mergeAdjustedSections(base, adjusted, mode, input, childName) {
  const sections = {
    observation: base.sections.observation,
    learning: mode === 'support' ? base.sections.learning : adjusted.sections.learning,
    support: mode === 'learning' ? base.sections.support : adjusted.sections.support,
  };
  const audit = auditObservationCopy({ input, observation: sections.observation, learning: sections.learning, support: sections.support, childName });
  if (audit.severity === 'major') return base;
  return { ...adjusted, copyReady: assemble(sections), sections, audit: { ...audit, fallbackApplied: false } };
}

export function generateB3(options = {}) {
  const mode = options.mode || 'default';
  if (mode === 'facts_only') {
    const b2 = generateB2({ ...options, mode: 'default' });
    const factsOnly = generateB2({ ...options, mode: 'facts_only' });
    return {
      ...factsOnly,
      b2,
      b2CopyReady: b2.copyReady,
      engineUsed: 'rule-b3',
      fallbackReason: '',
      trace: { ...factsOnly.trace, engine: 'rule-b3', mode, caseLibraryUsed: false, selectedCandidateIds: [], learningPatternId: '', supportPatternId: '' },
    };
  }
  const base = generateB3Core({ ...options, mode: 'default' });
  if (mode === 'default' || base.engineUsed !== 'rule-b3') return base;
  const adjusted = generateB3Core({ ...options, mode });
  if (adjusted.engineUsed !== 'rule-b3') return base;
  return mergeAdjustedSections(base, adjusted, mode, options.input || '', options.childName || '');
}

export function adjustB3(options = {}) {
  return generateB3(options);
}

export default generateB3;
