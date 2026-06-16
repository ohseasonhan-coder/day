import { makeReportStyleText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';

export function createDailyReport({ parsedInput, categories = [], curriculum, selectedSentence, tone } = {}) {
  const flow = parsedInput?.playFlow?.join(' ') || parsedInput?.normalizedText || '유아의 놀이 흐름을 관찰하였다.';
  const support = parsedInput?.teacherSupport?.[0] || '교사는 놀이가 이어질 수 있도록 자료와 언어적 지원을 제공하였다.';
  const area = categories[0] || curriculum?.area || '놀이';
  const basis = curriculum?.item ? `${curriculum.source}의 ${curriculum.item}과 연결된다.` : `${area} 발달 경험과 연결된다.`;
  const sentence = selectedSentence?.text || '놀이 흐름 속에서 유아의 관심과 반응을 관찰하고 필요한 지원을 제공하였다.';
  const draft = makeReportStyleText(`놀이 흐름: ${flow} 교사 지원: ${support} 발달영역: ${basis} ${sentence}`, {
    sourceText: parsedInput?.rawText,
  });
  return applyToneToDraft(draft, { tone, documentType: 'dailyReport', sourceText: parsedInput?.rawText });
}
