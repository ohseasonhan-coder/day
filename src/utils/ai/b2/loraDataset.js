import { parseTargetSections } from '../targetQuality';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set((values || []).map(clean).filter(Boolean))];

export function anonymizeTeacherText(value, { childName = '', speeches = [] } = {}) {
  let text = String(value || '');
  if (childName) {
    const escaped = childName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'g'), '<CHILD>');
  }
  speeches.forEach((speech) => {
    if (!speech) return;
    const escaped = speech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'g'), '<SPEECH>');
  });
  text = text.replace(/["“][^"”]+["”]/g, '"<SPEECH>"');
  return clean(text);
}

export function createAnonymizedLoraCandidate({
  factCard = {}, plan = {}, b2Result = {}, llmResult = {}, finalResult = {}, reasonTags = [], childName = '',
} = {}) {
  const speeches = (factCard.speech || []).map((item) => item?.text || item).filter(Boolean);
  const safeText = (value) => anonymizeTeacherText(value, { childName: childName || factCard.name, speeches });
  const safeOutput = (value) => {
    const sections = parseTargetSections(value || '');
    return {
      learning: safeText(sections.learning),
      support: safeText(sections.support),
    };
  };
  return {
    schemaVersion: 1,
    factCard: {
      factTypes: unique((factCard.facts || []).map((fact) => fact.type)),
      factIds: unique((factCard.facts || []).map((fact) => fact.id)),
      speechCount: speeches.length,
      flags: {
        sparse: !!factCard.flags?.sparse,
        hasPeer: !!factCard.flags?.hasPeer,
        hasTeacherSupport: !!factCard.flags?.hasTeacherSupport,
        hasEmotion: !!factCard.flags?.hasEmotion,
      },
    },
    sentencePlan: {
      themeIds: unique(plan.meta?.themeIds),
      allowedClaims: unique(plan.learningPlan?.allowedClaims),
      blockedClaims: unique(plan.learningPlan?.blockedClaims),
      supportActionIds: unique(plan.supportPlan?.nextSupportActions),
    },
    outputs: {
      b2: safeOutput(b2Result.copyReady),
      llm: safeOutput(llmResult.copyReady),
      teacherFinal: safeOutput(finalResult.copyReady || finalResult.text),
    },
    decision: {
      selectedEngine: ['rule-b2', 'local-7b', 'private-server-7b', 'private-server-14b'].includes(finalResult.engine) ? finalResult.engine : 'rule-b2',
      editedSections: unique(finalResult.editedSections).filter((section) => ['learning', 'support'].includes(section)),
      reasonTags: unique(reasonTags).slice(0, 12),
      auditPassed: !!llmResult.auditPassed,
    },
  };
}

export function evaluateLoraReadiness(metrics = {}) {
  const checks = {
    enoughAnonymizedCases: Number(metrics.anonymizedCases || 0) >= 500,
    lowFactMismatch: Number(metrics.factMismatchRate || 100) <= 1,
    repeatedEditPatternsKnown: Number(metrics.repeatedEditPatternCount || 0) >= 3,
    rolesClearlySeparated: !!metrics.rolesClearlySeparated,
    llmMeaningfullyPreferred: Number(metrics.llmPreferenceRate || 0) >= Number(metrics.b2PreferenceRate || 0) + 5,
    privacyAuditPassed: !!metrics.privacyAuditPassed,
  };
  return { ready: Object.values(checks).every(Boolean), checks, failed: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key) };
}

export default createAnonymizedLoraCandidate;
