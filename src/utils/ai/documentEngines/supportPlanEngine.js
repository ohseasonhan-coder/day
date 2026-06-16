import { makeObjectiveText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';

const CATEGORY_SUPPORTS = {
  '사회관계': '또래와의 차례, 양보, 감정 표현을 교사의 짧은 언어 모델링으로 지원한다.',
  '의사소통': '유아가 말로 표현한 내용을 기다려 주고, 필요한 경우 선택형 질문으로 확장한다.',
  '예술경험': '다양한 재료를 제공하고 결과보다 표현 과정에 머물 수 있도록 격려한다.',
  '자연탐구': '관찰한 내용을 비교하거나 다시 살펴볼 수 있는 자료를 제공한다.',
  '신체운동·건강': '컨디션과 움직임을 살피며 무리하지 않는 범위에서 참여를 지원한다.',
  '기본생활습관': '일과 속 반복되는 생활 행동을 스스로 시도할 수 있도록 순서와 시간을 안내한다.',
  '안전': '상황을 즉시 확인하고 안전한 방법을 짧고 구체적으로 안내한다.',
  '놀이': '유아의 놀이 흐름을 관찰하며 필요한 자료와 언어적 단서를 제공한다.',
};

export function createSupportPlan({ parsedInput, categories = [], tone } = {}) {
  const category = categories[0] || '놀이';
  const support = CATEGORY_SUPPORTS[category] || CATEGORY_SUPPORTS['놀이'];
  const teacherSeen = parsedInput?.teacherSupport?.[0]
    ? `기록된 교사 지원을 바탕으로 다음 지원을 이어간다. `
    : '';
  const draft = makeObjectiveText(`${teacherSeen}${support}`, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'supportPlan', sourceText: parsedInput?.rawText });
}
