import { analyzeRecordInput, processRecord } from './ai/index';
import { scoreText, explainDeductions, DIMENSION_MAX, detectsTeacherSupport } from './ai/qualityScorer';
import { GOLDEN_SAMPLES, GOLDEN_DOCUMENT_TYPES } from './ai/datasets/goldenSamples';
import { SENTENCE_DATASET, SENTENCE_TYPES, listBannedHits } from './ai/datasets/sentenceDataset';
import { composeEvaluation, extractEvaluationElements } from './ai/documentEngines/evaluationComposer';

// 입력 메모에서 아이 이름(첫 한글 2~3자) 추출
function nameFromInput(input) {
  const m = String(input).match(/^([가-힣]{2,3})이?(?:가|는|네)/);
  return m ? m[1] : '유아';
}
// 골든 입력으로 보육일지 평가 문장 생성
function evalFor(sample) {
  const childName = nameFromInput(sample.input);
  const analysis = analyzeRecordInput({ childName, rawText: sample.input, classAge: '4' });
  return composeEvaluation({ childName, input: sample.input, categories: analysis.categories });
}

const INTERNAL_LABEL_RE = /놀이 흐름:|교사 지원:|발달영역:|평가:|소재:/;

describe('qualityScorer 채점기', () => {
  test('채점 항목 가중치 합이 100점이다', () => {
    expect(Object.values(DIMENSION_MAX).reduce((a, b) => a + b, 0)).toBe(100);
  });

  test('골든 기대 출력은 모든 문서 유형에서 85점 이상이다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      GOLDEN_DOCUMENT_TYPES.forEach((dt) => {
        const r = scoreText(sample.expected[dt], { input: sample.input, documentType: dt });
        expect(r.totalScore).toBeGreaterThanOrEqual(85);
      });
    });
  });

  test('부정 사실을 긍정으로 미화하면 70점 미만이고 경고가 나온다', () => {
    const sample = GOLDEN_SAMPLES.find((s) => s.id === 'sample_fact_015');
    const r = scoreText('하준이는 그리기 활동에 적극적으로 참여하며 즐겁게 활동하였다.', {
      input: sample.input, documentType: 'observation',
    });
    expect(r.totalScore).toBeLessThan(70);
    expect(r.warnings.join(' ')).toMatch(/미화|발화/);
  });

  test('교사 지원을 다양한 표현으로 감지한다', () => {
    [
      '교사가 자료를 마련하였다.',
      '교사는 안전하게 놀이할 수 있도록 공간을 확보하였다.',
      '교사의 지원을 통해 놀이가 이어졌다.',
      '교사의 안내에 따라 줄을 섰다.',
      '교사는 놀이가 이어질 수 있도록 도왔다.',
      '교사는 함께 방법을 제안하였다.',
    ].forEach((t) => expect(detectsTeacherSupport(t)).toBe(true));
    expect(detectsTeacherSupport('유아가 블록을 쌓았다.')).toBe(false);
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

  test('모든 문장은 필수 필드를 갖추고 금지 표현이 없다', () => {
    SENTENCE_DATASET.forEach((s) => {
      expect(typeof s.id).toBe('string');
      expect(SENTENCE_TYPES).toContain(s.type);
      expect(s.riskLevel).toBe('safe');
      expect(listBannedHits(s.text)).toEqual([]);
    });
  });

  test('문장 id는 중복되지 않는다', () => {
    const ids = SENTENCE_DATASET.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('보육일지 평가(evaluation) 전용 문장이 충분히 있다', () => {
    expect(SENTENCE_DATASET.filter((s) => s.type === 'evaluation').length).toBeGreaterThanOrEqual(80);
  });
});

describe('보육일지 평가 composer', () => {
  test('입력의 핵심 소재가 평가 문장에서 사라지지 않는다', () => {
    const cases = [
      { input: '아이들이 팽이를 돌리며 누가 오래 도는지 겨루었다.', keep: '팽이' },
      { input: '윤재가 블록으로 높은 탑을 쌓았다.', keep: '블록' },
      { input: '지우가 물감을 섞어 색을 만들며 그림을 그렸다.', keep: '물감' },
      { input: '아이들이 나뭇잎을 주워 모양을 비교하였다.', keep: '나뭇잎' },
      { input: '비상벨 소리를 듣고 안전교육에 참여해 대피해 보았다.', keep: '비상벨' },
      { input: '서아가 인라인스케이트를 신고 미끄러지듯 나아갔다.', keep: '인라인스케이트' },
    ];
    cases.forEach(({ input, keep }) => {
      const text = composeEvaluation({ input, categories: [] });
      expect(text).toContain(keep);
    });
  });

  test('교사 지원이 평가 문장에 포함되고 qualityScorer가 이를 감지한다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      const text = evalFor(sample);
      expect(text).toMatch(/교사/);
      expect(detectsTeacherSupport(text)).toBe(true);
    });
  });

  test('내부 라벨이 최종 출력에 남지 않는다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      expect(evalFor(sample)).not.toMatch(INTERNAL_LABEL_RE);
    });
  });

  test('부정·소극적 참여 상황을 과도하게 긍정으로 왜곡하지 않는다', () => {
    ['sample_fact_015', 'sample_passive_010', 'sample_emotion_011', 'sample_conflict_012'].forEach((id) => {
      const sample = GOLDEN_SAMPLES.find((s) => s.id === id);
      const text = evalFor(sample);
      // 어려움을 부드럽게라도 인정하는 표현이 있어야 한다.
      expect(text).toMatch(/편안하지 않은|시간이 필요|조율|속상|살펴보|다가가/);
      // 근거 없는 긍정 스핀이 없어야 한다.
      expect(text).not.toMatch(/적극적으로 참여|즐겁게 참여|활발하게 참여/);
      const r = scoreText(text, { input: sample.input, documentType: 'dailyReport' });
      expect(r.warnings.join(' ')).not.toMatch(/미화/);
    });
  });

  test('평가 문장은 놀이 흐름·교사 지원·발달 경험 중 2개 이상을 포함한다', () => {
    GOLDEN_SAMPLES.forEach((sample) => {
      const text = evalFor(sample);
      const hasPlay = /놀이|활동|소재|탐색|상호작용/.test(text);
      const hasSupport = detectsTeacherSupport(text);
      const hasDevelopment = /경험|발달|영역|지원할 필요/.test(text);
      const count = [hasPlay, hasSupport, hasDevelopment].filter(Boolean).length;
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  test('추출기는 핵심 요소(활동/소재/교사지원)를 노출한다', () => {
    const el = extractEvaluationElements({
      input: '바깥놀이에서 윤재가 블록을 쌓고 친구와 함께 놀았으며, 교사가 안내하였다.',
      categories: ['사회관계'],
    });
    expect(el.activity).toBe('바깥놀이');
    expect(el.materials).toContain('블록');
    expect(el.peerInteraction).toBe(true);
    expect(el.teacherSupport).not.toBeNull();
  });
});

describe('보육일지 평가 품질 (composer 기반)', () => {
  let rows;
  beforeAll(() => {
    rows = GOLDEN_SAMPLES.map((sample) => ({
      id: sample.id,
      result: scoreText(evalFor(sample), { input: sample.input, documentType: 'dailyReport' }),
    }));
  });
  const avg = (key) => rows.reduce((a, r) => a + r.result.detail[key], 0) / rows.length;
  const avgTotal = () => rows.reduce((a, r) => a + r.result.totalScore, 0) / rows.length;

  test('보육일지 평가 평균 점수가 85점 이상이다 (목표 90)', () => {
    expect(avgTotal()).toBeGreaterThanOrEqual(85);
  });

  test('모든 샘플이 80점 이상이다', () => {
    rows.forEach((r) => expect(r.result.totalScore).toBeGreaterThanOrEqual(80));
  });

  test('품질 리포트: 평균과 90점 미만 샘플의 감점 항목을 로그로 남긴다', () => {
    const lines = [
      `평균 ${avgTotal().toFixed(1)} | factPreservation ${avg('factPreservation').toFixed(1)}/30 | documentFit ${avg('documentFit').toFixed(1)}/20`,
    ];
    rows
      .filter((r) => r.result.totalScore < 90)
      .forEach((r) => {
        const lost = explainDeductions(r.result).map((d) => `${d.dimension}-${d.lost}`).join(', ');
        lines.push(`  ${r.id}: ${r.result.totalScore}점 (감점: ${lost || '없음'})`);
      });
    // eslint-disable-next-line no-console
    console.log('\n===== 보육일지 평가(composer) 품질 리포트 =====\n' + lines.join('\n') + '\n');
    expect(rows.length).toBe(GOLDEN_SAMPLES.length);
  });
});

describe('관찰일지·알림장 회귀 baseline (레거시 엔진)', () => {
  let rows;
  beforeAll(async () => {
    rows = [];
    for (const sample of GOLDEN_SAMPLES) {
      // eslint-disable-next-line no-await-in-loop
      const result = await processRecord({
        childName: nameFromInput(sample.input),
        rawText: sample.input,
        classAge: '4',
        recordType: 'observe',
      });
      rows.push({
        id: sample.id,
        observation: scoreText(result.observation || '', { input: sample.input, documentType: 'observation' }),
        notice: scoreText(result.parent || '', { input: sample.input, documentType: 'notice' }),
      });
    }
  });
  const avg = (key) => rows.reduce((a, r) => a + r[key].totalScore, 0) / rows.length;

  test('관찰일지 평균 85점 이상, 알림장 평균 80점 이상을 유지한다', () => {
    expect(avg('observation')).toBeGreaterThanOrEqual(85);
    expect(avg('notice')).toBeGreaterThanOrEqual(80);
  });
});
