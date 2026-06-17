// 엔진 검수 리포트 + modular 기본 전환 가능 기준 계산 (로컬, 외부 전송 없음).
// 누적된 검수 데이터(userCorrectionLearning)를 문서 유형별로 집계한다.
// 자동 전환은 하지 않는다. 기준 충족 여부만 계산해 '기본 전환 가능' 표시에 사용한다.
import { getEngineReviews, getFallbackLog } from './userCorrectionLearning';
import { COMPARE_DOC_TYPES } from './engineComparison';
import { getDocumentEngineSettings, getEngineSwitchedAt } from './documentEngineSettings';

// fallback 사유 라벨 (관리자 표시용)
export const FALLBACK_REASON_LABELS = {
  modular_error: '생성 오류',
  empty: '빈 결과',
  internal_label: '내부 라벨 포함',
  speech_not_preserved: '발화 보존 실패',
  low_score: '점수 미달',
  safety_warning: 'safety 경고',
};

// modular 기본 전환 가능 기준
export const SWITCH_CRITERIA = {
  minCount: 30,             // 검수 건수 30건 이상
  minModularAvg: 90,        // modular 평균 점수 90점 이상
  minModularSelectRate: 0.8, // modular 선택률 80% 이상
  maxEditRate: 0.2,         // 사용자 수정 비율 20% 이하
  maxSafetyIssues: 0,       // safety 경고 0건
  minFactPreservation: 25,  // factPreservation 평균 25/30 이상
};

const round1 = (n) => Math.round(n * 10) / 10;
const rate = (num, den) => (den > 0 ? round1((num / den) * 100) / 100 : 0);
const scoreOf = (s, key = 'totalScore') => (s && typeof s[key] === 'number' ? s[key] : 0);

// 관리자/마스터만 검수 리포트에 접근 가능. (비교 모드 OFF·일반 사용자는 접근 불가)
export function canAccessReviewReport({ isMaster = false, compareEnabled = false } = {}) {
  return Boolean(isMaster) || Boolean(compareEnabled && isMaster);
}
// 검수 샘플 입력 도구도 마스터 전용.
export function canAccessReviewTools({ isMaster = false } = {}) {
  return Boolean(isMaster);
}

// 실제 생성 흐름에 resolver가 연결된(라이브) 문서 유형.
// observation/dailyReport/notice: processRecord, counseling: generateConsultDoc, development: generateGrowthSummary
export const LIVE_CONNECTED_DOC_TYPES = ['observation', 'dailyReport', 'notice', 'counseling', 'development'];
export function isLiveConnected(documentType) {
  return LIVE_CONNECTED_DOC_TYPES.includes(documentType);
}

// 문서 유형별 검수 진행 상태 라벨.
export function reviewStatusOf(stat) {
  if (stat.count < SWITCH_CRITERIA.minCount) return '검수 부족';
  return stat.switchReadiness?.ready ? '기본 전환 가능' : '개선 필요';
}

export function evaluateSwitchReadiness(stat) {
  const checks = {
    count: stat.count >= SWITCH_CRITERIA.minCount,
    modularAvg: stat.avgModularScore >= SWITCH_CRITERIA.minModularAvg,
    modularSelectRate: stat.modularSelectRate >= SWITCH_CRITERIA.minModularSelectRate,
    editRate: stat.editRate <= SWITCH_CRITERIA.maxEditRate,
    safety: stat.safetyIssues <= SWITCH_CRITERIA.maxSafetyIssues,
    factPreservation: stat.avgModularFact >= SWITCH_CRITERIA.minFactPreservation,
  };
  const ready = Object.values(checks).every(Boolean);
  return { ready, checks };
}

export function buildReviewReport(reviews = getEngineReviews()) {
  const byType = {};
  COMPARE_DOC_TYPES.forEach(({ key, label }) => {
    byType[key] = {
      key,
      label,
      count: 0,
      recommendedModular: 0,
      selectedModular: 0,
      selectedLegacy: 0,
      edited: 0,
      safetyIssues: 0,
      _legacySum: 0,
      _modularSum: 0,
      _modularFactSum: 0,
      lowModular: [],       // modular 90점 미만 사례
      legacyChosenCases: [], // 사용자가 legacy를 선택한 사례
    };
  });

  reviews.forEach((r) => {
    const t = byType[r.documentType];
    if (!t) return;
    t.count += 1;
    if (r.recommendedEngine === 'modular') t.recommendedModular += 1;
    if (r.selectedEngine === 'modular') t.selectedModular += 1;
    if (r.selectedEngine === 'legacy') t.selectedLegacy += 1;
    if (r.edited) t.edited += 1;
    t._legacySum += scoreOf(r.legacyScore);
    t._modularSum += scoreOf(r.modularScore);
    t._modularFactSum += scoreOf(r.modularScore, 'factPreservation');
    const modularSafety = scoreOf(r.modularScore, 'safety');
    if ((r.modularScore && modularSafety < 15) || (r.warnings || []).some((w) => /순화|라벨|미화|진단|단정/.test(w))) {
      t.safetyIssues += 1;
    }
    if (r.modularScore && scoreOf(r.modularScore) < 90) {
      t.lowModular.push({ id: r.id, score: scoreOf(r.modularScore), text: r.modularText, at: r.selectedAt });
    }
    if (r.selectedEngine === 'legacy') {
      t.legacyChosenCases.push({ id: r.id, inputText: r.inputText, legacyScore: scoreOf(r.legacyScore), modularScore: scoreOf(r.modularScore), at: r.selectedAt });
    }
  });

  const types = Object.values(byType).map((t) => {
    const stat = {
      key: t.key,
      label: t.label,
      count: t.count,
      modularRecommendRate: rate(t.recommendedModular, t.count),
      modularSelectRate: rate(t.selectedModular, t.count),
      legacySelectRate: rate(t.selectedLegacy, t.count),
      editRate: rate(t.edited, t.count),
      safetyIssues: t.safetyIssues,
      avgLegacyScore: t.count ? round1(t._legacySum / t.count) : 0,
      avgModularScore: t.count ? round1(t._modularSum / t.count) : 0,
      avgModularFact: t.count ? round1(t._modularFactSum / t.count) : 0,
      scoreDiff: t.count ? round1((t._modularSum - t._legacySum) / t.count) : 0,
      lowModular: t.lowModular,
      legacyChosenCases: t.legacyChosenCases,
    };
    stat.switchReadiness = evaluateSwitchReadiness(stat);
    stat.progress = `${stat.count}/${SWITCH_CRITERIA.minCount}`;
    stat.status = reviewStatusOf(stat);
    return stat;
  });

  return { totalCount: reviews.length, types, criteria: SWITCH_CRITERIA };
}

// ── 전환 후 모니터링 ──────────────────────────────────────────────
// 즉시 되돌리기를 권장하는 위험 사유(품질·안전 직결).
export const MONITOR_REVERT_REASONS = ['safety_warning', 'speech_not_preserved', 'internal_label'];

// modular 사용 중인 문서의 안정성 상태를 판정한다.
//  - 안정: fallback 0~1건, 위험 사유 없음
//  - 주의: fallback 2건 이상 또는 low_score 발생
//  - 되돌리기 권장: safety_warning/speech_not_preserved/internal_label 발생
export function computeMonitorStatus({ engine, fallbackCount = 0, reasonCounts = {} } = {}) {
  if (engine !== 'modular') return 'legacy';
  if (MONITOR_REVERT_REASONS.some((r) => (reasonCounts[r] || 0) > 0)) return '되돌리기 권장';
  if (fallbackCount >= 2 || (reasonCounts.low_score || 0) > 0) return '주의';
  return '안정';
}

// 문서 유형별 전환 후 모니터링 상태(엔진·전환 시각·fallback·상태).
export function buildEngineMonitor(fallback = buildFallbackSummary()) {
  const engines = getDocumentEngineSettings();
  const fbByType = fallback.byType.reduce((m, t) => ({ ...m, [t.documentType]: t }), {});
  return COMPARE_DOC_TYPES.map(({ key, label }) => {
    const engine = engines[key] === 'modular' ? 'modular' : 'legacy';
    const fb = fbByType[key] || { count: 0, reasons: {} };
    return {
      key,
      label,
      engine,
      switchedAt: getEngineSwitchedAt(key),
      fallbackCount: fb.count,
      reasonCounts: fb.reasons,
      safetyWarnings: fb.reasons.safety_warning || 0,
      status: computeMonitorStatus({ engine, fallbackCount: fb.count, reasonCounts: fb.reasons }),
    };
  });
}

// fallback 로그 집계: 문서 유형별 건수·사유 분포 + 최근 목록.
const DOC_LABELS = COMPARE_DOC_TYPES.reduce((m, d) => ({ ...m, [d.key]: d.label }), {});
export function buildFallbackSummary(log = getFallbackLog()) {
  const byType = {};
  const reasonTotals = {};
  log.forEach((e) => {
    const key = e.documentType || 'unknown';
    const t = byType[key] || { documentType: key, label: DOC_LABELS[key] || key, count: 0, reasons: {} };
    t.count += 1;
    (e.reasons || []).forEach((r) => {
      t.reasons[r] = (t.reasons[r] || 0) + 1;
      reasonTotals[r] = (reasonTotals[r] || 0) + 1;
    });
    byType[key] = t;
  });
  const recent = [...log].slice(-10).reverse();
  return { total: log.length, byType: Object.values(byType), reasonTotals, recent };
}
