import { makeReportStyleText } from '../qualityGuard';
import { composeDevelopment } from './counselingDevelopmentComposer';

// 발달평가/성장요약은 입력 핵심 요소를 반영한 전문 발달평가 문장 composer로 생성한다.
// 발달영역별 현재 모습·관찰 근거·지원 방향을 담되, 입력에 없는 발달 수준은 추정하지 않는다.
export function createGrowthSummaryDraft({ childName, records = [], period, analysis } = {}) {
  const parsed = analysis?.parsedInput;
  const input = parsed?.rawText || records.map((r) => r.observation || r.rawText).filter(Boolean)[0] || '';
  const composed = composeDevelopment({
    childName: childName || parsed?.childName,
    input,
    categories: analysis?.categories,
    curriculum: analysis?.curriculum,
  });
  return makeReportStyleText(composed, { sourceText: input });
}
