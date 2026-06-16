// 로컬 품질 엔진 공개 입구 (외부 API 없음, 결정적 규칙 기반).
// 아직 UI에는 연결하지 않는다. 테스트와 향후 엔진 개선의 기준으로만 사용한다.
export { scoreText, scoreAgainstGolden, QUALITY_PROFILES } from './qualityScorer';
export { GOLDEN_SAMPLES, findGoldenSample } from './goldenSamples';
export {
  AREA_SENTENCE_PATTERNS,
  EVALUATION_FRAMES,
  PARENT_FRAMES,
  BANNED_PATTERNS,
  PREFERRED_REPHRASES,
  listBannedHits,
} from './sentenceDataset';
export * as lexicon from './lexicon';
