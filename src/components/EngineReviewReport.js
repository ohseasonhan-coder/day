import React, { useState } from 'react';
import { buildReviewReport, SWITCH_CRITERIA, isLiveConnected, buildFallbackSummary, FALLBACK_REASON_LABELS } from '../utils/ai/engineReviewReport';
import { clearEngineReviews, clearFallbackLog } from '../utils/ai/userCorrectionLearning';
import { getDocumentEngineSettings, setDocumentEngine } from '../utils/ai/documentEngineSettings';

const SWITCH_CONFIRM = '이 문서 유형의 기본 문장 엔진을 modular로 전환합니다. 기존 legacy 엔진은 fallback으로 유지됩니다. 계속하시겠습니까?';

// 관리자/마스터 전용: 누적된 엔진 검수 데이터 리포트.
// 일반 사용자에게는 상위(SettingsPage)에서 isMaster로 가려 노출되지 않는다.
const pct = (v) => `${Math.round(v * 100)}%`;

function StatChip({ label, value, ok }) {
  return (
    <span style={{
      fontSize: 11, borderRadius: 6, padding: '2px 6px',
      background: ok == null ? 'var(--gray-100)' : ok ? 'var(--primary-light)' : 'var(--accent-light)',
      color: ok == null ? 'var(--text-secondary)' : ok ? 'var(--primary)' : 'var(--accent)',
    }}>{label} {value}</span>
  );
}

export default function EngineReviewReport({ enabled = true }) {
  const [report, setReport] = useState(() => buildReviewReport());
  const [engines, setEngines] = useState(() => getDocumentEngineSettings());
  const [fallbacks, setFallbacks] = useState(() => buildFallbackSummary());
  const refresh = () => { setReport(buildReviewReport()); setEngines(getDocumentEngineSettings()); setFallbacks(buildFallbackSummary()); };

  const switchTo = (key) => {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm && !window.confirm(SWITCH_CONFIRM)) return;
    setEngines(setDocumentEngine(key, 'modular'));
  };
  const revert = (key) => setEngines(setDocumentEngine(key, 'legacy'));

  if (!enabled) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={refresh} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--primary)', color: 'var(--white)' }}>새로고침</button>
        <button onClick={() => { clearEngineReviews(); refresh(); }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--gray-100)', color: 'var(--text-primary)' }}>검수 데이터 비우기</button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>총 검수 {report.totalCount}건</span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>현재 기본 엔진 (문서 유형별)</div>
        {report.types.map((t) => {
          const engine = engines[t.key] || 'legacy';
          const isModular = engine === 'modular';
          return (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, minWidth: 120 }}>{t.label}</span>
              <span style={{ fontSize: 10, color: isLiveConnected(t.key) ? 'var(--primary)' : 'var(--text-tertiary)' }}>
                {isLiveConnected(t.key) ? '● 라이브 연결됨' : '○ 설정 가능'}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 8px',
                background: isModular ? 'var(--primary-light)' : 'var(--gray-100)',
                color: isModular ? 'var(--primary)' : 'var(--text-secondary)',
              }}>{engine}</span>
              {isModular ? (
                <button onClick={() => revert(t.key)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--gray-100)', color: 'var(--text-primary)' }}>
                  legacy로 되돌리기
                </button>
              ) : (
                <button
                  onClick={() => switchTo(t.key)}
                  disabled={!t.switchReadiness.ready}
                  title={t.switchReadiness.ready ? '' : `전환 기준 미충족 (${t.status})`}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: t.switchReadiness.ready ? 'var(--primary)' : 'var(--gray-300)',
                    color: 'var(--white)', cursor: t.switchReadiness.ready ? 'pointer' : 'not-allowed',
                  }}
                >
                  {t.switchReadiness.ready ? 'modular 기본 전환' : t.status}
                </button>
              )}
            </div>
          );
        })}
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
          기준(검수 30건·평균 90·선택률 80%·수정률 20%·safety 0·factPres 25)을 모두 충족한 유형만 전환할 수 있어요. 전환해도 modular에 문제가 생기면 자동으로 legacy로 되돌아갑니다.
        </p>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>fallback 로그 <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· 총 {fallbacks.total}건</span></span>
          <button onClick={() => { clearFallbackLog(); setFallbacks(buildFallbackSummary()); }} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'var(--gray-100)', color: 'var(--text-primary)' }}>로그 비우기</button>
        </div>
        {fallbacks.total === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>modular 전환 후 legacy로 되돌아간 사례가 아직 없습니다.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {Object.entries(fallbacks.reasonTotals).map(([code, n]) => (
                <span key={code} style={{ fontSize: 11, borderRadius: 6, padding: '2px 6px', background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {FALLBACK_REASON_LABELS[code] || code} {n}
                </span>
              ))}
            </div>
            {fallbacks.byType.map((t) => (
              <div key={t.documentType} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>
                {t.label}: {t.count}건 ({Object.entries(t.reasons).map(([c, n]) => `${FALLBACK_REASON_LABELS[c] || c} ${n}`).join(', ')})
              </div>
            ))}
          </>
        )}
      </div>

      {report.totalCount === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          아직 검수 기록이 없습니다. 위 비교 모드에서 결과를 선택하면 이곳에 누적됩니다.
        </div>
      )}

      {report.types.filter((t) => t.count > 0).map((t) => {
        const sr = t.switchReadiness;
        return (
          <div key={t.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{t.label} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· 검수 {t.progress}</span></strong>
              <span style={{
                fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '3px 8px',
                background: t.status === '기본 전환 가능' ? 'var(--primary)' : t.status === '개선 필요' ? 'var(--accent-light)' : 'var(--gray-200)',
                color: t.status === '기본 전환 가능' ? 'var(--white)' : t.status === '개선 필요' ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
                {t.status === '기본 전환 가능' ? '✅ ' : ''}{t.status}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <StatChip label="modular 추천률" value={pct(t.modularRecommendRate)} />
              <StatChip label="modular 선택률" value={pct(t.modularSelectRate)} ok={sr.checks.modularSelectRate} />
              <StatChip label="legacy 선택률" value={pct(t.legacySelectRate)} />
              <StatChip label="수정률" value={pct(t.editRate)} ok={sr.checks.editRate} />
              <StatChip label="평균 legacy" value={t.avgLegacyScore} />
              <StatChip label="평균 modular" value={t.avgModularScore} ok={sr.checks.modularAvg} />
              <StatChip label="점수차(M-L)" value={(t.scoreDiff > 0 ? '+' : '') + t.scoreDiff} ok={t.scoreDiff >= 0} />
              <StatChip label="factPres" value={t.avgModularFact} ok={sr.checks.factPreservation} />
              <StatChip label="safety경고" value={`${t.safetyIssues}건`} ok={sr.checks.safety} />
              <StatChip label="검수수" value={`${t.count}/${SWITCH_CRITERIA.minCount}`} ok={sr.checks.count} />
            </div>
            {t.lowModular.length > 0 && (
              <details style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                <summary>modular 90점 미만 {t.lowModular.length}건</summary>
                {t.lowModular.slice(0, 10).map((x) => (
                  <div key={x.id} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>[{x.score}점] {x.text}</div>
                ))}
              </details>
            )}
            {t.legacyChosenCases.length > 0 && (
              <details style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                <summary>legacy를 선택한 사례 {t.legacyChosenCases.length}건</summary>
                {t.legacyChosenCases.slice(0, 10).map((x) => (
                  <div key={x.id} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                    legacy {x.legacyScore} vs modular {x.modularScore} · {x.inputText.slice(0, 40)}
                  </div>
                ))}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
