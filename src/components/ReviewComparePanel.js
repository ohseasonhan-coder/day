import React, { useEffect, useMemo, useState } from 'react';
import {
  FEEDBACK_OPTIONS,
  buildComparison,
  buildReviewReport,
  clearReviewData,
  getReviewEntries,
  hasSeenReviewNotice,
  markReviewNoticeSeen,
  saveReviewEntry,
  toggleFeedbackSelection,
  extractTeacherEditMetadata,
} from '../utils/reviewFeedback';
import { generateObservationWithEngine } from '../utils/ai/llm/engineAdapter';
import { privateServerAdapter } from '../utils/ai/llm/privateServerLLM';
import { parseTargetSections } from '../utils/ai/targetQuality';
import { recordB4RecentPattern } from '../utils/ai/b4/patternMemory';
import { recordTeacherPreferenceFeedback } from '../utils/ai/b4/teacherPreferenceProfile';

const card = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 };
const secTitle = { fontSize: 11.5, fontWeight: 800, color: 'var(--text-tertiary)', margin: '8px 0 3px' };
const secBody = { fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' };

function VariantCard({ v, selections, onToggle, onCopy, editDraft, onEditDraftChange }) {
  const warn = !v.audit?.ok;
  const showEditDraft = selections.includes('edited_after_use');
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{v.title}</span>
        <button onClick={() => onCopy(v)} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--gray-50)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>전체 복사</button>
      </div>
      {['observation', 'learning', 'support'].map((key, index) => {
        const text = v.sections[key];
        if (!text) return null;
        return (
          <div key={key}>
            <div style={secTitle}>[{v.sectionLabels[index]}]</div>
            <div style={secBody}>{text}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 10, padding: '7px 9px', borderRadius: 8, background: 'var(--gray-50)', fontSize: 11, color: warn ? '#B45309' : 'var(--text-tertiary)' }}>
        개발 검토 정보 · 안전 상태: {v.audit?.ok ? '통과' : `${v.audit?.severity === 'major' ? '중대' : '경미'} 경고`}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>이 결과를 어떻게 볼까요?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FEEDBACK_OPTIONS.filter((option) => v.variant === 'C' || !option.key.endsWith('_b2')).map((option) => {
            const on = selections.includes(option.key);
            return (
              <button key={option.key} onClick={() => onToggle(option.key)}
                style={{ padding: '6px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-light)' : 'var(--white)', color: on ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {option.label}
              </button>
            );
          })}
        </div>
        {showEditDraft && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              수정 후 사용한 문장 붙여넣기 · 저장 시 수정 유형만 남고 문장 전문은 저장하지 않습니다.
            </div>
            <textarea
              value={editDraft}
              onChange={(event) => onEditDraftChange(event.target.value)}
              placeholder="수정 후 최종 사용한 문장을 임시로 붙여넣으세요."
              style={{ width: '100%', minHeight: 84, resize: 'vertical', border: '1px solid var(--border)', borderRadius: 10, padding: 9, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ReportView() {
  const r = buildReviewReport(getReviewEntries());
  const row = (label, a, b, c) => (
    <tr><td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{label}</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>{a}</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>{b}</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>{c}</td></tr>
  );
  return (
    <div style={{ ...card, marginTop: 10, fontSize: 12.5 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>검토 리포트</div>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
        피드백 {r.feedbackCount}건 · 선호 응답 {r.preference.n}건 · B 선호 {r.preference.bPreferredRate}% · C 선호 {r.preference.cPreferredRate}%
      </div>
      <div style={{ padding: '8px 10px', marginBottom: 8, borderRadius: 8, background: 'var(--gray-50)', fontWeight: 800 }}>
        권고: {r.recommendation}
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr style={{ fontWeight: 800 }}><td style={{ padding: '4px 8px' }}>지표</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>기존 A</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>B2/B3</td><td style={{ padding: '4px 8px', textAlign: 'center' }}>C</td></tr></thead>
        <tbody>
          {row('그대로 사용 가능', `${r.A.useAsIsRate}%`, `${r.B.useAsIsRate}%`, `${r.C.useAsIsRate}%`)}
          {row('표현 수정 필요', `${r.A.minorWordingRate}%`, `${r.B.minorWordingRate}%`, `${r.C.minorWordingRate}%`)}
          {row('사실과 다름', `${r.A.factMismatchRate}%`, `${r.B.factMismatchRate}%`, `${r.C.factMismatchRate}%`)}
          {row('더 자연스럽게 필요', `${r.A.needNaturalRate}%`, `${r.B.needNaturalRate}%`, `${r.C.needNaturalRate}%`)}
          {row('지원 계획 구체화', `${r.A.needSupportPlanRate}%`, `${r.B.needSupportPlanRate}%`, `${r.C.needSupportPlanRate}%`)}
        </tbody>
      </table>
    </div>
  );
}

function LocalLLMSection({ result, input, childName, setCVariant }) {
  const [status, setStatus] = useState({ state: 'checking', progress: 0, error: '' });
  const [busy, setBusy] = useState(false);
  const [fallbackNote, setFallbackNote] = useState('');
  useEffect(() => { let on = true; privateServerAdapter.getStatus().then((s) => { if (on) setStatus(s); }); return () => { on = false; }; }, []);
  const apply = async () => {
    setBusy(true); setFallbackNote('');
    const output = await generateObservationWithEngine({ input, childName, observation: result.observation, support: result.support, engine: 'auto', reviewMode: true });
    if (output.engineUsed === 'rule-b2') {
      setFallbackNote(`AI 결과가 검수를 통과하지 못해 규칙 결과를 유지했습니다. (${output.fallbackReason || '-'})`);
      setCVariant(null);
    } else {
      const sections = parseTargetSections(output.copyReady);
      setCVariant({
        variant: 'C',
        title: `LLM 결과 · ${output.engineUsed}`,
        sourceEngine: output.engineUsed,
        sections: { observation: sections.observation, learning: sections.learning, support: sections.support },
        sectionLabels: ['관찰내용', '배움 읽기', '교사 지원 및 다음 계획'],
        copyText: output.copyReady,
        audit: output.audit,
        engine: output.engineUsed,
        llmMeta: output.llmMeta,
      });
    }
    setBusy(false);
  };
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'white', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>개인 PC 7B 비교</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{status.state === 'ready' ? '연결됨' : '연결된 경우에만 C안 표시'}</span>
      </div>
      {status.state === 'ready' && (
        <button onClick={apply} disabled={busy} style={{ marginTop: 8, padding: '7px 12px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 800 }}>{busy ? '생성 중...' : 'C안 생성'}</button>
      )}
      {fallbackNote && <div style={{ marginTop: 8, fontSize: 11.5, color: '#B45309' }}>{fallbackNote}</div>}
    </div>
  );
}

export default function ReviewComparePanel({ result, input, childName, resultId, onCopied }) {
  const cmp = useMemo(() => buildComparison({ result, input, childName }), [result, input, childName]);
  const [selA, setSelA] = useState([]);
  const [selB, setSelB] = useState([]);
  const [selC, setSelC] = useState([]);
  const [cVariant, setCVariant] = useState(null);
  const [preferred, setPreferred] = useState('');
  const [editDrafts, setEditDrafts] = useState({ A: '', B: '', C: '' });
  const [savedMsg, setSavedMsg] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [noticeSeen, setNoticeSeen] = useState(hasSeenReviewNotice());

  const thirdVariant = cmp.C || cVariant;
  const preferenceOptions = cmp.blind
    ? [['A', '안 A'], ['B', '안 B'], ['C', '안 C'], ['same', '비슷함']]
    : [['A', '기존 B안'], ['B', result.b3?.enabled ? 'B3 사례기반' : 'B2 규칙 엔진'], ...(thirdVariant ? [['C', thirdVariant.sourceEngine === 'rule-b4' ? 'B4 결과' : 'LLM 결과']] : []), ['same', '비슷함']];

  const copy = async (variant) => {
    try { await navigator.clipboard.writeText(variant.copyText); onCopied?.(); } catch {}
  };

  const traceFor = (variant) => {
    if (variant?.sourceEngine === 'rule-b4') return result.b4?.trace || {};
    if (variant?.sourceEngine === 'rule-b3') return result.b3?.trace || {};
    if (variant?.sourceEngine === 'rule-b2') return result.b2?.trace || {};
    return {};
  };

  const patternMetaForSection = (trace = {}, section = '') => ({
    observation: {
      patternId: trace.observationPatternId || '',
      supportPatternId: '',
      rhythmSignature: trace.rhythmSignatures?.observation || '',
    },
    learning: {
      patternId: trace.learningPatternId || '',
      supportPatternId: '',
      rhythmSignature: trace.rhythmSignatures?.learning || '',
    },
    support: {
      patternId: '',
      supportPatternId: trace.supportPatternId || '',
      rhythmSignature: trace.rhythmSignatures?.support || '',
    },
  }[section] || { patternId: '', supportPatternId: '', rhythmSignature: '' });

  const recordB4Preference = ({ variant, trace, selections, selected, editMeta }) => {
    if ((variant.sourceEngine || variant.engine) !== 'rule-b4') return;
    ['observation', 'learning', 'support'].forEach((section) => {
      const meta = patternMetaForSection(trace, section);
      if (!meta.patternId && !meta.supportPatternId) return;
      recordTeacherPreferenceFeedback({
        section,
        primaryTheme: trace.primaryTheme,
        secondaryTheme: trace.secondaryTheme,
        discourseRelation: trace.discourseRelation || trace.relation,
        patternId: meta.patternId,
        supportPatternId: meta.supportPatternId,
        styleProfile: trace.styleProfile,
        rhythmSignature: meta.rhythmSignature,
        selected,
        finalPreferred: selected || selections.includes('preferred_result'),
        editedAfterUse: selections.includes('edited_after_use'),
        editTags: editMeta?.tagsBySection?.[section] || [],
        selections,
        auditPassed: variant.audit?.severity !== 'major',
      });
    });
  };

  const saveVariantFeedback = (slot, selections) => {
    const variant = cmp[slot] || (slot === 'C' ? cVariant : null);
    if (!variant || !selections.length) return;
    const trace = traceFor(variant);
    const selected = preferred === slot;
    const editText = editDrafts[slot] || '';
    const editMeta = selections.includes('edited_after_use') && editText.trim()
      ? extractTeacherEditMetadata(variant.sections, parseTargetSections(editText))
      : { editTags: [], tagsBySection: {}, editedSections: [] };
    saveReviewEntry({
      kind: 'feedback',
      resultId,
      docType: 'observation',
      variant: variant.variant || slot,
      selections,
      auditCodes: variant.audit?.warnings || [],
      themeIds: trace.themeIds || result.b2?.trace?.themeIds || [],
      engine: variant.sourceEngine || variant.engine || '',
      auditPassed: variant.audit?.severity !== 'major',
      skeletonId: trace.learningPatternId || trace.skeletonId || '',
      variantId: trace.learningVariantId || '',
      learningPatternId: trace.learningPatternId,
      supportPatternId: trace.supportPatternId,
      selectedCandidateId: trace.selectedCandidateIds?.join('|'),
      candidateScore: trace.selectedScores ? Math.round(((trace.selectedScores.learning || 0) + (trace.selectedScores.support || 0)) / 2) : 0,
      discourseRelation: trace.discourseRelation || trace.relation,
      styleProfile: trace.styleProfile,
      selected,
      finalPreferred: selected || selections.includes('preferred_result'),
      editedAfterUse: selections.includes('edited_after_use'),
      rejectedOrHeld: selections.includes('not_used_hold'),
      editTags: editMeta.editTags,
      editedSections: editMeta.editedSections,
    });
    if ((variant.sourceEngine || variant.engine) === 'rule-b4') {
      recordB4RecentPattern({
        primaryTheme: trace.primaryTheme,
        secondaryTheme: trace.secondaryTheme,
        discourseRelation: trace.discourseRelation || trace.relation,
        learningPatternId: trace.learningPatternId,
        supportPatternId: trace.supportPatternId,
        styleProfile: trace.styleProfile,
        rhythmSignature: trace.rhythmSignatures?.learning || '',
        lengthBucket: trace.rhythmSignatures?.learning?.split('|')?.[0] || '',
        firstTokenType: trace.rhythmSignatures?.learning?.split('|')?.[1] || '',
        connectorType: trace.rhythmSignatures?.learning?.split('|')?.[2] || '',
        verbType: trace.rhythmSignatures?.learning?.split('|')?.[3] || '',
        endingType: trace.rhythmSignatures?.learning?.split('|')?.[4] || '',
        sentenceCount: trace.rhythmSignatures?.learning?.includes('two_sentence') ? 2 : 1,
        hasSpeech: trace.rhythmSignatures?.learning?.includes('speech') || false,
        selected,
        feedbackTags: selections,
      });
      recordB4Preference({ variant, trace, selections, selected, editMeta });
    }
  };

  const submit = () => {
    saveVariantFeedback('A', selA);
    saveVariantFeedback('B', selB);
    saveVariantFeedback('C', selC);
    if (preferred) {
      const selectedVariant = cmp[preferred] || (preferred === 'C' ? cVariant : null);
      saveReviewEntry({ kind: 'preference', resultId, docType: 'observation', preferred: selectedVariant?.variant || preferred, engine: selectedVariant?.sourceEngine || selectedVariant?.engine || '' });
    }
    setSavedMsg('피드백을 이 기기에 저장했습니다.');
    setEditDrafts({ A: '', B: '', C: '' });
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const removeAll = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('이 기기에 저장된 검토 데이터만 모두 삭제할까요?')) {
      clearReviewData();
      setSavedMsg('검토 데이터를 삭제했습니다.');
      setTimeout(() => setSavedMsg(''), 2500);
    }
  };

  return (
    <div style={{ marginTop: 14, marginBottom: 14, border: '1.5px dashed var(--primary)', borderRadius: 16, padding: 14, background: 'var(--primary-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>검토 모드 · 같은 입력 결과 비교</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowReport((state) => !state)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{showReport ? '리포트 닫기' : '검토 리포트'}</button>
          <button onClick={removeAll} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>검토 데이터 삭제</button>
        </div>
      </div>
      {!noticeSeen && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'white', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.6 }}>
          기록과 피드백은 <b>이 기기에만 저장</b>되며 외부로 전송하지 않습니다. 백업·동기화에서도 제외됩니다.
          <button onClick={() => { markReviewNoticeSeen(); setNoticeSeen(true); }} style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>확인</button>
        </div>
      )}
      {showReport && <ReportView />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 10 }}>
        <VariantCard v={cmp.A} selections={selA} onToggle={(key) => setSelA(toggleFeedbackSelection(selA, key))} onCopy={copy} editDraft={editDrafts.A} onEditDraftChange={(value) => setEditDrafts((state) => ({ ...state, A: value }))} />
        <VariantCard v={cmp.B} selections={selB} onToggle={(key) => setSelB(toggleFeedbackSelection(selB, key))} onCopy={copy} editDraft={editDrafts.B} onEditDraftChange={(value) => setEditDrafts((state) => ({ ...state, B: value }))} />
        {thirdVariant && <VariantCard v={thirdVariant} selections={selC} onToggle={(key) => setSelC(toggleFeedbackSelection(selC, key))} onCopy={copy} editDraft={editDrafts.C} onEditDraftChange={(value) => setEditDrafts((state) => ({ ...state, C: value }))} />}
      </div>
      {!result.b4?.enabled && <LocalLLMSection result={result} input={input} childName={childName} setCVariant={setCVariant} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>실제로 더 좋은 쪽</span>
        {preferenceOptions.map(([key, label]) => (
          <button key={key} onClick={() => setPreferred(key)} style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: `1.5px solid ${preferred === key ? 'var(--primary)' : 'var(--border)'}`, background: preferred === key ? 'var(--primary)' : 'white', color: preferred === key ? 'white' : 'var(--text-secondary)' }}>{label}</button>
        ))}
        <button onClick={submit} disabled={!selA.length && !selB.length && !selC.length && !preferred}
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 12, border: 'none', background: (selA.length || selB.length || selC.length || preferred) ? 'var(--primary)' : 'var(--gray-100)', color: (selA.length || selB.length || selC.length || preferred) ? 'white' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 800 }}>
          피드백 저장
        </button>
      </div>
      {savedMsg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>{savedMsg}</div>}
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>검토 데이터는 원문과 생성 전문 없이 최근 메타데이터만 이 기기에 저장됩니다.</div>
    </div>
  );
}
