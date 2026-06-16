import {
  applyPositiveRephrase,
  applyToneToDraft,
  chooseWithoutRecent,
  getRecentSentenceIds,
  makeDocumentReadyText,
  normalizeRecordText,
  rememberSentence,
  resetRepetitionMemory,
  softenRecordText,
} from './ai/index';
import { analyzeRecordInput } from './ai/index';
import { createObservation } from './ai/documentEngines/observationEngine';

test('새 품질 가드는 과장 표현을 초안에서 줄인다', () => {
  const analysis = analyzeRecordInput({
    childName: '하준',
    rawText: '하준이가 블록을 항상 완벽하게 쌓았다. 교사가 지켜보았다.',
    classAge: '4',
  });
  const observation = createObservation({ parsedInput: analysis.parsedInput, categories: analysis.categories });
  expect(observation).not.toContain('항상');
  expect(observation).not.toContain('완벽하게');
});

test('새 문체 어댑터와 문서 준비도 문구를 사용할 수 있다', () => {
  const concise = applyToneToDraft('첫 번째 문장입니다. 두 번째 문장입니다.', {
    tone: 'concise',
    documentType: 'notice',
  });
  expect(concise).not.toContain('두 번째');
  expect(makeDocumentReadyText({ usableFor: ['observation'], documentReady: true })).toContain('관찰일지');
});

test('정규화와 순화 규칙은 별도 모듈로 사용할 수 있고 발화를 보존한다', () => {
  const input = '선생님이 "샘 싫어"라는 말을 들었다. 안잠 뒤척임. 문제행동처럼 보였다.';
  expect(normalizeRecordText(input)).toContain('"샘 싫어"');
  expect(normalizeRecordText(input)).toContain('교사');
  expect(softenRecordText(input)).not.toContain('문제행동');
  expect(applyPositiveRephrase('하지 못했다')).toContain('도움이 필요한 모습');
});

test('반복 방지는 최근 문장 ID를 저장하고 다른 문장을 우선 선택한다', () => {
  resetRepetitionMemory();
  rememberSentence('a');
  expect(getRecentSentenceIds()).toContain('a');
  const picked = chooseWithoutRecent([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]);
  expect(picked.id).toBe('b');
  expect(getRecentSentenceIds()[0]).toBe('b');
});

