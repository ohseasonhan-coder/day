import { makeReportStyleText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';
import { composeEvaluation } from './evaluationComposer';

// 평가 문장은 입력의 핵심 소재·활동·또래·교사 지원·변화를 반영하는 composer로 생성한다.
// (일반 카테고리 템플릿만 반환하지 않도록 개선)
export function createEvaluation({ parsedInput, categories = [], curriculum, tone } = {}) {
  const composed = composeEvaluation({
    childName: parsedInput?.childName,
    input: parsedInput?.rawText,
    categories,
    curriculum,
  });
  const draft = makeReportStyleText(composed, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'evaluation', sourceText: parsedInput?.rawText });
}
