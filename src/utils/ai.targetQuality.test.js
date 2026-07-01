// 2.5단계 회귀 — 안전 점수(Safety)와 목표 품질 점수(Target Alignment/Copy-Ready)의 분리 검증.
import { parseTargetSections, scoreTargetAlignment, scoreCopyReady } from './ai/targetQuality';
import { dedupeByInput, aggregate } from './ai/reportAggregate';
import { auditObservationCopy } from './ai/observationAudit';
import { buildAuditedCopyReady } from './ai/copyReadyObservation';

const INPUT = 'A원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.';
const TARGET = {
  observation: '쌓기 영역에서 A원아는 블록으로 높은 탑을 쌓던 중 무너지자 다시 차근차근 쌓았다.',
  learning: '무너져도 놀이를 중단하지 않고 다시 시도하며 문제를 해결해 가는 과정을 보였다.',
  support: '다양한 블록을 제공하고, 시도 과정을 언어로 격려한다.',
};
const GEN_GROUNDED = {
  observation: 'A원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.',
  learning: 'A원아는 뜻대로 되지 않는 순간에도 다시 시도를 이어 가며 끈기를 보였다.',
  support: '다양한 크기의 블록을 제공하고 시도 과정을 말로 짚어 준다.',
  childName: 'A원아',
};
const GEN_GENERIC = {
  observation: 'A원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.',
  learning: 'A원아는 관심 있는 놀이에 몰입하며 자신의 방식으로 경험을 넓혀 갔다.', // 안전하지만 일반적
  support: '다양한 크기의 블록을 제공하고 시도 과정을 말로 짚어 준다.',
  childName: 'A원아',
};

describe('목표 섹션 파싱', () => {
  test('콜론·대괄호 두 형식 모두 3섹션 분해', () => {
    const colon = '관찰내용: 가 블록을 쌓았다.\n배움 읽기: 끈기를 보였다.\n교사 지원 및 다음 계획: 블록을 제공한다.';
    const bracket = '[관찰내용]\n가 블록을 쌓았다.\n\n[배움 읽기]\n끈기를 보였다.\n\n[교사 지원 및 다음 계획]\n블록을 제공한다.';
    [colon, bracket].forEach((t) => {
      const s = parseTargetSections(t);
      expect(s.observation).toContain('블록을 쌓았다');
      expect(s.learning).toContain('끈기');
      expect(s.support).toContain('제공한다');
    });
  });
});

describe('안전 점수와 목표 품질 점수 분리', () => {
  test('안전은 100이어도 목표 정렬은 100 미만일 수 있다(독립 계산)', () => {
    // 일반적 배움 읽기: 사실 추가·금지표현 없음 → Safety 100
    const safety = auditObservationCopy({ input: INPUT, observation: GEN_GENERIC.observation, learning: GEN_GENERIC.learning, support: GEN_GENERIC.support, childName: 'A원아' });
    const target = scoreTargetAlignment({ input: INPUT, gen: GEN_GENERIC, target: TARGET });
    expect(safety.pasteScore).toBe(100);      // 안전·사실성 통과
    expect(target.score).toBeLessThan(100);   // 그러나 목표 대비 품질은 낮음
  });

  test('안전하지만 일반적인 문장은 근거 있는 문장보다 목표 점수가 낮다', () => {
    const grounded = scoreTargetAlignment({ input: INPUT, gen: GEN_GROUNDED, target: TARGET }).score;
    const generic = scoreTargetAlignment({ input: INPUT, gen: GEN_GENERIC, target: TARGET }).score;
    expect(grounded).toBeGreaterThan(generic + 5);
  });
});

describe('문장이 달라도 사실·역할이 적절하면 과도 감점하지 않음', () => {
  test('목표와 표현이 달라도 사실 유지 + 근거 해석이면 높은 목표 점수', () => {
    const r = scoreTargetAlignment({ input: INPUT, gen: GEN_GROUNDED, target: TARGET });
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.dimensions.factCore).toBeGreaterThanOrEqual(0.6);
    expect(r.dimensions.learningGrounded).toBe(1);
  });
});

describe('중복 입력이 평균을 왜곡하지 않음 / 입력 같고 목표 다름 분류', () => {
  const low = { input: INPUT, safety: 100, targetScore: 70, copyReady: 100, targetSections: TARGET, alignReasons: ['배움 읽기가 행동 근거 없이 일반적임'] };
  const highs = [1, 2, 3].map((i) => ({ input: `케이스${i} 상황이 달라 고유하다.`, safety: 100, targetScore: 98, copyReady: 100, targetSections: { observation: `${i}`, learning: `${i}`, support: `${i}` }, alignReasons: [] }));

  test('저품질 1건을 20번 복제해도 고유 입력 평균은 왜곡되지 않는다', () => {
    const rows = [...Array(20).fill(low), ...highs];
    const agg = aggregate(rows);
    expect(agg.totals.unique).toBe(4);                       // 고유 입력 4
    expect(agg.withDuplicates.target).toBeLessThan(agg.uniqueInput.target); // 중복이 평균을 끌어내림
    expect(agg.uniqueInput.target).toBeCloseTo((70 + 98 * 3) / 4, 0);       // 고유 기준 평균
  });

  test('입력이 같고 목표가 다르면 별도 분류(sameInputDiffTarget) 된다', () => {
    const a = { input: INPUT, targetSections: { observation: '목표A', learning: 'x', support: 'y' } };
    const b = { input: INPUT, targetSections: { observation: '목표B 다름', learning: 'z', support: 'w' } };
    const dd = dedupeByInput([a, b]);
    expect(dd.uniqueCount).toBe(1);
    expect(dd.sameInputDiffTarget).toBe(1);
  });
});

describe('목표에 금지표현이 있어도 생성 결과는 따라 하지 않음', () => {
  test('목표 배움 읽기에 금지표현이 있어도 생성은 안전 문장을 유지', () => {
    const pollutedTarget = { ...TARGET, learning: '블록을 활용하여 발달 경험과 연결된다.' };
    // 생성은 목표와 무관하게 입력만으로 만들어진다 → 금지표현을 복사하지 않음
    const { copyReady, audit } = buildAuditedCopyReady({ observation: GEN_GROUNDED.observation, support: GEN_GROUNDED.support, input: INPUT, childName: 'A원아' });
    expect(copyReady).not.toContain('활용하여');
    expect(copyReady).not.toContain('발달 경험과 연결');
    expect(audit.metrics.noBanned).toBe(true);
    // 스코어러도 목표의 금지표현 때문에 생성을 감점하지 않는다(목표는 비교 기준일 뿐)
    const s = scoreCopyReady({ observation: GEN_GROUNDED.observation, learning: GEN_GROUNDED.learning, support: GEN_GROUNDED.support });
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(pollutedTarget.learning).toContain('활용하여'); // 목표엔 존재(기준 데이터일 뿐)
  });
});
