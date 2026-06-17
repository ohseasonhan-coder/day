import { buildCombinedCopy, appendExample, QUICK_EXAMPLES, RECORD_COPY_SECTIONS } from './recordCopy';

describe('결과 전체 복사 형식', () => {
  test('라벨을 붙여 [관찰일지 문장]…[교사 지원계획] 순서로 묶는다', () => {
    const result = {
      observation: '관찰 문장.',
      evaluation: '평가 문장.',
      parent: '알림장 문장.',
      support: '지원계획 문장.',
    };
    expect(buildCombinedCopy(result)).toBe(
      '[관찰일지 문장]\n관찰 문장.\n\n[보육일지 평가]\n평가 문장.\n\n[알림장]\n알림장 문장.\n\n[교사 지원계획]\n지원계획 문장.',
    );
  });

  test('빈 섹션은 제외한다', () => {
    const out = buildCombinedCopy({ observation: '관찰.', evaluation: '', parent: '   ', support: '지원.' });
    expect(out).toBe('[관찰일지 문장]\n관찰.\n\n[교사 지원계획]\n지원.');
    expect(out).not.toContain('[보육일지 평가]');
    expect(out).not.toContain('[알림장]');
  });

  test('결과가 없으면 빈 문자열', () => {
    expect(buildCombinedCopy(null)).toBe('');
    expect(buildCombinedCopy({})).toBe('');
  });

  test('섹션 정의는 4종(관찰/평가/알림장/지원계획)이다', () => {
    expect(RECORD_COPY_SECTIONS.map(([, k]) => k)).toEqual(['observation', 'evaluation', 'parent', 'support']);
  });
});

describe('예시 문장 입력', () => {
  test('빈 입력이면 예시를 그대로 넣는다', () => {
    expect(appendExample('', '친구와 놀이했어요')).toBe('친구와 놀이했어요');
    expect(appendExample('   ', '미술놀이를 했어요')).toBe('미술놀이를 했어요');
  });

  test('기존 입력이 있으면 줄바꿈 후 추가한다', () => {
    expect(appendExample('블록을 쌓았다.', '친구와 놀이했어요')).toBe('블록을 쌓았다.\n친구와 놀이했어요');
  });

  test('이미 줄바꿈으로 끝나면 줄바꿈을 중복하지 않는다', () => {
    expect(appendExample('블록을 쌓았다.\n', '친구와 놀이했어요')).toBe('블록을 쌓았다.\n친구와 놀이했어요');
  });

  test('빠른 예시는 6개이며 모두 비어 있지 않다', () => {
    expect(QUICK_EXAMPLES).toHaveLength(6);
    QUICK_EXAMPLES.forEach((ex) => expect(ex.trim().length).toBeGreaterThan(0));
  });
});
