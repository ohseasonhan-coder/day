// 인터넷을 통해 나가는 외부 LLM 어댑터(adapter.external === true)로 보내기 직전,
// 대상 원아 외 다른 원아 이름을 임시 라벨('친구1', '친구2'...)로 치환하고,
// 응답을 받은 뒤 원래 이름으로 복원한다. 대상 원아 이름 자체는 b2/llmBridge.js의
// buildRestrictedLLMContext가 이미 '원아 A'로 치환하므로 여기서는 그 외 이름만 다룬다.
// 로컬 전용 어댑터(같은 PC의 7B 서버 등)에는 적용하지 않는다.
import { extractChildNameCandidates } from '../b4/childcareDomainGuard';
import { getChildren } from '../../storage';

function knownNames() {
  try { return getChildren().map((c) => String(c?.name || '').trim()).filter((n) => n.length >= 2); } catch { return []; }
}

export function anonymizeOtherChildNames(messages = [], { input = '', targetChild = '' } = {}) {
  const target = String(targetChild || '').trim();
  const names = extractChildNameCandidates(input, knownNames()).filter((n) => n && n !== target);
  if (!names.length) return { messages, nameMap: [] };
  const nameMap = names.map((name, i) => ({ name, label: `친구${i + 1}` }));
  const replaceAll = (text) => nameMap.reduce((acc, { name, label }) => acc.split(name).join(label), String(text || ''));
  return { messages: messages.map((m) => ({ ...m, content: replaceAll(m.content) })), nameMap };
}

export function restoreOtherChildNames(text, nameMap = []) {
  return nameMap.reduce((acc, { name, label }) => acc.split(label).join(name), String(text || ''));
}

export default anonymizeOtherChildNames;
