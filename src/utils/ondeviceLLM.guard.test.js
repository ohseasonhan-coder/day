import { passesFactGuard } from './ondeviceLLM';

describe('온디바이스 다듬기 사실 보존 가드', () => {
  const memoQuote = '지우가 "다시 할래"라고 말하며 블록을 다시 쌓았다.';

  test('빈 결과는 거부', () => {
    expect(passesFactGuard({ memo: '지우가 블록을 쌓았다.', original: '지우가 블록을 쌓았다.', refined: '', docType: 'observation' })).toBe(false);
  });

  test('따옴표 속 아이 말이 빠지면 거부', () => {
    const original = '지우가 "다시 할래"라고 말하며 블록을 다시 쌓았다.';
    const refined = '지우가 블록을 다시 정성껏 쌓는 모습을 보였다.'; // 발화 누락
    expect(passesFactGuard({ memo: memoQuote, original, refined, docType: 'observation' })).toBe(false);
  });

  test('발화를 그대로 유지하면 통과', () => {
    const original = '지우가 "다시 할래"라고 말하며 블록을 다시 쌓았다.';
    const refined = '지우는 "다시 할래"라고 말하며 무너진 블록을 다시 차근차근 쌓았다.';
    expect(passesFactGuard({ memo: memoQuote, original, refined, docType: 'observation' })).toBe(true);
  });

  test('환각으로 과도하게 길어지면 거부', () => {
    const original = '지우가 블록을 쌓았다.';
    const refined = '지우가 블록을 쌓았다. ' + '추가로 친구와 노래를 부르고 그림도 그리고 밥도 먹고 산책도 다녀왔으며 매우 길게 늘어난 창작 내용이 계속 이어진다.'.repeat(2);
    expect(passesFactGuard({ memo: original, original, refined, docType: 'observation' })).toBe(false);
  });

  test('발화 없는 입력은 길이·사실 기준만 적용', () => {
    const original = '도윤이가 낮잠 시간에 스스로 이불을 덮고 누웠다.';
    const refined = '도윤이는 낮잠 시간에 스스로 이불을 덮고 누우며 휴식을 준비하였다.';
    expect(passesFactGuard({ memo: original, original, refined, docType: 'observation' })).toBe(true);
  });
});
