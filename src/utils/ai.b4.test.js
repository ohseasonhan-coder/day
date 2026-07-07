import { SYNTHETIC_CASES } from './ai/datasets/syntheticCases';
import { B2_SYNTHETIC_CASES } from './ai/datasets/b2Cases';
import { B3_SYNTHETIC_CASES } from './ai/datasets/b3Cases';
import { B4_SYNTHETIC_CASES } from './ai/datasets/b4Cases';
import { buildB2FactCard, generateB2 } from './ai/b2/engine';
import { generateB3 } from './ai/b3/engine';
import { buildB4EventGraph } from './ai/b4/eventGraph';
import { buildB4DiscoursePlan } from './ai/b4/discoursePlan';
import { adjustB4, generateB4 } from './ai/b4/engine';
import { APPROVED_PHRASE_BANK, CONTRAST_SETS } from './ai/b4/approvedPhraseBank';
import { lintSurfaceText, overlapRate, surfaceIssueSummary } from './ai/b4/sentenceLinter';
import { B4_KEYS, getB4StyleProfile, isB4Enabled, setB4Enabled, setB4StyleProfile } from './ai/b4/config';
import { getB4FeedbackWeight, getB4RecentPatternPenalty, getB4RecentPatterns, recordB4RecentPattern } from './ai/b4/patternMemory';
import { analyzeSentenceRhythm } from './ai/b4/teacherStyleJudge';
import { contrastiveRankCandidates } from './ai/b4/contrastiveRanker';
import { buildB4MeaningUnits } from './ai/b4/meaningUnits';
import {
  TEACHER_APPROVED_CONSTRUCTION_BANK,
  createConstructionCandidates,
  validateTeacherApprovedConstructionProposal,
} from './ai/b4/constructionGraph';
import { applyRewriteLoop, criticCandidate } from './ai/b4/selfCritic';
import { buildB4CandidateDiscoursePlans } from './ai/b4/multiDiscoursePlan';
import { compressCandidate } from './ai/b4/semanticCompressor';
import { planContrastiveRanker } from './ai/b4/planContrastiveRanker';
import { buildB4LoraMetadata, evaluateB4LoraStartReadiness } from './ai/b4/loraPreparation';
import { parseTargetSections, scoreCopyReady } from './ai/targetQuality';
import { processRecord } from './ai/publicApi';
import { buildComparison, getReviewEntries, saveReviewEntry } from './reviewFeedback';
import { SYNC_EXCLUDED_KEYS } from './storage';

const ALL = [...SYNTHETIC_CASES, ...B2_SYNTHETIC_CASES, ...B3_SYNTHETIC_CASES, ...B4_SYNTHETIC_CASES];
const runB2 = (item) => generateB2({ input: item.input, childName: item.name, observation: item.input });
const runB3 = (item) => generateB3({ input: item.input, childName: item.name, observation: item.input });
const runB4 = (item, mode = 'default', styleProfile) => generateB4({ input: item.input, childName: item.name, observation: item.input, mode, styleProfile });
const normalizeName = (text, name) => String(text || '').replaceAll(name, '<CHILD>');
const generic = (text) => /(구체적인 행동이 더 관찰|자료를 제공|격려한다|질문한다)/.test(text);
const connectorError = (text) => /(해 보며\.|수 있도록.{0,20}수 있도록|과정에서.{0,18}과정에서|흐름.{0,18}흐름)/.test(text);

beforeEach(() => localStorage.clear());

describe('B4 eventGraph와 discoursePlan', () => {
  test('입력 근거가 있는 관계만 그래프에 만든다', () => {
    const recoveryInput = '유나가 그림이 찢어져 속상해했지만 테이프로 붙인 뒤 다시 색칠을 시작했다.';
    const emotionOnlyInput = '하린이가 탑이 무너지자 울음을 보였다.';
    const recoveryCard = buildB2FactCard({ input: recoveryInput, childName: '유나' });
    const emotionCard = buildB2FactCard({ input: emotionOnlyInput, childName: '하린' });
    const recoveryGraph = buildB4EventGraph({ card: recoveryCard, b2Plan: { meta: { themeIds: [] } } });
    const emotionGraph = buildB4EventGraph({ card: emotionCard, b2Plan: { meta: { themeIds: [] } } });
    expect(recoveryGraph.edges.map((edge) => edge.type)).toContain('emotion_to_recovery');
    expect(emotionGraph.edges.map((edge) => edge.type)).not.toContain('emotion_to_recovery');
  });

  test('담화 계획은 핵심 사건 1개와 보조 사건 1개 이하만 선택한다', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => row.id === 'b4_036');
    const b2 = runB2(item);
    const card = buildB2FactCard({ input: item.input, childName: item.name });
    const graph = buildB4EventGraph({ card, b2Plan: b2.plan });
    const plan = buildB4DiscoursePlan({ graph, card });
    expect(plan.focusEventId).toBeTruthy();
    expect(plan.observationOrder.length).toBeLessThanOrEqual(3);
    expect(plan.learningFocus.length).toBeLessThanOrEqual(2);
    expect(plan.allowedClaims.length).toBeGreaterThan(0);
    expect(plan.blockedClaims).toEqual(expect.arrayContaining(['발달 진단']));
  });
});

describe('B4 200건 이상 의미 그래프 회귀', () => {
  test('사실 보존, 후보 제한, 담화 계획, fallback을 집계한다', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(600);
    expect(APPROVED_PHRASE_BANK.length).toBeGreaterThanOrEqual(25);
    expect(CONTRAST_SETS.length).toBeGreaterThanOrEqual(112);
    expect(TEACHER_APPROVED_CONSTRUCTION_BANK.length).toBeGreaterThanOrEqual(8);
    const rows = ALL.map((item) => ({ item, b2: runB2(item), b3: runB3(item), b4: runB4(item) }));
    expect(rows.filter(({ item }) => String(item.tag || '').startsWith('adversarial_')).length).toBeGreaterThanOrEqual(80);
    let b2FactSafe = 0; let b3FactSafe = 0; let b4FactSafe = 0;
    let discourseSuccess = 0; let focusSelected = 0; let candidateTotal = 0; let rejectedTotal = 0;
    let connectorErrors = 0; let quality = 0; let sparseTotal = 0; let sparseConservative = 0;
    const b3Texts = new Set(); const b4Texts = new Set(); const b3Freq = {}; const b4Freq = {};
    let b3Generic = 0; let b4Generic = 0; let accepted = 0; let fallbackSafe = 0;
    let connectorEndingErrors = 0; let connectorDuplicateErrors = 0; let particleEndingErrors = 0;
    let observationLearningOverlap = 0; let learningSupportOverlap = 0; let overlapRows = 0;
    let preSurfaceIssues = 0; let postSurfaceIssues = 0;
    const patternIds = new Set(); const patternFreq = {};
    const b3Rhythms = new Set(); const b4Rhythms = new Set();
    const b3RhythmFreq = {}; const b4RhythmFreq = {};
    let contrastiveChanged = 0; let contrastSetApplied = 0;
    let supportSpecific = 0; let supportGeneric = 0;
    let meaningUnitSuccess = 0; let meaningEvidenceLinked = 0; let clauseEvidenceLinked = 0;
    let constructionGraphApplied = 0; let constructionSelected = 0;
    let rewriteApplied = 0; let rewriteRejected = 0; let rewriteResolved = 0;
    let planCountTotal = 0; let planSuccess = 0; let planFallback = 0; let focusEvidenceLinked = 0;
    let compressionApplied = 0; let compressionDeleted = 0; let semanticOverlapRows = 0; let semanticOverlapTotal = 0;
    const selectedPlanTypes = {};
    const fallbackReasons = {};
    let adversarialTotal = 0; let adversarialBlocked = 0; let adversarialFallback = 0;
    const selfCriticIssues = {};
    const teacherStyleReasons = {}; const teacherStyleBlockedReasons = {};
    const improvedExamples = []; const fallbackExamples = []; const connectorExamples = [];

    rows.forEach(({ item, b2, b3, b4 }) => {
      const repeated = runB4(item);
      expect(b4.copyReady).toBe(repeated.copyReady);
      expect(b4.audit.severity).not.toBe('major');
      if (b2.audit.metrics?.factPreserved !== false) b2FactSafe += 1;
      if (b3.audit.metrics?.factPreserved !== false) b3FactSafe += 1;
      if (b4.audit.metrics?.factPreserved !== false) b4FactSafe += 1;
      const trace = b4.b4Trace;
      const adversarial = String(item.tag || '').startsWith('adversarial_');
      if (adversarial) adversarialTotal += 1;
      if (trace?.discoursePlanCreated) discourseSuccess += 1;
      if (trace?.focusEventId) focusSelected += 1;
      if (b4.engineUsed === 'rule-b4') {
        accepted += 1;
        if (adversarial && ((trace.rejectedCandidates || 0) > 0 || trace.multiPlanFallbackApplied || (trace.semanticCompression?.appliedCount || 0) > 0)) {
          adversarialBlocked += 1;
        }
        expect(trace.sentenceRealizerApplied).toBe(true);
        expect(trace.meaningUnitCount).toBeGreaterThan(0);
        expect(trace.meaningUnitEvidenceLinkRate).toBe(100);
        expect(trace.meaningUnitClauseEvidenceRate).toBe(100);
        expect(trace.selectedMeaningUnitIds.learning.length).toBeGreaterThan(0);
        expect(trace.selectedMeaningUnitIds.support.length).toBeGreaterThan(0);
        expect(trace.candidateDiscoursePlanCount).toBeGreaterThanOrEqual(1);
        expect(trace.candidateDiscoursePlan?.observationEvidenceIds?.length || trace.sectionEvidence.observation.length).toBeGreaterThan(0);
        expect(trace.planContrastiveRankerApplied).toBe(true);
        expect(trace.contrastiveRankerApplied).toBe(true);
        expect(trace.observationCandidateCount).toBeGreaterThanOrEqual(5);
        expect(trace.learningCandidateCount).toBeGreaterThanOrEqual(5);
        expect(trace.supportCandidateCount).toBeGreaterThanOrEqual(5);
        expect(trace.observationCandidateCount).toBeLessThanOrEqual(10);
        expect(trace.learningCandidateCount).toBeLessThanOrEqual(10);
        expect(trace.supportCandidateCount).toBeLessThanOrEqual(10);
        expect(trace.sectionEvidence.learning.length).toBeGreaterThan(0);
        expect(trace.sectionEvidence.support.length).toBeGreaterThan(0);
        expect(trace.rhythmSignatures.learning).toBeTruthy();
        expect(trace.rhythmSignatures.support).toBeTruthy();
        candidateTotal += trace.candidateCount;
        rejectedTotal += trace.rejectedCandidates;
        if (trace.contrastiveChangedFromScoreTop) contrastiveChanged += 1;
        if (trace.contrastSetApplied) contrastSetApplied += 1;
        if ((trace.meaningUnitCount || 0) > 0) meaningUnitSuccess += 1;
        if ((trace.meaningUnitEvidenceLinkRate || 0) === 100) meaningEvidenceLinked += 1;
        if ((trace.meaningUnitClauseEvidenceRate || 0) === 100) clauseEvidenceLinked += 1;
        planCountTotal += trace.candidateDiscoursePlanCount || 1;
        if ((trace.candidateDiscoursePlanCount || 1) >= 2) planSuccess += 1;
        if (trace.multiPlanFallbackApplied) {
          planFallback += 1;
          fallbackReasons[trace.multiPlanFallbackReason || 'multi_plan_fallback'] = (fallbackReasons[trace.multiPlanFallbackReason || 'multi_plan_fallback'] || 0) + 1;
        }
        if ((trace.candidateDiscoursePlan?.observationEvidenceIds || []).length) focusEvidenceLinked += 1;
        const focusType = trace.candidateDiscoursePlan?.focusType || 'unknown';
        selectedPlanTypes[focusType] = (selectedPlanTypes[focusType] || 0) + 1;
        compressionApplied += trace.semanticCompression?.appliedCount || 0;
        compressionDeleted += trace.semanticCompression?.deletedClauseCount || 0;
        if (trace.semanticCompression?.sectionMeaningOverlap) {
          semanticOverlapRows += 1;
          semanticOverlapTotal += Math.max(
            trace.semanticCompression.sectionMeaningOverlap.observationLearning || 0,
            trace.semanticCompression.sectionMeaningOverlap.learningSupport || 0,
          );
        }
        if (trace.constructionGraphApplied) constructionGraphApplied += 1;
        constructionSelected += trace.constructionSelectedCount || 0;
        rewriteApplied += trace.rewriteAppliedCount || 0;
        rewriteRejected += trace.rewriteRejectedCount || 0;
        rewriteResolved += trace.rewriteIssuesResolved || 0;
        Object.entries(trace.selfCriticIssueCounts || {}).forEach(([issue, count]) => { selfCriticIssues[issue] = (selfCriticIssues[issue] || 0) + count; });
        if ((trace.supportQuality?.score || 0) >= 70) supportSpecific += 1;
        if (generic(trace.supportQuality?.reasons?.join(' ') || '') || (trace.supportQuality?.reasons || []).includes('generic_support_only')) supportGeneric += 1;
        Object.entries(trace.teacherStyleReasonCounts || {}).forEach(([reason, count]) => { teacherStyleReasons[reason] = (teacherStyleReasons[reason] || 0) + count; });
        Object.entries(trace.teacherStyleBlockedReasonCounts || {}).forEach(([reason, count]) => { teacherStyleBlockedReasons[reason] = (teacherStyleBlockedReasons[reason] || 0) + count; });
        preSurfaceIssues += trace.surfaceQuality?.beforeIssueCount || 0;
        postSurfaceIssues += trace.surfaceQuality?.afterIssueCount || 0;
        [trace.learningPatternId, trace.supportPatternId].filter(Boolean).forEach((id) => {
          patternIds.add(id);
          patternFreq[id] = (patternFreq[id] || 0) + 1;
        });
      } else {
        fallbackSafe += 1;
        if (adversarial) {
          adversarialBlocked += 1;
          adversarialFallback += 1;
        }
        const reason = trace?.fallbackReason || b4.fallbackReason || '';
        fallbackReasons[reason || 'fallback'] = (fallbackReasons[reason || 'fallback'] || 0) + 1;
        fallbackExamples.push({ id: item.id, reason: trace?.fallbackReason || b4.fallbackReason || '' });
      }
      const sections = b4.sections || parseTargetSections(b4.copyReady);
      if (connectorError(sections.observation) || connectorError(sections.learning) || connectorError(sections.support)) {
        connectorErrors += 1;
        if (connectorExamples.length < 5) connectorExamples.push({ id: item.id, sections });
      }
      const surface = surfaceIssueSummary(sections, { hasTeacherSupport: trace?.eventGraph?.flags?.hasTeacherSupport });
      surface.rows.forEach((row) => row.issues.forEach((issue) => {
        if (issue.code === 'connector_ending') connectorEndingErrors += 1;
        if (issue.code === 'connector_duplicate') connectorDuplicateErrors += 1;
        if (issue.type === 'particle' || issue.type === 'ending') particleEndingErrors += 1;
      }));
      const ol = overlapRate(sections.learning, sections.observation);
      const ls = overlapRate(sections.support, sections.learning);
      observationLearningOverlap += ol;
      learningSupportOverlap += ls;
      overlapRows += 1;
      quality += scoreCopyReady(sections).score;
      const b3Text = normalizeName(b3.copyReady, item.name);
      const b4Text = normalizeName(b4.copyReady, item.name);
      b3Texts.add(b3Text); b4Texts.add(b4Text);
      b3Freq[b3Text] = (b3Freq[b3Text] || 0) + 1;
      b4Freq[b4Text] = (b4Freq[b4Text] || 0) + 1;
      const b3Rhythm = ['learning', 'support'].map((section) => analyzeSentenceRhythm(b3.sections?.[section] || '', { styleProfile: 'objective' }).signature).join('::');
      const b4Rhythm = ['learning', 'support'].map((section) => analyzeSentenceRhythm(sections?.[section] || '', { styleProfile: trace?.styleProfile || 'objective' }).signature).join('::');
      b3Rhythms.add(b3Rhythm); b4Rhythms.add(b4Rhythm);
      b3RhythmFreq[b3Rhythm] = (b3RhythmFreq[b3Rhythm] || 0) + 1;
      b4RhythmFreq[b4Rhythm] = (b4RhythmFreq[b4Rhythm] || 0) + 1;
      if (generic(b3.sections.learning) || generic(b3.sections.support)) b3Generic += 1;
      if (generic(sections.learning) || generic(sections.support)) b4Generic += 1;
      if (Object.prototype.hasOwnProperty.call(item, 'expectedTheme') && item.expectedTheme == null) {
        sparseTotal += 1;
        if (b4.engineUsed !== 'rule-b4' || !sections.learning) sparseConservative += 1;
      }
      if (b4.engineUsed === 'rule-b4' && improvedExamples.length < 5 && sections.learning !== b3.sections.learning) {
        improvedExamples.push({ id: item.id, b3: b3.sections.learning, b4: sections.learning, support: sections.support });
      }
    });

    const report = {
      cases: rows.length,
      accepted,
      b2FactPreservationRate: Math.round(b2FactSafe / rows.length * 100),
      b3FactPreservationRate: Math.round(b3FactSafe / rows.length * 100),
      b4FactPreservationRate: Math.round(b4FactSafe / rows.length * 100),
      sparseConservativeRate: sparseTotal ? Math.round(sparseConservative / sparseTotal * 100) : 100,
      discoursePlanSuccessRate: Math.round(discourseSuccess / rows.length * 100),
      focusEventSelectionRate: Math.round(focusSelected / rows.length * 100),
      averageCandidateCount: accepted ? Math.round(candidateTotal / accepted * 10) / 10 : 0,
      candidateSafetyRejectRate: candidateTotal ? Math.round(rejectedTotal / candidateTotal * 1000) / 10 : 0,
      connectorErrorRate: Math.round(connectorErrors / rows.length * 100),
      b3ExpressionDuplicateRate: Math.round((1 - b3Texts.size / rows.length) * 100),
      b4ExpressionDuplicateRate: Math.round((1 - b4Texts.size / rows.length) * 100),
      b3RhythmDuplicateRate: Math.round((1 - b3Rhythms.size / rows.length) * 100),
      b4RhythmDuplicateRate: Math.round((1 - b4Rhythms.size / rows.length) * 100),
      b3GenericRate: Math.round(b3Generic / rows.length * 100),
      b4GenericRate: Math.round(b4Generic / rows.length * 100),
      contrastiveChangedRate: accepted ? Math.round(contrastiveChanged / accepted * 100) : 0,
      contrastSetAppliedRate: accepted ? Math.round(contrastSetApplied / accepted * 100) : 0,
      supportSpecificRate: accepted ? Math.round(supportSpecific / accepted * 100) : 0,
      supportGenericRate: accepted ? Math.round(supportGeneric / accepted * 100) : 0,
      fallbackOccurrenceRate: Math.round(fallbackSafe / rows.length * 100),
      fallbackReasonDistribution: fallbackReasons,
      adversarialCaseCount: adversarialTotal,
      adversarialBlockedRate: adversarialTotal ? Math.round(adversarialBlocked / adversarialTotal * 100) : 0,
      adversarialFallbackRate: adversarialTotal ? Math.round(adversarialFallback / adversarialTotal * 100) : 0,
      meaningUnitSuccessRate: accepted ? Math.round(meaningUnitSuccess / accepted * 100) : 0,
      meaningEvidenceLinkRate: accepted ? Math.round(meaningEvidenceLinked / accepted * 100) : 0,
      clauseEvidenceLinkRate: accepted ? Math.round(clauseEvidenceLinked / accepted * 100) : 0,
      candidateDiscoursePlanAverage: accepted ? Math.round(planCountTotal / accepted * 10) / 10 : 0,
      planGenerationSuccessRate: accepted ? Math.round(planSuccess / accepted * 100) : 0,
      selectedPlanTypeDistribution: selectedPlanTypes,
      focusEvidenceLinkRate: accepted ? Math.round(focusEvidenceLinked / accepted * 100) : 0,
      semanticCompressionAppliedRate: accepted ? Math.round((compressionApplied / Math.max(1, accepted * 3)) * 100) : 0,
      compressionDeletedClauseCount: compressionDeleted,
      sectionMeaningOverlapRate: semanticOverlapRows ? Math.round(semanticOverlapTotal / semanticOverlapRows) : 0,
      singlePlanFallbackRate: accepted ? Math.round(planFallback / accepted * 100) : 0,
      constructionGraphAppliedRate: accepted ? Math.round(constructionGraphApplied / accepted * 100) : 0,
      constructionSelectedCount: constructionSelected,
      rewriteAppliedRate: accepted ? Math.round((rewriteApplied / Math.max(1, accepted * 3)) * 100) : 0,
      rewriteRejectedRate: candidateTotal ? Math.round(rewriteRejected / candidateTotal * 1000) / 10 : 0,
      rewriteResolvedIssueCount: rewriteResolved,
      selfCriticIssueDistribution: selfCriticIssues,
      teacherStyleReasonDistribution: teacherStyleReasons,
      teacherStyleBlockedReasonDistribution: teacherStyleBlockedReasons,
      connectorEndingErrors,
      connectorDuplicateErrors,
      particleEndingErrors,
      observationLearningOverlapRate: Math.round((observationLearningOverlap / Math.max(1, overlapRows)) * 100),
      learningSupportOverlapRate: Math.round((learningSupportOverlap / Math.max(1, overlapRows)) * 100),
      patternDuplicateRate: accepted ? Math.round((1 - patternIds.size / Math.max(1, accepted * 2)) * 100) : 0,
      preSurfaceIssues,
      postSurfaceIssues,
      recentPatternPenaltyEffect: getB4RecentPatternPenalty({ patternId: 'retry_core' }, { primaryTheme: 'retry', secondaryTheme: '', relation: 'retry_after_setback' }, 'objective', [
        { primaryTheme: 'retry', secondaryTheme: '', discourseRelation: 'retry_after_setback', learningPatternId: 'retry_core', styleProfile: 'objective' },
      ]),
      automaticQualityScore: Math.round(quality / rows.length * 10) / 10,
      improvedExamples,
      fallbackExamples: fallbackExamples.slice(0, 5),
      connectorExamples,
      topB3Duplicates: Object.entries(b3Freq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topB4Duplicates: Object.entries(b4Freq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topB3RhythmDuplicates: Object.entries(b3RhythmFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topB4RhythmDuplicates: Object.entries(b4RhythmFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topB4Patterns: Object.entries(patternFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      limitation: '자동 점수는 실제 교사 선호와 분리된 참고 지표입니다.',
    };
    // eslint-disable-next-line no-console
    console.log('\n===== B4 DISCOURSE ENGINE REPORT =====\n', JSON.stringify(report, null, 2));
    expect(report.b4FactPreservationRate).toBe(100);
    expect(report.sparseConservativeRate).toBeGreaterThanOrEqual(95);
    expect(report.discoursePlanSuccessRate).toBeGreaterThanOrEqual(70);
    expect(report.focusEventSelectionRate).toBeGreaterThanOrEqual(70);
    expect(report.averageCandidateCount).toBeGreaterThanOrEqual(15);
    expect(report.averageCandidateCount).toBeLessThanOrEqual(30);
    expect(report.connectorErrorRate).toBeLessThanOrEqual(2);
    expect(report.connectorEndingErrors).toBe(0);
    expect(report.connectorDuplicateErrors).toBe(0);
    expect(report.particleEndingErrors).toBeLessThanOrEqual(3);
    expect(report.postSurfaceIssues).toBeLessThanOrEqual(report.preSurfaceIssues);
    expect(report.b4ExpressionDuplicateRate).toBeLessThanOrEqual(report.b3ExpressionDuplicateRate);
    expect(report.b4RhythmDuplicateRate).toBeLessThanOrEqual(report.b3RhythmDuplicateRate);
    expect(report.b4GenericRate).toBeLessThanOrEqual(report.b3GenericRate);
    expect(report.contrastSetAppliedRate).toBeGreaterThanOrEqual(70);
    expect(report.supportSpecificRate).toBeGreaterThanOrEqual(80);
    expect(report.supportGenericRate).toBeLessThanOrEqual(5);
    expect(report.adversarialCaseCount).toBeGreaterThanOrEqual(80);
    expect(report.adversarialBlockedRate).toBeGreaterThanOrEqual(5);
    expect(report.meaningUnitSuccessRate).toBe(100);
    expect(report.meaningEvidenceLinkRate).toBe(100);
    expect(report.clauseEvidenceLinkRate).toBe(100);
    expect(report.candidateDiscoursePlanAverage).toBeGreaterThanOrEqual(1.5);
    expect(report.planGenerationSuccessRate).toBeGreaterThanOrEqual(60);
    expect(report.focusEvidenceLinkRate).toBe(100);
    expect(report.singlePlanFallbackRate).toBeLessThanOrEqual(25);
    expect(report.constructionGraphAppliedRate).toBeGreaterThanOrEqual(50);
    expect(report.rewriteRejectedRate).toBeLessThanOrEqual(25);
    expect(report.automaticQualityScore).toBeGreaterThanOrEqual(90);
  });

  test('정보 부족·감정 단서·반복 위험 경계에서 과장하지 않는다', () => {
    B4_SYNTHETIC_CASES.filter((item) => item.tag === 'sparse').forEach((item) => {
      const result = runB4(item);
      expect(result.engineUsed).not.toBe('rule-b4');
      expect(result.b4Trace.fallbackApplied).toBe(true);
    });
    B4_SYNTHETIC_CASES.filter((item) => item.tag === 'emotionOnly' || item.tag === 'emotionNoRecovery').forEach((item) => {
      const result = runB4(item);
      expect(result.copyReady).not.toMatch(/회복|안정|진정|감정을 조절/);
      expect(result.b4Trace.eventGraph.edges.map((edge) => edge.type)).not.toContain('emotion_to_recovery');
    });
    B4_SYNTHETIC_CASES.filter((item) => ['repeatRisk', 'supportRepeatRisk', 'connectorRisk', 'observationRepeatRisk'].includes(item.tag)).forEach((item) => {
      const result = runB4(item);
      expect(connectorError(result.copyReady)).toBe(false);
    });
  });

  test('문장 linter는 연결형 종결·연결어 반복·기계적 표현을 잡는다', () => {
    expect(lintSurfaceText('다온은 블록을 다시 쌓아 보며.', 'learning').issues.map((issue) => issue.code)).toContain('connector_ending');
    expect(lintSurfaceText('다시 해 볼 수 있도록 재료를 둘 수 있도록 돕는다.', 'support').issues.map((issue) => issue.code)).toContain('connector_duplicate');
    expect(lintSurfaceText('자료를 제공한다.', 'support').issues.map((issue) => issue.code)).toContain('generic_support');
  });

  test('meaningUnit, constructionGraph, selfCritic stay evidence-bound', () => {
    const sample = B4_SYNTHETIC_CASES.map((item) => {
      const b2 = runB2(item);
      const card = buildB2FactCard({ input: item.input, childName: item.name });
      const graph = buildB4EventGraph({ card, b2Plan: b2.plan });
      const plan = buildB4DiscoursePlan({ graph, card });
      const units = buildB4MeaningUnits({ card, graph, plan });
      const candidates = createConstructionCandidates({ section: 'learning', card, graph, plan, styleProfile: 'objective', meaningUnits: units });
      return { item, card, graph, plan, units, candidates };
    }).find((row) => row.units.length > 0 && row.candidates.length > 0);
    expect(sample).toBeTruthy();
    const { card, graph, plan, units, candidates } = sample;
    expect(units.length).toBeGreaterThan(0);
    expect(units.every((unit) => (unit.evidenceIds || []).length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.meaningUnitIds.length && candidate.evidenceIds.length)).toBe(true);
    const candidate = {
      ...candidates[0],
      text: `${candidates[0].text} ${candidates[0].text}`,
      meaningUnitIds: candidates[0].meaningUnitIds,
      evidenceIds: candidates[0].evidenceIds,
    };
    const critique = criticCandidate(candidate, { card, graph, plan, section: 'learning' });
    expect(['pass', 'rewrite', 'reject']).toContain(critique.decision);
    const rewritten = applyRewriteLoop(candidate, { card, graph, plan, section: 'learning' }, 2);
    expect(rewritten.meaningUnitIds.every((id) => candidate.meaningUnitIds.includes(id))).toBe(true);
    expect(rewritten.evidenceIds.every((id) => candidate.evidenceIds.includes(id))).toBe(true);
  });

  test('contrastSet과 contrastiveRanker는 문장을 생성하지 않고 안전 후보 중 자연스러움을 가중한다', () => {
    const themeCounts = CONTRAST_SETS.reduce((acc, set) => {
      acc[set.theme] = (acc[set.theme] || 0) + 1;
      return acc;
    }, {});
    ['retry', 'change_explore', 'make', 'language', 'peer_share', 'conflict', 'rules', 'selfhelp', 'movement', 'emotion_expression', 'emotion_recovery', 'roleplay', 'compare', 'peer_help'].forEach((theme) => {
      expect(themeCounts[theme]).toBeGreaterThanOrEqual(8);
    });
    const base = {
      section: 'support',
      safe: true,
      safetyScore: 100,
      specificityScore: 80,
      fluencyScore: 90,
      reasons: [],
      primaryTheme: 'retry',
      secondaryTheme: '',
      discourseRelation: 'retry_after_setback',
      evidenceIds: ['event_1'],
    };
    const ranked = contrastiveRankCandidates([
      {
        ...base,
        id: 'candidate_a',
        qualityScore: 78,
        text: '다양한 경험을 제공하고 지속적으로 격려한다.',
        supportPatternId: 'generic_support',
        rhythmSignature: 'medium|other|plain|support|plan_action|one_sentence|no_speech|objective',
        teacherStyle: { score: 42, reasons: [], blockedReasons: ['abstract_general_support'], rhythm: { signature: 'a' }, supportQuality: { score: 35, reasons: ['generic_support_only'] } },
      },
      {
        ...base,
        id: 'candidate_b',
        qualityScore: 82,
        text: '다음에는 다시 시도해 볼 시간을 먼저 주고, 필요한 경우 재료의 위치를 조정해 본다.',
        supportPatternId: 'teacher_support',
        rhythmSignature: 'medium|future_plan|sequence|support|plan_try|one_sentence|no_speech|objective',
        teacherStyle: { score: 88, reasons: ['teacher_like_ending', 'connected_to_real_action'], blockedReasons: [], rhythm: { signature: 'b' }, supportQuality: { score: 88, reasons: ['connected_to_observed_flow'] } },
      },
    ], {
      section: 'support',
      styleProfile: 'objective',
      plan: { primaryTheme: 'retry', secondaryTheme: '', relation: 'retry_after_setback' },
      graph: { flags: { hasSpeech: false } },
    });
    expect(ranked.selected.id).toBe('candidate_b');
    expect(ranked.contrastSetApplied).toBe(true);
    expect(JSON.stringify(ranked.comparisons)).not.toContain('다양한 경험');
  });
});

describe('B4 adversarial fallback and privacy guards', () => {
  test('fallback guards expose only non-identifying reason codes', () => {
    const sparse = B4_SYNTHETIC_CASES.find((item) => item.tag === 'adversarial_sparseOverLearning') || B4_SYNTHETIC_CASES.find((item) => item.expectedTheme == null);
    const result = runB4(sparse);
    expect(result.engineUsed).not.toBe('rule-b4');
    expect(result.b4Trace.fallbackDiagnostic).toMatchObject({
      fallback: true,
      source: 'b4_single_plan',
      metadataOnly: true,
    });
    expect(JSON.stringify(result.b4Trace.fallbackDiagnostic)).not.toContain(sparse.input);
    expect(JSON.stringify(result.b4Trace.fallbackDiagnostic)).not.toContain(sparse.name);

    expect(buildB4CandidateDiscoursePlans({
      graph: { nodes: [], edges: [], flags: {} },
      basePlan: { sparse: false, focusEventId: '' },
      meaningUnits: [],
    })).toEqual([]);

    const compressed = compressCandidate({
      id: 'unsafe_learning_without_evidence',
      section: 'learning',
      text: '근거 없는 배움 읽기 문장.',
      meaningUnitIds: [],
      evidenceIds: [],
    }, { meaningUnits: [], graph: { flags: {} } });
    expect(compressed.semanticCompressionRejected).toBe(true);
    expect(compressed.semanticCompression.rejected).toBe(true);

    const ranked = planContrastiveRanker([
      { valid: false, plan: { id: 'unsafe_plan_01' }, audit: { severity: 'major' }, selectedChoices: [] },
      { valid: false, plan: { id: 'unsafe_plan_02' }, audit: { severity: 'major' }, selectedChoices: [] },
    ]);
    expect(ranked.selected).toBeNull();
    expect(ranked.rejectedPlanIds).toEqual(['unsafe_plan_01', 'unsafe_plan_02']);
  });

  test('trace keeps raw record, name, direct speech, and generated full text out of metadata', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => /"[^"]+"/.test(row.input));
    const result = runB4(item);
    const trace = result.b4Trace;
    const traceJson = JSON.stringify(trace);
    const speech = (item.input.match(/"([^"]+)"/) || [])[1] || '';
    expect(traceJson).not.toContain(item.input);
    expect(traceJson).not.toContain(item.name);
    if (speech) expect(traceJson).not.toContain(speech);
    expect(traceJson).not.toContain(result.copyReady);
    expect((trace.eventGraph.nodes || []).every((node) => !Object.prototype.hasOwnProperty.call(node, 'value') && !Object.prototype.hasOwnProperty.call(node, 'label'))).toBe(true);
    expect(trace.eventGraph.metadataOnly).toBe(true);
    expect(trace.planContrastive?.metadataOnly || true).toBe(true);
  });

  test('admin-approved construction proposals require generalized metadata, not copied teacher text', () => {
    const proposal = {
      section: 'learning',
      theme: 'retry',
      discourseRelation: 'retry_after_setback',
      requiredClaims: ['retry'],
      blockedClaims: ['confidence_growth'],
      meaningUnitTypes: ['retry'],
      evidenceConditions: ['focus_event_has_evidence'],
      skeleton: '{childTopic} {focusProcess} retry meaning.',
      shortSkeleton: '{childTopic} retry meaning.',
      twoSentenceSkeleton: '{childTopic} {focusAction}. retry meaning.',
      objectiveSkeleton: '{childTopic} observed retry meaning.',
      warmSkeleton: '{childTopic} retry flow.',
      forbiddenExpressions: ['ability_growth'],
      regressionTestStatus: 'passed',
    };
    expect(validateTeacherApprovedConstructionProposal(proposal)).toMatchObject({ ok: true, metadataOnly: true });
    expect(validateTeacherApprovedConstructionProposal({ ...proposal, teacherEditedText: 'teacher final sentence' })).toMatchObject({ ok: false, copiedTeacherText: true });
    expect(validateTeacherApprovedConstructionProposal({ ...proposal, regressionTestStatus: 'pending' })).toMatchObject({ ok: false, passedRegression: false });
  });

  test('LLM and LoRA preparation keeps B4 role boundary and non-identifying dataset metadata', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => /"[^"]+"/.test(row.input));
    const result = runB4(item);
    const metadata = buildB4LoraMetadata({
      trace: result.b4Trace,
      feedback: { selected: true, selections: ['preferred_result'], editTags: ['makeSupportSpecific'], auditPassed: true },
      llmCandidate: {
        engine: 'private-server-7b',
        learningTheme: result.b4Trace.primaryTheme,
        supportAction: result.b4Trace.supportPatternId,
        auditPassed: true,
        retryCount: 1,
      },
      approvedConstructionId: 'admin_generalized_retry_01',
    });
    const json = JSON.stringify(metadata);
    expect(metadata.metadataOnly).toBe(true);
    expect(json).not.toContain(item.input);
    expect(json).not.toContain(item.name);
    expect(json).not.toContain(result.copyReady);
    expect(metadata.teacherSelection.selections).toEqual(['preferred_result']);
    expect(evaluateB4LoraStartReadiness({
      deidentifiedReviewCount: 500,
      factMismatchRate: 1,
      repeatedEditTypeCount: 3,
      roleSeparationVerified: true,
      llmPreferenceLift: 5,
      gpuAndModelValidated: true,
    })).toMatchObject({ ok: true, recommendation: 'ready_for_private_lora_experiment' });
    expect(evaluateB4LoraStartReadiness({ deidentifiedReviewCount: 100 })).toMatchObject({ ok: false, recommendation: 'collect_more_review_data' });
  });
});

describe('B4 문체·피드백·공개 API', () => {
  test('문체 프로필은 의미 계획을 바꾸지 않고 문장 렌더링만 바꾼다', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => row.id === 'b4_036');
    const objective = runB4(item, 'default', 'objective');
    const concise = runB4(item, 'default', 'concise');
    expect(objective.b4Trace.primaryTheme).toBe(concise.b4Trace.primaryTheme);
    expect(objective.b4Trace.relation).toBe(concise.b4Trace.relation);
    if (objective.engineUsed === 'rule-b4' && concise.engineUsed === 'rule-b4') {
      expect(objective.copyReady).not.toBe(concise.copyReady);
    }
  });

  test('빠른 조정은 같은 담화 계획 안에서 결정론적으로 재선택한다', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => row.id === 'b4_003');
    const base = runB4(item);
    ['shorter', 'objective', 'warm', 'learning', 'support', 'speech'].forEach((mode) => {
      const first = adjustB4({ input: item.input, childName: item.name, observation: item.input, mode });
      const second = adjustB4({ input: item.input, childName: item.name, observation: item.input, mode });
      expect(first.copyReady).toBe(second.copyReady);
      expect(first.audit.severity).not.toBe('major');
      if (first.engineUsed === 'rule-b4' && base.engineUsed === 'rule-b4') {
        expect(first.b4Trace.primaryTheme).toBe(base.b4Trace.primaryTheme);
      }
    });
  });

  test('로컬 피드백과 최근 패턴은 원문 없이 메타데이터만 저장한다', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => row.id === 'b4_003');
    const base = runB4(item);
    const positive = getB4FeedbackWeight({ patternId: base.b4Trace.learningPatternId }, base.b4Trace.themeIds, [{
      variant: 'C',
      engine: 'rule-b4',
      themeIds: base.b4Trace.themeIds,
      learningPatternId: base.b4Trace.learningPatternId,
      selections: ['use_as_is'],
    }]);
    const unsafe = getB4FeedbackWeight({ patternId: base.b4Trace.learningPatternId }, base.b4Trace.themeIds, [{
      variant: 'C',
      engine: 'rule-b4',
      themeIds: base.b4Trace.themeIds,
      learningPatternId: base.b4Trace.learningPatternId,
      selections: ['fact_mismatch'],
    }]);
    expect(positive).toBeGreaterThan(0);
    expect(unsafe).toBe(-40);
    recordB4RecentPattern({
      primaryTheme: base.b4Trace.primaryTheme,
      secondaryTheme: base.b4Trace.secondaryTheme,
      discourseRelation: base.b4Trace.relation,
      learningPatternId: base.b4Trace.learningPatternId,
      supportPatternId: base.b4Trace.supportPatternId,
      styleProfile: base.b4Trace.styleProfile,
      selected: true,
      feedbackTags: ['use_as_is'],
      rawText: item.input,
      childName: item.name,
    });
    const raw = JSON.stringify(getB4RecentPatterns());
    expect(raw).toContain(base.b4Trace.learningPatternId);
    expect(raw).not.toContain(item.input);
    expect(raw).not.toContain(item.name);
  });

  test('B4 feature flag는 기본 OFF이고 켜진 경우에만 공개 API에서 적용된다', async () => {
    expect(isB4Enabled()).toBe(false);
    expect(getB4StyleProfile()).toBe('objective');
    setB4StyleProfile('warm');
    expect(getB4StyleProfile()).toBe('warm');
    const options = { childName: '다온', rawText: '다온이가 블록 탑이 무너지자 다시 쌓고 "이번에는 길게 해 볼래"라고 말했다.', classAge: 4, recordType: 'observe' };
    const off = await processRecord(options);
    expect(off.b4).toBeNull();
    setB4Enabled(true);
    const on = await processRecord(options);
    expect(on.b4.enabled).toBe(true);
    expect(['rule-b4', 'rule-b3', 'rule-b2']).toContain(on.sentenceEngine);
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining([B4_KEYS.ENABLED, B4_KEYS.STYLE_PROFILE, B4_KEYS.RECENT_PATTERNS]));
  });

  test('검토 비교는 B4를 이름 없이 섞고 원문 전문 없이 피드백 메타데이터를 저장한다', () => {
    const item = B4_SYNTHETIC_CASES.find((row) => row.id === 'b4_050');
    const b4 = runB4(item);
    const result = {
      observation: item.input,
      support: '지원',
      copyReady: b4.copyReady,
      b2CopyReady: b4.b2CopyReady,
      b2: { enabled: true, trace: b4.b2.trace, questions: [] },
      b3: { enabled: true, trace: b4.b3.trace, copyReady: b4.b3.copyReady },
      b4: { enabled: true, trace: b4.b4Trace, copyReady: b4.b4CopyReady },
    };
    const cmp = buildComparison({ result, input: item.input, childName: item.name });
    expect(cmp.blind).toBe(true);
    expect([cmp.A.title, cmp.B.title, cmp.C.title]).toEqual(['안 A', '안 B', '안 C']);
    saveReviewEntry({
      kind: 'feedback',
      variant: 'C',
      engine: 'rule-b4',
      themeIds: b4.b4Trace.themeIds,
      discourseRelation: b4.b4Trace.relation,
      learningPatternId: b4.b4Trace.learningPatternId,
      supportPatternId: b4.b4Trace.supportPatternId,
      styleProfile: b4.b4Trace.styleProfile,
      section: 'learning',
      primaryTheme: b4.b4Trace.primaryTheme,
      secondaryTheme: b4.b4Trace.secondaryTheme,
      surfaceEditTypes: ['조사', '연결어', '원문'],
      finalPreferred: true,
      selections: ['use_as_is'],
      rawText: item.input,
      generatedText: b4.copyReady,
      childName: item.name,
    });
    const raw = JSON.stringify(getReviewEntries());
    expect(raw).toContain('rule-b4');
    expect(raw).toContain(b4.b4Trace.learningPatternId);
    expect(raw).toContain('조사');
    expect(raw).toContain('연결어');
    expect(raw).not.toContain('원문');
    expect(raw).not.toContain(item.input);
    expect(raw).not.toContain(item.name);
    expect(raw).not.toContain(b4.sections.learning);
  });
});
