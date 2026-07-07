import {
  FEEDBACK_OPTIONS,
  MAX_REVIEW_ENTRIES,
  REVIEW_KEYS,
  buildComparison,
  buildReviewReport,
  clearReviewData,
  computeEditStats,
  getReviewEntries,
  isReviewModeEnabled,
  saveReviewEntry,
  setReviewMode,
  toggleFeedbackSelection,
  extractTeacherEditMetadata,
} from './reviewFeedback';
import {
  clearTeacherPreferenceProfile,
  getPhraseImprovementCandidates,
  getTeacherPreferenceProfile,
  getTeacherPreferenceWeight,
  recordTeacherPreferenceFeedback,
} from './ai/b4/teacherPreferenceProfile';
import { B4_KEYS } from './ai/b4/config';
import { SYNC_EXCLUDED_KEYS } from './storage';

const RESULT = {
  observation: '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 쌓았다.',
  evaluation: '지우는 다시 시도하며 놀이를 이어 갔다.',
  support: '다시 시도해 볼 시간을 두고 다른 크기의 블록을 함께 놓는다.',
  copyReady: '[관찰내용]\n지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 쌓았다.\n\n[배움 읽기]\n지우는 다시 시도하며 놀이를 이어 갔다.\n\n[교사 지원 및 다음 계획]\n다시 시도해 볼 시간을 두고 다른 크기의 블록을 함께 놓는다.',
};
const INPUT = '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 쌓았다.';

beforeEach(() => localStorage.clear());

describe('review mode flag', () => {
  test('기본값은 OFF이고 토글된다', () => {
    expect(isReviewModeEnabled()).toBe(false);
    setReviewMode(true);
    expect(isReviewModeEnabled()).toBe(true);
    setReviewMode(false);
    expect(isReviewModeEnabled()).toBe(false);
  });
});

describe('review feedback preference metadata hardening', () => {
  const meta = {
    section: 'learning',
    primaryTheme: 'retry',
    secondaryTheme: '',
    discourseRelation: 'retry_after_setback',
    patternId: 'retry_learning_core',
    styleProfile: 'objective',
    rhythmSignature: 'medium|child_subject|process|retry|record_flow|one_sentence|no_speech|objective',
    auditPassed: true,
  };

  test('preferred_result is tracked separately from use_as_is', () => {
    clearTeacherPreferenceProfile();
    for (let i = 0; i < 5; i += 1) {
      recordTeacherPreferenceFeedback({ ...meta, selections: ['preferred_result'], selected: true });
    }
    const entry = getTeacherPreferenceProfile().entries[0];
    expect(entry.preferredCount).toBe(5);
    expect(entry.acceptedCount).toBe(0);
    expect(entry.editedCount).toBe(0);
  });

  test('phrase improvement candidates expose rates and confidence only as metadata', () => {
    clearTeacherPreferenceProfile();
    for (let i = 0; i < 12; i += 1) {
      recordTeacherPreferenceFeedback({
        ...meta,
        section: 'support',
        patternId: '',
        supportPatternId: 'retry_support_plan',
        selections: ['edited_after_use'],
        editTags: ['makeSupportSpecific'],
        selected: i % 3 === 0,
      });
    }
    const candidates = getPhraseImprovementCandidates(getTeacherPreferenceProfile(), { includeInsufficient: false });
    expect(candidates[0]).toMatchObject({
      patternId: 'retry_support_plan',
      supportPatternId: 'retry_support_plan',
      factIssueRate: 0,
      confidence: 'medium',
      metadataOnly: true,
    });
    expect(JSON.stringify(candidates)).not.toContain(INPUT);
    expect(JSON.stringify(candidates)).not.toContain(RESULT.copyReady);
  });
});

describe('comparison builder', () => {
  test('기존 A와 현재 B를 만든다', () => {
    const { A, B } = buildComparison({ result: RESULT, input: INPUT, childName: '지우' });
    expect(A.sections.observation).toBe(RESULT.observation);
    expect(A.title).toBe('기존 B안');
    expect(B.title).toContain('새 규칙');
    expect(A.copyText).toContain('[관찰내용]');
    expect(B.copyText).toContain('[배움 읽기]');
    expect(A.audit).toBeTruthy();
    expect(Array.isArray(B.audit.warnings)).toBe(true);
  });

  test('B4가 있으면 A/B/C를 블라인드로 섞는다', () => {
    const result = {
      ...RESULT,
      b2CopyReady: RESULT.copyReady,
      b2: { enabled: true, trace: { themeIds: ['retry'] } },
      b3: { enabled: true, copyReady: RESULT.copyReady, trace: { themeIds: ['retry'], learningPatternId: 'b3_l', supportPatternId: 'b3_s' } },
      b4: { enabled: true, copyReady: RESULT.copyReady, trace: { themeIds: ['retry'], learningPatternId: 'b4_l', supportPatternId: 'b4_s', relation: 'retry_after_setback', styleProfile: 'objective' } },
    };
    const cmp = buildComparison({ result, input: INPUT, childName: '지우' });
    expect(cmp.blind).toBe(true);
    expect([cmp.A.title, cmp.B.title, cmp.C.title]).toEqual(['안 A', '안 B', '안 C']);
    expect([cmp.A.variant, cmp.B.variant, cmp.C.variant].sort()).toEqual(['A', 'B3', 'C'].sort());
  });
});

describe('feedback selection and storage', () => {
  test('"그대로 사용 가능"은 다른 항목과 배타적이다', () => {
    let selected = toggleFeedbackSelection([], 'use_as_is');
    expect(selected).toEqual(['use_as_is']);
    selected = toggleFeedbackSelection(selected, 'need_natural');
    expect(selected).toEqual(['need_natural']);
    selected = toggleFeedbackSelection(selected, 'minor_wording');
    expect(selected.sort()).toEqual(['minor_wording', 'need_natural']);
    selected = toggleFeedbackSelection(selected, 'use_as_is');
    expect(selected).toEqual(['use_as_is']);
  });

  test('피드백은 로컬에 저장되고 원문·이름·메모·생성 전문은 저장하지 않는다', () => {
    saveReviewEntry({
      kind: 'feedback',
      resultId: 'rev_1',
      docType: 'observe',
      variant: 'C',
      selections: ['use_as_is'],
      memo: '좋아요',
      auditCodes: [],
      rawText: INPUT,
      childName: '지우',
      generatedText: RESULT.copyReady,
      engine: 'rule-b4',
      themeIds: ['retry'],
      discourseRelation: 'retry_after_setback',
      learningPatternId: 'b4_l',
      supportPatternId: 'b4_s',
      styleProfile: 'objective',
    });
    const raw = localStorage.getItem(REVIEW_KEYS.DATA);
    expect(getReviewEntries()).toHaveLength(1);
    expect(raw).toContain('rule-b4');
    expect(raw).toContain('retry_after_setback');
    expect(raw).not.toContain(INPUT);
    expect(raw).not.toContain('지우');
    expect(raw).not.toContain('좋아요');
    expect(raw).not.toContain(RESULT.copyReady);
  });

  test('최근 200건만 보관한다', () => {
    for (let i = 0; i < MAX_REVIEW_ENTRIES + 30; i += 1) {
      saveReviewEntry({ kind: 'feedback', resultId: `rev_${i}`, variant: 'B', selections: ['minor_wording'] });
    }
    const list = getReviewEntries();
    expect(list).toHaveLength(MAX_REVIEW_ENTRIES);
    expect(list[0].resultId).toBe(`rev_${MAX_REVIEW_ENTRIES + 29}`);
  });

  test('검토 저장소는 일반 데이터와 분리되고 동기화 제외 목록에 있다', () => {
    Object.values(REVIEW_KEYS).forEach((key) => expect(key.startsWith('sw_review_')).toBe(true));
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining(['sw_review_entries', 'sw_review_mode', 'sw_review_notice_seen']));
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining([B4_KEYS.TEACHER_PREFERENCE_PROFILE]));
    expect(FEEDBACK_OPTIONS.map((option) => option.key)).toContain('speech_damaged');
    expect(FEEDBACK_OPTIONS.map((option) => option.key)).toEqual(expect.arrayContaining(['edited_after_use', 'preferred_result', 'not_used_hold']));
  });

  test('검토 데이터만 삭제한다', () => {
    localStorage.setItem('records', JSON.stringify([{ id: 1 }]));
    saveReviewEntry({ kind: 'feedback', resultId: 'rev_1', variant: 'A', selections: ['fact_mismatch'] });
    clearReviewData();
    expect(getReviewEntries()).toHaveLength(0);
    expect(localStorage.getItem('records')).not.toBeNull();
  });

  test('수정 후 사용은 수정 유형 태그만 저장하고 수정 전문은 저장하지 않는다', () => {
    const editedCopy = '[관찰내용]\n지우가 블록으로 탑을 다시 쌓았다.\n\n[배움 읽기]\n지우는 다시 시도하며 놀이를 이어 갔다.\n\n[교사 지원 및 다음 계획]\n다음에는 다른 크기의 블록을 가까이에 두고 다시 쌓아 볼 시간을 마련한다.';
    const editMeta = extractTeacherEditMetadata(
      { observation: RESULT.observation, learning: RESULT.evaluation, support: RESULT.support },
      {
        observation: '지우가 블록으로 탑을 다시 쌓았다.',
        learning: '지우는 다시 시도하며 놀이를 이어 갔다.',
        support: '다음에는 다른 크기의 블록을 가까이에 두고 다시 쌓아 볼 시간을 마련한다.',
      },
    );
    expect(editMeta.editTags.length).toBeGreaterThan(0);
    saveReviewEntry({
      kind: 'feedback',
      resultId: 'rev_edit',
      variant: 'C',
      selections: ['edited_after_use'],
      editTags: editMeta.editTags,
      rawText: INPUT,
      generatedText: RESULT.copyReady,
      editedText: editedCopy,
      childName: '지우',
      engine: 'rule-b4',
      learningPatternId: 'retry_learning',
      supportPatternId: 'retry_support',
    });
    const raw = localStorage.getItem(REVIEW_KEYS.DATA);
    expect(raw).toContain('edited_after_use');
    expect(raw).toContain('editTags');
    expect(raw).not.toContain(editedCopy);
    expect(raw).not.toContain(RESULT.copyReady);
    expect(raw).not.toContain(INPUT);
    expect(raw).not.toContain('지우');
  });
});

describe('edit stats and report', () => {
  test('수정 여부와 섹션을 계산한다', () => {
    const original = { observation: '가'.repeat(10), evaluation: '평가', support: '지원' };
    const final = { observation: '가'.repeat(16), evaluation: '평가', support: '지원 계획을 더 구체적으로' };
    const stats = computeEditStats(original, final);
    expect(stats.edited).toBe(true);
    expect(stats.editedSections.sort()).toEqual(['observation', 'support']);
    expect(stats.editLen).toBeGreaterThan(0);
    expect(computeEditStats(final, { ...final }).edited).toBe(false);
  });

  test('표본 부족 권고와 KPI를 집계한다', () => {
    expect(buildReviewReport([]).recommendation).toBe('실제 검토 표본 부족으로 보류');
    saveReviewEntry({ kind: 'feedback', resultId: 'r1', variant: 'A', selections: ['use_as_is'] });
    saveReviewEntry({ kind: 'feedback', resultId: 'r2', variant: 'A', selections: ['fact_mismatch', 'need_natural'], auditCodes: ['speech_lost'] });
    saveReviewEntry({ kind: 'feedback', resultId: 'r1', variant: 'B', selections: ['use_as_is'] });
    saveReviewEntry({ kind: 'feedback', resultId: 'r2', variant: 'B', selections: ['use_as_is'] });
    saveReviewEntry({ kind: 'preference', resultId: 'r1', preferred: 'B' });
    saveReviewEntry({ kind: 'preference', resultId: 'r2', preferred: 'same' });
    saveReviewEntry({ kind: 'edit', resultId: 'r1', variant: 'A', edited: true, editLen: 24, editedSections: ['observation'] });
    saveReviewEntry({ kind: 'edit', resultId: 'r2', variant: 'A', edited: false, editLen: 0, editedSections: [] });
    const report = buildReviewReport(getReviewEntries());
    expect(report.feedbackCount).toBe(4);
    expect(report.A.useAsIsRate).toBe(50);
    expect(report.B.useAsIsRate).toBe(100);
    expect(report.A.factMismatchRate).toBe(50);
    expect(report.preference.bPreferredRate).toBe(50);
    expect(report.editing.editedRate).toBe(50);
    expect(report.editing.avgEditLen).toBe(12);
    expect(report.editing.sectionFocus.observation).toBe(1);
    expect(report.factCauses[0]).toEqual({ code: 'speech_lost', count: 1 });
    expect(report.recentPatterns.find((item) => item.key === 'use_as_is').count).toBe(3);
  });
});

describe('local teacher preference profile', () => {
  const baseMeta = {
    section: 'learning',
    primaryTheme: 'retry',
    secondaryTheme: '',
    discourseRelation: 'retry_after_setback',
    patternId: 'retry_learning_core',
    styleProfile: 'objective',
    rhythmSignature: 'medium|child_subject|process|retry|record_flow|one_sentence|no_speech|objective',
    auditPassed: true,
  };

  test('표본이 부족하면 선호 가중치를 적용하지 않는다', () => {
    clearTeacherPreferenceProfile();
    recordTeacherPreferenceFeedback({ ...baseMeta, selections: ['use_as_is'], selected: true });
    const profile = getTeacherPreferenceProfile();
    const weight = getTeacherPreferenceWeight({
      section: 'learning',
      safe: true,
      primaryTheme: 'retry',
      discourseRelation: 'retry_after_setback',
      patternId: 'retry_learning_core',
    }, { primaryTheme: 'retry', relation: 'retry_after_setback' }, 'objective', profile);
    expect(weight).toBe(0);
  });

  test('그대로 사용 가능은 제한된 양수 가중치로 누적된다', () => {
    clearTeacherPreferenceProfile();
    for (let i = 0; i < 6; i += 1) {
      recordTeacherPreferenceFeedback({ ...baseMeta, selections: ['use_as_is'], selected: true });
    }
    const profile = getTeacherPreferenceProfile();
    const entry = profile.entries[0];
    expect(entry.acceptedCount).toBe(6);
    expect(entry.preferenceWeight).toBeGreaterThan(0);
    expect(entry.preferenceWeight).toBeLessThanOrEqual(8);
    expect(JSON.stringify(profile)).not.toContain(INPUT);
    expect(JSON.stringify(profile)).not.toContain('지우');
  });

  test('사실과 다름은 강한 감점으로 반영되지만 안전 후보가 아니면 가중치를 주지 않는다', () => {
    clearTeacherPreferenceProfile();
    for (let i = 0; i < 5; i += 1) {
      recordTeacherPreferenceFeedback({ ...baseMeta, selections: ['fact_mismatch'], selected: false });
    }
    const profile = getTeacherPreferenceProfile();
    const safeWeight = getTeacherPreferenceWeight({
      section: 'learning',
      safe: true,
      primaryTheme: 'retry',
      discourseRelation: 'retry_after_setback',
      patternId: 'retry_learning_core',
    }, { primaryTheme: 'retry', relation: 'retry_after_setback' }, 'objective', profile);
    const unsafeWeight = getTeacherPreferenceWeight({
      section: 'learning',
      safe: false,
      primaryTheme: 'retry',
      discourseRelation: 'retry_after_setback',
      patternId: 'retry_learning_core',
    }, { primaryTheme: 'retry', relation: 'retry_after_setback' }, 'objective', profile);
    expect(safeWeight).toBeLessThan(0);
    expect(safeWeight).toBeGreaterThanOrEqual(-8);
    expect(unsafeWeight).toBe(0);
  });

  test('반복 수정 경향은 phraseImprovementCandidates로만 집계된다', () => {
    clearTeacherPreferenceProfile();
    for (let i = 0; i < 10; i += 1) {
      recordTeacherPreferenceFeedback({
        ...baseMeta,
        section: 'support',
        patternId: '',
        supportPatternId: 'retry_support_plan',
        selections: ['edited_after_use'],
        editTags: ['makeSupportSpecific'],
        selected: i % 2 === 0,
      });
    }
    const candidates = getPhraseImprovementCandidates(getTeacherPreferenceProfile(), { includeInsufficient: false });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      patternId: 'retry_support_plan',
      supportPatternId: 'retry_support_plan',
      recommendation: 'support_specificity_needed',
      metadataOnly: true,
    });
    expect(JSON.stringify(candidates)).not.toContain('수정');
  });
});
