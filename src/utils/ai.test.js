// ── 기록 변환 회귀 테스트 ─────────────────────────────────────────────────────
// 과거에 실제로 발생했던 변환 버그가 다시 생기지 않는지 확인합니다.
// ai.js를 수정한 뒤에는 반드시 `npm test`로 이 테스트가 통과하는지 확인하세요.
import { processRecord } from './ai';

const run = (rawText, childName = '하준') =>
  processRecord({ childName, rawText, classAge: '4', recordType: 'observe' });

// 모든 케이스에 공통으로 적용되는 기본 품질 검사
async function expectBasicQuality(rawText, childName = '하준') {
  const res = await run(rawText, childName);
  const outputs = [res.observation, res.parent, res.support];
  outputs.forEach(text => {
    expect(typeof text).toBe('string');
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain('🔚');            // 내부 마커 유출 금지
    expect(text).not.toMatch(/다다[.\s]|다다$/); // 이중 종결어미 금지
    expect(text).not.toContain('보이며에게');     // 치환 규칙 파괴 흔적 금지
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
  // 관찰일지는 문어체 종결
  expect(res.observation).toMatch(/(다|요)[.!]?$/);
  // 관찰일지 평가도 항상 생성되고 발달적 해석 문장이어야 함
  expect(typeof res.evaluation).toBe('string');
  expect(res.evaluation.trim().length).toBeGreaterThan(0);
  expect(res.evaluation).not.toContain('🔚');
  expect(res.evaluation).toMatch(/발달|성장|형성|향상|자라|키워|길러/);
  return res;
}

describe('기록 변환 기본 품질 (전 케이스 공통)', () => {
  const CASES = [
    '하준이가 오늘 많이 아파서 힘들어요 투약을 제대로 하였고, 열이 조금 내렸습니다.',
    '"나도 할래"라고 말하며 완성한 블록을 보여줬어요',
    '친구가 가지고 놀던 장난감을 빼앗았다 친구가 울자 미안하다고 했다',
    '블록놀이 시간에 친구들과 협력해서 높은 탑을 쌓았어요',
    '오늘 점심시간에 스스로 수저를 사용해서 밥을 먹었어요',
    '서아가 블록을 높이 쌓았어요 무너지자 다시 쌓았어요',
    '지우 낮잠 안잠 뒤척임',
    '간식을 먹음 양치를 했음',
    '체온 37.8도 해열제 투약 후 떨어짐',
    '미끄럼틀에서 떨어졌어요 무릎에 가벼운 찰과상',
    '동화책을 읽어달라고 가져왔어요 끝까지 집중해서 들었어요',
    '물감으로 나비를 그렸네요 색을 섞는 것에 관심이 많아요',
  ];

  CASES.forEach(rawText => {
    test(`"${rawText.slice(0, 28)}…" 변환 품질`, async () => {
      await expectBasicQuality(rawText);
    });
  });
});

describe('과거 버그 회귀 방지', () => {
  test('아픈 아이 기록이 시간개념 장면으로 오인되지 않는다', async () => {
    const res = await run('하준이가 오늘 많이 아파서 힘들어요 투약을 제대로 하였고, 열이 조금 내렸습니다.');
    const all = `${res.observation} ${res.parent} ${res.support}`;
    expect(all).not.toContain('시간 개념');
    expect(all).not.toContain('달력');
    // 건강·투약 관련 내용이 살아 있어야 함
    expect(/아파|아프|투약|열이|건강|회복|컨디션/.test(all)).toBe(true);
  });

  test('따옴표 안 아이 발화는 변형되지 않는다', async () => {
    const res = await run('"나도 할래"라고 말하며 완성한 블록을 보여줬어요');
    expect(res.observation).toContain('"나도 할래"');
  });

  test('선생님→교사 치환이 문장을 파괴하지 않는다', async () => {
    const res = await run('속상한 일이 있으면 선생님에게 바로 말했다');
    expect(res.observation).toContain('교사');
    expect(res.observation).not.toContain('선생님');
    expect(res.observation).not.toContain('보이며에게');
  });

  test('내밀었다가 밀었다 순화 규칙에 오염되지 않는다', async () => {
    const res = await run('완성한 그림을 교사에게 내밀었다');
    expect(res.observation).toContain('내밀');
    expect(res.observation).not.toContain('내또래');
  });

  test('양보가 수학(양) 장면으로 오인되지 않는다', async () => {
    const res = await run('친구에게 장난감을 양보했어요');
    expect(res.observation).toContain('양보');
  });

  test('ㅆ받침 해요체가 전부 문어체로 바뀐다 (쌓았어요/채웠어요)', async () => {
    const res1 = await run('서아가 블록을 높이 쌓았어요 무너지자 다시 쌓았어요', '서아');
    expect(res1.observation).not.toContain('쌓았어요');
    const res2 = await run('혼자 단추를 채웠어요');
    expect(res2.observation).not.toContain('채웠어요');
  });

  test('명사형 메모(먹음/했음/뒤척임)가 문어체로 바뀐다', async () => {
    const res = await run('간식을 먹음 양치를 했음');
    expect(res.observation).not.toMatch(/먹음|했음/);
    const res2 = await run('지우 낮잠 안잠 뒤척임', '지우');
    expect(res2.observation).not.toMatch(/지우가\s+지우/); // 이름 중복 금지
  });

  test('숫자 단위 띄어쓰기가 깨지지 않는다 (37.8도)', async () => {
    const res = await run('서아 체온 37.8도 해열제 투약 후 떨어짐', '서아');
    expect(res.observation).not.toContain('37.8 도');
  });

  test('교사 감상(기특했다)이 관찰 동사로 오변환되지 않는다', async () => {
    const res = await run('스스로 자리를 정리했어요 정말 기특했어요');
    expect(res.observation).not.toContain('기특하는');
  });

  test('말투(tone)가 부모 문장 종결과 어휘를 바꾼다', async () => {
    const input = '서아가 혼자 단추를 채웠어요';
    const warm = await processRecord({ childName: '서아', rawText: input, classAge: '4', recordType: 'observe', tone: 'warm' });
    const pro  = await processRecord({ childName: '서아', rawText: input, classAge: '4', recordType: 'observe', tone: 'professional' });
    const formal = await processRecord({ childName: '서아', rawText: input, classAge: '4', recordType: 'observe', tone: 'formal' });
    const report = await processRecord({ childName: '서아', rawText: input, classAge: '4', recordType: 'observe', tone: 'report' });

    // warm: 부모 문장이 일관된 해요체 (합쇼체 종결 없음)
    expect(warm.parent).not.toMatch(/습니다[.!]?(\s|$)/);
    // professional: 합쇼체
    expect(pro.parent).toMatch(/습니다/);
    expect(pro.parent).not.toMatch(/있어요|보이고 있어요/);
    // formal: '원' → '기관' 격식 어휘 + 합쇼체
    expect(formal.parent).not.toContain('원에서');
    expect(formal.parent).toMatch(/습니다/);
    // report: 관찰·평가가 명사형(~음/~함)
    expect(report.evaluation).toMatch(/(음|함)\.?$|있음/);
    expect(report.observation).not.toMatch(/관찰되었다$/);
  });

  test('tone 미지정 시 변환 없이 원본 템플릿을 반환한다', async () => {
    const input = '서아가 혼자 단추를 채웠어요';
    const noTone = await processRecord({ childName: '서아', rawText: input, classAge: '4', recordType: 'observe' });
    expect(typeof noTone.parent).toBe('string');
    expect(noTone.parent.length).toBeGreaterThan(0);
  });

  test('풍부한 입력은 맥락 프레임이 중복되지 않는다', async () => {
    const r = await run('서아가 동화책을 끝까지 집중해서 들었어요', '서아');
    // '책' 주제가 입력에 있으므로 '책과 글자 관련 상황에서' 프레임이 덧붙지 않아야 함
    expect(r.observation).not.toMatch(/책과 글자 관련 상황에서 동화책/);
    expect(r.observation).toContain('동화책');
  });

  test('짧은 입력은 맥락 프레임으로 보완된다', async () => {
    const r = await run('그림 그렸어요', '지우');
    // 짧은 입력엔 프레임(예술 활동에서)이 붙어 완결된 문장이 됨
    expect(r.observation).toMatch(/활동|상황|중|에서/);
  });

  test('목적격 조사(을/를)가 빠진 짧은 표현을 보정한다', async () => {
    const r1 = await run('그림 그렸어요', '지우');
    expect(r1.observation).toContain('그림을');
    const r2 = await run('블록 높이 쌓았어요', '하준');
    expect(r2.observation).toContain('블록을');
    // 이미 조사가 있으면 중복 보정하지 않음
    const r3 = await run('그림을 그렸어요', '서아');
    expect(r3.observation).not.toContain('그림을을');
  });

  test('관찰·부모·지원이 같은 장면을 바라본다 (갈등 상황)', async () => {
    const res = await run('친구가 가지고 놀던 장난감을 빼앗았다 친구가 울자 미안하다고 했다');
    const all = `${res.observation} ${res.parent} ${res.support}`;
    // 갈등/사회관계 맥락이 유지되어야 함
    expect(/친구|또래|마음|갈등|양보|배려/.test(all)).toBe(true);
  });
});
