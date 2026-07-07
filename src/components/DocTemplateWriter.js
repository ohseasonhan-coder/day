// 서식 문서 작성(일반 교사용) — 공개된 서식만 선택해 작성한다.
// 필드 키·블록 구조·내부 JSON·AI 엔진 선택값·서버 주소는 노출하지 않는다(라벨만 표시).
// 흐름: 서식 선택 → 자동 입력 채움 → 직접 입력 작성 → AI 생성(규칙/7B→audit→fallback) → 미리보기·수정 → 복사.
import React, { useMemo, useState } from 'react';
import {
  FIELD_DICTIONARY, listPublishedTemplates, renderInstance, extractTags, buildAutoValues, generateAIFieldValues,
} from '../utils/docTemplates';

const btn = (primary) => ({ padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--primary)' : 'white', color: primary ? 'white' : 'var(--text-secondary)' });
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 };

export default function DocTemplateWriter({ childName = '', childAge = '', className = '', teacherName = '', memoText = '', ruleObservation = '', ruleSupport = '' }) {
  const templates = useMemo(() => listPublishedTemplates(), []);
  const [selected, setSelected] = useState(null);
  const [manual, setManual] = useState({});
  const [aiValues, setAiValues] = useState({});
  const [finalText, setFinalText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  if (templates.length === 0) return null; // 공개 서식이 없으면 아무것도 노출하지 않음

  const auto = buildAutoValues({ childName, childAge, className, teacherName });
  const tags = selected ? extractTags(selected) : [];
  const manualTags = tags.filter((k) => FIELD_DICTIONARY[k]?.valueType === 'manual');
  const aiTags = tags.filter((k) => FIELD_DICTIONARY[k]?.valueType === 'ai');
  const values = { ...auto, ...aiValues, ...manual }; // 직접 입력이 항상 우선(AI가 덮어쓰지 않음)

  const pick = (t) => { setSelected(t); setManual({}); setAiValues({}); setFinalText(''); setNote(''); setCopied(false); };

  const runAI = async () => {
    setBusy(true); setNote('');
    const r = await generateAIFieldValues({
      input: memoText, childName, ruleObservation, ruleSupport, engine: 'private-server-7b', manualValues: manual,
    });
    setAiValues(r.values);
    if (r.engineUsed === 'rule') setNote('규칙 엔진 결과로 채웠어요.'); // fallback 사유는 노출하지 않음(개발 정보)
    else setNote('AI 문장으로 채웠어요. 검토 후 수정할 수 있어요.');
    setBusy(false);
  };
  const preview = () => setFinalText(renderInstance(selected, values).text); // 인스턴스 — 원본 서식 불변
  const copy = async () => { try { await navigator.clipboard.writeText(finalText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>📑 서식 문서 작성</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {templates.map((t) => (
          <button key={t.templateId} onClick={() => pick(t)}
            style={{ ...btn(selected?.templateId === t.templateId), textAlign: 'left' }}>
            {t.title}{t.description ? ` — ${t.description}` : ''}
          </button>
        ))}
      </div>

      {selected && (
        <div>
          {manualTags.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {manualTags.map((k) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>{FIELD_DICTIONARY[k].label}</div>
                  <input value={manual[k] || ''} placeholder={FIELD_DICTIONARY[k].placeholder}
                    onChange={(e) => setManual({ ...manual, [k]: e.target.value })} style={inputStyle} />
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {aiTags.length > 0 && <button onClick={runAI} disabled={busy || !memoText} style={btn(true)}>{busy ? '생성 중…' : 'AI로 문장 채우기'}</button>}
            <button onClick={preview} style={btn(!aiTags.length)}>완성 문서 미리보기</button>
          </div>
          {note && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{note}</div>}
          {finalText !== '' && (
            <div>
              <textarea value={finalText} onChange={(e) => setFinalText(e.target.value)} rows={10}
                style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap', lineHeight: 1.7 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={copy} style={btn(true)}>{copied ? '복사됨 ✓' : '전체 복사'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
