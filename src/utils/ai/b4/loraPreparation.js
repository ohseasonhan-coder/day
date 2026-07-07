const clean = (value, max = 80) => String(value || '').trim().replace(/\s{2,}/g, ' ').slice(0, max);
const unique = (values) => [...new Set((values || []).filter(Boolean))];

export const B4_LLM_ROLE_BOUNDARY = {
  b4Owns: [
    'factCard',
    'directSpeechPreservation',
    'eventOrder',
    'allowedThemes',
    'allowedClaims',
    'blockedClaims',
    'actualTeacherSupport',
    'sparseConservativeFallback',
    'audit',
    'fallback',
  ],
  llmMayOnlyRender: [
    'learningReadingSurfaceText',
    'supportAndNextPlanSurfaceText',
    'longRecordSentenceFlow',
    'repetitionSoftening',
  ],
  llmForbidden: [
    'newObservation',
    'newAction',
    'newEmotion',
    'newIntention',
    'newPeerReaction',
    'newTeacherSupport',
    'claimOutsideB4Evidence',
  ],
};

export const B4_LORA_DATASET_SCHEMA = {
  factCardShape: 'non-identifying fact and signal ids only',
  sentencePlan: 'B4 selected plan and pattern metadata',
  llmCandidateMetadata: 'engine, allowed ids, validation and fallback codes only',
  teacherSelection: 'selection and edit tags only',
  approvedConstructionId: 'administrator-authored generalized skeleton id',
  excluded: [
    'childName',
    'sourceRecordText',
    'directSpeechFullText',
    'generatedFullText',
    'teacherEditedFullText',
    'teacherMemo',
    'dateClassInstitutionIdentity',
  ],
};

export function buildB4LoraMetadata({ trace = {}, feedback = {}, llmCandidate = {}, approvedConstructionId = '' } = {}) {
  return {
    factCardShape: {
      factsShape: trace.eventGraph?.factsShape || [],
      themeIds: trace.themeIds || trace.eventGraph?.themeIds || [],
      flags: trace.eventGraph?.flags || {},
    },
    sentencePlan: {
      planId: clean(trace.candidateDiscoursePlan?.id || trace.discoursePlan?.id, 80),
      focusType: clean(trace.candidateDiscoursePlan?.focusType, 60),
      primaryTheme: clean(trace.primaryTheme, 40),
      secondaryTheme: clean(trace.secondaryTheme, 40),
      discourseRelation: clean(trace.relation || trace.discourseRelation, 60),
      learningPatternId: clean(trace.learningPatternId, 100),
      supportPatternId: clean(trace.supportPatternId, 100),
      selectedMeaningUnitIds: {
        learning: unique(trace.selectedMeaningUnitIds?.learning || []),
        support: unique(trace.selectedMeaningUnitIds?.support || []),
      },
    },
    llmCandidateMetadata: {
      engine: clean(llmCandidate.engine, 40),
      learningTheme: clean(llmCandidate.learningTheme, 40),
      supportAction: clean(llmCandidate.supportAction, 80),
      auditPassed: !!llmCandidate.auditPassed,
      validationFailed: !!llmCandidate.validationFailed,
      fallbackReason: clean(llmCandidate.fallbackReason, 80),
      retryCount: Math.max(0, Math.min(1, Number(llmCandidate.retryCount) || 0)),
    },
    teacherSelection: {
      selected: !!feedback.selected,
      selections: unique(feedback.selections || []).slice(0, 10),
      editTags: unique(feedback.editTags || []).slice(0, 10),
      auditPassed: feedback.auditPassed !== false,
    },
    approvedConstructionId: clean(approvedConstructionId, 100),
    metadataOnly: true,
  };
}

export function evaluateB4LoraStartReadiness(metrics = {}) {
  const gates = {
    enoughDeidentifiedReviews: (Number(metrics.deidentifiedReviewCount) || 0) >= 500,
    factMismatchLow: (Number(metrics.factMismatchRate) || 0) <= 1,
    editTypesTraceable: (Number(metrics.repeatedEditTypeCount) || 0) >= 3,
    roleSeparationVerified: metrics.roleSeparationVerified === true,
    llmPreferenceLiftClear: (Number(metrics.llmPreferenceLift) || 0) >= 5,
    gpuAndModelValidated: metrics.gpuAndModelValidated === true,
  };
  return {
    ok: Object.values(gates).every(Boolean),
    gates,
    recommendation: Object.values(gates).every(Boolean) ? 'ready_for_private_lora_experiment' : 'collect_more_review_data',
    metadataOnly: true,
  };
}

export default buildB4LoraMetadata;
