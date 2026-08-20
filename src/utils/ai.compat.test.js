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

test('외부 API 호출 코드는 허용된 두 지점(로컬 7B, Gemini)으로만 제한된다', () => {
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
  const relPath = (f) => path.relative(aiDir, f).split(path.sep).join('/');

  // 예외1(5.5단계): privateServerLLM.js는 "관리자 본인 소유 PC의 로컬 7B 서버"로만 fetch한다.
  //  - 제3자 유료 LLM API 아님(주소는 관리자가 직접 설정, 미설정 시 규칙 fallback)
  //  - 별도 가드: 해당 파일에 상용 API 도메인이 들어가면 실패한다.
  files.filter((f) => relPath(f) === 'llm/privateServerLLM.js').forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).not.toMatch(/openai\.com|anthropic|googleapis|api\.openai|generativelanguage|api\.mistral|openrouter/i);
  });

  // 예외2: geminiLLM.js는 관리자가 API 키를 직접 입력하고 엔진을 'gemini'로 선택했을 때만
  // 쓰이는 유일한 실제 외부(Google) 호출 지점이다. Gemini 도메인만 허용하고 다른 상용 API는 금지한다.
  files.filter((f) => relPath(f) === 'llm/geminiLLM.js').forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).toMatch(/generativelanguage\.googleapis\.com/);
    expect(src).not.toMatch(/openai\.com|anthropic|api\.openai|api\.mistral|openrouter/i);
  });

  // 예외3: photoObservation.js는 "사진 기록" 화면 전용 — geminiAdapter(외부 Gemini 호출)를 직접
  // 위임만 하고 fetch를 스스로 호출하지 않는다. 사진 분석이라는 존재 목적 자체가 Gemini Vision opt-in
  // 이므로 이름을 가려서 이 검사를 통과시키기보다 geminiLLM.js와 동일하게 감사 대상 예외로 등록한다.
  files.filter((f) => relPath(f) === 'llm/photoObservation.js').forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).not.toMatch(/fetch\s*\(|XMLHttpRequest|axios|openai\.com|anthropic|api\.openai|api\.mistral|openrouter/i);
  });

  // 그 외 모든 파일은 실제 네트워크 호출(fetch/XMLHttpRequest/axios)이나 상용 API 참조를 가질 수 없다.
  // b2/llmBridge.js·b2/config.js는 'gemini'를 엔진 id 문자열로만 참조(실제 fetch는 geminiLLM.js 전용)하므로
  // 'gemini' 문자열만 예외로 허용하고 fetch(/axios 등은 그대로 금지 대상에 남긴다.
  const ENGINE_ID_ONLY_FILES = ['b2/llmBridge.js', 'b2/config.js'];
  const EXEMPT = ['llm/privateServerLLM.js', 'llm/geminiLLM.js', 'llm/photoObservation.js'];
  const source = files
    .filter((f) => !EXEMPT.includes(relPath(f)))
    .map((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return ENGINE_ID_ONLY_FILES.includes(relPath(f)) ? src.replace(/gemini/gi, '') : src;
    }).join('\n');
  expect(source).not.toMatch(/openai|gemini|claude|fetch\s*\(|XMLHttpRequest|axios/i);
});
