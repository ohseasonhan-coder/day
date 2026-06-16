import fs from 'fs';
import path from 'path';
import * as publicAi from './ai';
import { generateConsultDoc, generateDailyJournal, generateGrowthSummary, processRecord } from './ai';

const sample = {
  childName: '하준',
  rawText: '하준이가 친구와 블록을 함께 쌓다가 "나도 할래"라고 말했고, 교사가 순서를 안내하자 다시 기다렸다.',
  classAge: '4',
};

test('실제 발화가 보존된다', async () => {
  const result = await processRecord({ ...sample, recordType: 'observe' });
  const all = `${result.observation} ${result.parent} ${result.support} ${result.modularDrafts.observation}`;
  expect(all).toContain('"나도 할래"');
});

test('public wrapper는 기존 호환 API를 제공한다', () => {
  expect(Object.keys(publicAi).sort()).toEqual([
    'RECORD_QUALITY_SAMPLES',
    'TONE_OPTIONS',
    'generateConsultDoc',
    'generateDailyJournal',
    'generateGrowthSummary',
    'processRecord',
  ].sort());
});

test('레거시 결과는 유지하고 새 엔진 초안을 병행한다', async () => {
  const result = await processRecord({ ...sample, recordType: 'observe' });
  expect(result.observation).toBeTruthy();
  expect(result.parent).toBeTruthy();
  expect(result.support).toBeTruthy();
  expect(result.aiAnalysis.primaryCategory).toBeTruthy();
  expect(result.modularDrafts.observation).toBeTruthy();
  expect(result.modularDrafts.notice).toBeTruthy();
  expect(result.modularDrafts.dailyReport).toBeTruthy();
  expect(result.modularDrafts.parentMessage).toBeTruthy();
  expect(result.modularDrafts.supportPlan).toBeTruthy();
  expect(result.modularDrafts.evaluation).toBeTruthy();
});

test('기존 보육일지 생성 함수도 계속 사용할 수 있다', async () => {
  const result = await generateDailyJournal({
    records: [{ rawText: sample.rawText, category: 'play', observation: sample.rawText }],
    date: '2026-06-16',
    classAge: '4',
    className: '햇살반',
  });
  expect(result.playFlow).toBeTruthy();
  expect(result.teacherSupport).toBeTruthy();
  // 보육일지 모듈 초안은 내부 라벨 없이 놀이·교사 지원 내용을 담는다.
  expect(result.modularDraft).not.toMatch(/놀이 흐름:|교사 지원:|발달영역:/);
  expect(result.modularDraft).toMatch(/경험|놀이|지원/);
  expect(result.aiAnalysis.primaryCategory).toBeTruthy();
});

test('성장요약과 상담자료도 레거시 결과와 새 초안을 병행 반환한다', async () => {
  const records = [{ rawText: sample.rawText, observation: sample.rawText, parent: sample.rawText }];
  const growth = await generateGrowthSummary({
    childName: '하준',
    records,
    period: '최근 한 달',
    childAge: '4',
  });
  const consult = await generateConsultDoc({
    childName: '하준',
    records,
    childAge: '4',
  });
  expect(growth.overall).toBeTruthy();
  expect(growth.modularDraft).toBeTruthy();
  expect(growth.aiAnalysis.primaryCategory).toBeTruthy();
  expect(consult.recentGrowth).toBeTruthy();
  expect(consult.modularDraft).toBeTruthy();
  expect(consult.aiAnalysis.primaryCategory).toBeTruthy();
});

test('외부 API 호출 코드가 없다', () => {
  const aiDir = path.join(__dirname, 'ai');
  const files = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    });
  };
  walk(aiDir);
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  expect(source).not.toMatch(/openai|gemini|claude|fetch\s*\(|XMLHttpRequest|axios/i);
});
