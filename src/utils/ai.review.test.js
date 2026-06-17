import { recordEngineChoice, getEngineReviews, clearEngineReviews } from './ai/userCorrectionLearning';
import { buildReviewReport, evaluateSwitchReadiness, canAccessReviewReport, SWITCH_CRITERIA } from './ai/engineReviewReport';

function seed({ documentType, n, selectedEngine = 'modular', recommendedEngine = 'modular', modularTotal = 92, modularFact = 27, safety = 15, edited = false }) {
  for (let i = 0; i < n; i += 1) {
    recordEngineChoice({
      documentType,
      inputText: `메모 ${i} "안녕"`,
      legacyText: 'legacy 결과',
      modularText: 'modular 결과',
      legacyScore: { totalScore: 80, factPreservation: 20, naturalness: 18, safety: 15, documentFit: 16 },
      modularScore: { totalScore: modularTotal, factPreservation: modularFact, naturalness: 20, safety, documentFit: 19 },
      recommendedEngine,
      selectedEngine,
      userEditedText: edited ? 'modular 결과(수정)' : undefined,
      warnings: safety < 15 ? ['부정 표현 순화 필요'] : [],
    });
  }
}

describe('엔진 검수 데이터 로컬 저장', () => {
  beforeEach(() => clearEngineReviews());

  test('선택 시 모든 필드가 로컬에 저장된다', () => {
    recordEngineChoice({
      recordId: 'rec-1', documentType: 'notice', inputText: '윤재가 블록을 쌓았다',
      legacyText: 'L', modularText: 'M',
      legacyScore: { totalScore: 81 }, modularScore: { totalScore: 95 },
      recommendedEngine: 'modular', selectedEngine: 'modular',
      tags: ['사회관계'], category: '사회관계', warnings: [],
    });
    const all = getEngineReviews();
    expect(all).toHaveLength(1);
    const e = all[0];
    expect(e.recordId).toBe('rec-1');
    expect(e.documentType).toBe('notice');
    expect(e.selectedEngine).toBe('modular');
    expect(e.recommendedEngine).toBe('modular');
    expect(e.legacyScore.totalScore).toBe(81);
    expect(e.modularScore.totalScore).toBe(95);
    expect(e.finalText).toBe('M');
    expect(e.selectedAt).toBeTruthy();
    expect(e.tags).toEqual(['사회관계']);
  });

  test('사용자가 수정하면 edited=true와 수정문이 저장된다', () => {
    recordEngineChoice({
      documentType: 'observation', legacyText: 'L', modularText: 'M',
      selectedEngine: 'modular', userEditedText: '교사가 직접 고친 문장',
    });
    const e = getEngineReviews()[0];
    expect(e.edited).toBe(true);
    expect(e.userEditedText).toBe('교사가 직접 고친 문장');
    expect(e.finalText).toBe('교사가 직접 고친 문장');
  });

  test('데이터는 외부로 전송되지 않는다(fetch 미호출, localStorage에만 저장)', () => {
    const fetchSpy = jest.fn();
    const original = global.fetch;
    global.fetch = fetchSpy;
    try {
      recordEngineChoice({ documentType: 'notice', legacyText: 'L', modularText: 'M', selectedEngine: 'modular' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getEngineReviews()).toHaveLength(1);
    } finally {
      global.fetch = original;
    }
  });
});

describe('엔진 검수 리포트 통계', () => {
  beforeEach(() => clearEngineReviews());

  test('문서 유형별 검수 건수와 선택률·평균 점수가 계산된다', () => {
    seed({ documentType: 'notice', n: 8, selectedEngine: 'modular' });
    seed({ documentType: 'notice', n: 2, selectedEngine: 'legacy' });
    const report = buildReviewReport();
    const notice = report.types.find((t) => t.key === 'notice');
    expect(notice.count).toBe(10);
    expect(notice.modularSelectRate).toBe(0.8);
    expect(notice.legacySelectRate).toBe(0.2);
    expect(notice.avgModularScore).toBe(92);
    expect(notice.avgLegacyScore).toBe(80);
    expect(notice.scoreDiff).toBe(12);
    expect(notice.legacyChosenCases).toHaveLength(2);
  });

  test('modular 90점 미만 사례와 수정률이 집계된다', () => {
    seed({ documentType: 'development', n: 5, modularTotal: 85 });
    seed({ documentType: 'development', n: 5, modularTotal: 95, edited: true });
    const dev = buildReviewReport().types.find((t) => t.key === 'development');
    expect(dev.lowModular).toHaveLength(5);
    expect(dev.editRate).toBe(0.5);
  });
});

describe('modular 기본 전환 가능 기준', () => {
  beforeEach(() => clearEngineReviews());

  test('기준을 모두 만족하면 전환 가능으로 계산된다', () => {
    seed({ documentType: 'observation', n: SWITCH_CRITERIA.minCount, selectedEngine: 'modular', modularTotal: 92, modularFact: 27, safety: 15 });
    const obs = buildReviewReport().types.find((t) => t.key === 'observation');
    expect(obs.switchReadiness.ready).toBe(true);
    expect(obs.switchReadiness.checks.count).toBe(true);
    expect(obs.switchReadiness.checks.modularSelectRate).toBe(true);
  });

  test('건수가 부족하거나 선택률이 낮으면 전환 불가로 계산된다', () => {
    seed({ documentType: 'counseling', n: 10, selectedEngine: 'modular' }); // 건수 부족
    seed({ documentType: 'dailyReport', n: 30, selectedEngine: 'legacy' });  // 선택률 부족
    const types = buildReviewReport().types;
    expect(types.find((t) => t.key === 'counseling').switchReadiness.ready).toBe(false);
    const daily = types.find((t) => t.key === 'dailyReport').switchReadiness;
    expect(daily.ready).toBe(false);
    expect(daily.checks.modularSelectRate).toBe(false);
  });

  test('safety 경고가 있으면 전환 불가로 계산된다', () => {
    const stat = { count: 40, avgModularScore: 92, modularSelectRate: 0.9, editRate: 0.1, safetyIssues: 3, avgModularFact: 27 };
    expect(evaluateSwitchReadiness(stat).ready).toBe(false);
    expect(evaluateSwitchReadiness(stat).checks.safety).toBe(false);
  });
});

describe('검수 리포트 접근 제어', () => {
  test('일반 사용자는 접근할 수 없고 마스터만 접근 가능하다', () => {
    expect(canAccessReviewReport({ isMaster: false })).toBe(false);
    expect(canAccessReviewReport({ isMaster: false, compareEnabled: true })).toBe(false);
    expect(canAccessReviewReport({ isMaster: true })).toBe(true);
  });
});
