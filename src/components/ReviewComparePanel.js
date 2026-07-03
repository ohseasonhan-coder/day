// 교사 검토 모드 패널(4단계) — 같은 입력에서 A안(기존)/B안(개선)을 나란히 비교하고
// 피드백을 "이 기기 로컬"에만 저장한다. 점수·audit 사유는 개발 검토 정보로 작게 표시.
import React, { useEffect, useMemo, useState } from 'react';
import {
  FEEDBACK_OPTIONS, buildComparison, toggleFeedbackSelection, saveReviewEntry,
  hasSeenReviewNotice, markReviewNoticeSeen, buildReviewReport, getReviewEntries, clearReviewData,
} from '../utils/reviewFeedback';
import { generateObservationWithEngine } from '../utils/ai/llm/engineAdapter';
import { embeddedAdapter, EMBEDDED_MODEL_ID } from '../utils/ai/llm/embeddedLLM';
import { parseTargetSections } from '../utils/ai/targetQuality';

const card = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 };
const secTitle = { fontSize: 11.5, fontWeight: 800, color: 'var(--text-tertiary)', margin: '8px 0 3px' };
const secBody = { fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' };

function VariantCard({ v, selections, onToggle, memo, onMemo, onCopy }) {
  const warn = !v.audit.ok;
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{v.title}</span>
        <button onClick={() => onCopy(v)} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--gray-50)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>전체 복사</button>
      </div>
      {[0, 1, 2].map((i) => {
        const key = ['observation', 'learning', 'support'][i];
        const text = v.sections[key];
        if (!text) return null;
        return (
          <div key={key}>
            <div style={secTitle}>[{v.sectionLabels[i]}]</div>
            <div style={secBody}>{text}</div>
          </div>
        );
      })}
      {/* 개발 검토 정보(교사용 점수 강조 금지 — 작게 표시) */}
      <div style={{ marginTop: 10, padding: '7px 9px', borderRadius: 8, background: 'var(--gray-50)', fontSize: 11, color: warn ? '#B45309' : 'var(--text-tertiary)' }}>
        개발 검토 정보 · 안전 상태: {v.audit.ok ? '통과' : `${v.audit.severity === 'major' ? '중대' : '경미'} 경고`}
        {warn && ` — ${(v.audit.details || []).slice(0, 3).map((d) => d.message).join(' · ')}`}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>이 결과는 어땠나요? (복수 선택)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FEEDBACK_OPTIONS.map((o) => {
            const on = selections.includes(o.key);
            return (
              <button key={o.key} onClick={() => onToggle(o.key)}
                style={{ padding: '6px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-light)' : 'var(--white)', color: on ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <input value={memo} onChange={(e) => onMemo(e.target.value)} placeholder="한 줄 메모(선택, 이 기기에만 저장)" maxLength={120}
          style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12.5 }} />
      </div>
    </div>
  );
}

function ReportView() {
  const r = buildReviewReport(getReviewEntries());
  const row = (label, a, b) => (
    <tr><td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{label}</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>{a}</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>{b}</td></tr>
  );
  return (
    <div style={{ ...card, marginTop: 10, fontSize: 12.5 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>검토 리포트 (이 기기 로컬 집계 · 원문 미포함)</div>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
        검토 {r.feedbackCount}건 · 선호 응답 {r.preference.n}건 (B안 선호 {r.preference.bPreferredRate}%) · 수정 표본 {r.editing.n}건(수정률 {r.editing.editedRate}%, 평균 {r.editing.avgEditLen}자)
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr style={{ fontWeight: 800 }}><td style={{ padding: '4px 8px' }}>지표</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>A안(n={r.A.n})</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>B안(n={r.B.n})</td></tr></thead>
        <tbody>
          {row('그대로 사용 가능', `${r.A.useAsIsRate}%`, `${r.B.useAsIsRate}%`)}
          {row('표현만 약간 수정', `${r.A.minorWordingRate}%`, `${r.B.minorWordingRate}%`)}
          {row('사실과 다름', `${r.A.factMismatchRate}%`, `${r.B.factMismatchRate}%`)}
          {row('더 자연스럽게 필요', `${r.A.needNaturalRate}%`, `${r.B.needNaturalRate}%`)}
          {row('더 구체적 지원 계획', `${r.A.needSupportPlanRate}%`, `${r.B.needSupportPlanRate}%`)}
        </tbody>
      </table>
      {Object.keys(r.editing.sectionFocus).length > 0 && (
        <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>섹션별 수정 집중: {Object.entries(r.editing.sectionFocus).map(([s, n]) => `${s} ${n}회`).join(' · ')}</div>
      )}
      {r.recentPatterns.length > 0 && (
        <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>최근 20건 반복 유형: {r.recentPatterns.slice(0, 3).map((p) => `${p.label} ${p.count}회`).join(' · ')}</div>
      )}
      {r.factCauses.length > 0 && (
        <div style={{ marginTop: 4, color: '#B45309' }}>사실 오류 시 감지 코드: {r.factCauses.map((c) => `${c.code}×${c.count}`).join(' · ')}</div>
      )}
    </div>
  );
}

// 앱 내장형 로컬 LLM(실험) 섹션 — 검토 flag 안에서만 노출. 규칙 결과를 덮어쓰지 않고 C안으로만 표시.
// 상태: 미준비/다운로드 필요/준비 중(진행률)/사용 가능/기기 미지원/실패 → 실패·미지원은 규칙 결과 그대로.
function LocalLLMSection({ result, input, childName, cVariant, setCVariant }) {
  const [status, setStatus] = useState({ state: 'idle', progress: 0, error: '' });
  const [busy, setBusy] = useState(false);
  const [fallbackNote, setFallbackNote] = useState('');
  useEffect(() => { let on = true; embeddedAdapter.getStatus().then((s) => { if (on) setStatus(s); }); return () => { on = false; }; }, []);

  const prepare = async () => {
    setBusy(true); setFallbackNote('');
    setStatus({ state: 'preparing', progress: 0, error: '' });
    const r = await embeddedAdapter.prepare((p) => setStatus({ state: 'preparing', progress: p, error: '' }));
    setStatus(await embeddedAdapter.getStatus());
    if (!r.ok && r.error !== 'unsupported') setFallbackNote(`엔진 준비 실패(${r.error}) — 규칙 기반 결과를 그대로 사용해요.`);
    setBusy(false);
  };
  const apply = async () => {
    setBusy(true); setFallbackNote('');
    const r = await generateObservationWithEngine({ input, childName, observation: result.observation, support: result.support, engine: 'embedded-local-llm' });
    if (r.engineUsed === 'rule') {
      setFallbackNote(`AI 결과가 검수를 통과하지 못해 규칙 결과를 유지했어요. (개발 정보: ${r.fallbackReason || '-'})`);
      setCVariant(null);
    } else {
      const s = parseTargetSections(r.copyReady);
      setCVariant({
        variant: 'C', title: 'C안 · 로컬 AI(실험)',
        sections: { observation: s.observation, learning: s.learning, support: s.support },
        sectionLabels: ['관찰내용(규칙 보존)', '배움 읽기(AI)', '교사 지원 및 다음 계획(AI)'],
        copyText: r.copyReady, audit: r.audit,
      });
    }
    setBusy(false);
  };
  const removeModel = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('내려받은 AI 모델 파일을 이 기기에서 삭제할까요? (다시 쓰려면 재다운로드)')) return;
    await embeddedAdapter.deleteCache();
    setCVariant(null);
    setStatus(await embeddedAdapter.getStatus());
  };

  const stateLabel = {
    idle: '모델 준비 필요(캐시 있음 — 초기화만)', 'need-download': '모델 다운로드 필요(최초 1회, 이후 기기 캐시)',
    preparing: `AI 문장 엔진 준비 중… ${status.progress}%`, ready: '사용 가능',
    unsupported: '이 기기(브라우저)는 로컬 AI 미지원 — 규칙 엔진 사용', error: `실패: ${status.error}`,
  }[status.state] || status.state;

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'white', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>🧪 AI 문장 엔진(앱 내장 로컬 · 실험)</span>
        <span style={{ fontSize: 11.5, color: status.state === 'error' ? '#DC2626' : 'var(--text-tertiary)' }}>{stateLabel}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        문장 생성은 이 기기 안에서만 실행돼요(기록·결과 외부 전송 없음). 모델은 최초 1회만 내려받아 기기에 저장돼요.
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {(status.state === 'need-download' || status.state === 'idle' || status.state === 'error') && (
          <button onClick={prepare} disabled={busy} style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12, fontWeight: 800 }}>AI 문장 엔진 준비</button>
        )}
        {status.state === 'ready' && (
          <button onClick={apply} disabled={busy} style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 800 }}>{busy ? '생성 중…' : '더 자연스러운 AI 문장 적용 (C안 생성)'}</button>
        )}
        {status.state !== 'need-download' && status.state !== 'unsupported' && (
          <button onClick={removeModel} disabled={busy} style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', color: '#DC2626', fontSize: 12, fontWeight: 700 }}>모델 삭제</button>
        )}
      </div>
      {status.state === 'preparing' && (
        <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'var(--gray-100)', overflow: 'hidden' }}>
          <div style={{ width: `${status.progress}%`, height: '100%', background: 'var(--primary)', transition: 'width .3s' }} />
        </div>
      )}
      {fallbackNote && <div style={{ marginTop: 8, fontSize: 11.5, color: '#B45309' }}>{fallbackNote}</div>}
      <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-tertiary)' }}>모델: {EMBEDDED_MODEL_ID} (Apache-2.0) · WebGPU 필요 · 원문·프롬프트·AI 전문은 저장하지 않아요.</div>
    </div>
  );
}

export default function ReviewComparePanel({ result, input, childName, resultId, onCopied }) {
  const cmp = useMemo(() => buildComparison({ result, input, childName }), [result, input, childName]);
  const [selA, setSelA] = useState([]);
  const [selB, setSelB] = useState([]);
  const [selC, setSelC] = useState([]);
  const [cVariant, setCVariant] = useState(null);
  const [memoA, setMemoA] = useState('');
  const [memoB, setMemoB] = useState('');
  const [preferred, setPreferred] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [noticeSeen, setNoticeSeen] = useState(hasSeenReviewNotice());

  const copy = async (v) => {
    try { await navigator.clipboard.writeText(v.copyText); onCopied?.(); } catch {}
  };
  const submit = () => {
    if (selA.length) saveReviewEntry({ kind: 'feedback', resultId, docType: 'observation', variant: 'A', selections: selA, memo: memoA, auditCodes: cmp.A.audit.warnings });
    if (selB.length) saveReviewEntry({ kind: 'feedback', resultId, docType: 'observation', variant: 'B', selections: selB, memo: memoB, auditCodes: cmp.B.audit.warnings });
    if (cVariant && selC.length) saveReviewEntry({ kind: 'feedback', resultId, docType: 'observation', variant: 'C', selections: selC, memo: '', auditCodes: cVariant.audit?.warnings });
    if (preferred) saveReviewEntry({ kind: 'preference', resultId, docType: 'observation', preferred });
    setSavedMsg('피드백을 이 기기에 저장했어요.');
    setTimeout(() => setSavedMsg(''), 2500);
  };
  const removeAll = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('이 기기에 저장된 검토 데이터(피드백·수정 비교·집계)를 모두 삭제할까요?')) {
      clearReviewData();
      setSavedMsg('검토 데이터를 삭제했어요.');
      setTimeout(() => setSavedMsg(''), 2500);
    }
  };

  return (
    <div style={{ marginTop: 14, marginBottom: 14, border: '1.5px dashed var(--primary)', borderRadius: 16, padding: 14, background: 'var(--primary-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>🔍 검토 모드 — 같은 입력, 두 가지 결과 비교</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowReport((s) => !s)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{showReport ? '리포트 닫기' : '검토 리포트'}</button>
          <button onClick={removeAll} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>검토 데이터 삭제</button>
        </div>
      </div>
      {!noticeSeen && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'white', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.6 }}>
          🔒 기록과 피드백은 <b>이 기기에만 저장</b>되며 외부로 전송되지 않아요. 백업·동기화에서도 제외됩니다.
          <button onClick={() => { markReviewNoticeSeen(); setNoticeSeen(true); }} style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>확인</button>
        </div>
      )}
      {showReport && <ReportView />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 10 }}>
        <VariantCard v={cmp.A} selections={selA} onToggle={(k) => setSelA(toggleFeedbackSelection(selA, k))} memo={memoA} onMemo={setMemoA} onCopy={copy} />
        <VariantCard v={cmp.B} selections={selB} onToggle={(k) => setSelB(toggleFeedbackSelection(selB, k))} memo={memoB} onMemo={setMemoB} onCopy={copy} />
        {cVariant && (
          <VariantCard v={cVariant} selections={selC} onToggle={(k) => setSelC(toggleFeedbackSelection(selC, k))} memo={''} onMemo={() => {}} onCopy={copy} />
        )}
      </div>
      <LocalLLMSection result={result} input={input} childName={childName} cVariant={cVariant} setCVariant={setCVariant} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>실제로 쓰기에 더 좋은 쪽:</span>
        {[['A', 'A안'], ['B', 'B안'], ['same', '비슷함']].map(([k, label]) => (
          <button key={k} onClick={() => setPreferred(k)} style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: `1.5px solid ${preferred === k ? 'var(--primary)' : 'var(--border)'}`, background: preferred === k ? 'var(--primary)' : 'white', color: preferred === k ? 'white' : 'var(--text-secondary)' }}>{label}</button>
        ))}
        <button onClick={submit} disabled={!selA.length && !selB.length && !preferred}
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 12, border: 'none', background: (selA.length || selB.length || preferred) ? 'var(--primary)' : 'var(--gray-100)', color: (selA.length || selB.length || preferred) ? 'white' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 800 }}>
          피드백 저장
        </button>
      </div>
      {savedMsg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>{savedMsg}</div>}
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>피드백은 이 기기에만 저장되고 외부로 전송되지 않아요. 최근 200건까지 보관돼요.</div>
    </div>
  );
}
