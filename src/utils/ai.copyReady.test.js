import { buildCopyReadyObservation, buildLearningReading } from './ai/copyReadyObservation';
import { processRecord } from './ai/index';

describe('복사용 관찰일지(복붙용 3단)', () => {
  test('[관찰내용]/[배움 읽기]/[교사 지원 및 다음 계획] 블록 형식', () => {
    const out = buildCopyReadyObservation({
      observation: '지우가 블록으로 탑을 쌓다가 무너지자 다시 쌓았다.',
      support: '다양한 블록을 제공한다.',
      input: '지우가 블록으로 탑을 쌓다가 무너지자 다시 쌓았다.',
      childName: '지우',
    });
    expect(out).toContain('[관찰내용]');
    expect(out).toContain('[배움 읽기]');
    expect(out).toContain('[교사 지원 및 다음 계획]');
    expect(out.indexOf('[관찰내용]')).toBeLessThan(out.indexOf('[배움 읽기]'));
    expect(out.indexOf('[배움 읽기]')).toBeLessThan(out.indexOf('[교사 지원 및 다음 계획]'));
    // 라벨 다음 줄에 내용, 블록 사이 빈 줄
    expect(out).toMatch(/\[관찰내용\]\n[^\n]/);
    expect(out).toContain('\n\n[배움 읽기]');
  });

  test('배움 읽기는 원아 중심·근거 기반이며 금지 표현이 없다', () => {
    const learning = buildLearningReading({ input: '도윤이가 블록으로 탑을 쌓다가 무너지자 다시 쌓았다.', childName: '도윤' });
    expect(learning).toContain('도윤은');          // 개인화
    expect(learning).not.toContain('유아들');       // 비개인화 금지
    expect(learning).not.toContain('활용하여 놀이에 참여하였다');
    expect(learning).not.toContain('발달 경험과 연결된다');
    expect(learning).toMatch(/끈기|시도/);          // '무너지자 다시' → 근거 기반 끈기 읽기
  });

  test('또래 신호는 실제 친구/또래 언급이 있을 때만 관계로 읽는다', () => {
    expect(buildLearningReading({ input: '서연이가 친구에게 크레파스를 빌려주었다.', childName: '서연' })).toMatch(/또래|친구/);
    // 친구 언급 없는 '번갈아'는 또래로 읽지 않음
    expect(buildLearningReading({ input: '연우가 두 발을 번갈아 계단을 올랐다.', childName: '연우' })).not.toMatch(/또래 관계를 넓혀/);
  });

  test('빈 값은 건너뛴다', () => {
    expect(buildCopyReadyObservation({})).toBe('');
    const only = buildCopyReadyObservation({ observation: '관찰만 있음.', input: '관찰만 있음.', childName: '지우' });
    expect(only).toContain('[관찰내용]\n관찰만 있음.');
  });

  test('processRecord 결과 copyReady에 관찰 사실이 그대로 담긴다', async () => {
    const r = await processRecord({ childName: '지우', rawText: '지우가 "다시 할래"라며 무너진 블록을 다시 쌓았다.', classAge: '4', recordType: 'observe', tone: 'warm' });
    expect(typeof r.copyReady).toBe('string');
    expect(r.copyReady).toContain('[관찰내용]');
    expect(r.copyReady).toContain(r.observation);         // 관찰 사실 보존
    expect(r.copyReady).toContain('"다시 할래"');          // 발화 보존
    expect(r.copyReady).not.toContain('유아들');
  });
});
