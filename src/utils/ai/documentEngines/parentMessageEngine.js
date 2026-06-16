import { makeWarmNoticeText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';

const CATEGORY_MESSAGES = {
  '사회관계': '친구와 함께하는 과정에서 자신의 생각과 감정을 표현해 보는 경험이 있었습니다.',
  '의사소통': '말이나 행동으로 자신의 생각을 표현하는 모습이 관찰되었습니다.',
  '예술경험': '표현 활동에 관심을 보이며 자신만의 방식으로 시도해 보았습니다.',
  '자연탐구': '주변 대상에 관심을 가지고 살펴보며 궁금한 점을 표현했습니다.',
  '신체운동·건강': '몸의 움직임과 컨디션을 살피며 하루 일과에 참여했습니다.',
  '기본생활습관': '일상생활 속에서 스스로 해 보려는 경험이 이어졌습니다.',
  '안전': '안전과 관련된 상황을 살피며 필요한 도움을 받았습니다.',
  '놀이': '놀이 속에서 관심 있는 주제를 선택하고 이어 가는 모습이 있었습니다.',
};

export function createParentMessage({ parsedInput, categories = [], tone } = {}) {
  const name = parsedInput?.childName || '유아';
  const category = categories[0] || '놀이';
  const speech = parsedInput?.actualSpeech?.[0] ? `"${parsedInput.actualSpeech[0]}"라고 말하며 ` : '';
  const peer = parsedInput?.peerInteraction?.[0] ? `친구와의 상호작용도 함께 경험했습니다. ` : '';
  const health = parsedInput?.healthAndSafety?.[0] ? `컨디션과 안전은 교사가 계속 살폈습니다. ` : '';
  const base = CATEGORY_MESSAGES[category] || CATEGORY_MESSAGES['놀이'];
  const text = `${name}는 오늘 ${speech}${base} ${peer}${health}가정에서도 오늘 경험한 내용을 편안하게 이야기 나누어 주시면 좋겠습니다.`;
  const draft = makeWarmNoticeText(text, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'parentMessage', sourceText: parsedInput?.rawText });
}
