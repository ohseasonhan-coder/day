import { buildCopyReadyObservation } from './ai/copyReadyObservation';
import { processRecord } from './ai/index';

describe('복사용 관찰일지(복붙용 3단)', () => {
  test('관찰내용/배움 읽기/교사 지원 라벨로 묶고 순서를 지킨다', () => {
    const out = buildCopyReadyObservation({
      observation: '지우가 블록으로 탑을 쌓았다.',
      evaluation: '유아들은 블록을 활용하여 놀이하며 놀이에 참여하였다.',
      support: '다양한 블록을 제공한다.',
      childName: '지우',
    });
    expect(out).toContain('관찰내용: ');
    expect(out).toContain('배움 읽기: ');
    expect(out).toContain('교사 지원 및 다음 계획: ');
    expect(out.indexOf('관찰내용:')).toBeLessThan(out.indexOf('배움 읽기:'));
    expect(out.indexOf('배움 읽기:')).toBeLessThan(out.indexOf('교사 지원 및 다음 계획:'));
  });

  test('배움 읽기를 원아 중심으로 개인화하고 중복을 정리한다', () => {
    const out = buildCopyReadyObservation({
      observation: '도윤이가 정리했다.',
      evaluation: '유아들은 블록을 활용하여 놀이하며 놀이에 참여하였다.',
      support: '칭찬한다.',
      childName: '도윤',
    });
    expect(out).toContain('도윤은');        // 유아들은 → 도윤은
    expect(out).not.toContain('유아들');     // 비개인화 표현 제거
    expect(out).not.toContain('놀이하며 놀이에 참여'); // 중복 정리
  });

  test('받침 없는 이름은 는 조사로 치환된다', () => {
    const out = buildCopyReadyObservation({ observation: 'x', evaluation: '유아들은 참여하였다.', support: 'y', childName: '지우' });
    expect(out).toContain('지우는');
  });

  test('빈 필드는 건너뛰고, 모두 비면 빈 문자열', () => {
    expect(buildCopyReadyObservation({ observation: '관찰만', evaluation: '', support: '' })).toBe('관찰내용: 관찰만');
    expect(buildCopyReadyObservation({})).toBe('');
  });

  test('processRecord 결과 copyReady에 관찰/지원이 그대로 담긴다', async () => {
    const r = await processRecord({ childName: '지우', rawText: '지우가 블록으로 탑을 쌓다가 무너지자 다시 쌓았다.', classAge: '4', recordType: 'observe', tone: 'warm' });
    expect(typeof r.copyReady).toBe('string');
    expect(r.copyReady).toContain('관찰내용: ');
    expect(r.copyReady).toContain('교사 지원 및 다음 계획: ');
    expect(r.copyReady).toContain(r.observation);
    expect(r.copyReady).toContain(r.support);
    expect(r.copyReady).not.toContain('유아들'); // 개인화되어 비개인화 표현 없음
  });
});
