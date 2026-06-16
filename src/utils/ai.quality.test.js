import { processRecord } from './ai/index';
import {
  scoreText,
  scoreAgainstGolden,
  QUALITY_PROFILES,
  GOLDEN_SAMPLES,
  findGoldenSample,
  listBannedHits,
} from './ai/quality';

const codes = (result) => result.issues.map((i) => i.code);

describe('품질 점수화 엔진', () => {
  test('모든 문서 유형 가중치 프로필이 정의되어 있고 합이 1에 가깝다', () => {
    ['observation', 'evaluation', 'parent', 'notice', 'counseling', 'support'].forEach((type) => {
      const profile = QUALITY_PROFILES[type];
      expect(profile).toBeTruthy();
      const sum = Object.values(profile).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.98);
      expect(sum).toBeLessThan(1.02);
    });
  });

  test('관찰일지는 발화 보존을 가장 무겁게 평가한다', () => {
    expect(QUALITY_PROFILES.observation.factualConsistency).toBeGreaterThanOrEqual(0.2);
    expect(QUALITY_PROFILES.observation.speechPreservation).toBeGreaterThanOrEqual(0.2);
  });

  test('부정 사실을 긍정 스핀으로 미화하면 낮은 점수와 issue가 나온다', () => {
    const sample = findGoldenSample('hajun-refusal');
    const distorted = '하준이는 미술활동에 적극적으로 참여하며 자신의 생각을 표현하는 모습이 늘었다.';
    const result = scoreText(distorted, { sourceText: sample.input.rawText, documentType: 'observation' });
    expect(result.grade).toBe('D');
    expect(codes(result)).toEqual(expect.arrayContaining(['speech_dropped', 'positive_spin']));
  });

  test('주관적 라벨·과장 절대어를 감지한다', () => {
    const labeled = '유아가 항상 산만하게 돌아다녔고 문제행동을 보였다.';
    const result = scoreText(labeled, { documentType: 'observation' });
    expect(codes(result)).toEqual(expect.arrayContaining(['subjective_label', 'overstatement']));
    const hits = listBannedHits(labeled).map((h) => h.code);
    expect(hits).toEqual(expect.arrayContaining(['label', 'overstatement']));
  });

  test('인접 단어 반복을 감지한다', () => {
    const repeated = '친구와 함께 함께 블록을 만들고 만들고 교사에게 보여주었다.';
    const result = scoreText(repeated, { documentType: 'observation' });
    expect(codes(result)).toContain('repetition');
  });
});

describe('골든 샘플 벤치마크', () => {
  test('모든 골든 샘플의 이상적 관찰일지는 기준 점수를 넘고 통과한다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      const result = scoreAgainstGolden(sample.ideal.observation, sample, { field: 'observation' });
      expect(result.missing).toEqual([]);
      expect(result.violated).toEqual([]);
      expect(result.score).toBeGreaterThanOrEqual(sample.minScore);
      expect(result.passed).toBe(true);
    });
  });

  test('이상적 출력은 왜곡 출력보다 항상 높은 점수를 받는다', () => {
    const sample = findGoldenSample('hajun-refusal');
    const ideal = scoreText(sample.ideal.observation, {
      sourceText: sample.input.rawText,
      documentType: 'observation',
    });
    const distorted = scoreText('하준이는 즐겁게 참여하며 활발하게 활동하였다.', {
      sourceText: sample.input.rawText,
      documentType: 'observation',
    });
    expect(ideal.score).toBeGreaterThan(distorted.score + 25);
  });

  test('이상적 평가 문장도 평가 프로필에서 양호한 점수를 받는다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      const result = scoreText(sample.ideal.evaluation, {
        sourceText: sample.input.rawText,
        documentType: 'evaluation',
      });
      expect(result.score).toBeGreaterThanOrEqual(65);
    });
  });
});

describe('실제 엔진 출력 품질 회귀(통합)', () => {
  test('하준 거부 사례: 실제 관찰일지에 발화 누락·긍정 스핀 issue가 없다', async () => {
    const sample = findGoldenSample('hajun-refusal');
    const result = await processRecord({
      childName: sample.input.childName,
      rawText: sample.input.rawText,
      classAge: sample.input.classAge,
      recordType: 'observe',
    });
    const scored = scoreText(result.observation, {
      sourceText: sample.input.rawText,
      documentType: 'observation',
    });
    const issueCodes = scored.issues.map((i) => i.code);
    expect(issueCodes).not.toContain('positive_spin');
    expect(issueCodes).not.toContain('fact_omitted');
    expect(result.observation).toContain('"하준이는 안하고 싶어요?"');
  });
});
