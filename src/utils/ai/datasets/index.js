// 데이터셋 배럴 — 골든 샘플과 문장 데이터셋 공개 입구 (UI 미연결).
export { GOLDEN_SAMPLES, GOLDEN_DOCUMENT_TYPES, findGoldenSample } from './goldenSamples';
export {
  SENTENCE_DATASET,
  SENTENCE_TYPES,
  getSentencesByType,
  querySentences,
  BANNED_PATTERNS,
  listBannedHits,
} from './sentenceDataset';
