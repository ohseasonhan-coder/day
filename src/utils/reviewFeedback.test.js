// 4단계 회귀 — 교사 검토 모드(로컬 비교·피드백)의 저장·삭제·집계·개인정보 규칙 검증.
import {
  REVIEW_KEYS, MAX_REVIEW_ENTRIES, FEEDBACK_OPTIONS,
  isReviewModeEnabled, setReviewMode, toggleFeedbackSelection,
  saveReviewEntry, getReviewEntries, clearReviewData,
  computeEditStats, buildComparison, buildReviewReport,
} from './reviewFeedback';
import { SYNC_EXCLUDED_KEYS } from './storage';

const RESULT = {
  observation: '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.',
  evaluation: '유아들은 쌓기 놀이에 참여하며 소근육 조절을 경험하였다.',
  support: '다양한 크기의 블록을 제공하고 시도 과정을 말로 짚어 준다.',
  copyReady: '[관찰내용]\n지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.\n\n[배움 읽기]\n지우는 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.\n\n[교사 지원 및 다음 계획]\n다양한 크기의 블록을 제공하고 시도 과정을 말로 짚어 준다.',
};
const INPUT = '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.';

beforeEach(() => localStorage.clear());

describe('feature flag — 기본 OFF(기존 화면 불변 보장)', () => {
  test('플래그가 없으면 검토 모드는 꺼져 있다', () => {
    expect(isReviewModeEnabled()).toBe(false); // RecordPage는 reviewMode && … 게이트이므로 기존 화면 불변
  });
  test('켜고 끌 수 있다', () => {
    setReviewMode(true);
    expect(isReviewModeEnabled()).toBe(true);
    setReviewMode(false);
    expect(isReviewModeEnabled()).toBe(false);
  });
});

describe('A안/B안 비교 데이터', () => {
  test('같은 입력에서 A안(기존)·B안(개선)이 모두 만들어진다', () => {
    const { A, B } = buildComparison({ result: RESULT, input: INPUT, childName: '지우' });
    expect(A.sections.observation).toBe(RESULT.observation);
    expect(A.sections.learning).toBe(RESULT.evaluation);       // A안 중간 섹션 = 기존 보육일지 평가
    expect(B.sections.learning).toContain('끈기');             // B안 = 3단계 배움 읽기
    expect(A.copyText).toContain('[관찰내용');
    expect(B.copyText).toContain('[배움 읽기]');
    expect(A.audit).toBeTruthy();
    expect(B.audit.ok).toBe(true);                             // 안전 상태 표시용 audit 동봉
    expect(A.audit.warnings).toContain('banned_phrase');       // 기존 평가문('유아들은')은 경고가 드러남 — 비교 포인트
  });
});

describe('피드백 선택 규칙 — "그대로 사용 가능" 배타', () => {
  test('부정 항목 선택 시 그대로 사용 가능이 해제된다', () => {
    let sel = toggleFeedbackSelection([], 'use_as_is');
    expect(sel).toEqual(['use_as_is']);
    sel = toggleFeedbackSelection(sel, 'need_natural');
    expect(sel).toEqual(['need_natural']);                     // 동시 선택 불가
    sel = toggleFeedbackSelection(sel, 'minor_wording');
    expect(sel.sort()).toEqual(['minor_wording', 'need_natural']); // 부정끼리는 복수 가능
    sel = toggleFeedbackSelection(sel, 'use_as_is');
    expect(sel).toEqual(['use_as_is']);                        // 반대 방향도 배타
  });
});

describe('로컬 저장 — 화이트리스트·200건 제한·키 분리', () => {
  test('피드백이 로컬에 저장되고 원문·이름은 저장되지 않는다', () => {
    saveReviewEntry({ kind: 'feedback', resultId: 'rev_1', docType: 'observe', variant: 'B', selections: ['use_as_is'], memo: '좋아요', auditCodes: [], rawText: INPUT, childName: '지우', observation: RESULT.observation });
    const list = getReviewEntries();
    expect(list).toHaveLength(1);
    const raw = localStorage.getItem(REVIEW_KEYS.DATA);
    expect(raw).not.toContain('블록으로 높은 탑');             // 원문 미저장
    expect(raw).not.toContain('지우가');                       // 이름 포함 원문 미저장
    expect(list[0].selections).toEqual(['use_as_is']);
  });

  test('최근 200건만 보관한다', () => {
    for (let i = 0; i < MAX_REVIEW_ENTRIES + 30; i += 1) {
      saveReviewEntry({ kind: 'feedback', resultId: `rev_${i}`, variant: 'B', selections: ['minor_wording'] });
    }
    const list = getReviewEntries();
    expect(list).toHaveLength(MAX_REVIEW_ENTRIES);
    expect(list[0].resultId).toBe(`rev_${MAX_REVIEW_ENTRIES + 29}`); // 최신 우선 보관
  });

  test('검토 키는 일반 기록 키와 분리되고 동기화 제외 목록에 있다', () => {
    Object.values(REVIEW_KEYS).forEach((k) => expect(k.startsWith('sw_review_')).toBe(true));
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining(['sw_review_entries', 'sw_review_mode', 'sw_review_notice_seen']));
    // 계정 키 패턴(sw_${uid}_feedback 등)과의 정확 충돌 금지 — uid='review'인 계정 보호
    const accountSuffixes = ['_records', '_children', '_classes', '_documents', '_settings', '_templates', '_draft', '_feedback', '_copy_history', '_trash', '_events', '_consults', '_routines'];
    Object.values(REVIEW_KEYS).forEach((k) => {
      accountSuffixes.forEach((suf) => expect(k).not.toBe(`sw_review${suf}`));
    });
  });

  test('검토 데이터 삭제 — 일반 데이터는 남고 검토 데이터만 지워진다', () => {
    localStorage.setItem('records', JSON.stringify([{ id: 1 }])); // 일반 기록(별도 키)
    saveReviewEntry({ kind: 'feedback', resultId: 'rev_1', variant: 'A', selections: ['fact_mismatch'] });
    clearReviewData();
    expect(getReviewEntries()).toHaveLength(0);
    expect(localStorage.getItem('records')).not.toBeNull();     // 일반 기록 보존
  });
});

describe('수정 전후 비교(파생 통계만)', () => {
  test('수정 여부·길이·변경 섹션을 계산한다', () => {
    const original = { observation: 'ㄱ'.repeat(10), evaluation: '평가', support: '지원' };
    const final = { observation: 'ㄱ'.repeat(16), evaluation: '평가', support: '지원 계획을 더 구체화' };
    const s = computeEditStats(original, final);
    expect(s.edited).toBe(true);
    expect(s.editedSections.sort()).toEqual(['observation', 'support']);
    expect(s.editLen).toBeGreaterThan(0);
  });
  test('수정 없으면 edited=false', () => {
    const same = { observation: 'a', evaluation: 'b', support: 'c' };
    expect(computeEditStats(same, { ...same }).edited).toBe(false);
  });
});

describe('로컬 리포트 — 집계 정확성·원문 미출력', () => {
  test('KPI가 정확히 집계된다', () => {
    // A안: 2건 중 use_as_is 1 → 50%, B안: 2건 모두 use_as_is → 100%
    saveReviewEntry({ kind: 'feedback', resultId: 'r1', variant: 'A', selections: ['use_as_is'] });
    saveReviewEntry({ kind: 'feedback', resultId: 'r2', variant: 'A', selections: ['fact_mismatch', 'need_natural'], auditCodes: ['speech_lost'] });
    saveReviewEntry({ kind: 'feedback', resultId: 'r1', variant: 'B', selections: ['use_as_is'] });
    saveReviewEntry({ kind: 'feedback', resultId: 'r2', variant: 'B', selections: ['use_as_is'] });
    saveReviewEntry({ kind: 'preference', resultId: 'r1', preferred: 'B' });
    saveReviewEntry({ kind: 'preference', resultId: 'r2', preferred: 'same' });
    saveReviewEntry({ kind: 'edit', resultId: 'r1', variant: 'A', edited: true, editLen: 24, editedSections: ['observation'] });
    saveReviewEntry({ kind: 'edit', resultId: 'r2', variant: 'A', edited: false, editLen: 0, editedSections: [] });
    const r = buildReviewReport(getReviewEntries());
    expect(r.feedbackCount).toBe(4);
    expect(r.A.useAsIsRate).toBe(50);
    expect(r.B.useAsIsRate).toBe(100);
    expect(r.A.factMismatchRate).toBe(50);
    expect(r.preference.bPreferredRate).toBe(50);              // B 1 / 응답 2
    expect(r.editing.editedRate).toBe(50);
    expect(r.editing.avgEditLen).toBe(12);
    expect(r.editing.sectionFocus.observation).toBe(1);
    expect(r.factCauses[0]).toEqual({ code: 'speech_lost', count: 1 });
    expect(r.recentPatterns.find((p) => p.key === 'use_as_is').count).toBe(3);
  });

  test('리포트 출력에 원문·메모가 포함되지 않는다', () => {
    saveReviewEntry({ kind: 'feedback', resultId: 'r1', variant: 'B', selections: ['fact_mismatch'], memo: '아이 이름이 이상해요', rawText: INPUT });
    const out = JSON.stringify(buildReviewReport(getReviewEntries()));
    expect(out).not.toContain('아이 이름이 이상해요');          // 메모 미출력
    expect(out).not.toContain('블록으로 높은 탑');              // 원문 미출력
  });
});
