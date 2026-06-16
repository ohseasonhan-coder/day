import { makeWarmNoticeText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';

export function createNotice({ parsedInput, selectedSentence, tone } = {}) {
  const name = parsedInput?.childName || '유아';
  const base = parsedInput?.normalizedText || '오늘의 활동에 참여했습니다.';
  const support = parsedInput?.teacherSupport?.[0] || '교사는 편안하게 시도할 수 있도록 곁에서 도왔습니다.';
  const peer = parsedInput?.peerInteraction?.[0] ? `친구와의 경험도 함께 살펴보았습니다. ${parsedInput.peerInteraction[0]}` : '';
  const health = parsedInput?.healthAndSafety?.[0] ? `컨디션과 안전도 세심하게 확인했습니다. ${parsedInput.healthAndSafety[0]}` : '';
  const sentence = selectedSentence?.text || '오늘의 경험을 통해 스스로 시도해 보는 모습이 이어졌습니다.';
  const draft = makeWarmNoticeText(`${name}는 오늘 ${base} ${peer} ${health} ${support} ${sentence}`, { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'notice', sourceText: parsedInput?.rawText });
}
