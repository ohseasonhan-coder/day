import { makeWarmNoticeText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';
import { composeNotice } from './noticeComposer';

// 알림장은 입력 핵심 요소를 반영한 부모 친화 문장 composer로 생성한다.
// 내부 라벨 없이 부드러운 존댓말 문단으로 만들고, 부정 사실은 순화하되 없애지 않는다.
export function createNotice({ parsedInput, categories = [], curriculum, tone } = {}) {
  const composed = composeNotice({
    childName: parsedInput?.childName,
    input: parsedInput?.rawText,
    categories,
    curriculum,
  });
  const draft = makeWarmNoticeText(composed, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'notice', sourceText: parsedInput?.rawText });
}
