import React, { useState } from 'react';
import { INTERNAL_DOC_TYPES, getInternalDocType, generateInternalDoc } from '../utils/internalDocs';
import { getInternalDocs, addInternalDoc, deleteInternalDoc, today, formatDate } from '../utils/storage';
import { exportDocx } from '../utils/docxExport';
import { useToast } from '../components/Toast';
import { FileText, Copy, Check, Download, ArrowLeft, Trash2, Sparkles } from 'lucide-react';

// 원내문서: 입력 → 유형 선택 → 초안 생성 → 교사 검토 → 저장/복사/Word
export default function InternalDocsPage({ isDesktop }) {
  const showToast = useToast();
  const [step, setStep] = useState('list');     // 'list' | 'form' | 'result'
  const [typeKey, setTypeKey] = useState(null);
  const [values, setValues] = useState({});
  const [doc, setDoc] = useState(null);
  const [history, setHistory] = useState(() => getInternalDocs());

  const docType = getInternalDocType(typeKey);

  const startNew = (key) => {
    setTypeKey(key);
    setValues({ date: today() });
    setDoc(null);
    setStep('form');
  };

  const handleGenerate = () => {
    const generated = generateInternalDoc(typeKey, values);
    setDoc(generated);
    setStep('result');
  };

  const handleSave = () => {
    const saved = addInternalDoc({ typeKey, typeLabel: docType?.label, title: doc.title, badge: doc.badge, sections: doc.sections, values });
    setHistory(getInternalDocs());
    showToast('문서함에 저장했어요 📁', 'success');
    setDoc({ ...doc, _savedId: saved.id });
  };

  const docToText = (d) =>
    `${d.title}\n${d.badge || ''}\n\n` + (d.sections || []).map(s => `[${s.title}]\n${s.text}`).join('\n\n');

  const handleCopy = () => {
    navigator.clipboard?.writeText(docToText(doc)).catch(() => {});
    showToast('복사했어요 📋', 'success');
  };

  const handleWord = async () => {
    try { await exportDocx(doc); showToast('Word로 저장했어요', 'success'); }
    catch { showToast('Word 생성 중 오류가 났어요', 'error'); }
  };

  const pad = isDesktop ? '32px 36px' : '20px';

  // ── 목록 화면 ──
  if (step === 'list') {
    return (
      <div style={{ padding: pad }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.6px' }}>원내문서</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>입력만 하면 행정 문서 초안이 자동으로 채워져요. 검토 후 저장·복사·Word로 내보내세요.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 24 }}>
          {INTERNAL_DOC_TYPES.map(t => (
            <button key={t.key} onClick={() => startNew(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderRadius: 16,
              background: 'var(--white)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', textAlign: 'left',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>{t.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>최근 저장한 원내문서</div>
            {history.slice(0, 20).map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8 }}>
                <FileText size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{h.typeLabel} · {formatDate(h.createdAt?.slice(0, 10))}</div>
                </div>
                <button onClick={() => { setDoc({ title: h.title, badge: h.badge, sections: h.sections, _savedId: h.id }); setTypeKey(h.typeKey); setStep('result'); }} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12, fontWeight: 800 }}>열기</button>
                <button onClick={() => { if (window.confirm('이 문서를 삭제할까요?')) { deleteInternalDoc(h.id); setHistory(getInternalDocs()); } }} style={{ padding: '6px 9px', borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12, fontWeight: 800 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 입력 폼 화면 ──
  if (step === 'form') {
    const required = docType.fields.filter(f => !f.optional);
    const filled = required.every(f => String(values[f.key] || '').trim());
    return (
      <div style={{ padding: pad, maxWidth: 720, margin: '0 auto' }}>
        <button onClick={() => setStep('list')} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          <ArrowLeft size={18} /> 원내문서 목록
        </button>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{docType.icon} {docType.label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>아는 만큼만 입력하면 돼요. 빈칸은 일반적인 문구로 채워집니다.</div>

        {docType.fields.map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {f.label}{!f.optional && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
            </div>
            {f.type === 'textarea' ? (
              <textarea
                value={values[f.key] || ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', minHeight: 90, padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: 'var(--white)', color: 'var(--text-primary)' }}
              />
            ) : (
              <input
                type={f.type === 'date' ? 'date' : 'text'}
                value={values[f.key] || ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'var(--white)', color: 'var(--text-primary)' }}
              />
            )}
          </div>
        ))}

        <button onClick={handleGenerate} disabled={!filled} style={{
          width: '100%', padding: '16px', borderRadius: 14, marginTop: 6,
          background: filled ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--gray-300)',
          color: 'white', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: filled ? '0 8px 24px rgba(79,127,255,0.35)' : 'none',
        }}>
          <Sparkles size={18} /> 문서 초안 만들기
        </button>
        {!filled && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>* 표시된 항목을 채우면 만들 수 있어요</div>}
      </div>
    );
  }

  // ── 결과(검토) 화면 ──
  return (
    <div style={{ padding: pad, maxWidth: 760, margin: '0 auto' }}>
      <button onClick={() => setStep(typeKey && docType ? 'form' : 'list')} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
        <ArrowLeft size={18} /> {docType ? '다시 입력' : '목록'}
      </button>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={handleCopy} style={{ flex: 1, minWidth: 100, padding: '13px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Copy size={15} /> 복사하기
        </button>
        <button onClick={handleWord} style={{ flex: 1, minWidth: 100, padding: '13px', borderRadius: 12, background: '#2B579A', color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Download size={15} /> Word
        </button>
        {!doc?._savedId && (
          <button onClick={handleSave} style={{ flex: 1, minWidth: 100, padding: '13px', borderRadius: 12, background: 'var(--white)', border: '2px solid var(--primary)', color: 'var(--primary)', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Check size={15} /> 문서함 저장
          </button>
        )}
      </div>

      {/* 문서 미리보기 (섹션별 수정 가능) */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: isDesktop ? '28px 32px' : '20px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 19, fontWeight: 900, textAlign: 'center' }}>{doc.title}</div>
        {doc.badge && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4, marginBottom: 18 }}>{doc.badge}</div>}
        {(doc.sections || []).map((s, i) => (
          <div key={i} style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)', borderBottom: '2px solid var(--primary-light)', paddingBottom: 5, marginBottom: 8 }}>{s.title}</div>
            <textarea
              value={s.text}
              onChange={e => setDoc(d => ({ ...d, sections: d.sections.map((sec, idx) => idx === i ? { ...sec, text: e.target.value } : sec), _savedId: undefined }))}
              style={{ width: '100%', minHeight: 60, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.8, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: 'var(--gray-50)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
        입력한 내용을 바탕으로 만든 초안이에요. 내용을 직접 수정한 뒤 복사·저장·Word로 내보내세요.
      </div>
    </div>
  );
}
