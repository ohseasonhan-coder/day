﻿﻿﻿﻿﻿import React, { useState, useEffect, useRef } from 'react';
import { getChildren, getClasses, addRecord, CATEGORIES, today } from '../utils/storage';
import { processRecord } from '../utils/ai';
import { Sparkles, ChevronDown, Copy, Check, RotateCcw, Save } from 'lucide-react';


export default function RecordPage({ context, onNavigate }) {
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const ch = getChildren();
    const cl = getClasses();
    setChildren(ch);
    setClasses(cl);
    if (context?.childId) {
      const found = ch.find(c => c.id === context.childId);
      if (found) setSelectedChild(found);
    }
  }, [context]);

  const cl = classes[0];

  const handleProcess = async () => {
    if (!selectedChild) return setError('?占쎌씠占??占쏀깮?占쎌＜?占쎌슂');
    if (!rawText.trim()) return setError('湲곕줉 ?占쎌슜???占쎈젰?占쎌＜?占쎌슂');
    setError('');
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await processRecord({
        childName: selectedChild.name,
        rawText: rawText.trim(),
        classAge: cl?.age,
      });
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result || !selectedChild) return;
    addRecord({
      childId: selectedChild.id,
      childName: selectedChild.name,
      date: today(),
      rawText,
      ...result,
    });
    setSaved(true);
  };

  const handleReset = () => {
    setResult(null);
    setRawText('');
    setError('');
    setSaved(false);
    textareaRef.current?.focus();
  };

  const cat = result?.category ? CATEGORIES[result.category] : null;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>기록하기</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>吏㏐쾶 ?占쎈룄 AI媛 ?占쎈룞?占쎈줈 ?占쎈━?占쎈뱶?占쎌슂</div>
      </div>

      {/* Child Selector */}
      <div style={{ marginBottom: 16 }}>
        <Label>?占쎌씠 ?占쏀깮</Label>
        <button
          onClick={() => setShowChildPicker(!showChildPicker)}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 15, cursor: 'pointer', color: selectedChild ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          <span>{selectedChild ? selectedChild.name : '?占쎌씠占??占쏀깮?占쎌＜?占쎌슂'}</span>
          <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', transform: showChildPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showChildPicker && (
          <div style={{
            background: 'white', border: '1.5px solid var(--border)',
            borderRadius: 12, marginTop: 4, overflow: 'hidden',
            boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto',
          }}>
            {children.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedChild(c); setShowChildPicker(false); }}
                style={{
                  width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 15,
                  background: selectedChild?.id === c.id ? 'var(--primary-light)' : 'transparent',
                  color: selectedChild?.id === c.id ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: selectedChild?.id === c.id ? 600 : 400,
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text Input */}
      <div style={{ marginBottom: 16 }}>
        <Label>愿占?湲곕줉</Label>
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="吏㏐쾶 ?占쎈룄 愿쒖갖?占쎌슂.&#10;&#10;?? ?占쏙옙??占쏙옙? 移쒓뎄 ?占쎈룞李⑨옙? 媛?占쏙옙?占??占쎌뼱 ?占쎌뿀?? 李⑨옙? 湲곕떎由ъ옄占??占쎌빞湲고빐以щ떎."
          style={{
            width: '100%', minHeight: 120, padding: '14px 16px',
            borderRadius: 12, border: '1.5px solid var(--border)',
            fontSize: 15, lineHeight: 1.7, resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', color: 'var(--text-primary)',
            background: 'white',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {rawText.length}??        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Process Button */}
      {!result && (
        <button
          onClick={handleProcess}
          disabled={loading}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: loading ? 'var(--gray-300)' : 'var(--primary)',
            color: 'white', fontSize: 16, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading ? 'none' : '0 4px 16px rgba(79,127,255,0.35)',
            transition: 'all 0.2s',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              AI媛 遺꾩꽍 以묒씠?占쎌슂...
            </>
          ) : (
            <><Sparkles size={18} /> AI ?占쎈룞 ?占쎈━?占쎄린</>
          )}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="slide-up">
          {/* Category Badge */}
          {cat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{
                background: cat.bg, color: cat.color,
                padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
              }}>
                {cat.emoji} {cat.label}
              </span>
              {result.tags?.map(tag => (
                <span key={tag} style={{
                  background: 'var(--gray-100)', color: 'var(--text-secondary)',
                  padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Dev Areas */}
          {result.devAreas?.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.devAreas.map(area => (
                <span key={area} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--gray-100)', padding: '3px 10px', borderRadius: 100 }}>
                  {area}
                </span>
              ))}
            </div>
          )}

          {/* Document sections */}
          <ResultSection title="관찰일지용" text={result.observation} />
          <ResultSection title="부모상담용" text={result.parent} accent />
          <ResultSection title="지원계획" text={result.support} />

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <button onClick={handleReset} style={{
              padding: '13px', borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'white', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
            }}>
              <RotateCcw size={15} /> ?占쎌떆 ?占쎈젰
            </button>
            <button
              onClick={handleSave}
              disabled={saved}
              style={{
                padding: '13px', borderRadius: 12, border: 'none',
                background: saved ? 'var(--cat-play)' : 'var(--primary)',
                fontSize: 14, fontWeight: 600, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
                boxShadow: saved ? 'none' : '0 4px 12px rgba(79,127,255,0.3)',
              }}
            >
              {saved ? <><Check size={15} /> 저장완료!</> : <><Save size={15} /> 저장하기</>}
            </button>
          </div>

          {saved && (
            <button onClick={handleReset} style={{
              width: '100%', marginTop: 10, padding: '12px', borderRadius: 12,
              background: 'var(--primary-light)', color: 'var(--primary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
            }}>
              + ?占쎈Ⅸ ?占쎌씠 湲곕줉?占쎄린
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
}

function ResultSection({ title, text, accent }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!text) return null;

  return (
    <div style={{
      background: accent ? 'var(--primary-light)' : 'white',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 14, padding: 16, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>
          {title}
        </span>
        <button onClick={handleCopy} style={{
          fontSize: 12, color: accent ? 'var(--primary)' : 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          background: 'transparent', border: 'none', padding: '4px 8px', borderRadius: 6,
          transition: 'background 0.1s',
        }}>
          {copied ? <><Check size={13} /> 蹂듭궗</> : <><Copy size={13} /> 蹂듭궗</>}
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </div>
  );
}
