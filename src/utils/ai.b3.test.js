import { SYNTHETIC_CASES } from './ai/datasets/syntheticCases';
import { B2_SYNTHETIC_CASES } from './ai/datasets/b2Cases';
import { B3_SYNTHETIC_CASES } from './ai/datasets/b3Cases';
import { B3_CASE_LIBRARY } from './ai/b3/caseLibrary';
import { extractB3FactsShape, findSimilarB3Cases } from './ai/b3/caseSearch';
import { adjustB3, generateB3, getB3FeedbackWeight } from './ai/b3/engine';
import { isB3Enabled, setB3Enabled } from './ai/b3/config';
import { buildB2FactCard, buildB2SentencePlan, generateB2, judgeB2Themes } from './ai/b2/engine';
import { parseTargetSections, scoreCopyReady } from './ai/targetQuality';
import { processRecord } from './ai/publicApi';
import { getReviewEntries, saveReviewEntry } from './reviewFeedback';
import { SYNC_EXCLUDED_KEYS } from './storage';

const ALL = [...SYNTHETIC_CASES, ...B2_SYNTHETIC_CASES, ...B3_SYNTHETIC_CASES];
const runB2 = (item) => generateB2({ input: item.input, childName: item.name, observation: item.input });
const runB3 = (item, mode = 'default') => generateB3({ input: item.input, childName: item.name, observation: item.input, mode });
const normalizeName = (text, name) => String(text || '').replaceAll(name, '<CHILD>');
const generic = (text) => /(관찰된 행동을 자신의 방식으로|추가로 관찰한 뒤|놀이 흐름을 이어 본다)/.test(text);

beforeEach(() => localStorage.clear());

describe('B3 선언형 사례 라이브러리와 검색', () => {
  test('사례는 원문 없이 테마·사실 형태·골격·안전 태그만 가진다', () => {
    expect(B3_CASE_LIBRARY.length).toBeGreaterThanOrEqual(20);
    B3_CASE_LIBRARY.forEach((item) => {
      ['id', 'themes', 'factsShape', 'learningPatternId', 'supportPatternId', 'learningSkeleton', 'supportSkeleton', 'blockedClaims', 'qualityTags'].forEach((key) => expect(item[key]).toBeDefined());
      expect(item).not.toHaveProperty('input');
      expect(item).not.toHaveProperty('childName');
      expect(JSON.stringify(item)).not.toMatch(/[가-힣]{2,4}이가\s/);
    });
  });

  test('검색은 테마·사실 형태·발화·또래·교사 지원·문서·희박 여부를 점수화한다', () => {
    const input = '해솔이가 탑이 무너지자 다시 쌓으며 친구에게 "잡아 줘"라고 말했다.';
    const card = buildB2FactCard({ input, childName: '해솔' });
    const judgment = judgeB2Themes(card);
    const plan = buildB2SentencePlan({ card, judgment, observation: input });
    const search = findSimilarB3Cases({ card, plan, documentType: 'observation' });
    expect(extractB3FactsShape(card)).toEqual(expect.arrayContaining(['failed_attempt', 'retry', 'direct_speech', 'peer_interaction']));
    expect(search.success).toBe(true);
    expect(search.matches[0].themes).toContain('retry');
    expect(search.matches[0].score).toBeGreaterThanOrEqual(58);
    expect(search.matches.length).toBeLessThanOrEqual(5);
  });
});

describe('B3 150건 이상 결정론·안전·품질 회귀', () => {
  test('후보 생성·안전 우선 선택·B2 fallback과 비교 지표를 집계한다', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(150);
    const rows = ALL.map((item) => ({ item, b2: runB2(item), b3: runB3(item) }));
    const accepted = rows.filter(({ b3 }) => b3.engineUsed === 'rule-b3');
    const sparse = rows.filter(({ b3 }) => b3.b2.trace.sparse);
    let candidateTotal = 0; let rejectedTotal = 0; let searchSuccess = 0; let librarySearchUsed = 0; let selectedCaseUsed = 0; let factSafe = 0; let quality = 0;
    const b2Texts = new Set(); const b3Texts = new Set(); const b2Freq = {}; const b3Freq = {}; const skeletons = new Set();
    let b2Generic = 0; let b3Generic = 0;

    rows.forEach(({ item, b2, b3 }) => {
      const repeated = runB3(item);
      expect(b3.copyReady).toBe(repeated.copyReady);
      expect(b3.audit.severity).not.toBe('major');
      expect(b3.sections.observation).toBe(b2.sections.observation);
      (item.input.match(/"[^"]+"/g) || []).forEach((speech) => expect(b3.sections.observation).toContain(speech.replace(/["“”]/g, '')));
      if (b3.trace.caseSearchSuccess) searchSuccess += 1;
      if ((b3.trace.similarCaseIds || []).length) librarySearchUsed += 1;
      if (b3.trace.caseLibraryUsed) selectedCaseUsed += 1;
      if (b3.engineUsed === 'rule-b3') {
        expect(b3.trace.learningCandidateCount).toBeGreaterThanOrEqual(5);
        expect(b3.trace.supportCandidateCount).toBeGreaterThanOrEqual(5);
        expect(b3.trace.selectedSafetyScores.learning).toBeGreaterThanOrEqual(90);
        expect(b3.trace.selectedSafetyScores.support).toBeGreaterThanOrEqual(90);
        candidateTotal += b3.trace.candidateCount;
        rejectedTotal += b3.trace.rejectedCandidates;
        skeletons.add(b3.trace.learningPatternId);
        skeletons.add(b3.trace.supportPatternId);
      }
      if (b3.audit.metrics?.factPreserved !== false && b3.audit.metrics?.speechPreserved !== false) factSafe += 1;
      quality += scoreCopyReady(b3.sections).score;
      const b2Text = normalizeName(b2.sections.learning, item.name);
      const b3Text = normalizeName(b3.sections.learning, item.name);
      b2Texts.add(b2Text); b3Texts.add(b3Text);
      b2Freq[b2Text] = (b2Freq[b2Text] || 0) + 1;
      b3Freq[b3Text] = (b3Freq[b3Text] || 0) + 1;
      if (generic(b2.sections.learning) || generic(b2.sections.support)) b2Generic += 1;
      if (generic(b3.sections.learning) || generic(b3.sections.support)) b3Generic += 1;
    });

    sparse.forEach(({ b3 }) => {
      expect(b3.engineUsed).toBe('rule-b2');
      expect(b3.sections.learning).toBe(b3.b2.sections.learning);
      expect(b3.questions.length).toBeLessThanOrEqual(2);
    });

    const report = {
      cases: rows.length,
      accepted: accepted.length,
      averageCandidateCount: accepted.length ? Math.round(candidateTotal / accepted.length * 10) / 10 : 0,
      candidateSafetyRejectRate: candidateTotal ? Math.round(rejectedTotal / candidateTotal * 1000) / 10 : 0,
      similarCaseSearchSuccessRate: Math.round(searchSuccess / rows.length * 100),
      caseLibraryUseRate: Math.round(librarySearchUsed / rows.length * 100),
      selectedCasePatternRate: Math.round(selectedCaseUsed / rows.length * 100),
      b2ExpressionDuplicateRate: Math.round((1 - b2Texts.size / rows.length) * 100),
      b3ExpressionDuplicateRate: Math.round((1 - b3Texts.size / rows.length) * 100),
      b2GenericRate: Math.round(b2Generic / rows.length * 100),
      b3GenericRate: Math.round(b3Generic / rows.length * 100),
      factPreservationRate: Math.round(factSafe / rows.length * 100),
      sparseConservativeRate: sparse.length ? Math.round(sparse.filter(({ b3 }) => b3.engineUsed === 'rule-b2').length / sparse.length * 100) : 100,
      uniqueSkeletons: skeletons.size,
      topB2Duplicates: Object.entries(b2Freq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topB3Duplicates: Object.entries(b3Freq).sort((a, b) => b[1] - a[1]).slice(0, 5),
      automaticQualityScore: Math.round(quality / rows.length * 10) / 10,
      improvedExamples: rows.filter(({ b2, b3 }) => b3.engineUsed === 'rule-b3' && scoreCopyReady(b3.sections).score > scoreCopyReady(b2.sections).score)
        .slice(0, 5).map(({ item, b2, b3 }) => ({ id: item.id, b2: b2.sections.learning, b3: b3.sections.learning })),
      changedExamples: rows.filter(({ item, b2, b3 }) => ['b3_002', 'b3_017', 'b3_024', 'b3_032', 'b3_033'].includes(item.id) && b3.engineUsed === 'rule-b3' && b3.sections.learning !== b2.sections.learning)
        .slice(0, 5).map(({ item, b2, b3 }) => ({ id: item.id, b2: b2.sections.learning, b3: b3.sections.learning, support: b3.sections.support })),
      saferB2Examples: rows.filter(({ b3 }) => b3.trace.fallbackApplied).slice(0, 5).map(({ item, b3 }) => ({ id: item.id, reason: b3.fallbackReason })),
    };
    // eslint-disable-next-line no-console
    console.log('\n===== B3 CASE ENGINE REPORT =====\n', JSON.stringify(report, null, 2));
    expect(report.factPreservationRate).toBe(100);
    expect(report.sparseConservativeRate).toBe(100);
    expect(report.similarCaseSearchSuccessRate).toBeGreaterThanOrEqual(75);
    expect(report.caseLibraryUseRate).toBeGreaterThanOrEqual(75);
    expect(report.b3ExpressionDuplicateRate).toBeLessThanOrEqual(report.b2ExpressionDuplicateRate);
    expect(report.b3GenericRate).toBeLessThanOrEqual(report.b2GenericRate);
    expect(report.uniqueSkeletons).toBeGreaterThanOrEqual(8);
    expect(report.automaticQualityScore).toBeGreaterThanOrEqual(90);
  });

  test('지정 경계 사례에서 허용되지 않은 의미를 만들지 않는다', () => {
    const byTag = (tag) => B3_SYNTHETIC_CASES.filter((item) => item.tag === tag).map(runB3);
    byTag('emotionOnly').forEach((result) => expect(result.copyReady).not.toMatch(/극복|정서 조절|안정을 찾았다/));
    byTag('metaphor').forEach((result) => expect(result.copyReady).not.toMatch(/상상력이|창의력이|의도|발달/));
    byTag('sparse').forEach((result) => { expect(result.engineUsed).toBe('rule-b2'); expect(result.questions.length).toBeLessThanOrEqual(2); });
    [...byTag('long'), ...byTag('colloquial'), ...byTag('typo')].forEach((result) => expect(result.audit.severity).not.toBe('major'));
  });
});

describe('B3 빠른 조정과 로컬 피드백', () => {
  test('빠른 조정은 같은 B2 계획 안에서 결정론적으로 후보만 다시 선택한다', () => {
    const item = B3_SYNTHETIC_CASES.find((row) => row.id === 'b3_004');
    const base = runB3(item);
    const learning = adjustB3({ input: item.input, childName: item.name, observation: item.input, mode: 'learning' });
    const support = adjustB3({ input: item.input, childName: item.name, observation: item.input, mode: 'support' });
    expect(learning.sections.support).toBe(base.sections.support);
    expect(support.sections.learning).toBe(base.sections.learning);
    ['shorter', 'objective', 'warm', 'learning', 'support', 'speech'].forEach((mode) => {
      const first = runB3(item, mode); const second = runB3(item, mode);
      expect(first.copyReady).toBe(second.copyReady);
      expect(first.audit.severity).not.toBe('major');
      expect(first.trace.themeIds).toEqual(base.trace.themeIds);
    });
    const factsOnly = runB3(item, 'facts_only');
    expect(factsOnly.sections.learning).toBe('');
    expect(factsOnly.sections.support).toBe('');
  });

  test('피드백 가중치는 골격 선호에만 작게 반영되고 사실 오류는 강하게 감점한다', () => {
    const candidate = { id: 'candidate_x', patternId: 'retry_context_compact' };
    const positive = getB3FeedbackWeight(candidate, ['retry'], [{ variant: 'B3', themeIds: ['retry'], learningPatternId: 'retry_context_compact', selections: ['use_as_is'] }]);
    const unsafe = getB3FeedbackWeight(candidate, ['retry'], [{ variant: 'B3', themeIds: ['retry'], learningPatternId: 'retry_context_compact', selections: ['fact_mismatch'] }]);
    expect(positive).toBe(6);
    expect(unsafe).toBe(-30);
    expect(positive).toBeLessThan(90); // 최소 안전 점수를 뒤집을 수 없는 보조 가중치
  });

  test('누적된 사실 오류 피드백은 안전 후보군 안에서 다른 골격을 우선하게 한다', () => {
    const item = B3_SYNTHETIC_CASES.find((row) => row.id === 'b3_001');
    const base = runB3(item);
    localStorage.setItem('sw_review_entries', JSON.stringify([{
      variant: 'B3', themeIds: base.trace.themeIds,
      learningPatternId: base.trace.learningPatternId,
      selections: ['fact_mismatch'],
    }]));
    const adjusted = runB3(item);
    expect(adjusted.trace.selectedSafetyScores.learning).toBeGreaterThanOrEqual(90);
    expect(adjusted.trace.learningPatternId).not.toBe(base.trace.learningPatternId);
  });

  test('B3 검토 저장은 패턴·점수만 보존하고 원문·이름·생성 전문은 버린다', () => {
    saveReviewEntry({
      kind: 'feedback', variant: 'B3', resultId: 'b3_local', themeIds: ['retry'],
      learningPatternId: 'retry_context_compact', supportPatternId: 'retry_material_flow',
      candidateScore: 94.2, selectedCandidateId: 'candidate_1|candidate_2', selections: ['use_as_is'],
      rawText: '가온이가 블록을 다시 쌓았다.', childName: '가온', generatedText: '가온은 다시 시도했다.', speech: '다시 할래',
    });
    const raw = JSON.stringify(getReviewEntries());
    expect(raw).toContain('retry_context_compact');
    expect(raw).not.toContain('가온');
    expect(raw).not.toContain('다시 할래');
    expect(raw).not.toContain('블록을 다시');
  });
});

describe('B3 feature flag 공개 API', () => {
  afterEach(() => setB3Enabled(false));

  test('B2와 분리된 기본 OFF flag이며 켠 경우에만 B3 결과를 적용한다', async () => {
    localStorage.removeItem('sw_b3_case_engine_enabled');
    expect(isB3Enabled()).toBe(false);
    const options = { childName: '해솔', rawText: '해솔이가 탑이 무너지자 다시 블록을 쌓았다.', classAge: 4, recordType: 'observe' };
    const b2 = await processRecord(options);
    expect(b2.b3).toBeNull();
    setB3Enabled(true);
    const b3 = await processRecord(options);
    expect(b3.b3.enabled).toBe(true);
    expect(['rule-b3', 'rule-b2']).toContain(b3.sentenceEngine);
    expect(b3.b2CopyReady).toBeTruthy();
    expect(SYNC_EXCLUDED_KEYS).toContain('sw_b3_case_engine_enabled');
  });
});
