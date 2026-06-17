// 알림장 modular 전환 운영: 모니터링 상태 + 샘플 일괄 점검.
import {
  computeMonitorStatus, buildEngineMonitor, MONITOR_REVERT_REASONS,
} from './ai/engineReviewReport';
import { runSampleAudit } from './ai/engineSampleRunner';
import {
  setDocumentEngine, resetDocumentEngine, getActiveEngineForDocument, getEngineSwitchedAt, ENGINE_DOC_TYPES,
} from './ai/documentEngineSettings';
import { recordFallback, clearFallbackLog } from './ai/userCorrectionLearning';
import { getBackupJson } from './storage';

function resetAll() {
  ENGINE_DOC_TYPES.forEach((t) => resetDocumentEngine(t));
  clearFallbackLog();
}

describe('전환 후 모니터링 상태', () => {
  beforeEach(resetAll);

  test('legacy면 모니터링 대상이 아니다', () => {
    expect(computeMonitorStatus({ engine: 'legacy', fallbackCount: 5 })).toBe('legacy');
  });

  test('modular + fallback 없음 → 안정', () => {
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 0, reasonCounts: {} })).toBe('안정');
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 1, reasonCounts: {} })).toBe('안정');
  });

  test('fallback 2건 이상 또는 low_score → 주의', () => {
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 2, reasonCounts: {} })).toBe('주의');
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 1, reasonCounts: { low_score: 1 } })).toBe('주의');
  });

  test('safety_warning/speech_not_preserved/internal_label → 되돌리기 권장', () => {
    expect(MONITOR_REVERT_REASONS).toEqual(expect.arrayContaining(['safety_warning', 'speech_not_preserved', 'internal_label']));
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 1, reasonCounts: { safety_warning: 1 } })).toBe('되돌리기 권장');
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 1, reasonCounts: { speech_not_preserved: 1 } })).toBe('되돌리기 권장');
    expect(computeMonitorStatus({ engine: 'modular', fallbackCount: 1, reasonCounts: { internal_label: 1 } })).toBe('되돌리기 권장');
  });

  test('buildEngineMonitor: 알림장 전환 + safety 경고 → 되돌리기 권장 + 전환 시각 기록', () => {
    setDocumentEngine('notice', 'modular');
    recordFallback({ documentType: 'notice', reasons: ['safety_warning'], inputText: 'x' });
    const notice = buildEngineMonitor().find((m) => m.key === 'notice');
    expect(notice.engine).toBe('modular');
    expect(notice.status).toBe('되돌리기 권장');
    expect(notice.fallbackCount).toBe(1);
    expect(notice.switchedAt).toBeTruthy();
    expect(getEngineSwitchedAt('notice')).toBeTruthy();
  });
});

describe('알림장 modular 전환 운영', () => {
  beforeEach(resetAll);

  test('알림장을 modular로 전환할 수 있고 되돌릴 수 있다', () => {
    setDocumentEngine('notice', 'modular');
    expect(getActiveEngineForDocument('notice')).toBe('modular');
    resetDocumentEngine('notice');
    expect(getActiveEngineForDocument('notice')).toBe('legacy');
  });

  test('engineSettings 백업에는 notice:modular만 담기고 검수 데이터는 포함되지 않는다', () => {
    setDocumentEngine('notice', 'modular');
    recordFallback({ documentType: 'notice', reasons: ['low_score'], inputText: '비밀메모' });
    const payload = JSON.parse(getBackupJson());
    expect(payload.engineSettings.engines.notice).toBe('modular');
    expect(payload.engineSettings.engines.observation).toBe('legacy');
    expect(payload.engineSettings.engines.development).toBe('legacy');
    const json = getBackupJson();
    expect(json).not.toContain('engine_fallbacks');
    expect(json).not.toContain('비밀메모');
  });
});

describe('전환 후 샘플 일괄 점검 (알림장 20개)', () => {
  test('20개 프리셋을 modular로 돌려 품질을 요약한다', () => {
    const audit = runSampleAudit('notice');
    expect(audit.total).toBe(20);
    expect(audit.modularPass + audit.fallback).toBe(20);
    expect(typeof audit.avgScore).toBe('number');
    // 알림장 modular는 안정적이어야 한다
    expect(audit.modularPass).toBeGreaterThanOrEqual(18);
    expect(audit.internalLabel).toBe(0);
    expect(audit.speechFail).toBe(0);
    expect(audit.safetyWarnings).toBe(0);
    expect(audit.avgScore).toBeGreaterThanOrEqual(90);
  });
});
