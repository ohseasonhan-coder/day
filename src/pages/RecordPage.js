import React, { useState, useEffect, useRef } from 'react';
import { getChildren, getClasses, addRecord, CATEGORIES, today } from '../utils/storage';
import { processRecord } from '../utils/ai';
import { Sparkles, Copy, Check, RotateCcw, Save, Mic, Zap } from 'lucide-react';

const RECORD_PRESETS = [
  { key: 'observe', label: '관찰기록',    emoji: '👀', hint: '놀이·상호작용·생활습관을 짧게 입력' },
  { key: 'notice',  label: '알림장',      emoji: '📢', hint: '부모님께 전달할 내용을 부드럽게 정리' },
  { key: 'consult', label: '상담메모',    emoji: '💬', hint: '상담자료로 이어질 성장 포인트 기록' },
  { key: 'special', label: '안전/특이사항', emoji: '🚨', hint: '상처·건강·투약·행사 상황 기록' },
];

const EXAMPLES = [
  '친구와 블록으로 캠핑장을 만들며 역할을 나누어 놀이했다. 중간에 차례 문제로 속상해했지만 교사의 안내 후 다시 함께 놀이했다.',
  '바깥놀이에서 나뭇잎과 돌멩이를 모으며 크기를 비교했고, 왜 색이 다른지 궁금해하며 질문했다.',
  '점심시간에 처음 보는 반찬을 조금 맛본 뒤 스스로 물을 마시고 식판을 정리했다.',
];

// 아바타 색상 — 이름 첫 글자로 고정 색상 배정
const AVATAR_COLORS = [
  '#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8',
  '#4CAF50', '#E91E9A', '#FF5722', '#607D8B',
];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function RecordPage({ context, onNavigate, isDesktop }) {
  const [children, setChildren]         = useState([]);
  const [classes, setClasses]           = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [recordType, setRecordType]     = useState('observe');
  const [rawText, setRawText]           = useState('');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState('');
  const [saved, setSaved]               = useState(false);
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
    if (!selectedChild) return setError('위에서 아이를 먼저 선택해 주세요.');
    if (!rawText.trim()) return setError('기록 내용을 입력해 주세요.');
    setError('');
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await processRecord({
        childName: selectedChild.name,
        rawText:   rawText.trim(),
        classAge:  cl?.age,
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
      childId:    selectedChild.id,
      childName:  selectedChild.name,
      date:       today(),
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
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const cat = result?.category ? CATEGORIES[result.category] : null;

  /* 데스크톱: 결과 있을 때 2컬럼 */
  if (isDesktop && result) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          {/* 왼쪽: 입력 요약 */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
              <Zap size={13} /> 입력 내용
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 20, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                {selectedChild && (() => {
                  const color = getAvatarColor(selectedChild.name);
                  return (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: 'white', flexShrink: 0 }}>
                      {selectedChild.name[0]}
                    </div>
                  );
                })()}
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedChild?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currentPreset?.emoji} {currentPreset?.label}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', background: 'var(--gray-50)', borderRadius: 12, padding: '12px 14px' }}>
                {rawText}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={handleReset} style={{
                padding: '15px', borderRadius: 14, border: '1.5px solid var(--border)',
                background: 'white', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <RotateCcw size={15} /> 다시 입력
              </button>
              <button onClick={handleSave} disabled={saved} style={{
                padding: '15px', borderRadius: 14, border: 'none',
                background: saved ? 'var(--cat-play)' : 'var(--primary)',
                fontSize: 14, fontWeight: 800, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: saved ? 'none' : '0 4px 14px rgba(79,127,255,0.3)',
              }}>
                {saved ? <><Check size={15} /> 저장 완료</> : <><Save size={15} /> 저장하기</>}
              </button>
            </div>
            {saved && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={handleReset} style={{ padding: '13px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 14, fontWeight: 800 }}>
                  + 다음 기록
                </button>
                <button onClick={() => onNavigate('docs')} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>
                  문서 만들기
                </button>
              </div>
            )}
          </div>

          {/* 오른쪽: AI 결과 */}
          <div className="slide-up">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
              <Sparkles size={13} /> AI 자동 정리 결과
            </div>
            {cat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ background: cat.bg, color: cat.color, padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 800 }}>
                  {cat.emoji} {cat.label}
                </span>
                {result.tags?.map(tag => (
                  <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {result.devAreas?.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
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
            <ResultSection title="관찰일지 문장"        text={result.observation} />
            <ResultSection title="부모상담/알림장 문장" text={result.parent}      accent />
            <ResultSection title="교사 지원계획"        text={result.support} />
            <ResultSection title="문서작성 준비 상태"   text={result.documentReadyText} />
            <ResultSection title="원문 순화본"          text={result.softened} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isDesktop ? '32px 36px' : '20px' }}>

      {/* ── 페이지 헤더 ─────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          <Zap size={13} /> 3분 기록 자동화
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.7px', marginBottom: 4 }}>
          짧게 쓰면 문서가 만들어져요
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          교사는 상황만 남기고, 앱이 관찰일지·부모상담·지원계획으로 정리합니다.
        </div>
      </div>

      {/* ── STEP 1 : 아이 선택 ──────────────────────── */}
      <StepSection step={1} label="누구의 기록인가요?">
        {children.length === 0 ? (
          <div style={{ padding: '18px 16px', background: 'var(--gray-50)', borderRadius: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👶</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10 }}>등록된 아이가 없어요</div>
            <button
              onClick={() => onNavigate('settings')}
              style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 800, background: 'var(--primary-light)', borderRadius: 100, padding: '7px 14px' }}
            >
              설정에서 아이 추가하기 →
            </button>
          </div>
        ) : (
          /* 가로 스크롤 아바타 행 */
          <div
            className="avatar-scroll"
            style={{ marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, paddingBottom: 6 }}
          >
            <div style={{ display: 'flex', gap: 16, width: 'max-content' }}>
              {children.map(child => {
                const color = getAvatarColor(child.name);
                const isSelected = selectedChild?.id === child.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => { setSelectedChild(child); setError(''); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '4px 2px', minWidth: 60 }}
                  >
                    <div style={{
                      width: 58, height: 58, borderRadius: '50%',
                      background: isSelected ? color : `${color}18`,
                      border: `3px solid ${isSelected ? color : 'transparent'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 900,
                      color: isSelected ? 'white' : color,
                      boxShadow: isSelected ? `0 6px 18px ${color}44` : 'none',
                      transition: 'all 0.18s ease',
                      flexShrink: 0,
                    }}>
                      {child.name[0]}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: isSelected ? 800 : 500,
                      color: isSelected ? color : 'var(--text-secondary)',
                      maxWidth: 58, textAlign: 'center', lineHeight: 1.3,
                      wordBreak: 'keep-all',
                    }}>
                      {child.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </StepSection>

      {/* ── STEP 2 : 기록 유형 ─────────────────────── */}
      <StepSection step={2} label="어떤 기록인가요?">
        <div
          className="avatar-scroll"
          style={{ marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, paddingBottom: 4 }}
        >
          <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
            {RECORD_PRESETS.map(p => {
              const isActive = recordType === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setRecordType(p.key)}
                  style={{
                    padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700,
                    background: isActive ? 'var(--primary)' : 'white',
                    color:      isActive ? 'white' : 'var(--text-secondary)',
                    border:     `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                    whiteSpace: 'nowrap',
                    boxShadow:  isActive ? '0 4px 14px rgba(79,127,255,0.3)' : 'var(--shadow-sm)',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.emoji} {p.label}
                </button>
              );
            })}
          </div>
        </div>
        {currentPreset && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, paddingLeft: 2, lineHeight: 1.5 }}>
            💡 {currentPreset.hint}
          </div>
        )}
      </StepSection>

      {/* ── STEP 3 : 내용 입력 ─────────────────────── */}
      <StepSection step={3} label="무슨 일이 있었나요?">
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder={`있었던 상황을 말하듯 짧게 써주세요.\n\n예) 친구와 블록으로 캠핑장을 만들었다. 차례 문제로 속상해했지만 교사 안내 후 다시 놀이했다.`}
          style={{
            width: '100%', minHeight: 160, padding: '16px',
            borderRadius: 16, border: '1.5px solid var(--border)',
            fontSize: 15, lineHeight: 1.8, resize: 'vertical',
            fontFamily: 'inherit', color: 'var(--text-primary)',
            background: 'white', boxShadow: 'var(--shadow-sm)',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={() => setRawText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', borderRadius: 100, padding: '6px 12px' }}
          >
            <Mic size={13} /> 예시 넣기
          </button>
          <div style={{
            fontSize: 12, fontWeight: rawText.length > 0 ? 700 : 400,
            color: rawText.length > 0 ? 'var(--primary)' : 'var(--text-tertiary)',
          }}>
            {rawText.length}자
          </div>
        </div>
      </StepSection>

      {/* ── 에러 ────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'var(--accent-light)', color: 'var(--accent)',
          padding: '13px 16px', borderRadius: 12, fontSize: 14,
          marginBottom: 16, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── AI 정리 버튼 ─────────────────────────────── */}
      {!result && (
        <button
          onClick={handleProcess}
          disabled={loading}
          style={{
            width: '100%', padding: '18px', borderRadius: 16,
            background: loading
              ? 'var(--gray-300)'
              : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: 'white', fontSize: 16, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading ? 'none' : '0 8px 24px rgba(79,127,255,0.35)',
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.3px',
          }}
        >
          {loading
            ? <><Spinner /> AI가 문서 문장으로 정리 중...</>
            : <><Sparkles size={20} /> AI 자동 정리하기</>
          }
        </button>
      )}

      {/* ── 결과 ─────────────────────────────────────── */}
      {result && (
        <div className="slide-up">

          {/* 카테고리 배지 */}
          {cat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ background: cat.bg, color: cat.color, padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 800 }}>
                {cat.emoji} {cat.label}
              </span>
              {result.tags?.map(tag => (
                <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 발달영역 */}
          {result.devAreas?.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
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

          <ResultSection title="관찰일지 문장"        text={result.observation} />
          <ResultSection title="부모상담/알림장 문장" text={result.parent}      accent />
          <ResultSection title="교사 지원계획"        text={result.support} />
          <ResultSection title="문서작성 준비 상태"   text={result.documentReadyText} />
          <ResultSection title="원문 순화본"          text={result.softened} />

          {/* 저장 버튼 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <button onClick={handleReset} style={{
              padding: '15px', borderRadius: 14, border: '1.5px solid var(--border)',
              background: 'white', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <RotateCcw size={15} /> 다시 입력
            </button>
            <button onClick={handleSave} disabled={saved} style={{
              padding: '15px', borderRadius: 14, border: 'none',
              background: saved ? 'var(--cat-play)' : 'var(--primary)',
              fontSize: 14, fontWeight: 800, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: saved ? 'none' : '0 4px 14px rgba(79,127,255,0.3)',
            }}>
              {saved ? <><Check size={15} /> 저장 완료</> : <><Save size={15} /> 저장하기</>}
            </button>
          </div>

          {saved && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={handleReset} style={{ padding: '13px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 14, fontWeight: 800 }}>
                + 다음 기록
              </button>
              <button onClick={() => onNavigate('docs')} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>
                문서 만들기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 서브 컴포넌트 ──────────────────────────────── */

function StepSection({ step, label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--primary)', color: 'white',
          fontSize: 12, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {step}
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{label}</span>
      </div>
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
  return (
    <div style={{
      width: 18, height: 18,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}
