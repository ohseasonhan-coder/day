import React, { useState } from 'react';
import { buildReviewReport, SWITCH_CRITERIA } from '../utils/ai/engineReviewReport';
import { clearEngineReviews } from '../utils/ai/userCorrectionLearning';

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
  const refresh = () => setReport(buildReviewReport());

  if (!enabled) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={refresh} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--primary)', color: 'var(--white)' }}>새로고침</button>
        <button onClick={() => { clearEngineReviews(); refresh(); }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--gray-100)', color: 'var(--text-primary)' }}>검수 데이터 비우기</button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>총 검수 {report.totalCount}건</span>
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
