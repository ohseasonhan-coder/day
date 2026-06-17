// 운영 기본 전환: 4종(알림장/보육일지평가/상담/발달) modular, 관찰일지 legacy 유지.
import {
  getActiveEngineForDocument, clearDocumentEnginePrefs, DEFAULT_ENGINE_PREFS,
} from './ai/documentEngineSettings';
import { isObservationSwitchEligible, OBSERVATION_SWITCH_CRITERIA } from './ai/engineReviewReport';
import { runSampleAudit } from './ai/engineSampleRunner';
import { recordFallback, clearFallbackLog } from './ai/userCorrectionLearning';
import { getBackupJson } from './storage';
import { processRecord, generateConsultDoc, generateGrowthSummary } from './ai';

const RECORDS = [{ rawText: '미술 활동에서 윤재가 물감으로 그림을 그리며 "초록 됐다!"라고 말하고 친구에게 보여주었다.' }];
const SAMPLE = { childName: '나윤', rawText: '나윤이가 친구와 블록을 쌓으며 "같이 만들래?"라고 말했고, 교사가 순서를 안내했다.', classAge: '4' };

describe('운영 기본 엔진 설정', () => {
  beforeEach(() => { clearDocumentEnginePrefs(); clearFallbackLog(); });

  test('기본값: observation만 legacy, 나머지 4종은 modular', () => {
    expect(DEFAULT_ENGINE_PREFS).toEqual({
      observation: 'legacy', dailyReport: 'modular', notice: 'modular', counseling: 'modular', development: 'modular',
    });
    expect(getActiveEngineForDocument('observation')).toBe('legacy');
    ['dailyReport', 'notice', 'counseling', 'development'].forEach((t) => {
      expect(getActiveEngineForDocument(t)).toBe('modular');
    });
  });

  test('engineSettings 백업에 4종 modular + observation legacy만 포함되고 검수 데이터는 빠진다', () => {
    recordFallback({ documentType: 'notice', reasons: ['low_score'], inputText: '비밀메모' });
    const json = getBackupJson();
    const payload = JSON.parse(json);
    expect(payload.engineSettings.engines).toEqual({
      observation: 'legacy', dailyReport: 'modular', notice: 'modular', counseling: 'modular', development: 'modular',
    });
    expect(json).not.toContain('engine_reviews');
    expect(json).not.toContain('engine_fallbacks');
    expect(json).not.toContain('비밀메모');
  });
});

describe('관찰일지 전환 보류', () => {
  test('샘플 감사 기준 미달이라 modular 전환 불가(legacy 유지)', () => {
    const audit = runSampleAudit('observation');
    expect(isObservationSwitchEligible(audit)).toBe(false); // 발화 보존 실패 존재
    expect(audit.speechFail).toBeGreaterThan(0);
    expect(OBSERVATION_SWITCH_CRITERIA.maxSpeechFail).toBe(0);
    expect(OBSERVATION_SWITCH_CRITERIA.successRate).toBe(1.0);
  });

  test('완전 통과한 가상 감사라면 전환 가능으로 계산된다', () => {
    const perfect = { total: 30, modularPass: 30, fallback: 0, speechFail: 0, internalLabel: 0, safetyWarnings: 0 };
    expect(isObservationSwitchEligible(perfect)).toBe(true);
  });
});

describe('운영 기본값에서 실제 화면 출력 경로', () => {
  beforeEach(() => { clearDocumentEnginePrefs(); clearFallbackLog(); });

  test('보육일지평가/알림장은 modular 경로, 관찰일지는 legacy', async () => {
    const r = await processRecord(SAMPLE);
    expect(r.evaluation).toBe(r.modularDrafts.dailyReport); // dailyReport modular 사용
    expect(r.parent).toBe(r.modularDrafts.notice);          // notice modular 사용
    expect(getActiveEngineForDocument('observation')).toBe('legacy');
    expect(r.observation).toContain('"같이 만들래?"');       // 관찰일지(legacy) 발화 보존
    // 일반 사용자 노출 금지
    expect(r.engine).toBeUndefined();
    expect(r.qualityScore).toBeUndefined();
    expect(r.fellBack).toBeUndefined();
    expect(r.parent).not.toMatch(/놀이 흐름:|교사 지원:|발달영역:|qualityScore/);
  });

  test('상담자료/발달평가는 modular 경로를 사용한다', async () => {
    const consult = await generateConsultDoc({ childName: '윤재', records: RECORDS, childAge: '4' });
    const growth = await generateGrowthSummary({ childName: '윤재', records: RECORDS, period: '6월', childAge: '4' });
    expect(consult.recentGrowth).toBe(consult.modularDraft);
    expect(growth.overall).toBe(growth.modularDraft);
    expect(consult.recentGrowth).not.toMatch(/문제행동|발달지연|못한다|ADHD/);
  });

  test('modular 실패 시 legacy로 fallback된다(예: 빈 결과)', () => {
    // resolver 단위로 fallback 동작 확인(공통 경로)
    const { resolveDocumentEngine } = require('./ai/documentEngineResolver');
    const r = resolveDocumentEngine({ documentType: 'notice', input: '메모', legacyText: 'L', modularFn: () => '   ' });
    expect(r.engine).toBe('legacy');
    expect(r.text).toBe('L');
    expect(r.reasons).toContain('empty');
  });
});
