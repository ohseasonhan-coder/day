import { makeReportStyleText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';

const CATEGORY_EVALUATIONS = {
  '사회관계': '또래와 관계를 맺는 과정에서 감정 표현과 조율 경험이 나타났다.',
  '의사소통': '자신의 생각이나 요구를 말과 행동으로 표현하는 경험이 나타났다.',
  '예술경험': '표현 매체를 탐색하고 자신의 방식으로 나타내려는 경험이 나타났다.',
  '자연탐구': '관찰과 탐색 과정에서 궁금한 점을 확인하려는 경험이 나타났다.',
  '신체운동·건강': '신체 움직임과 건강 상태를 살피며 일과에 참여하는 경험이 나타났다.',
  '기본생활습관': '반복되는 일상 상황에서 스스로 시도하는 경험이 나타났다.',
  '안전': '안전한 행동과 교사의 안내를 연결해 보는 경험이 나타났다.',
  '놀이': '놀이 흐름 속에서 관심을 유지하고 경험을 확장하는 모습이 나타났다.',
};

export function createEvaluation({ parsedInput, categories = [], curriculum, tone } = {}) {
  const category = categories[0] || '놀이';
  const base = CATEGORY_EVALUATIONS[category] || CATEGORY_EVALUATIONS['놀이'];
  const change = parsedInput?.changes?.[0] ? ` 이후 변화로 ${parsedInput.changes[0]}이 관찰되었다.` : '';
  const basis = curriculum?.item
    ? ` ${curriculum.source}의 ${curriculum.item}과 관련지어 볼 수 있다.`
    : '';
  const draft = makeReportStyleText(`${base}${change}${basis}`, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'evaluation', sourceText: parsedInput?.rawText });
}
