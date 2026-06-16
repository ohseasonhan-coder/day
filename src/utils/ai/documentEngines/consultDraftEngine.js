import { makeWarmNoticeText } from '../qualityGuard';
import { composeCounseling } from './counselingDevelopmentComposer';

// 상담자료는 입력 핵심 요소를 반영한 전문 상담 문장 composer로 생성한다.
// (원본 메모를 그대로 붙여넣지 않고, 부드럽고 전문적인 문체로 풀어낸다)
export function createConsultDraft({ childName, records = [], analysis } = {}) {
  const parsed = analysis?.parsedInput;
  const input = parsed?.rawText || records.map((r) => r.rawText || r.observation).filter(Boolean)[0] || '';
  const composed = composeCounseling({
    childName: childName || parsed?.childName,
    input,
    categories: analysis?.categories,
    curriculum: analysis?.curriculum,
  });
  return makeWarmNoticeText(composed, { sourceText: input });
}
