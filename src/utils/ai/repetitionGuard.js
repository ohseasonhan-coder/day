const MEMORY_LIMIT = 30;
const STORAGE_KEY = 'sw_ai_recent_sentence_ids';
const memory = [];

const canUseStorage = () => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

function readStoredMemory() {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeStoredMemory(values) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values.slice(0, MEMORY_LIMIT)));
  } catch {}
}

function currentMemory() {
  const stored = readStoredMemory();
  if (stored.length) {
    memory.splice(0, memory.length, ...stored.slice(0, MEMORY_LIMIT));
  }
  return memory;
}

export function rememberSentence(sentenceId) {
  if (!sentenceId) return;
  const current = currentMemory();
  const index = current.indexOf(sentenceId);
  if (index !== -1) current.splice(index, 1);
  current.unshift(sentenceId);
  current.splice(MEMORY_LIMIT);
  writeStoredMemory(current);
}

export function getRecentSentenceIds() {
  return [...currentMemory()];
}

export function chooseWithoutRecent(candidates = []) {
  const recent = currentMemory();
  const picked = candidates.find((candidate) => candidate?.id && !recent.includes(candidate.id)) || candidates[0] || null;
  if (picked?.id) rememberSentence(picked.id);
  return picked;
}

export function resetRepetitionMemory() {
  memory.splice(0, memory.length);
  if (canUseStorage()) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

export { STORAGE_KEY as REPETITION_STORAGE_KEY };
