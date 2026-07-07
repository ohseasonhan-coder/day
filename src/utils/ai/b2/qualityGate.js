const rate = (value) => Math.max(0, Number(value) || 0);

export const LLM_PROMOTION_THRESHOLDS = {
  minimumReviewedSamples: 100,
  maximumFactMismatchRate: 1,
  maximumNameOrSpeechErrors: 0,
  maximumExposedMajorAuditErrors: 0,
  minimumUseAsIsLift: 5,
  maximumResponseP95Ms: 15000,
};

export function evaluateLLMPromotion(metrics = {}) {
  const checks = {
    enoughTeacherReviews: rate(metrics.reviewedSamples) >= LLM_PROMOTION_THRESHOLDS.minimumReviewedSamples,
    factsPreserved: rate(metrics.factMismatchRate) <= LLM_PROMOTION_THRESHOLDS.maximumFactMismatchRate,
    namesAndSpeechPreserved: rate(metrics.nameOrSpeechErrors) === 0,
    noMajorAuditExposure: rate(metrics.exposedMajorAuditErrors) === 0,
    useAsIsImproved: rate(metrics.llmUseAsIsRate) - rate(metrics.b2UseAsIsRate) >= LLM_PROMOTION_THRESHOLDS.minimumUseAsIsLift,
    naturalnessImproved: rate(metrics.llmNeedNaturalRate) < rate(metrics.b2NeedNaturalRate),
    hardCasesImproved: !!metrics.longNarrativeImproved && !!metrics.metaphorImproved && !!metrics.emotionChangeImproved,
    responseTimeAcceptable: rate(metrics.responseP95Ms) > 0 && rate(metrics.responseP95Ms) <= LLM_PROMOTION_THRESHOLDS.maximumResponseP95Ms,
    fallbackVerified: !!metrics.fallbackVerified,
  };
  return {
    eligible: Object.values(checks).every(Boolean),
    checks,
    failed: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
  };
}

export default evaluateLLMPromotion;
