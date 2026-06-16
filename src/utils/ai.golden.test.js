import { processRecord } from './ai/index';
import { scoreText, explainDeductions, DIMENSION_MAX } from './ai/qualityScorer';
import { GOLDEN_SAMPLES, GOLDEN_DOCUMENT_TYPES } from './ai/datasets/goldenSamples';
import { SENTENCE_DATASET, SENTENCE_TYPES, listBannedHits } from './ai/datasets/sentenceDataset';

// 입력 메모에서 아이 이름(첫 한글 2~3자) 추출
function nameFromInput(input) {
  const m = String(input).match(/^([가-힣]{2,3})이?(?:가|는|네)/);
  return m ? m[1] : '유아';
}

describe('qualityScorer 채점기', () => {
  test('채점 항목 가중치 합이 100점이다', () => {
    const sum = Object.values(DIMENSION_MAX).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  test('골든 기대 출력은 모든 문서 유형에서 85점 이상이다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      GOLDEN_DOCUMENT_TYPES.forEach((dt) => {
        const r = scoreText(sample.expected[dt], { input: sample.input, documentType: dt });
        expect(r.totalScore).toBeGreaterThanOrEqual(85);
      });
    });
  });

  test('관찰일지에서 부정 사실을 긍정으로 미화하면 70점 미만이고 경고가 나온다', () => {
    const sample = GOLDEN_SAMPLES.find((s) => s.id === 'sample_fact_015');
    const distorted = '하준이는 그리기 활동에 적극적으로 참여하며 즐겁게 활동하였다.';
    const r = scoreText(distorted, { input: sample.input, documentType: 'observation' });
    expect(r.totalScore).toBeLessThan(70);
    expect(r.warnings.join(' ')).toMatch(/미화|발화/);
  });

  test('실제 발화는 어떤 문서 유형에서도 원문 그대로일 때 발화 감점이 없다', () => {
    const sample = GOLDEN_SAMPLES.find((s) => s.id === 'sample_social_001');
    const obs = scoreText(sample.expected.observation, { input: sample.input, documentType: 'observation' });
    expect(obs.warnings.join(' ')).not.toMatch(/발화/);
  });
});

describe('sentenceDataset 데이터셋', () => {
  test('문장 조각이 150개 이상이다', () => {
    expect(SENTENCE_DATASET.length).toBeGreaterThanOrEqual(150);
  });

  test('필수 문장 유형 10가지가 모두 존재한다', () => {
    SENTENCE_TYPES.forEach((type) => {
      expect(SENTENCE_DATASET.some((s) => s.type === type)).toBe(true);
    });
  });

  test('모든 문장은 필수 필드를 갖추고 금지 표현(라벨·과장·진단)이 없다', () => {
    SENTENCE_DATASET.forEach((s) => {
      expect(typeof s.id).toBe('string');
      expect(SENTENCE_TYPES).toContain(s.type);
      expect(Array.isArray(s.category)).toBe(true);
      expect(Array.isArray(s.documentType)).toBe(true);
      expect(Array.isArray(s.ageGroup)).toBe(true);
      expect(s.riskLevel).toBe('safe');
      expect(listBannedHits(s.text)).toEqual([]);
    });
  });

  test('문장 id는 중복되지 않는다', () => {
    const ids = SENTENCE_DATASET.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('현재 엔진 출력 품질 (회귀 baseline)', () => {
  // 30개 골든 입력을 현재 엔진에 통과시켜 관찰/알림장/보육일지 점수를 수집한다.
  const TARGET = 75; // 목표 점수
  let report;

  beforeAll(async () => {
    const rows = [];
    for (const sample of GOLDEN_SAMPLES) {
      // eslint-disable-next-line no-await-in-loop
      const result = await processRecord({
        childName: nameFromInput(sample.input),
        rawText: sample.input,
        classAge: '4',
        recordType: 'observe',
      });
      const score = (text, dt) => scoreText(text || '', { input: sample.input, documentType: dt });
      rows.push({
        id: sample.id,
        observation: score(result.observation, 'observation'),
        notice: score(result.parent, 'notice'),
        dailyReport: score(result.evaluation, 'dailyReport'),
      });
    }
    report = rows;
  });

  const avg = (rows, key) => rows.reduce((a, r) => a + r[key].totalScore, 0) / rows.length;

  test('회귀 baseline: 평균 점수가 측정된 바닥선 이상이다', () => {
    // 측정값(2026-06 기준): obs 90.4 / notice 86.6 / dailyReport 77.6
    expect(avg(report, 'observation')).toBeGreaterThanOrEqual(85);
    expect(avg(report, 'notice')).toBeGreaterThanOrEqual(80);
    expect(avg(report, 'dailyReport')).toBeGreaterThanOrEqual(72);
  });

  test('어떤 출력도 심각한 품질 실패(55점 미만)를 내지 않는다', () => {
    report.forEach((r) => {
      ['observation', 'notice', 'dailyReport'].forEach((dt) => {
        expect(r[dt].totalScore).toBeGreaterThanOrEqual(55);
      });
    });
  });

  // 90점 미만 샘플의 감점 항목을 콘솔에 남겨, 어디서 점수가 빠지는지 추적 가능하게 한다.
  test('품질 리포트: 90점 미만 샘플의 감점 항목을 로그로 남긴다', () => {
    const lines = [];
    const summarize = (dt) => {
      const scores = report.map((r) => r[dt].totalScore);
      const mean = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const below = report.filter((r) => r[dt].totalScore < TARGET).length;
      lines.push(`\n[${dt}] 평균 ${mean} | 75점 미만 ${below}/${report.length}개`);
      report
        .filter((r) => r[dt].totalScore < 90)
        .forEach((r) => {
          const lost = explainDeductions(r[dt]).map((d) => `${d.dimension}-${d.lost}`).join(', ');
          lines.push(`  ${r.id}: ${r[dt].totalScore}점 (감점: ${lost || '없음'})`);
        });
    };
    ['observation', 'notice', 'dailyReport'].forEach(summarize);
    // eslint-disable-next-line no-console
    console.log('\n===== 현재 엔진 품질 리포트 =====' + lines.join('\n') + '\n');
    expect(report.length).toBe(GOLDEN_SAMPLES.length);
  });
});
