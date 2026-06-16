import {
  RECORD_QUALITY_SAMPLES,
  TONE_OPTIONS,
  processRecord as legacyProcessRecord,
  generateDailyJournal as legacyGenerateDailyJournal,
  generateGrowthSummary as legacyGenerateGrowthSummary,
  generateConsultDoc as legacyGenerateConsultDoc,
} from './legacyEngine';
import { guardRecordResult } from './qualityGuard';
import {
  analyzeRecordInput,
  createConsultDocumentDraft,
  createDailyJournalDraft,
  createGrowthDraft,
  createRecordDrafts,
} from './draftComposer';

export { RECORD_QUALITY_SAMPLES, TONE_OPTIONS };

export async function processRecord(options = {}) {
  const analysis = analyzeRecordInput(options);
  const legacyResult = await legacyProcessRecord(options);
  return {
    ...guardRecordResult(legacyResult, { sourceText: options.rawText }),
    aiAnalysis: analysis,
    modularDrafts: createRecordDrafts({ analysis, tone: options.tone }),
  };
}

export async function generateDailyJournal(options = {}) {
  const legacyResult = await legacyGenerateDailyJournal(options);
  const modular = createDailyJournalDraft({
    records: options.records || [],
    className: options.className || '',
    classAge: options.classAge,
    tone: options.tone,
  });
  return {
    ...legacyResult,
    aiAnalysis: modular.analysis,
    modularDraft: modular.draft,
  };
}

export async function generateGrowthSummary(options = {}) {
  const legacyResult = await legacyGenerateGrowthSummary(options);
  const modular = createGrowthDraft(options);
  return {
    ...legacyResult,
    aiAnalysis: modular.analysis,
    modularDraft: modular.draft,
  };
}

export async function generateConsultDoc(options = {}) {
  const legacyResult = await legacyGenerateConsultDoc(options);
  const modular = createConsultDocumentDraft(options);
  return {
    ...legacyResult,
    aiAnalysis: modular.analysis,
    modularDraft: modular.draft,
  };
}

