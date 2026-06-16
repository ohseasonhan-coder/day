import { makeWarmNoticeText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';
import { composeNotice } from './noticeComposer';

// 부모 전달 메시지는 알림장 composer를 재사용하여 입력 핵심 요소를 부모 친화 문체로 전달한다.
export function createParentMessage({ parsedInput, categories = [], curriculum, tone } = {}) {
  const composed = composeNotice({
    childName: parsedInput?.childName,
    input: parsedInput?.rawText,
    categories,
    curriculum,
  });
  const draft = makeWarmNoticeText(composed, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'parentMessage', sourceText: parsedInput?.rawText });
}
