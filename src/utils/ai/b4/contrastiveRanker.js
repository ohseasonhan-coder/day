import { CONTRAST_SETS } from './approvedPhraseBank';
import { judgeTeacherStyle, tokenOverlap } from './teacherStyleJudge';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

function safeCandidate(candidate = {}) {
  return !!candidate && candidate.safe && candidate.safetyScore >= 92 && !(candidate.reasons || []).length;
}

function countReasons(rows = [], key = 'reasons') {
  return rows.flatMap((row) => row[key] || []).reduce((acc, reason) => {
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
}

function sectionOverlapReason(candidate = {}, context = {}) {
  if (candidate.section === 'learning' && context.observation && tokenOverlap(candidate.text, context.observation) > 0.56) {
    return 'candidate_repeats_observation';
  }
  if (candidate.section === 'support' && context.learning && tokenOverlap(candidate.text, context.learning) > 0.52) {
    return 'candidate_repeats_learning';
  }
  return '';
}

function genericPenalty(candidate = {}, judge = {}) {
  let penalty = 0;
  if ((candidate.surfaceLint?.issues || []).some((issue) => issue.code === 'generic_support' || issue.type === 'generic')) penalty += 18;
  if ((judge.blockedReasons || []).includes('abstract_general_support')) penalty += 16;
  if ((judge.blockedReasons || []).includes('report_like_or_development_claim')) penalty += 22;
  if ((judge.reasons || []).includes('overused_record_phrase')) penalty += 8;
  return penalty;
}

function supportBoost(candidate = {}, judge = {}) {
  if (candidate.section !== 'support') return 0;
  const quality = judge.supportQuality?.score ?? candidate.supportQuality?.score ?? 70;
  return Math.round((quality - 70) * 0.65);
}

function rhythmPenalty(candidate = {}, judge = {}) {
  return Math.max(candidate.rhythmPenalty || 0, judge.rhythmPenalty || 0);
}

function contrastSetFor(candidate = {}, context = {}) {
  const themes = [candidate.primaryTheme, candidate.secondaryTheme, context.plan?.primaryTheme, context.plan?.secondaryTheme].filter(Boolean);
  return CONTRAST_SETS.find((set) => themes.includes(set.theme)) || null;
}

function styleComparisonScore(candidate = {}, context = {}) {
  const judge = candidate.teacherStyle || judgeTeacherStyle(candidate, context);
  const overlapReason = sectionOverlapReason(candidate, context);
  const contrastSet = contrastSetFor(candidate, context);
  const contrastBonus = contrastSet ? 4 : 0;
  const score = Math.round(
    (candidate.qualityScore || 0)
    + (judge.score || 0) * 0.42
    + supportBoost(candidate, judge)
    + (candidate.localPreferenceWeight || 0)
    - genericPenalty(candidate, judge)
    - rhythmPenalty(candidate, judge)
    - (overlapReason ? 14 : 0)
  );
  return {
    score,
    judge,
    overlapReason,
    contrastSet,
    adjusted: score + contrastBonus,
  };
}

function firstDifferentReason(a = {}, b = {}, aMeta = {}, bMeta = {}, context = {}) {
  const reasons = [];
  const blockedReasons = [];
  const aGeneric = genericPenalty(a, aMeta.judge);
  const bGeneric = genericPenalty(b, bMeta.judge);
  if (bGeneric < aGeneric) reasons.push('less_generic');
  if (bMeta.overlapReason && !aMeta.overlapReason) blockedReasons.push('candidate_b_repeats_section');
  if (aMeta.overlapReason && !bMeta.overlapReason) {
    reasons.push('better_section_separation');
    blockedReasons.push(a.section === 'learning' ? 'candidate_a_repeats_observation' : 'candidate_a_repeats_learning');
  }
  if ((bMeta.judge?.reasons || []).includes('teacher_like_ending') && !(aMeta.judge?.reasons || []).includes('teacher_like_ending')) {
    reasons.push('more_teacher_like_ending');
  }
  if ((b.rhythmPenalty || 0) < (a.rhythmPenalty || 0)) reasons.push('less_recent_rhythm_overlap');
  if ((b.localPreferenceWeight || 0) > (a.localPreferenceWeight || 0)) reasons.push('local_teacher_preference');
  if ((bMeta.judge?.supportQuality?.score || 0) > (aMeta.judge?.supportQuality?.score || 0) && b.section === 'support') {
    reasons.push('more_practical_support_plan');
  }
  if (context.graph?.flags?.hasSpeech && /"[^"]+"/.test(b.text || '') && !/"[^"]+"/.test(a.text || '')) {
    reasons.push('better_speech_placement');
  }
  if ((b.text || '').length < (a.text || '').length && (a.text || '').length > 118) reasons.push('less_overloaded_sentence');
  if (bMeta.contrastSet && !aMeta.contrastSet) reasons.push('contrast_set_preference');
  if (!reasons.length && bMeta.adjusted > aMeta.adjusted) reasons.push('higher_teacher_style_score');
  return { reasons: unique(reasons), blockedReasons: unique(blockedReasons) };
}

export function compareCandidates(candidateA = {}, candidateB = {}, context = {}) {
  const aMeta = styleComparisonScore(candidateA, context);
  const bMeta = styleComparisonScore(candidateB, context);
  const bWins = bMeta.adjusted > aMeta.adjusted
    || (bMeta.adjusted === aMeta.adjusted && clean(candidateB.id).localeCompare(clean(candidateA.id)) < 0);
  const detail = firstDifferentReason(candidateA, candidateB, aMeta, bMeta, context);
  const winner = bWins ? candidateB : candidateA;
  const loser = bWins ? candidateA : candidateB;
  return {
    winnerId: winner.id,
    loserId: loser.id,
    winner: bWins ? 'candidate_b' : 'candidate_a',
    reasons: bWins ? detail.reasons : unique([
      ...(aMeta.overlapReason && !bMeta.overlapReason ? [] : ['score_top_retained']),
      ...((aMeta.judge?.reasons || []).includes('teacher_like_ending') ? ['more_teacher_like_ending'] : []),
    ]),
    blockedReasons: bWins ? detail.blockedReasons : unique([
      ...(bMeta.overlapReason ? [bMeta.overlapReason.replace('candidate_', 'candidate_b_')] : []),
      ...((bMeta.judge?.blockedReasons || []).map((reason) => `candidate_b_${reason}`)),
    ]),
    scores: { candidateA: aMeta.adjusted, candidateB: bMeta.adjusted },
    metadataOnly: true,
    rhythm: {
      winner: winner.rhythmSignature || aMeta.judge?.rhythm?.signature || bMeta.judge?.rhythm?.signature || '',
      loser: loser.rhythmSignature || '',
    },
  };
}

export function contrastiveRankCandidates(candidates = [], context = {}) {
  const safe = candidates.filter(safeCandidate);
  if (!safe.length) {
    return {
      selected: null,
      scoreTopId: '',
      changedFromScoreTop: false,
      comparisons: [],
      reasonCounts: {},
      blockedReasonCounts: {},
      contrastSetApplied: false,
      rhythmSignatures: [],
      selectedRhythm: '',
      metadataOnly: true,
    };
  }
  const scoreTop = safe[0];
  const narrowed = safe.slice(0, 6);
  let current = scoreTop;
  const comparisons = [];
  narrowed.slice(1).forEach((candidate) => {
    const result = compareCandidates(current, candidate, context);
    comparisons.push({
      winner: result.winner,
      winnerId: result.winnerId,
      loserId: result.loserId,
      reasons: result.reasons,
      blockedReasons: result.blockedReasons,
      scores: result.scores,
      metadataOnly: true,
    });
    if (result.winnerId === candidate.id) current = candidate;
  });
  const judges = narrowed.map((candidate) => candidate.teacherStyle || judgeTeacherStyle(candidate, context));
  const contrastSetApplied = narrowed.some((candidate) => !!contrastSetFor(candidate, context));
  return {
    selected: current,
    scoreTopId: scoreTop.id,
    changedFromScoreTop: current.id !== scoreTop.id,
    comparisons,
    reasonCounts: countReasons(comparisons, 'reasons'),
    blockedReasonCounts: countReasons(comparisons, 'blockedReasons'),
    contrastSetApplied,
    rhythmSignatures: unique(narrowed.map((candidate, index) => candidate.rhythmSignature || judges[index]?.rhythm?.signature || '')),
    selectedRhythm: current.rhythmSignature || (current.teacherStyle || judgeTeacherStyle(current, context)).rhythm?.signature || '',
    selectedTeacherStyle: {
      score: current.teacherStyle?.score || 0,
      reasons: current.teacherStyle?.reasons || [],
      blockedReasons: current.teacherStyle?.blockedReasons || [],
    },
    metadataOnly: true,
  };
}

export default contrastiveRankCandidates;
