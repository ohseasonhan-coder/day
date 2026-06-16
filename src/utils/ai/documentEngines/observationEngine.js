import { makeObjectiveText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';
import { buildObservationFrame } from '../observationFrames';

const joinFacts = (items) => (items || []).filter(Boolean).join(' ');

export function createObservation({ parsedInput, selectedSentence, categories = [], tone, scene } = {}) {
  if (scene?.primary) {
    const framed = buildObservationFrame({ parsedInput, scene, selectedSentence });
    const guarded = makeObjectiveText(framed, { sourceText: parsedInput?.rawText });
    return applyToneToDraft(guarded, { tone, documentType: 'observation', sourceText: parsedInput?.rawText });
  }

  const name = parsedInput?.childName || '유아';
  const action = joinFacts(parsedInput?.actions) || parsedInput?.normalizedText || '기록된 상황을 보였다.';
  const teacher = joinFacts(parsedInput?.teacherSupport) || selectedSentence?.text || '교사는 유아의 반응을 관찰하며 필요한 지원을 제공하였다.';
  const peer = joinFacts(parsedInput?.peerInteraction);
  const health = joinFacts(parsedInput?.healthAndSafety);
  const change = joinFacts(parsedInput?.changes);
  const parts = [
    `${name}는 ${action}`,
    peer && categories.includes('사회관계') ? `또래 상호작용: ${peer}` : '',
    health ? `건강·안전 관련 기록: ${health}` : '',
    teacher,
    change ? `이후 ${change}` : '',
  ];
  const draft = makeObjectiveText(parts.filter(Boolean).join(' '), { sourceText: parsedInput?.rawText });
  return applyToneToDraft(draft, { tone, documentType: 'observation', sourceText: parsedInput?.rawText });
}
