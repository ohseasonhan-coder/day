import {
  getDocumentEngineSettings, getActiveEngineForDocument, setDocumentEngine, resetDocumentEngine,
  ENGINE_DOC_TYPES, DEFAULT_ENGINE_PREFS,
} from './ai/documentEngineSettings';
import {
  resolveDocumentEngine, validateModularOutput, generateWithFallback, FALLBACK_MIN_SCORE,
} from './ai/documentEngineResolver';
import { getFallbackLog, clearFallbackLog } from './ai/userCorrectionLearning';
import { processRecord } from './ai/index';

const goodScore = () => ({ totalScore: 92, detail: { safety: 15, factPreservation: 27, naturalness: 20, documentFit: 19 } });
const lowScore = () => ({ totalScore: 70, detail: { safety: 15, factPreservation: 20, naturalness: 18, documentFit: 16 } });
const unsafeScore = () => ({ totalScore: 92, detail: { safety: 10, factPreservation: 27, naturalness: 20, documentFit: 19 } });

function resetAll() {
  ENGINE_DOC_TYPES.forEach((t) => resetDocumentEngine(t));
  clearFallbackLog();
}

describe('문서 유형별 엔진 설정', () => {
  beforeEach(resetAll);

  test('기본값은 모든 문서 유형이 legacy다', () => {
    const prefs = getDocumentEngineSettings();
    ENGINE_DOC_TYPES.forEach((t) => expect(prefs[t]).toBe('legacy'));
    expect(prefs).toEqual(DEFAULT_ENGINE_PREFS);
    ENGINE_DOC_TYPES.forEach((t) => expect(getActiveEngineForDocument(t)).toBe('legacy'));
  });

  test('승인 시 해당 문서 유형만 modular로 저장된다', () => {
    setDocumentEngine('observation', 'modular');
    const prefs = getDocumentEngineSettings();
    expect(prefs.observation).toBe('modular');
    expect(prefs.dailyReport).toBe('legacy');
    expect(prefs.notice).toBe('legacy');
  });

  test('legacy로 되돌리기가 가능하다', () => {
    setDocumentEngine('notice', 'modular');
    expect(getActiveEngineForDocument('notice')).toBe('modular');
    resetDocumentEngine('notice');
    expect(getActiveEngineForDocument('notice')).toBe('legacy');
  });
});

describe('resolver + fallback', () => {
  beforeEach(resetAll);

  test('설정이 legacy면 legacy 출력을 사용한다(modular 생성 안 함)', () => {
    let called = false;
    const r = resolveDocumentEngine({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => { called = true; return 'M'; }, scoreFn: goodScore });
    expect(r.engine).toBe('legacy');
    expect(r.text).toBe('L');
    expect(called).toBe(false);
  });

  test('설정이 modular이고 검수를 통과하면 modular 출력을 사용한다', () => {
    setDocumentEngine('notice', 'modular');
    const r = resolveDocumentEngine({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => '오늘 아이는 즐겁게 놀이했어요.', scoreFn: goodScore });
    expect(r.engine).toBe('modular');
    expect(r.text).toBe('오늘 아이는 즐겁게 놀이했어요.');
    expect(r.fellBack).toBe(false);
  });

  test('modular 생성 실패 시 legacy로 fallback되고 로그가 남는다', () => {
    setDocumentEngine('notice', 'modular');
    const r = resolveDocumentEngine({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => { throw new Error('boom'); }, scoreFn: goodScore });
    expect(r.engine).toBe('legacy');
    expect(r.fellBack).toBe(true);
    expect(r.reasons).toContain('modular_error');
    expect(getFallbackLog().some((e) => e.documentType === 'notice')).toBe(true);
  });

  test('modular 결과가 비어 있으면 legacy로 fallback된다', () => {
    setDocumentEngine('notice', 'modular');
    const r = resolveDocumentEngine({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => '   ', scoreFn: goodScore });
    expect(r.engine).toBe('legacy');
    expect(r.reasons).toContain('empty');
  });

  test('qualityScore가 85점 미만이면 legacy로 fallback된다', () => {
    setDocumentEngine('dailyReport', 'modular');
    const r = resolveDocumentEngine({ documentType: 'dailyReport', input: '메모', legacyText: 'L', modularFn: () => '모듈 결과 문장입니다.', scoreFn: lowScore });
    expect(r.engine).toBe('legacy');
    expect(r.reasons).toContain('low_score');
    expect(FALLBACK_MIN_SCORE).toBe(85);
  });

  test('safety 경고가 있으면 legacy로 fallback된다', () => {
    setDocumentEngine('notice', 'modular');
    const r = resolveDocumentEngine({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => '모듈 결과 문장입니다.', scoreFn: unsafeScore });
    expect(r.engine).toBe('legacy');
    expect(r.reasons).toContain('safety_warning');
  });

  test('내부 라벨이 포함되면 legacy로 fallback된다', () => {
    setDocumentEngine('dailyReport', 'modular');
    const r = resolveDocumentEngine({ documentType: 'dailyReport', input: '메모', legacyText: 'L', modularFn: () => '놀이 흐름: 블록놀이 교사 지원: 도움', scoreFn: goodScore });
    expect(r.engine).toBe('legacy');
    expect(r.reasons).toContain('internal_label');
  });

  test('실제 발화 보존 실패 시 legacy로 fallback된다', () => {
    setDocumentEngine('observation', 'modular');
    setDocumentEngine('notice', 'modular');
    // 관찰일지인데 입력 발화를 누락
    const missing = resolveDocumentEngine({ documentType: 'observation', input: '아이가 "안녕"이라고 말했다.', legacyText: 'L', modularFn: () => '아이가 인사하였다.', scoreFn: goodScore });
    expect(missing.reasons).toContain('speech_not_preserved');
    // 입력에 없던 발화를 날조
    const fabricated = resolveDocumentEngine({ documentType: 'notice', input: '아이가 "안녕"이라고 말했다.', legacyText: 'L', modularFn: () => '아이가 "다른 말"이라고 했어요.', scoreFn: goodScore });
    expect(fabricated.reasons).toContain('speech_not_preserved');
  });

  test('validateModularOutput는 통과 시 ok=true를 반환한다', () => {
    const v = validateModularOutput({ text: '아이가 "안녕"이라고 말했어요.', input: '아이가 "안녕"이라고 말했다.', documentType: 'notice', scoreFn: goodScore });
    expect(v.ok).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  test('generateWithFallback는 텍스트만 반환한다(엔진/점수 비노출)', () => {
    setDocumentEngine('notice', 'modular');
    const text = generateWithFallback({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => '오늘 아이는 잘 지냈어요.', scoreFn: goodScore });
    expect(typeof text).toBe('string');
  });
});

describe('processRecord 통합 — 일반 사용자 비노출 + 기본 legacy', () => {
  beforeEach(resetAll);
  const SAMPLE = { childName: '나윤', rawText: '나윤이가 친구와 블록을 쌓으며 "같이 만들래?"라고 말했고, 교사가 순서를 안내했다.', classAge: '4' };

  test('기본 상태에서 결과 필드는 문자열이며 엔진/점수/fallback 정보가 노출되지 않는다', async () => {
    const r = await processRecord(SAMPLE);
    expect(typeof r.observation).toBe('string');
    expect(typeof r.evaluation).toBe('string');
    expect(typeof r.parent).toBe('string');
    expect(r.engine).toBeUndefined();
    expect(r.fellBack).toBeUndefined();
    expect(r.qualityScore).toBeUndefined();
    // 내부 라벨도 최종 출력에 없어야 한다
    expect(r.observation).not.toMatch(/놀이 흐름:|교사 지원:|발달영역:/);
  });

  test('관찰일지를 modular로 전환해도 출력은 문자열이고 발화가 보존된다', async () => {
    setDocumentEngine('observation', 'modular');
    const r = await processRecord(SAMPLE);
    expect(typeof r.observation).toBe('string');
    expect(r.observation).toContain('"같이 만들래?"');
    expect(r.observation).not.toMatch(/놀이 흐름:|교사 지원:/);
  });
});
