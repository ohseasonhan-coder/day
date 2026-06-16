import { makeReportStyleText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';
import { composeEvaluation } from './evaluationComposer';

// 보육일지 평가는 입력 핵심 요소를 반영한 평가 문장 composer로 생성한다.
// 내부 라벨("놀이 흐름:" 등)을 남기지 않고 자연스러운 문단으로 만든다.
export function createDailyReport({ parsedInput, categories = [], curriculum, tone } = {}) {
  const composed = composeEvaluation({
    childName: parsedInput?.childName,
    input: parsedInput?.rawText,
    categories,
    curriculum,
  });
  const draft = makeReportStyleText(composed, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'dailyReport', sourceText: parsedInput?.rawText });
}
