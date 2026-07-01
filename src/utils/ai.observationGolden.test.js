import { processRecord } from './ai/index';
import { buildLearningReading, buildAuditedCopyReady } from './ai/copyReadyObservation';
import { auditObservationCopy } from './ai/observationAudit';
import { OBSERVATION_GOLDEN, validateGoldenItem } from './ai/datasets/observationGolden';

function auditFor(item, r) {
  const learning = buildLearningReading({ input: item.input, childName: item.factCard?.name });
  return auditObservationCopy({ input: item.input, observation: r.observation, learning, support: r.support, childName: item.factCard?.name });
}
const genFor = (item) => processRecord({ childName: item.factCard?.name || '원아', rawText: item.input, classAge: '4', recordType: 'observe', tone: 'warm' });

describe('골든 데이터셋 구조/개인정보', () => {
  test('회귀 케이스는 input 필수 + 익명 식별자', () => {
    OBSERVATION_GOLDEN.regressionCases.forEach((it) => {
      expect(validateGoldenItem(it, 'regression').ok).toBe(true);
      expect(it.input).toBeTruthy();
      expect(it.factCard.name).toMatch(/원아/); // 실명 아님
    });
  });
  test('정답 예시는 targetCopyReady 필수', () => {
    OBSERVATION_GOLDEN.answerExamples.forEach((it) => expect(validateGoldenItem(it, 'answer').ok).toBe(true));
  });
});

describe('관찰일지 회귀 — 골든 케이스별 audit 통과', () => {
  test('모든 회귀 케이스가 중대 결함 없이 생성된다', async () => {
    for (const it of OBSERVATION_GOLDEN.regressionCases) {
      const r = await genFor(it);
      const a = auditFor(it, r);
      expect(a.severity).not.toBe('major');   // 사실추가·발화손실·낙인·조사오류 없음
      expect(a.metrics.noBanned).toBe(true);
    }
  });

  test('직접 발화: 관찰내용에 발화 그대로 보존', async () => {
    const it = OBSERVATION_GOLDEN.regressionCases.find((x) => x.qualityTags.includes('발화보존'));
    const r = await genFor(it);
    it.factCard.speeches.forEach((q) => expect(r.observation).toContain(q));
    expect(auditFor(it, r).metrics.speechPreserved).toBe(true);
  });

  test('또래: 실제 친구 언급이 있을 때만 관계로 읽음', () => {
    expect(buildLearningReading({ input: 'C원아가 친구에게 크레파스를 빌려주었다.', childName: 'C원아' })).toMatch(/친구|또래/);
  });

  test('지원 미입력: 교사 지원을 과거형으로 단정하지 않음', async () => {
    const it = OBSERVATION_GOLDEN.regressionCases.find((x) => x.qualityTags.includes('지원미입력'));
    const r = await genFor(it);
    expect(r.support).not.toMatch(/지원하였다|도와주었다|제공하였다|격려하였다/);
  });

  test('사실 추가 방지: 입력에 없는 또래·발화·감정을 만들지 않음', async () => {
    const it = OBSERVATION_GOLDEN.regressionCases.find((x) => x.qualityTags.includes('사실추가위험'));
    const learning = buildLearningReading({ input: it.input, childName: it.factCard.name });
    expect(learning).not.toMatch(/친구|또래/);
    expect(learning).not.toMatch(/"[^"]+"/);
  });

  test('이름·조사: 배움 읽기 조사 오류 없음', () => {
    const a = auditObservationCopy({ input: '지우가 블록을 쌓았다.', observation: '지우가 블록을 쌓았다.', learning: buildLearningReading({ input: '지우가 블록을 쌓았다.', childName: '지우' }), support: '블록을 더 제공한다.', childName: '지우' });
    expect(a.warnings).not.toContain('josa_error');
  });
});

describe('audit 우선순위: 경미 경고 / 중대 폴백', () => {
  test('경미 경고: 배움 읽기가 관찰내용을 반복하면 minor 경고', () => {
    const obs = '지우가 블록으로 탑을 쌓았다.';
    const a = auditObservationCopy({ input: obs, observation: obs, learning: obs, support: '블록을 제공한다.', childName: '지우' });
    expect(a.warnings).toContain('learning_repeats_observation');
    expect(a.severity).toBe('minor');
  });

  test('중대 폴백: 발화 손실 시 복사용 관찰내용에 원문 발화를 복원한다', () => {
    const { copyReady, audit } = buildAuditedCopyReady({
      observation: '지우가 무너진 블록을 다시 쌓았다.',           // 발화 누락된 관찰내용
      support: '블록을 더 제공한다.',
      input: '지우가 "다시 할래"라며 무너진 블록을 다시 쌓았다.', // 원문에 발화 존재
      childName: '지우',
    });
    expect(audit.fallbackApplied).toBe(true);
    expect(copyReady).toContain('"다시 할래"');   // 발화 복원
    expect(audit.warnings).not.toContain('speech_lost'); // 폴백 후 통과
  });
});
