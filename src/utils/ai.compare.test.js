import { buildEngineComparison, getComparisonView, pickRecommended, COMPARE_DOC_TYPES } from './ai/engineComparison';
import { recordEngineChoice, getPendingCorrections, clearPendingCorrections } from './ai/userCorrectionLearning';

const SAMPLE = {
  childName: '나윤',
  rawText: '나윤이가 친구에게 "같이 블록 만들래?"라고 말하며 함께 쌓기놀이를 하였고, 교사가 순서를 안내하자 차례를 기다렸다.',
  classAge: '4',
};

describe('문장 엔진 비교 모드 (개발자/검수용)', () => {
  test('비교 모드가 꺼져 있으면 비교 데이터를 생성하지 않는다 (기존 화면 그대로)', async () => {
    const view = await getComparisonView({ enabled: false, ...SAMPLE });
    expect(view.enabled).toBe(false);
    expect(view.results).toBeUndefined();
    // 꺼진 상태에서는 점수·디버그 정보가 전혀 노출되지 않는다.
    expect(JSON.stringify(view)).not.toMatch(/totalScore|qualityScore|modular/);
  });

  test('비교 모드가 켜져 있으면 legacy/modular 결과가 모두 생성된다', async () => {
    const view = await getComparisonView({ enabled: true, ...SAMPLE });
    expect(view.enabled).toBe(true);
    expect(view.results).toHaveLength(COMPARE_DOC_TYPES.length);
    view.results.forEach((r) => {
      expect(typeof r.legacy.text).toBe('string');
      expect(typeof r.modular.text).toBe('string');
      expect(r.modular.text.length).toBeGreaterThan(0);
    });
  });

  test('각 결과의 qualityScore와 세부 지표가 계산된다', async () => {
    const { results } = await buildEngineComparison(SAMPLE);
    results.forEach((r) => {
      [r.legacy.scores, r.modular.scores].forEach((s) => {
        expect(typeof s.totalScore).toBe('number');
        expect(s).toHaveProperty('factPreservation');
        expect(s).toHaveProperty('naturalness');
        expect(s).toHaveProperty('safety');
        expect(s).toHaveProperty('documentFit');
      });
    });
  });

  test('더 높은 점수의 결과가 추천으로 표시된다 (자동 대체 아님)', async () => {
    const { results } = await buildEngineComparison(SAMPLE);
    results.forEach((r) => {
      const expected = r.modular.scores.totalScore >= r.legacy.scores.totalScore ? 'modular' : 'legacy';
      expect(r.recommended).toBe(expected);
    });
    expect(pickRecommended({ totalScore: 80 }, { totalScore: 90 })).toBe('modular');
    expect(pickRecommended({ totalScore: 95 }, { totalScore: 90 })).toBe('legacy');
  });

  test('5종 문서(관찰/보육일지평가/알림장/상담/발달)가 모두 비교된다', async () => {
    const { results } = await buildEngineComparison(SAMPLE);
    expect(results.map((r) => r.key)).toEqual(['observation', 'dailyReport', 'notice', 'counseling', 'development']);
  });

  test('modular 결과에 내부 라벨이 노출되지 않는다', async () => {
    const { results } = await buildEngineComparison(SAMPLE);
    results.forEach((r) => {
      expect(r.modular.text).not.toMatch(/놀이 흐름:|교사 지원:|발달영역:|qualityScore:|modularDrafts:/);
    });
  });

  test('실제 발화가 비교 결과에서 원문 그대로 보존된다', async () => {
    const { results } = await buildEngineComparison(SAMPLE);
    const observation = results.find((r) => r.key === 'observation');
    expect(observation.modular.text).toContain('"같이 블록 만들래?"');
  });
});

describe('사용자 선택/수정 학습 연결 스텁', () => {
  beforeEach(() => clearPendingCorrections());

  test('선택 결과를 기록할 수 있고 최종 문장이 보존된다', () => {
    const entry = recordEngineChoice({
      docType: 'notice', chosenEngine: 'modular',
      legacyText: 'L', modularText: 'M', input: '원문',
    });
    expect(entry.chosenEngine).toBe('modular');
    expect(entry.finalText).toBe('M');
    expect(getPendingCorrections()).toHaveLength(1);
  });

  test('직접 수정한 문장은 edited=true로 기록된다', () => {
    const entry = recordEngineChoice({
      docType: 'observation', chosenEngine: 'modular',
      legacyText: 'L', modularText: 'M', finalText: '교사가 직접 고친 문장',
    });
    expect(entry.edited).toBe(true);
    expect(entry.finalText).toBe('교사가 직접 고친 문장');
  });
});
