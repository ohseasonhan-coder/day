// 전환 후 검수용: 샘플 프리셋을 modular 엔진으로 일괄 생성하고 품질을 요약한다.
// 관리자 화면에서 "알림장 샘플 20개 실행" 등에 사용. 전부 로컬, 외부 전송 없음.
import { analyzeRecordInput } from './draftComposer';
import { composeNotice } from './documentEngines/noticeComposer';
import { composeEvaluation } from './documentEngines/evaluationComposer';
import { composeCounseling, composeDevelopment } from './documentEngines/counselingDevelopmentComposer';
import { createObservation } from './documentEngines/observationEngine';
import { validateModularOutput } from './documentEngineResolver';
import { scoreText } from './qualityScorer';
import { REVIEW_SAMPLE_PRESETS } from './reviewSamplePresets';

const round1 = (n) => Math.round(n * 10) / 10;

function buildModularText(documentType, input) {
  const analysis = analyzeRecordInput({ rawText: input, classAge: '4' });
  const opts = { input, categories: analysis.categories };
  switch (documentType) {
    case 'observation':
      return createObservation({ parsedInput: analysis.parsedInput, categories: analysis.categories, scene: analysis.scene });
    case 'dailyReport':
      return composeEvaluation(opts);
    case 'counseling':
      return composeCounseling(opts);
    case 'development':
      return composeDevelopment(opts);
    case 'notice':
    default:
      return composeNotice(opts);
  }
}

// 프리셋을 modular로 생성 → 검수(validateModularOutput) → 요약.
// 결과는 관리자에게만 노출(점수/사유 포함). 일반 사용자 출력과 무관.
export function runSampleAudit(documentType = 'notice', presets = REVIEW_SAMPLE_PRESETS) {
  const rows = presets.map((p) => {
    let text = '';
    let errored = false;
    try {
      text = buildModularText(documentType, p.rawText);
    } catch {
      errored = true;
    }
    const verdict = validateModularOutput({ text, input: p.rawText, documentType, scoreFn: scoreText });
    const reasons = errored ? ['modular_error'] : verdict.reasons;
    const score = verdict.score ? verdict.score.totalScore : 0;
    return { id: p.id, label: p.label, ok: !errored && verdict.ok, reasons, score, text };
  });

  const has = (r, code) => r.reasons.includes(code);
  const scores = rows.map((r) => r.score);
  return {
    documentType,
    total: rows.length,
    modularPass: rows.filter((r) => r.ok).length,
    fallback: rows.filter((r) => !r.ok).length,
    avgScore: rows.length ? round1(scores.reduce((a, b) => a + b, 0) / rows.length) : 0,
    minScore: rows.length ? Math.min(...scores) : 0,
    safetyWarnings: rows.filter((r) => has(r, 'safety_warning')).length,
    below90: rows.filter((r) => r.score < 90).length,
    internalLabel: rows.filter((r) => has(r, 'internal_label')).length,
    speechFail: rows.filter((r) => has(r, 'speech_not_preserved')).length,
    rows,
  };
}
