import React, { useState } from 'react';
import { buildReviewReport, SWITCH_CRITERIA, isLiveConnected, buildFallbackSummary, FALLBACK_REASON_LABELS, buildEngineMonitor } from '../utils/ai/engineReviewReport';
import { clearEngineReviews, clearFallbackLog } from '../utils/ai/userCorrectionLearning';
import { getDocumentEngineSettings, setDocumentEngine } from '../utils/ai/documentEngineSettings';
import { runSampleAudit } from '../utils/ai/engineSampleRunner';
import { triggerEnginePrefSync } from '../utils/storage';

const SWITCH_CONFIRM = '이 문서 유형의 기본 문장 엔진을 modular로 전환합니다. 기존 legacy 엔진은 fallback으로 유지됩니다. 계속하시겠습니까?';

const TONE = {
  ok: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  warn: { bg: 'var(--accent-light)', color: 'var(--accent)' },
  danger: { bg: 'var(--accent)', color: 'var(--white)' },
  muted: { bg: 'var(--gray-100)', color: 'var(--text-secondary)' },
};
const STATUS_TONE = { '안정': 'ok', '주의': 'warn', '되돌리기 권장': 'danger', '기본 전환 가능': 'ok', '개선 필요': 'warn', '검수 부족': 'muted' };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(); } catch { return ''; } };
const pct = (v) => `${Math.round(v * 100)}%`;

function Pill({ tone = 'muted', children, title }) {
  const s = TONE[tone] || TONE.muted;
  return (
    <span title={title} style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 9px', background: s.bg, color: s.color, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {children}
    </span>
  );
}
function Section({ title, desc, right, children }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{title}</div>
        {right}
      </div>
      {desc && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{desc}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}
function GhostBtn({ onClick, children, tone = 'gray' }) {
  const bg = tone === 'primary' ? 'var(--primary)' : 'var(--gray-100)';
  const color = tone === 'primary' ? 'var(--white)' : 'var(--text-primary)';
  return <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: bg, color }}>{children}</button>;
}

export default function EngineReviewReport({ enabled = true }) {
  const [report, setReport] = useState(() => buildReviewReport());
  const [engines, setEngines] = useState(() => getDocumentEngineSettings());
  const [fallbacks, setFallbacks] = useState(() => buildFallbackSummary());
  const [monitor, setMonitor] = useState(() => buildEngineMonitor());
  const [audit, setAudit] = useState(null);
  const [auditType, setAuditType] = useState('notice');
  const [obsAudit] = useState(() => { try { return runSampleAudit('observation'); } catch { return null; } });

  const refresh = () => {
    setReport(buildReviewReport());
    setEngines(getDocumentEngineSettings());
    const fb = buildFallbackSummary();
    setFallbacks(fb);
    setMonitor(buildEngineMonitor(fb));
  };
  const monByKey = monitor.reduce((m, x) => ({ ...m, [x.key]: x }), {});
  const runAudit = () => setAudit(runSampleAudit(auditType));

  const switchTo = (key) => {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm && !window.confirm(SWITCH_CONFIRM)) return;
    setDocumentEngine(key, 'modular');
    triggerEnginePrefSync();
    refresh();
  };
  const revert = (key) => {
    setDocumentEngine(key, 'legacy');
    triggerEnginePrefSync();
    refresh();
  };

  if (!enabled) return null;

  const modularCount = report.types.filter((t) => (engines[t.key] || 'legacy') === 'modular').length;
  const auditClean = audit && audit.fallback === 0 && audit.speechFail === 0 && audit.internalLabel === 0 && audit.safetyWarnings === 0 && audit.below90 === 0;

  return (
    <div>
      {/* 한눈 요약 배너 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: 'var(--gray-50, var(--gray-100))', borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <Pill tone="ok">modular {modularCount}종 사용 중</Pill>
        <Pill tone={(engines.observation || 'legacy') === 'modular' ? 'ok' : 'muted'}>관찰일지 {engines.observation || 'legacy'}</Pill>
        <Pill tone={fallbacks.total ? 'warn' : 'muted'}>fallback {fallbacks.total}건</Pill>
        <Pill tone="muted">누적 검수 {report.totalCount}건</Pill>
        <span style={{ flex: 1 }} />
        <GhostBtn onClick={refresh} tone="primary">새로고침</GhostBtn>
      </div>

      {/* 문서 유형별 현재 엔진 + 전환 */}
      <Section title="문서 유형별 기본 엔진" desc="기준을 모두 충족한 유형만 전환할 수 있어요. 전환해도 modular에 문제가 생기면 자동으로 legacy로 되돌아갑니다.">
        {report.types.map((t) => {
          const engine = engines[t.key] || 'legacy';
          const isModular = engine === 'modular';
          const mon = monByKey[t.key];
          let note = null;
          if (isModular && mon) {
            note = `${mon.status} · fallback ${mon.fallbackCount}${mon.switchedAt ? ` · 전환 ${fmtDate(mon.switchedAt)}` : ''}`;
          } else if (t.key === 'observation' && obsAudit) {
            note = (obsAudit.speechFail > 0 || obsAudit.fallback > 0)
              ? `발화 보존 실패 ${obsAudit.speechFail}건 · fallback ${obsAudit.fallback}건 → 전환 보류`
              : `샘플 ${obsAudit.modularPass}/${obsAudit.total} 통과 · 발화실패 0 — 엄격 기준(30건+·factPres 28+) 충족 시 전환`;
          } else if (!isModular) {
            note = t.switchReadiness.ready ? '전환 기준 충족 — 전환 가능' : `전환 보류 (${t.status})`;
          }
          return (
            <div key={t.key} style={{ background: 'var(--gray-50, transparent)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{t.label}</strong>
                  <Pill tone={isModular ? 'ok' : 'muted'}>{engine}</Pill>
                  {isModular && mon && <Pill tone={STATUS_TONE[mon.status] || 'muted'}>{mon.status}</Pill>}
                  {isLiveConnected(t.key) && <span style={{ fontSize: 10, color: 'var(--primary)' }}>● 라이브</span>}
                </div>
                {isModular ? (
                  <GhostBtn onClick={() => revert(t.key)}>legacy로 되돌리기</GhostBtn>
                ) : (
                  <button
                    onClick={() => switchTo(t.key)}
                    disabled={!t.switchReadiness.ready}
                    title={t.switchReadiness.ready ? '' : `전환 기준 미충족 (${t.status})`}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: t.switchReadiness.ready ? 'var(--primary)' : 'var(--gray-300)',
                      color: 'var(--white)', cursor: t.switchReadiness.ready ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {t.switchReadiness.ready ? 'modular 전환' : '전환 보류'}
                  </button>
                )}
              </div>
              {note && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{note}</div>}
            </div>
          );
        })}
      </Section>

      {/* 전환 후 샘플 점검 */}
      <Section
        title="전환 후 샘플 점검"
        desc="선택한 문서 유형의 프리셋 20개를 modular로 생성해 품질을 점검합니다. (검수용 — 사용자 출력과 무관)"
        right={(
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={auditType} onChange={(e) => { setAuditType(e.target.value); setAudit(null); }} style={{ padding: '5px 8px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}>
              {report.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <GhostBtn onClick={runAudit} tone="primary">실행</GhostBtn>
          </div>
        )}
      >
        {!audit ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>아직 실행하지 않았습니다.</div>
        ) : (
          <>
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: auditClean ? 'var(--primary)' : 'var(--accent)' }}>
              {auditClean ? '✅ 전환 적합 — 모든 항목 통과' : '⚠ 보완 필요 — 일부 항목 미달'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Pill tone="ok">성공 {audit.modularPass}/{audit.total}</Pill>
              <Pill tone={audit.fallback ? 'warn' : 'muted'}>fallback {audit.fallback}</Pill>
              <Pill tone="muted">평균 {audit.avgScore} · 최저 {audit.minScore}</Pill>
              <Pill tone={audit.safetyWarnings ? 'danger' : 'muted'}>safety {audit.safetyWarnings}</Pill>
              <Pill tone={audit.below90 ? 'warn' : 'muted'}>90점 미만 {audit.below90}</Pill>
              <Pill tone={audit.internalLabel ? 'danger' : 'muted'}>내부라벨 {audit.internalLabel}</Pill>
              <Pill tone={audit.speechFail ? 'danger' : 'muted'}>발화실패 {audit.speechFail}</Pill>
            </div>
          </>
        )}
      </Section>

      {/* fallback 로그 */}
      <Section
        title={`fallback 로그 · 총 ${fallbacks.total}건`}
        right={<GhostBtn onClick={() => { clearFallbackLog(); setFallbacks(buildFallbackSummary()); }}>로그 비우기</GhostBtn>}
      >
        {fallbacks.total === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>modular 전환 후 legacy로 되돌아간 사례가 아직 없습니다.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {Object.entries(fallbacks.reasonTotals).map(([code, n]) => (
                <Pill key={code} tone="warn">{FALLBACK_REASON_LABELS[code] || code} {n}</Pill>
              ))}
            </div>
            {fallbacks.byType.map((t) => (
              <div key={t.documentType} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>
                {t.label}: {t.count}건 ({Object.entries(t.reasons).map(([c, n]) => `${FALLBACK_REASON_LABELS[c] || c} ${n}`).join(', ')})
              </div>
            ))}
          </>
        )}
      </Section>

      {/* 검수 통계 (유형별) */}
      <Section
        title="검수 통계 (유형별)"
        right={<GhostBtn onClick={() => { clearEngineReviews(); refresh(); }}>검수 데이터 비우기</GhostBtn>}
      >
        {report.totalCount === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            아직 검수 기록이 없습니다. 비교 모드에서 결과를 선택하면 이곳에 누적됩니다.
          </div>
        ) : report.types.filter((t) => t.count > 0).map((t) => {
          const sr = t.switchReadiness;
          return (
            <div key={t.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <strong style={{ fontSize: 13 }}>{t.label} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· 검수 {t.progress}</span></strong>
                <Pill tone={STATUS_TONE[t.status] || 'muted'}>{t.status === '기본 전환 가능' ? '✅ ' : ''}{t.status}</Pill>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Pill>추천률 {pct(t.modularRecommendRate)}</Pill>
                <Pill tone={sr.checks.modularSelectRate ? 'ok' : 'warn'}>선택률 {pct(t.modularSelectRate)}</Pill>
                <Pill tone={sr.checks.editRate ? 'ok' : 'warn'}>수정률 {pct(t.editRate)}</Pill>
                <Pill tone={sr.checks.modularAvg ? 'ok' : 'warn'}>평균 M {t.avgModularScore} / L {t.avgLegacyScore}</Pill>
                <Pill tone={t.scoreDiff >= 0 ? 'ok' : 'warn'}>차 {(t.scoreDiff > 0 ? '+' : '') + t.scoreDiff}</Pill>
                <Pill tone={sr.checks.factPreservation ? 'ok' : 'warn'}>factPres {t.avgModularFact}</Pill>
                <Pill tone={sr.checks.safety ? 'ok' : 'danger'}>safety {t.safetyIssues}</Pill>
                <Pill tone={sr.checks.count ? 'ok' : 'muted'}>검수 {t.count}/{SWITCH_CRITERIA.minCount}</Pill>
              </div>
              {t.lowModular.length > 0 && (
                <details style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
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
      </Section>
    </div>
  );
}
