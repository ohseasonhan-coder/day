// 실제 화면(ChildrenPage)이 import하는 진입점 '../utils/ai'(= ai.js)를 그대로 사용해
// 상담자료/발달평가 생성 흐름이 엔진 설정·fallback에 연결되었는지 검증한다.
import { processRecord, generateConsultDoc, generateGrowthSummary } from './ai';
import { setDocumentEngine, resetDocumentEngine, getActiveEngineForDocument, ENGINE_DOC_TYPES } from './ai/documentEngineSettings';
import { clearFallbackLog } from './ai/userCorrectionLearning';

const RECORDS = [{ rawText: '미술 활동에서 윤재가 물감으로 그림을 그리며 "초록 됐다!"라고 말하고 친구에게 보여주었다.' }];
const BANNED = /문제행동|산만|공격적|고집|발달지연|발달 지연|못한다|부족하|ADHD|자폐|장애|지능|가정환경|방임|학대/;

function resetAll() {
  ENGINE_DOC_TYPES.forEach((t) => resetDocumentEngine(t));
  clearFallbackLog();
}

describe('실제 화면 진입점(../utils/ai)에서 상담/발달 엔진 연결', () => {
  beforeEach(resetAll);

  test('counseling/development 기본값은 legacy다', () => {
    expect(getActiveEngineForDocument('counseling')).toBe('legacy');
    expect(getActiveEngineForDocument('development')).toBe('legacy');
  });

  test('기본 상태에서 상담/발달은 legacy 출력을 쓰고 내부정보가 노출되지 않는다', async () => {
    const consult = await generateConsultDoc({ childName: '윤재', records: RECORDS, childAge: '4' });
    const growth = await generateGrowthSummary({ childName: '윤재', records: RECORDS, period: '6월', childAge: '4' });
    expect(typeof consult.recentGrowth).toBe('string');
    expect(typeof growth.overall).toBe('string');
    // 기본 legacy → modular 초안과 다르다
    expect(consult.recentGrowth).not.toBe(consult.modularDraft);
    expect(growth.overall).not.toBe(growth.modularDraft);
    [consult, growth].forEach((r) => {
      expect(r.engine).toBeUndefined();
      expect(r.qualityScore).toBeUndefined();
      expect(r.fellBack).toBeUndefined();
    });
  });

  test('counseling을 modular로 전환하면 화면 함수가 modular 상담자료를 사용한다', async () => {
    setDocumentEngine('counseling', 'modular');
    const consult = await generateConsultDoc({ childName: '윤재', records: RECORDS, childAge: '4' });
    expect(consult.recentGrowth).toBe(consult.modularDraft);   // 검수 통과 → modular 사용
    expect(consult.recentGrowth).toContain('"초록 됐다!"');      // 발화 원문 보존
    expect(consult.recentGrowth).not.toMatch(BANNED);          // 문제행동/가정환경 추정 없음
    expect(consult.recentGrowth).not.toMatch(/놀이 흐름:|교사 지원:|발달영역:/);
  });

  test('development를 modular로 전환하면 화면 함수가 modular 발달평가를 사용한다', async () => {
    setDocumentEngine('development', 'modular');
    const growth = await generateGrowthSummary({ childName: '윤재', records: RECORDS, period: '6월', childAge: '4' });
    expect(growth.overall).toBe(growth.modularDraft);
    expect(growth.overall).not.toMatch(BANNED);                 // 발달지연/진단성 표현 없음
    expect(growth.overall).not.toMatch(/놀이 흐름:|교사 지원:|발달영역:/);
  });

  test('관찰/보육일지평가/알림장도 화면 함수(processRecord)에서 연결된다', async () => {
    const SAMPLE = { childName: '나윤', rawText: '나윤이가 친구와 블록을 쌓으며 "같이 만들래?"라고 말했고, 교사가 순서를 안내했다.', classAge: '4' };
    setDocumentEngine('observation', 'modular');
    const r = await processRecord(SAMPLE);
    expect(typeof r.observation).toBe('string');
    expect(r.observation).toContain('"같이 만들래?"');
    expect(r.engine).toBeUndefined();
  });
});
