// 관찰일지 modular 엔진의 발화 100% 보존 검증.
import { analyzeRecordInput } from './ai/draftComposer';
import { createObservation } from './ai/documentEngines/observationEngine';
import { extractActualSpeech } from './ai/inputParser';
import { validateModularOutput } from './ai/documentEngineResolver';
import { isObservationSwitchEligible } from './ai/engineReviewReport';
import { REVIEW_SAMPLE_PRESETS } from './ai/reviewSamplePresets';
import { getActiveEngineForDocument, clearDocumentEnginePrefs } from './ai/documentEngineSettings';

function observationOf(rawText, childName = '유아') {
  const a = analyzeRecordInput({ childName, rawText, classAge: '4' });
  return createObservation({ parsedInput: a.parsedInput, categories: a.categories, scene: a.scene });
}

describe('관찰일지 발화 100% 보존', () => {
  test('모든 검수 프리셋의 입력 발화가 관찰일지 출력에 그대로 포함된다', () => {
    REVIEW_SAMPLE_PRESETS.forEach((p) => {
      const text = observationOf(p.rawText);
      extractActualSpeech(p.rawText).forEach((sp) => {
        expect(text).toContain(sp);
      });
    });
  });

  test('실패했던 케이스(속상했구나/미안해)가 이제 보존된다', () => {
    const cry = observationOf('블록이 무너지자 윤서가 울먹였다. 교사가 "속상했구나"라고 하자 고개를 끄덕였다.');
    expect(cry).toContain('"속상했구나"');
    const soft = observationOf('등원 후 태오가 친구를 밀어 넘어질 뻔했다. 교사가 위험하다고 알려주자 "미안해"라고 사과했다.');
    expect(soft).toContain('"미안해"');
  });

  test('여러 개의 발화를 모두 보존한다', () => {
    const text = observationOf('지호가 "내가 먼저 할래"라고 말하자 친구가 "그럼 나는 나중에"라고 답했고, 교사가 "차례를 정해보자"라고 안내했다.');
    ['"내가 먼저 할래"', '"그럼 나는 나중에"', '"차례를 정해보자"'].forEach((q) => expect(text).toContain(q));
  });

  test('작은따옴표/큰따옴표/한국어 따옴표 발화를 모두 보존한다', () => {
    const text = observationOf("수아가 '여기 봐'라고 하고, 지우가 \"이거 뭐야\"라며 “정말 신기해”라고 말했다.");
    ["'여기 봐'", '"이거 뭐야"', '“정말 신기해”'].forEach((q) => expect(text).toContain(q));
  });

  test('발화의 문장부호를 변형하지 않는다', () => {
    const text = observationOf('지우가 물감을 섞으며 "초록 됐다!"라고 외쳤다. 친구가 "왜 그래?"라고 물었다.');
    expect(text).toContain('"초록 됐다!"');
    expect(text).toContain('"왜 그래?"');
  });

  test('발화를 순화/요약하지 않는다(부정 표현도 원문 그대로)', () => {
    const text = observationOf('하준이가 그리기를 권하자 "안 할래요"라고 말하며 참여하지 않았다.');
    expect(text).toContain('"안 할래요"'); // 순화(예: 편안하지 않은)로 바꾸지 않음
    expect(text).not.toContain('"안 하고 싶어요"');
  });
});

describe('발화 누락 시 fallback / 전환 기준', () => {
  test('발화가 누락된 modular 결과는 speech_not_preserved로 fallback 대상이 된다', () => {
    const v = validateModularOutput({
      text: '유아는 그림을 그렸다. 교사가 지원하였다.',
      input: '아이가 "초록 됐다!"라고 말했다.',
      documentType: 'observation',
    });
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('speech_not_preserved');
  });

  test('발화 실패가 1건이라도 있으면 관찰일지 전환 불가', () => {
    expect(isObservationSwitchEligible({ total: 20, modularPass: 19, fallback: 1, speechFail: 1, internalLabel: 0, safetyWarnings: 0 })).toBe(false);
  });
});

describe('기존 4종 modular 상태 유지', () => {
  test('관찰일지 개선이 4종 기본 엔진 설정을 바꾸지 않는다', () => {
    clearDocumentEnginePrefs();
    expect(getActiveEngineForDocument('observation')).toBe('legacy');
    ['dailyReport', 'notice', 'counseling', 'development'].forEach((t) => {
      expect(getActiveEngineForDocument(t)).toBe('modular');
    });
  });
});
