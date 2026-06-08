import React, { useState, useEffect, useRef } from 'react';
import { getChildren, getClasses, addRecord, CATEGORIES, today } from '../utils/storage';
import { processRecord } from '../utils/ai';
import { Sparkles, ChevronDown, Copy, Check, RotateCcw, Save, Mic, Zap } from 'lucide-react';

const RECORD_PRESETS = [
  { key: 'observe', label: '관찰기록', hint: '놀이·상호작용·생활습관을 짧게 입력' },
  { key: 'notice', label: '알림장', hint: '부모님께 전달할 내용을 부드럽게 정리' },
  { key: 'consult', label: '상담메모', hint: '상담자료로 이어질 성장 포인트 기록' },
  { key: 'special', label: '안전/특이사항', hint: '상처·건강·투약·행사 상황 기록' },
];

const EXAMPLES = [
  '친구와 블록으로 캠핑장을 만들며 역할을 나누어 놀이했다. 중간에 차례 문제로 속상해했지만 교사의 안내 후 다시 함께 놀이했다.',
  '바깥놀이에서 나뭇잎과 돌멩이를 모으며 크기를 비교했고, 왜 색이 다른지 궁금해하며 질문했다.',
  '점심시간에 처음 보는 반찬을 조금 맛본 뒤 스스로 물을 마시고 식판을 정리했다.',
];

export default function RecordPage({ context, onNavigate }) {
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [recordType, setRecordType] = useState('observe');
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
  const currentPreset = RECORD_PRESETS.find(p => p.key === recordType);

  const handleProcess = async () => {
    if (!selectedChild) return setError('먼저 아이를 선택해 주세요.');
    if (!rawText.trim()) return setError('기록할 내용을 입력해 주세요.');
    setError('');
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await processRecord({
        childName: selectedChild.name,
        rawText: rawText.trim(),
        classAge: cl?.age,
        recordType,
      });
      setResult({ ...res, recordType });
    } catch (e) {
      setError(e.message || '기록을 정리하는 중 오류가 발생했어요.');
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
      recordType,
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          <Zap size={13} /> 3분 기록 자동화
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.7px' }}>짧게 쓰면 문서가 만들어져요</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          교사는 상황만 남기고, 앱이 관찰일지·부모상담 문장·지원계획으로 정리합니다.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {RECORD_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setRecordType(p.key)}
            style={{
              background: recordType === p.key ? 'var(--primary)' : 'white',
              color: recordType === p.key ? 'white' : 'var(--text-primary)',
              border: `1px solid ${recordType === p.key ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 14,
              padding: '12px',
              textAlign: 'left',
              boxShadow: recordType === p.key ? '0 8px 18px rgba(79,127,255,0.22)' : 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{p.label}</div>
            <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.45 }}>{p.hint}</div>
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label>아이 선택</Label>
        <button
          onClick={() => setShowChildPicker(!showChildPicker)}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 14,
            border: '1.5px solid var(--border)', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 15, cursor: 'pointer', color: selectedChild ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span>{selectedChild ? selectedChild.name : '아이를 선택해 주세요'}</span>
          <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', transform: showChildPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showChildPicker && (
          <div style={{
            background: 'white', border: '1.5px solid var(--border)',
            borderRadius: 14, marginTop: 6, overflow: 'hidden',
            boxShadow: 'var(--shadow-md)', maxHeight: 220, overflowY: 'auto',
          }}>
            {children.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedChild(c); setShowChildPicker(false); }}
                style={{
                  width: '100%', padding: '13px 16px', textAlign: 'left', fontSize: 15,
                  background: selectedChild?.id === c.id ? 'var(--primary-light)' : 'transparent',
                  color: selectedChild?.id === c.id ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: selectedChild?.id === c.id ? 700 : 400,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label>{currentPreset?.label || '기록'} 내용</Label>
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder={'상황을 말하듯 짧게 입력해 주세요.\n\n예) 친구와 차례를 기다리며 캠핑장 놀이를 했다. 중간에 속상해했지만 교사의 안내 후 다시 함께 놀이했다.'}
          style={{
            width: '100%', minHeight: 150, padding: '15px 16px',
            borderRadius: 14, border: '1.5px solid var(--border)',
            fontSize: 15, lineHeight: 1.75, resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', color: 'var(--text-primary)',
            background: 'white', boxShadow: 'var(--shadow-sm)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={() => setRawText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', borderRadius: 100, padding: '6px 10px' }}
          >
            <Mic size={13} /> 예시 넣기
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{rawText.length}자</div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '12px 16px', borderRadius: 12, fontSize: 14, marginBottom: 16, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {!result && (
        <button
          onClick={handleProcess}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: loading ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: 'white', fontSize: 16, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading ? 'none' : '0 8px 22px rgba(79,127,255,0.32)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <Spinner /> AI가 문서 문장으로 정리 중...
            </>
          ) : (
            <><Sparkles size={19} /> AI 자동 정리하기</>
          )}
        </button>
      )}

      {result && (
        <div className="slide-up">
          {cat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{
                background: cat.bg, color: cat.color,
                padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 800,
              }}>
                {cat.emoji} {cat.label}
              </span>
              {result.tags?.map(tag => (
                <span key={tag} style={{
                  background: 'var(--gray-100)', color: 'var(--text-secondary)',
                  padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {result.devAreas?.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>자동 연결 발달영역</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.devAreas.map(area => (
                  <span key={area} style={{ fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: 100, fontWeight: 700 }}>
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          <ResultSection title="관찰일지 문장" text={result.observation} />
          <ResultSection title="부모상담/알림장 문장" text={result.parent} accent />
          <ResultSection title="교사 지원계획" text={result.support} />
          <ResultSection title="문서작성 준비 상태" text={result.documentReadyText} />
          <ResultSection title="원문 순화본" text={result.softened} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <button onClick={handleReset} style={{
              padding: '14px', borderRadius: 14, border: '1.5px solid var(--border)',
              background: 'white', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <RotateCcw size={15} /> 다시 입력
            </button>
            <button
              onClick={handleSave}
              disabled={saved}
              style={{
                padding: '14px', borderRadius: 14, border: 'none',
                background: saved ? 'var(--cat-play)' : 'var(--primary)',
                fontSize: 14, fontWeight: 800, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: saved ? 'none' : '0 4px 12px rgba(79,127,255,0.3)',
              }}
            >
              {saved ? <><Check size={15} /> 저장 완료</> : <><Save size={15} /> 저장하기</>}
            </button>
          </div>

          {saved && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={handleReset} style={{ padding: '12px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 14, fontWeight: 800 }}>
                + 다음 기록
              </button>
              <button onClick={() => onNavigate('docs')} style={{ padding: '12px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>
                문서 만들기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function ResultSection({ title, text, accent }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!text) return null;

  return (
    <div style={{
      background: accent ? 'var(--primary-light)' : 'white',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 15, padding: 16, marginBottom: 12,
      boxShadow: accent ? '0 8px 18px rgba(79,127,255,0.08)' : 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>
          {title}
        </span>
        <button onClick={handleCopy} style={{
          fontSize: 12, color: accent ? 'var(--primary)' : 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700,
        }}>
          {copied ? <><Check size={13} /> 복사됨</> : <><Copy size={13} /> 복사</>}
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}
