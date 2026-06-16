import { normalizeRecordText } from './normalizationRules';

const QUOTED_SPEECH_RE = /["“”'‘’]([^"“”'‘’]+)["“”'‘’]/g;

const TEACHER_WORDS = ['교사', '선생님', '도움', '지원', '안내', '제안', '격려', '관찰', '물어'];
const PEER_WORDS = ['친구', '또래', '함께', '같이', '양보', '기다', '나누', '빌려', '미안'];
const EMOTION_WORDS = ['울', '웃', '속상', '기뻐', '즐거', '불안', '화', '놀라', '편안', '힘들'];
const CHANGE_WORDS = ['다시', '점차', '후', '이후', '변화', '시도', '완성', '멈추', '안정'];
const HEALTH_WORDS = ['체온', '투약', '약', '아프', '기침', '콧물', '상처', '넘어', '다치'];
const PLAY_WORDS = ['놀이', '블록', '역할', '쌓', '만들', '그림', '물감', '책', '탐색', '관찰'];

const splitSentences = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。]|요|다)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const pickByWords = (sentences, words) =>
  sentences.filter((sentence) => words.some((word) => sentence.includes(word)));

export function normalizeKoreanRecordText(text) {
  return normalizeRecordText(text);
}

export function extractActualSpeech(text) {
  const speech = [];
  const source = String(text || '');
  let match;
  while ((match = QUOTED_SPEECH_RE.exec(source))) {
    const value = match[1]?.trim();
    if (value) speech.push(value);
  }
  return speech;
}

export function parseInput({ childName, rawText } = {}) {
  const normalizedText = normalizeKoreanRecordText(rawText);
  const sentences = splitSentences(normalizedText);
  const actualSpeech = extractActualSpeech(normalizedText);

  return {
    childName: childName || '',
    rawText: rawText || '',
    normalizedText,
    sentences,
    actualSpeech,
    actions: sentences.filter((sentence) => !actualSpeech.some((speech) => sentence.includes(speech))),
    teacherSupport: pickByWords(sentences, TEACHER_WORDS),
    peerInteraction: pickByWords(sentences, PEER_WORDS),
    emotions: pickByWords(sentences, EMOTION_WORDS),
    changes: pickByWords(sentences, CHANGE_WORDS),
    healthAndSafety: pickByWords(sentences, HEALTH_WORDS),
    playFlow: pickByWords(sentences, PLAY_WORDS),
  };
}
