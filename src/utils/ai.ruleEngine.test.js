// 6단계 회귀 — 규칙 엔진 5단 파이프라인(사실카드→판정→계획→렌더링→audit) 자유입력 55건 검증.
// v3 합성 장면과 겹치지 않는 사례로, 실제 자유입력 대응력을 상시 검증한다(CI 포함, 빠름).
import { SYNTHETIC_CASES } from './ai/datasets/syntheticCases';
import { buildAuditedCopyReady, buildLearningReading, readLearningSignal, planForInput } from './ai/copyReadyObservation';
import { judgeSituation } from './ai/planner/situationJudge';
import { buildSentencePlan } from './ai/planner/sentencePlanner';
import { THEMES } from './ai/rules/themes';
import { findBlockedClaims, hasBannedPhrase } from './ai/rules/blockedClaims';
import { parseTargetSections, scoreCopyReady, mechanicalHits } from './ai/targetQuality';

const gen = (c) => buildAuditedCopyReady({ observation: c.input, support: '', input: c.input, childName: c.name });

describe('테마 사전 무결성(선언형 규칙)', () => {
  test('모든 테마가 필수 메타데이터와 testCase를 갖는다', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(19);
    THEMES.forEach((th) => {
      expect(th.id).toBeTruthy();
      expect(th.category).toBeTruthy();
      expect(th.trigger).toBeInstanceOf(RegExp);
      expect(Array.isArray(th.learningVariants)).toBe(true);
      expect(th.learningVariants.length).toBeGreaterThanOrEqual(1);
      expect(th.supportVariants.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(th.blockedClaims)).toBe(true);
      expect(th.testCases.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('각 테마의 testCase 입력이 해당 테마로 판정된다', () => {
    THEMES.forEach((th) => {
      th.testCases.forEach((tc) => {
        const input = /친구|또래/.test(tc) || !th.needPeer ? tc : `${tc} 친구와 함께`;
        const { primary, secondary } = judgeSituation(input);
        const ids = [primary?.id, secondary?.id];
        expect(ids).toContain(th.id);
      });
    });
  });

  test('모든 테마 변형(배움·지원)이 금지 표현·금지 주장을 포함하지 않는다', () => {
    THEMES.forEach((th) => {
      const sample = th.testCases[0];
      th.learningVariants.forEach((v) => {
        const s = v('가온이는', sample);
        expect(hasBannedPhrase(s)).toBe(false);
        expect(findBlockedClaims(s, sample).filter((c) => c.severity === 'major')).toEqual([]);
        expect(s.endsWith('.')).toBe(true);
      });
      th.supportVariants.forEach((s) => {
        expect(hasBannedPhrase(s)).toBe(false);
        expect(/[가-힣]다\.$/.test(s)).toBe(true);          // 완결 문장
        expect(/(았|었|였)다\.$/.test(s)).toBe(false);       // 과거 단정 금지 — 계획 문체(현재형)
      });
    });
  });
});

describe('문장 계획 객체', () => {
  test('계획에 사실·발화·테마·금지 주장이 기록되고 렌더는 계획 밖 의미를 추가하지 않는다', () => {
    const input = '해솔이가 블록 탑이 무너지자 다시 쌓으며 친구에게 "같이 하자"라고 말했다.';
    const plan = buildSentencePlan({ input, childName: '해솔' });
    expect(plan.observationPlan.speech).toEqual(['같이 하자']);
    expect(plan.learningPlan.primaryTheme).toBe('persist');
    expect(plan.learningPlan.secondaryTheme).toBe('share');
    expect(plan.observationPlan.sequence).toBe('persist_then_share');
    expect(plan.learningPlan.blockedClaims.join(' ')).toContain('감정·의도·발달');
    expect(plan.supportPlan.blockedClaims).toContain('교사 지원 완료형 표현'); // 실지원 미입력
  });

  test('감정만 있고 회복 단서가 없으면 계획이 안정 서술을 금지한다', () => {
    const plan = buildSentencePlan({ input: '봄이가 쌓던 탑이 무너지자 울음을 터뜨렸다.', childName: '봄이' });
    expect(plan.meta.emotionOnly).toBe(true);
    expect(plan.learningPlan.blockedClaims.join(' ')).toContain('안정');
  });
});

describe('자유입력 55건 회귀 + 품질 리포트', () => {
  test('전 사례: 사실 보존·금지 차단·역할 분리·결정론', () => {
    const rows = SYNTHETIC_CASES.map((c) => {
      const r = gen(c);
      const sec = parseTargetSections(r.copyReady);
      const cr = scoreCopyReady(sec);
      const signal = readLearningSignal(c.input);
      return { c, r, sec, cr, signal };
    });

    const stats = { major: 0, banned: 0, mech: 0, safe: 0, personalized: 0, dupSet: new Set(), safety: 0, copy: 0 };
    rows.forEach(({ c, r, sec, cr, signal }) => {
      // 1) 중대 오류 0(사실 왜곡 없음 — fallback 후 기준)
      if (r.audit.severity === 'major') stats.major += 1;
      // 2) 금지 표현·주장 0
      if (hasBannedPhrase(r.copyReady)) stats.banned += 1;
      expect(findBlockedClaims(sec.learning, c.input).filter((x) => x.severity === 'major')).toEqual([]);
      // 3) 발화 보존(관찰내용)
      (c.input.match(/"([^"]+)"/g) || []).forEach((q) => expect(r.copyReady).toContain(q));
      // 4) 역할 분리: 배움이 관찰을 그대로 포함하지 않음
      expect(sec.learning).not.toBe(sec.observation);
      // 5) 기계적 표현
      if (mechanicalHits(sec.learning).length || mechanicalHits(sec.support).length) stats.mech += 1;
      if (!signal) stats.safe += 1;
      if (r.audit.metrics.personalized) stats.personalized += 1;
      stats.dupSet.add(sec.learning.replace(c.name, '○'));
      stats.safety += r.audit.pasteScore;
      stats.copy += cr.score;
    });

    // 감정만 사례: 안정·진정 창작 금지 + 감정과 상충하는 '즐거움' 서술 금지
    rows.filter(({ c }) => c.tag === 'emotionOnly').forEach(({ sec }) => {
      expect(sec.learning).not.toMatch(/안정|진정|괜찮아/);
      expect(sec.learning).not.toMatch(/즐/);
    });
    // 갈등 사례: 갈등 테마 감지 + 해결 단정 금지
    rows.filter(({ c }) => c.tag === 'conflict').forEach(({ c, sec }) => {
      expect(readLearningSignal(c.input)?.key).toBe('conflict');
      expect(sec.learning).not.toMatch(/갈등이 해결|배려심|사회성/);
    });
    // 근거 희박: SAFE 폴백 + 창작 없음
    rows.filter(({ c }) => c.tag === 'sparse').forEach(({ c, sec }) => {
      expect(readLearningSignal(c.input)).toBeNull();
      expect(sec.learning).not.toMatch(/친구|또래|"[^"]+"/);
    });
    // 과장 위험: 발달·성취 단정 없음
    rows.filter(({ c }) => c.tag === 'riskBanned').forEach(({ sec }) => {
      expect(sec.learning).not.toMatch(/뛰어나|영리|똑똑|발달하|향상/);
    });
    // 결정론: 같은 입력 = 같은 결과
    const d1 = rows.find(({ c }) => c.id === 'syn50');
    const d2 = rows.find(({ c }) => c.id === 'syn51');
    expect(d1.r.copyReady).toBe(d2.r.copyReady);

    const n = rows.length;
    const uniqueRate = Math.round((stats.dupSet.size / n) * 100);
    const report = {
      사례수: n,
      'Safety 평균': Math.round((stats.safety / n) * 10) / 10,
      'Copy-Ready 평균': Math.round((stats.copy / n) * 10) / 10,
      '자연스러움(기계적 표현 없음)': `${Math.round(((n - stats.mech) / n) * 100)}%`,
      개인화율: `${Math.round((stats.personalized / n) * 100)}%`,
      'SAFE 폴백(일반론) 비율': `${Math.round((stats.safe / n) * 100)}%`,
      신호감지율: `${Math.round(((n - stats.safe) / n) * 100)}%`,
      '배움 문형 고유율': `${uniqueRate}%`,
      '중대 오류': stats.major,
      '금지 표현': stats.banned,
    };
    // eslint-disable-next-line no-console
    console.log('\n===== 규칙 엔진 자유입력 리포트(55건) =====\n', JSON.stringify(report, null, 1));

    // 품질 게이트
    expect(stats.major).toBe(0);
    expect(stats.banned).toBe(0);
    expect(stats.safe / n).toBeLessThanOrEqual(0.2);          // SAFE(일반론) 20% 이하
    expect((n - stats.safe) / n).toBeGreaterThanOrEqual(0.8); // 신호 감지 80% 이상
    expect(stats.safety / n).toBeGreaterThanOrEqual(95);
    expect(uniqueRate).toBeGreaterThanOrEqual(55);            // 배움 문형 고유율(반복 억제)
  }, 30000);

  test('복합 신호: 핵심 하나+보조 하나만(두 문장 이내) + 지원이 상황과 연결', () => {
    const c = SYNTHETIC_CASES.find((x) => x.id === 'syn39');
    const r = gen(c);
    const sec = parseTargetSections(r.copyReady);
    expect((sec.learning.match(/\./g) || []).length).toBeLessThanOrEqual(2); // 최대 두 문장
    expect(sec.learning).toMatch(/시도|끈기/);                                // primary: persist
    expect(sec.support).toMatch(/재료|세우|고쳐|받침/);                       // persist 테마 연결 지원
    expect(sec.support).toMatch(/(한다|돕는다|준다|간다)\.$/);                // 계획 문체
  });

  test('플랜 열람 API가 UI 노출용이 아님을 전제로 계획을 돌려준다', () => {
    const p = planForInput({ input: '가온이 블록 또 무너짐, 다시 함', childName: '가온' });
    expect(p.learningPlan.primaryTheme).toBe('persist');
  });
});
