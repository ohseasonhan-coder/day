import { classifyCategories, detectDevelopmentAreas, getDocumentUses, getPrimaryCategory } from './categoryClassifier';
import { mapCurriculumForAnalysis } from './curriculumMapper';
import { parseInput } from './inputParser';
import { extractTags } from './tagExtractor';
import { analyzeScene } from './sceneAnalyzer';
import { selectDraftSentences } from './sentenceSelector';
import { createObservation } from './documentEngines/observationEngine';
import { createNotice } from './documentEngines/noticeEngine';
import { createDailyReport } from './documentEngines/dailyReportEngine';
import { createParentMessage } from './documentEngines/parentMessageEngine';
import { createSupportPlan } from './documentEngines/supportPlanEngine';
import { createEvaluation } from './documentEngines/evaluationEngine';
import { createGrowthSummaryDraft } from './documentEngines/growthSummaryEngine';
import { createConsultDraft } from './documentEngines/consultDraftEngine';
import { buildDocumentMeta, makeDocumentReadyText } from './documentMeta';
import { getRecentSentenceIds, rememberSentence } from './repetitionGuard';

export function getRecordText(records = [], fields = ['observation', 'rawText', 'parent']) {
  return records
    .map((record) => fields.map((field) => record?.[field]).find(Boolean) || '')
    .filter(Boolean)
    .join(' ');
}

export function analyzeRecordInput({ childName, rawText, classAge } = {}) {
  const parsedInput = parseInput({ childName, rawText });
  const categories = classifyCategories(parsedInput);
  const primaryCategory = getPrimaryCategory(parsedInput);
  const scene = analyzeScene(parsedInput);
  const devAreas = detectDevelopmentAreas(parsedInput, categories);
  const documentUses = getDocumentUses(parsedInput, categories);
  const tags = extractTags({ parsedInput, categories, devAreas });
  const curriculum = mapCurriculumForAnalysis({ parsedInput, categories, devAreas, classAge });
  const documentMeta = buildDocumentMeta({ parsedInput, categories, devAreas, tags, documentUses, classAge });
  const documentReadyText = makeDocumentReadyText(documentMeta);
  return { parsedInput, categories, primaryCategory, scene, devAreas, tags, documentUses, curriculum, documentMeta, documentReadyText };
}

export function selectAndRememberDraftSentences(analysis) {
  const sentences = selectDraftSentences({
    primaryCategory: analysis.primaryCategory,
    excludeIds: getRecentSentenceIds(),
  });
  Object.values(sentences).forEach((sentence) => rememberSentence(sentence?.id));
  return sentences;
}

export function createRecordDrafts({ analysis, tone } = {}) {
  const sentences = selectAndRememberDraftSentences(analysis);
  return {
    observation: createObservation({
      parsedInput: analysis.parsedInput,
      categories: analysis.categories,
      selectedSentence: sentences.observation,
      tone,
      scene: analysis.scene,
    }),
    notice: createNotice({ parsedInput: analysis.parsedInput, selectedSentence: sentences.notice, tone }),
    dailyReport: createDailyReport({
      parsedInput: analysis.parsedInput,
      categories: analysis.categories,
      curriculum: analysis.curriculum,
      selectedSentence: sentences.dailyReport,
      tone,
    }),
    parentMessage: createParentMessage({
      parsedInput: analysis.parsedInput,
      categories: analysis.categories,
      tone,
    }),
    supportPlan: createSupportPlan({
      parsedInput: analysis.parsedInput,
      categories: analysis.categories,
      tone,
    }),
    evaluation: createEvaluation({
      parsedInput: analysis.parsedInput,
      categories: analysis.categories,
      curriculum: analysis.curriculum,
      tone,
    }),
  };
}

export function createDailyJournalDraft({ records = [], className = '', classAge, tone } = {}) {
  const analysis = analyzeRecordInput({
    childName: className,
    rawText: getRecordText(records),
    classAge,
  });
  const sentences = selectAndRememberDraftSentences(analysis);
  return {
    analysis,
    draft: createDailyReport({
      parsedInput: analysis.parsedInput,
      categories: analysis.categories,
      curriculum: analysis.curriculum,
      selectedSentence: sentences.dailyReport,
      tone,
    }),
  };
}

export function createGrowthDraft({ childName, records = [], period, childAge } = {}) {
  const analysis = analyzeRecordInput({
    childName,
    rawText: getRecordText(records),
    classAge: childAge,
  });
  return {
    analysis,
    draft: createGrowthSummaryDraft({ childName, records, period, analysis }),
  };
}

export function createConsultDocumentDraft({ childName, records = [], childAge } = {}) {
  const analysis = analyzeRecordInput({
    childName,
    rawText: getRecordText(records, ['parent', 'observation', 'rawText']),
    classAge: childAge,
  });
  return {
    analysis,
    draft: createConsultDraft({ childName, records, analysis }),
  };
}

