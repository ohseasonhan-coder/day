import { analyzeRecordInput } from './ai/index';
import { createDailyReport } from './ai/documentEngines/dailyReportEngine';
import { createEvaluation } from './ai/documentEngines/evaluationEngine';
import { createNotice } from './ai/documentEngines/noticeEngine';
import { createObservation } from './ai/documentEngines/observationEngine';
import { createParentMessage } from './ai/documentEngines/parentMessageEngine';
import { createSupportPlan } from './ai/documentEngines/supportPlanEngine';

const sample = {
  childName: '하준',
  rawText: '하준이가 친구와 블록을 함께 쌓다가 "나도 할래"라고 말했고, 교사가 순서를 안내하자 다시 기다렸다.',
  classAge: '4',
};

test('입력에 없는 행동을 모듈 초안에 추가하지 않는다', () => {
  const analysis = analyzeRecordInput(sample);
  const observation = createObservation({ parsedInput: analysis.parsedInput });
  expect(observation).not.toContain('노래');
  expect(observation).not.toContain('그림');
  expect(observation).not.toContain('달리');
});

test('관찰일지는 객관적으로 작성된다', () => {
  const analysis = analyzeRecordInput(sample);
  const observation = createObservation({ parsedInput: analysis.parsedInput });
  expect(observation).toContain('교사');
  expect(observation).not.toMatch(/문제행동|고집|못한다/);
});

test('알림장은 부드럽게 작성된다', () => {
  const analysis = analyzeRecordInput(sample);
  const notice = createNotice({ parsedInput: analysis.parsedInput });
  expect(notice).toMatch(/오늘|도왔|시도/);
  expect(notice).not.toMatch(/문제행동|낙인|발달이 늦/);
});

test('보육일지는 놀이 흐름과 교사 지원을 포함한다', () => {
  const analysis = analyzeRecordInput(sample);
  const daily = createDailyReport({
    parsedInput: analysis.parsedInput,
    categories: analysis.categories,
    curriculum: analysis.curriculum,
  });
  expect(daily).toContain('놀이 흐름');
  expect(daily).toContain('교사 지원');
});

test('부모 안내문, 지원계획, 평가는 새 엔진 초안으로 생성된다', () => {
  const analysis = analyzeRecordInput(sample);
  const parentMessage = createParentMessage({
    parsedInput: analysis.parsedInput,
    categories: analysis.categories,
  });
  const supportPlan = createSupportPlan({
    parsedInput: analysis.parsedInput,
    categories: analysis.categories,
  });
  const evaluation = createEvaluation({
    parsedInput: analysis.parsedInput,
    categories: analysis.categories,
    curriculum: analysis.curriculum,
  });

  expect(parentMessage).toContain('가정');
  expect(parentMessage).not.toMatch(/문제행동|발달이 늦/);
  expect(supportPlan).toMatch(/지원|안내|제공/);
  expect(evaluation).toMatch(/경험|관찰|나타/);
});

