import {
  analyzeRecordInput,
  analyzeScene,
  buildObservationFrame,
  formatDocumentUseLabels,
  getDocumentUseLabel,
  getDocumentUsesForCategory,
  parseInput,
} from './ai/index';

const sample = {
  childName: '하준',
  rawText: '하준이가 친구와 블록을 함께 쌓다가 "나도 할래"라고 말했고, 교사가 순서를 안내하자 다시 기다렸다.',
  classAge: '4',
};

test('입력 정규화는 실제 발화 안의 표현을 바꾸지 않는다', () => {
  const parsed = parseInput({
    childName: '하준',
    rawText: '선생님이 순서를 안내하자 "샘 나도 할래"라고 말했다. 안잠 뒤척임.',
  });
  expect(parsed.normalizedText).toContain('교사');
  expect(parsed.normalizedText).toContain('"샘 나도 할래"');
  expect(parsed.normalizedText).toContain('잠들지 않음');
});

test('새 분석 결과에 발달영역, 태그, 문서 활용 정보가 포함된다', () => {
  const analysis = analyzeRecordInput(sample);
  expect(Array.isArray(analysis.devAreas)).toBe(true);
  expect(Array.isArray(analysis.tags)).toBe(true);
  expect(Array.isArray(analysis.documentUses)).toBe(true);
  expect(analysis.devAreas.length).toBeGreaterThan(0);
  expect(analysis.tags).toEqual(expect.arrayContaining(['실제발화']));
  expect(analysis.documentUses).toEqual(expect.arrayContaining(['observation', 'dailyReport']));
  expect(analysis.documentMeta.engine).toBe('local-rule-modular');
  expect(analysis.documentReadyText).toContain('활용 가능 문서');
});

test('장면 분석과 관찰 프레임을 새 모듈로 사용할 수 있다', () => {
  const analysis = analyzeRecordInput({
    childName: '하준',
    rawText: '하준이가 친구와 블록을 함께 쌓다가 친구가 가져가자 울었다. 교사가 감정을 말로 표현하도록 도왔다.',
    classAge: '4',
  });
  expect(analysis.scene.primary.id).toBeTruthy();
  expect(analyzeScene(analysis.parsedInput).primary.id).toBeTruthy();
  const frame = buildObservationFrame({
    parsedInput: analysis.parsedInput,
    scene: analysis.scene,
  });
  expect(frame).toContain('하준');
  expect(frame).toContain('교사');
});

test('문서 활용 매핑은 공통 documentMeta 모듈에서 제공된다', () => {
  expect(getDocumentUsesForCategory('peer', 'consult')).toEqual(expect.arrayContaining(['parentConsult']));
  expect(getDocumentUsesForCategory('special', 'special')).toEqual(expect.arrayContaining(['safetyEvaluation', 'eventEvaluation']));
  expect(getDocumentUsesForCategory('놀이')).toEqual(expect.arrayContaining(['observation']));
});

test('문서 활용 라벨은 공통 documentMeta 모듈에서 제공된다', () => {
  expect(getDocumentUseLabel('dailyJournal')).toBe('보육일지');
  expect(formatDocumentUseLabels(['observation', 'parentConsult'])).toContain('관찰일지');
  expect(formatDocumentUseLabels(['observation', 'parentConsult'])).toContain('부모상담자료');
});

