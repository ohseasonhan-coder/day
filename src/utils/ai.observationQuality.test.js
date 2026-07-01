import { processRecord } from './ai/index';
import { buildCopyReadyObservation, buildLearningReading } from './ai/copyReadyObservation';
import { auditObservationCopy } from './ai/observationAudit';
import { BULK_SAMPLE_RECORDS } from './ai/datasets/bulkSamples';

const nameFromInput = (t) => (String(t).match(/([가-힣]{2,3})(?:이가|가|는)/) || [,'유아'])[1];
async function gen(childName, rawText) {
  const r = await processRecord({ childName, rawText, classAge: '4', recordType: 'observe', tone: 'warm' });
  const learning = buildLearningReading({ input: rawText, childName });
  return { r, learning };
}

describe('관찰일지 품질 회귀 (복붙 수준)', () => {
  test('정상 사례: 3단 완성 + 감사 통과', async () => {
    const { r } = await gen('지우', '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.');
    const audit = auditObservationCopy({ input: '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.', observation: r.observation, learning: buildLearningReading({ input: '지우가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.', childName: '지우' }), support: r.support, childName: '지우' });
    expect(r.copyReady).toContain('[관찰내용]');
    expect(audit.ok).toBe(true);
  });

  test('직접 발화 사례: 아이 말이 관찰내용에 그대로 보존', async () => {
    const input = '수아가 "이건 우리 엄마예요"라고 그림을 가리키며 이야기했다.';
    const { r } = await gen('수아', input);
    expect(r.observation).toContain('"이건 우리 엄마예요"');
    expect(r.copyReady).toContain('"이건 우리 엄마예요"');
    const audit = auditObservationCopy({ input, observation: r.observation, learning: buildLearningReading({ input, childName: '수아' }), support: r.support, childName: '수아' });
    expect(audit.warnings).not.toContain('speech_lost');
  });

  test('또래 상호작용 사례: 관계 흐름으로 읽음', async () => {
    const input = '서연이가 친구에게 크레파스를 빌려주며 함께 그림을 그렸다.';
    const learning = buildLearningReading({ input, childName: '서연' });
    expect(learning).toMatch(/친구|또래/);
  });

  test('교사 지원 미입력 사례: 하지 않은 지원을 했다고 쓰지 않음(계획 문체)', async () => {
    const input = '도윤이가 낮잠 시간에 스스로 이불을 덮고 누웠다.';
    const { r } = await gen('도윤', input);
    // support는 "~한다" 계획 문체여야 하며, 과거형으로 지원했다고 단정하지 않음
    expect(r.support).not.toMatch(/지원하였다|도와주었다|제공하였다|격려하였다/);
    expect(r.copyReady).toContain('[교사 지원 및 다음 계획]');
  });

  test('사실 추가 방지: 입력에 없는 또래/발화를 배움 읽기가 만들지 않음', () => {
    const learning = buildLearningReading({ input: '건우가 색종이를 접어 비행기를 만들었다.', childName: '건우' });
    expect(learning).not.toMatch(/친구|또래/);   // 또래 언급 없음
    expect(learning).not.toMatch(/"[^"]+"/);      // 발화 창작 없음
  });

  test('대량 표본: 복사용에 금지 표현·발화 손실이 없다(감사 0 실패)', async () => {
    const sample = BULK_SAMPLE_RECORDS.slice(0, 120);
    let bad = 0;
    for (const { text } of sample) {
      const name = nameFromInput(text);
      const r = await processRecord({ childName: name, rawText: text, classAge: '4', recordType: 'observe', tone: 'warm' });
      const learning = buildLearningReading({ input: text, childName: name });
      const audit = auditObservationCopy({ input: text, observation: r.observation, learning, support: r.support, childName: name });
      if (!audit.ok) bad++;
    }
    expect(bad).toBe(0);
  });
});
