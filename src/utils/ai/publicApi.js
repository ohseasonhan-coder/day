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
import { generateWithFallback } from './documentEngineResolver';
import { buildCopyReadyObservation } from './copyReadyObservation';

export { RECORD_QUALITY_SAMPLES, TONE_OPTIONS };

// 문서 유형별 기본 엔진 설정에 따라 최종 출력을 결정한다.
// 기본값은 모두 legacy이므로 평상시 동작은 기존과 동일하며,
// 관리자가 modular로 전환한 유형만 검수(fallback 포함)를 거쳐 modular 출력을 사용한다.
function applyEnginePreferences(guarded, modularDrafts, sourceText) {
  const out = { ...guarded };
  const route = [
    ['observation', 'observation', modularDrafts.observation],
    ['dailyReport', 'evaluation', modularDrafts.dailyReport],
    ['notice', 'parent', modularDrafts.notice],
  ];
  route.forEach(([documentType, field, modularText]) => {
    if (typeof out[field] !== 'string') return;
    out[field] = generateWithFallback({
      documentType,
      input: sourceText,
      legacyText: out[field],
      modularFn: () => modularText,
    });
  });
  return out;
}

export async function processRecord(options = {}) {
  const analysis = analyzeRecordInput(options);
  const legacyResult = await legacyProcessRecord(options);
  const guarded = guardRecordResult(legacyResult, { sourceText: options.rawText });
  const modularDrafts = createRecordDrafts({ analysis, tone: options.tone });
  const resolved = applyEnginePreferences(guarded, modularDrafts, options.rawText);
  return {
    ...resolved,
    // 복사용 관찰일지(관찰내용/배움 읽기/교사 지원 및 다음 계획) — 기존 필드 조합, 새 생성 없음
    copyReady: buildCopyReadyObservation(resolved),
    aiAnalysis: analysis,
    modularDrafts,
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
  const input = modular.analysis?.parsedInput?.rawText || '';
  // 발달평가(전체 요약) 대표 서술 필드에 엔진 설정/검수/legacy fallback을 적용.
  const overall = generateWithFallback({
    documentType: 'development',
    input,
    legacyText: legacyResult.overall || '',
    modularFn: () => modular.draft,
  });
  return {
    ...legacyResult,
    overall,
    aiAnalysis: modular.analysis,
    modularDraft: modular.draft,
  };
}

export async function generateConsultDoc(options = {}) {
  const legacyResult = await legacyGenerateConsultDoc(options);
  const modular = createConsultDocumentDraft(options);
  const input = modular.analysis?.parsedInput?.rawText || '';
  // 상담자료(최근 성장 흐름) 대표 서술 필드에 엔진 설정/검수/legacy fallback을 적용.
  const recentGrowth = generateWithFallback({
    documentType: 'counseling',
    input,
    legacyText: legacyResult.recentGrowth || '',
    modularFn: () => modular.draft,
  });
  return {
    ...legacyResult,
    recentGrowth,
    aiAnalysis: modular.analysis,
    modularDraft: modular.draft,
  };
}

