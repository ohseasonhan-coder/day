import { overlapRate } from './sentenceLinter';
import { sectionMeaningOverlapSummary } from './semanticCompressor';

const unique = (values) => [...new Set(values.filter(Boolean))];

function avg(values = []) {
  const rows = values.filter((value) => Number.isFinite(value));
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function planId(outcome = {}) {
  return outcome.plan?.id || outcome.plan?.focusType || 'single_plan';
}

function evidenceCoverage(outcome = {}) {
  const choices = outcome.selectedChoices || [];
  return choices.length
    ? choices.filter((choice) => (choice.evidenceIds || []).length && (choice.meaningUnitIds || []).length).length / choices.length * 100
    : 0;
}

function safetyScore(outcome = {}) {
  const choices = outcome.selectedChoices || [];
  if (!choices.length) return 0;
  return Math.min(...choices.map((choice) => choice.safetyScore || 0));
}

function sectionSeparation(outcome = {}) {
  const sections = outcome.sections || {};
  const stringOverlap = Math.max(
    overlapRate(sections.learning, sections.observation),
    overlapRate(sections.support, sections.learning),
  );
  const meaningOverlap = sectionMeaningOverlapSummary(outcome.selectedBySection || {});
  return Math.max(0, 100 - Math.round(stringOverlap * 70) - (meaningOverlap.anyOverlap ? 18 : 0));
}

function genericPenalty(outcome = {}) {
  return (outcome.selectedChoices || []).reduce((sum, choice) => {
    const issues = choice.surfaceLint?.issues || [];
    return sum + issues.filter((issue) => issue.code === 'generic_support' || issue.type === 'generic').length * 12;
  }, 0);
}

function rhythmPenalty(outcome = {}) {
  return (outcome.selectedChoices || []).reduce((sum, choice) => sum + (choice.rhythmPenalty || 0), 0);
}

function supportScore(outcome = {}) {
  return outcome.selectedBySection?.support?.supportQuality?.score || 0;
}

function styleScore(outcome = {}) {
  return avg((outcome.selectedChoices || []).map((choice) => choice.teacherStyleScore || choice.teacherStyle?.score || 0));
}

function localPreference(outcome = {}) {
  return (outcome.selectedChoices || []).reduce((sum, choice) => sum + (choice.localPreferenceWeight || 0), 0);
}

function focusClarity(outcome = {}) {
  const plan = outcome.plan || {};
  let score = plan.planPriorityScore || 60;
  if (plan.focusEventId) score += 8;
  if ((plan.evidenceIds || []).length) score += 8;
  if (plan.focusType === 'short_objective') score -= 5;
  if ((plan.learningMeaningUnitIds || []).length > 2) score -= 6;
  return Math.max(0, Math.min(100, score));
}

function auditScore(outcome = {}) {
  if (!outcome.audit) return 0;
  return outcome.audit.severity === 'major' ? 0 : 100;
}

export function scorePlanOutcome(outcome = {}) {
  const metrics = {
    safetyScore: safetyScore(outcome),
    evidenceCoverage: evidenceCoverage(outcome),
    auditScore: auditScore(outcome),
    focusClarity: focusClarity(outcome),
    sectionSeparation: sectionSeparation(outcome),
    genericAvoidance: Math.max(0, 100 - genericPenalty(outcome)),
    teacherStyle: styleScore(outcome),
    rhythmFit: Math.max(0, 100 - rhythmPenalty(outcome)),
    speechPlacement: outcome.plan?.semanticFootprint?.speech ? 86 : 76,
    supportPracticality: supportScore(outcome),
    localPreference: localPreference(outcome),
  };
  const total = Math.round(
    metrics.safetyScore * 0.22
    + metrics.evidenceCoverage * 0.16
    + metrics.auditScore * 0.14
    + metrics.focusClarity * 0.12
    + metrics.sectionSeparation * 0.10
    + metrics.genericAvoidance * 0.07
    + metrics.teacherStyle * 0.06
    + metrics.rhythmFit * 0.04
    + metrics.speechPlacement * 0.03
    + metrics.supportPracticality * 0.04
    + Math.max(-20, Math.min(20, metrics.localPreference)) * 0.02
  );
  return { metrics, total };
}

function compareReasons(winner = {}, loser = {}) {
  const w = scorePlanOutcome(winner).metrics;
  const l = scorePlanOutcome(loser).metrics;
  const reasons = [];
  const rejected = [];
  if (w.focusClarity > l.focusClarity + 3) reasons.push('clearer_focus_event');
  if (w.sectionSeparation > l.sectionSeparation + 3) reasons.push('less_section_overlap');
  if (w.supportPracticality > l.supportPracticality + 3) reasons.push('more_specific_support');
  if (w.genericAvoidance > l.genericAvoidance + 3) reasons.push('less_generic');
  if (w.rhythmFit > l.rhythmFit + 3) reasons.push('better_sentence_breath');
  if (w.evidenceCoverage > l.evidenceCoverage + 1) reasons.push('stronger_evidence_coverage');
  if (l.sectionSeparation < 70) rejected.push('observation_learning_overlap');
  if (l.genericAvoidance < 80) rejected.push('generic_expression');
  if (l.focusClarity < 70) rejected.push('weak_focus_event');
  if (!reasons.length) reasons.push('higher_plan_score');
  return { reasons: unique(reasons), rejectedReasons: unique(rejected) };
}

export function planContrastiveRanker(outcomes = [], context = {}) {
  const valid = outcomes.filter((outcome) => outcome?.valid && outcome.audit?.severity !== 'major');
  if (!valid.length) {
    return {
      selected: null,
      winnerPlanId: '',
      rejectedPlanIds: outcomes.map(planId),
      reasons: [],
      rejectedReasons: {},
      comparisons: [],
      metadataOnly: true,
    };
  }
  const scored = valid.map((outcome) => ({ outcome, ...scorePlanOutcome(outcome) }))
    .sort((a, b) => b.metrics.safetyScore - a.metrics.safetyScore
      || b.metrics.evidenceCoverage - a.metrics.evidenceCoverage
      || b.metrics.auditScore - a.metrics.auditScore
      || b.total - a.total
      || planId(a.outcome).localeCompare(planId(b.outcome)));
  let current = scored[0].outcome;
  const comparisons = [];
  scored.slice(1).forEach((row) => {
    const leftScore = scorePlanOutcome(current);
    const rightScore = scorePlanOutcome(row.outcome);
    const rightWins = rightScore.total > leftScore.total
      && rightScore.metrics.safetyScore >= leftScore.metrics.safetyScore
      && rightScore.metrics.evidenceCoverage >= leftScore.metrics.evidenceCoverage;
    const winner = rightWins ? row.outcome : current;
    const loser = rightWins ? current : row.outcome;
    const detail = compareReasons(winner, loser);
    comparisons.push({
      winnerPlanId: planId(winner),
      loserPlanId: planId(loser),
      reasons: detail.reasons,
      rejectedReasons: detail.rejectedReasons,
      scores: { winner: scorePlanOutcome(winner).total, loser: scorePlanOutcome(loser).total },
      metadataOnly: true,
    });
    if (rightWins) current = row.outcome;
  });
  const rejectedReasons = {};
  outcomes.filter((outcome) => planId(outcome) !== planId(current)).forEach((outcome) => {
    const detail = compareReasons(current, outcome);
    rejectedReasons[planId(outcome)] = detail.rejectedReasons.length ? detail.rejectedReasons : detail.reasons;
  });
  const first = comparisons.find((row) => row.winnerPlanId === planId(current));
  return {
    selected: current,
    winnerPlanId: planId(current),
    rejectedPlanIds: outcomes.map(planId).filter((id) => id !== planId(current)),
    reasons: first?.reasons || ['highest_ranked_safe_plan'],
    rejectedReasons,
    comparisons,
    selectedScore: scorePlanOutcome(current).total,
    baselineScore: context.baseline ? scorePlanOutcome(context.baseline).total : 0,
    metadataOnly: true,
  };
}

export default planContrastiveRanker;
