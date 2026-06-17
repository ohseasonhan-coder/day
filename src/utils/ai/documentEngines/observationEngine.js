import { makeObjectiveText } from '../qualityGuard';
import { applyToneToDraft } from '../toneAdapter';
import { buildObservationFrame } from '../observationFrames';

const joinFacts = (items) => (items || []).filter(Boolean).join(' ');

function originalSentenceContaining(speech, parsedInput) {
  const sentences = parsedInput?.sentences || [];
  return sentences.find((s) => s.includes(speech)) || '';
}

// 관찰일지: 입력의 따옴표 발화가 출력에서 빠졌으면 원문 문장을 그대로 덧붙여 100% 보존한다.
// - 작은/큰/한국어 따옴표 모두 parsedInput.actualSpeech(extractActualSpeech)로 추출됨
// - 발화 내용(조사·어미·띄어쓰기·문장부호)을 바꾸지 않고, 요약/순화/메타문장 없이 원문만 복원
// - 발화가 여러 개면 모두 보존
function ensureSpeechPreserved(text, parsedInput) {
  let out = String(text || '');
  const speeches = parsedInput?.actualSpeech || [];
  speeches.forEach((sp) => {
    if (!sp || out.includes(sp)) return; // 이미 원문 그대로 포함됨
    const orig = originalSentenceContaining(sp, parsedInput);
    const addition = orig || `"${sp}"`;  // 원문 문장 우선, 없으면 발화 원문만(메타 없이)
    if (addition && !out.includes(addition)) {
      out = `${out} ${addition}`.replace(/\s+/g, ' ').trim();
    }
  });
  return out;
}

export function createObservation({ parsedInput, selectedSentence, categories = [], tone, scene } = {}) {
  const finalize = (text) => ensureSpeechPreserved(text, parsedInput);

  if (scene?.primary) {
    const framed = buildObservationFrame({ parsedInput, scene, selectedSentence });
    const guarded = makeObjectiveText(framed, { sourceText: parsedInput?.rawText });
    return finalize(applyToneToDraft(guarded, { tone, documentType: 'observation', sourceText: parsedInput?.rawText }));
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
  return finalize(applyToneToDraft(draft, { tone, documentType: 'observation', sourceText: parsedInput?.rawText }));
}
