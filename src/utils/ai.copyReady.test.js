import { buildCopyReadyObservation } from './ai/copyReadyObservation';
import { processRecord } from './ai/index';

describe('복사용 관찰일지(3단 라벨)', () => {
  test('관찰내용/배움 읽기/교사 지원 라벨로 묶는다', () => {
    const out = buildCopyReadyObservation({
      observation: '지우가 블록으로 탑을 쌓았다.',
      evaluation: '문제를 해결해 가는 과정을 보였다.',
      support: '다양한 블록을 제공한다.',
    });
    expect(out).toContain('[관찰내용]');
    expect(out).toContain('[배움 읽기]');
    expect(out).toContain('[교사 지원 및 다음 계획]');
    expect(out).toContain('지우가 블록으로 탑을 쌓았다.');
    expect(out).toContain('다양한 블록을 제공한다.');
    // 순서: 관찰내용 → 배움 읽기 → 교사 지원
    expect(out.indexOf('[관찰내용]')).toBeLessThan(out.indexOf('[배움 읽기]'));
    expect(out.indexOf('[배움 읽기]')).toBeLessThan(out.indexOf('[교사 지원 및 다음 계획]'));
  });

  test('빈 필드는 건너뛰고, 모두 비면 빈 문자열', () => {
    expect(buildCopyReadyObservation({ observation: '관찰만 있음', evaluation: '', support: '' }))
      .toBe('[관찰내용]\n관찰만 있음');
    expect(buildCopyReadyObservation({})).toBe('');
  });

  test('새 문장을 만들지 않는다(입력 필드만 포함)', () => {
    const out = buildCopyReadyObservation({ observation: 'AAA', evaluation: 'BBB', support: 'CCC' });
    expect(out.replace(/\[관찰내용\]|\[배움 읽기\]|\[교사 지원 및 다음 계획\]|\s/g, '')).toBe('AAABBBCCC');
  });

  test('processRecord 결과에 copyReady가 포함된다', async () => {
    const r = await processRecord({ childName: '지우', rawText: '지우가 블록으로 탑을 쌓다가 무너지자 다시 쌓았다.', classAge: '4', recordType: 'observe', tone: 'warm' });
    expect(typeof r.copyReady).toBe('string');
    expect(r.copyReady).toContain('[관찰내용]');
    expect(r.copyReady).toContain('[교사 지원 및 다음 계획]');
    // 복사용은 기존 관찰/지원 내용을 그대로 담는다
    expect(r.copyReady).toContain(r.observation);
    expect(r.copyReady).toContain(r.support);
  });
});
