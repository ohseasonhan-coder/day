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
import {
  guardRecordResult,
  makeObjectiveText,
  makeWarmNoticeText,
  restoreSpeech,
} from './ai/qualityGuard';

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

// ── 필드별 guard 정책 (관찰 사실 보존 vs 부모 전달 순화) ──

test('관찰일지(observation)는 "거부했다"를 긍정 재구성하지 않고 사실 그대로 보존한다', () => {
  const guarded = guardRecordResult(
    { observation: '유아가 활동을 거부했다. 자리에 앉지 않았다.' },
    { sourceText: '' },
  );
  expect(guarded.observation).toContain('거부했다');
  expect(guarded.observation).not.toContain('참여가 아직 편안하지 않은 모습');
});

test('makeObjectiveText는 관찰용 객관 환원만 하고 부정 사실을 순화하지 않는다', () => {
  const out = makeObjectiveText('유아가 활동을 거부했다.');
  expect(out).toContain('거부했다');
});

test('부모 알림장(parent)은 부정 단정을 부드럽게 순화할 수 있다', () => {
  const guarded = guardRecordResult(
    { parent: '오늘 유아가 활동을 거부했다.' },
    { sourceText: '' },
  );
  expect(guarded.parent).not.toContain('거부했다');
  const warm = makeWarmNoticeText('오늘 활동에서 거부하였다.');
  expect(warm).toContain('아직 참여가 편안하지 않은 모습');
});

test('실제 발화 "안 하고 싶어요?"는 어떤 필드에서도 임의로 바뀌지 않는다', () => {
  const src = '교사가 "안 하고 싶어요?"라고 물었다.';
  const guarded = guardRecordResult(
    {
      observation: '교사가 "안 하고 싶어요?"라고 물었다.',
      parent: '교사가 "안 하고 싶어요?"라고 물었습니다.',
      evaluation: '교사가 "안 하고 싶어요?"라고 물었다.',
    },
    { sourceText: src },
  );
  expect(guarded.observation).toContain('"안 하고 싶어요?"');
  expect(guarded.parent).toContain('"안 하고 싶어요?"');
  expect(guarded.evaluation).toContain('"안 하고 싶어요?"');
});

test('restoreSpeech는 "원문 그대로 보존하였다" 같은 메타 문장을 절대 덧붙이지 않는다', () => {
  const src = '교사가 "하준이는 안하고 싶어요?"라고 물었다.';
  // 발화가 없는 평가 문장에 발화 설명을 추가하면 안 된다
  const evalText = '하준이가 비언어적으로 거부 의사를 나타냈다.';
  const restored = restoreSpeech(evalText, src);
  expect(restored).toBe(evalText);
  expect(restored).not.toContain('원문 그대로 보존하였다');
});

test('하준 사례: 평가(evaluation) 끝에 발화 보존 설명 문장이 붙지 않는다', () => {
  const src = '교사가 "하준이는 안하고 싶어요?"라고 물어도 대답하지 않았다.';
  const guarded = guardRecordResult(
    {
      observation: '교사가 "하준이는 안하고 싶어요?"라고 물어도 대답하지 않았다.',
      evaluation: '하준이가 원하지 않는 상황에서 거부 의사를 비언어적으로 표현하였다.',
    },
    { sourceText: src },
  );
  expect(guarded.evaluation).not.toContain('원문 그대로 보존하였다');
  expect(guarded.observation).toContain('"하준이는 안하고 싶어요?"');
});

