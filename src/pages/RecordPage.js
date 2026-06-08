import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  getChildren,
  getClasses,
  addRecord,
  getRecords,
  CATEGORIES,
  today,
  formatDate,
  formatDateKo,
} from '../utils/storage';
import { processRecord } from '../utils/ai';
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Save,
  Mic,
  Zap,
  Search,
  CalendarDays,
  ListFilter,
  X,
  ChevronLeft,
  ChevronRight,
  List,
  PlusCircle,
} from 'lucide-react';

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

const QUICK_TEMPLATES = [
  { label: '낮잠', emoji: '😴', type: 'habit', text: '{child} 낮잠 시간에 편안하게 누워 휴식을 취했고, 교사의 토닥임을 받으며 안정적으로 잠들었다.' },
  { label: '식사', emoji: '🍚', type: 'habit', text: '{child} 점심시간에 스스로 식사 도구를 사용하며 식사에 참여했고, 새로운 반찬도 조금씩 경험해 보았다.' },
  { label: '바깥놀이', emoji: '🌤️', type: 'body', text: '{child} 바깥놀이에서 주변 자연물과 놀이기구에 관심을 보이며 몸을 활발하게 움직였다.' },
  { label: '친구관계', emoji: '🤝', type: 'peer', text: '{child} 친구와 함께 놀이하며 차례를 기다리고 놀잇감을 나누어 사용하는 경험을 하였다.' },
  { label: '언어표현', emoji: '💬', type: 'comm', text: '{child} 자신의 생각과 감정을 말로 표현하려고 시도했고, 교사의 질문에 관심을 가지고 대답하였다.' },
  { label: '정리', emoji: '🧺', type: 'habit', text: '{child} 놀이 후 교사의 안내를 듣고 사용한 놀잇감을 제자리에 정리하려는 모습을 보였다.' },
  { label: '배변', emoji: '🚽', type: 'habit', text: '{child} 배변 의사를 표현하고 화장실을 이용하는 과정에 참여하며 기본생활습관을 경험하였다.' },
  { label: '건강/컨디션', emoji: '🌡️', type: 'special', text: '{child} 평소와 다른 컨디션이 관찰되어 교사가 가까이에서 살피며 휴식과 안정을 지원하였다.' },
];

const RECORD_TYPE_LABELS = RECORD_PRESETS.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

// 아바타 색상 — 이름 첫 글자로 고정 색상 배정
const AVATAR_COLORS = [
  '#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8',
  '#4CAF50', '#E91E9A', '#FF5722', '#607D8B',
];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function hasFinalConsonant(value) {
  const last = [...String(value || '').trim()].pop();
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function nameSubject(name) {
  const clean = String(name || '').trim();
  if (!clean) return '아이가';
  if (clean.endsWith('이')) return `${clean}가`;
  if (clean === '아동' || clean === '유아') return `${clean}이`;
  return `${clean}${hasFinalConsonant(clean) ? '이가' : '가'}`;
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export default function RecordPage({ context, onNavigate, isDesktop }) {
  const [children, setChildren]           = useState([]);
  const [classes, setClasses]             = useState([]);
  const [records, setRecords]             = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [recordType, setRecordType]       = useState('observe');
  const [rawText, setRawText]             = useState('');
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState(null);
  const [error, setError]                 = useState('');
  const [saved, setSaved]                 = useState(false);
  const [mode, setMode]                   = useState(context?.mode === 'list' ? 'list' : 'write');
  const [searchText, setSearchText]       = useState('');
  const [filterChildId, setFilterChildId] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDate, setFilterDate]       = useState(context?.date || '');
  const [calendarMonth, setCalendarMonth] = useState(() => parseDate(context?.date || today()));
  const textareaRef = useRef(null);

  useEffect(() => {
    const ch = getChildren();
    const cl = getClasses();
    setChildren(ch);
    setClasses(cl);
    setRecords(getRecords());
    if (context?.childId) {
      const found = ch.find(c => c.id === context.childId);
      if (found) setSelectedChild(found);
    }
    if (context?.date) {
      setFilterDate(context.date);
      setCalendarMonth(parseDate(context.date));
      setMode('list');
    }
  }, [context]);

  const cl = classes[0];
  const currentPreset = RECORD_PRESETS.find(p => p.key === recordType);

  const recordDates = useMemo(() => {
    const map = new Map();
    records.forEach(r => {
      if (!r.date) return;
      map.set(r.date, (map.get(r.date) || 0) + 1);
    });
    return map;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return records
      .filter(r => {
        if (filterDate && r.date !== filterDate) return false;
        if (filterChildId !== 'all' && r.childId !== filterChildId) return false;
        if (filterCategory !== 'all' && r.category !== filterCategory) return false;
        if (!q) return true;
        const haystack = [
          r.childName,
          r.rawText,
          r.observation,
          r.parent,
          r.support,
          r.softened,
          r.title,
          ...(r.tags || []),
          ...(r.devAreas || []),
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.date || 0).getTime();
        const bTime = new Date(b.createdAt || b.date || 0).getTime();
        return bTime - aTime;
      });
  }, [records, searchText, filterDate, filterChildId, filterCategory]);

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
    if (!result || !selectedChild || saved) return;
    const newRecord = addRecord({
      childId:    selectedChild.id,
      childName:  selectedChild.name,
      date:       today(),
      rawText,
      recordType,
      ...result,
    });
    setRecords(prev => [newRecord, ...prev]);
    setSaved(true);
  };

  const handleReset = () => {
    setResult(null);
    setRawText('');
    setError('');
    setSaved(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const insertTemplate = (template) => {
    const childText = nameSubject(selectedChild?.name || '아이');
    const insertText = template.text.replace('{child}', childText);
    const textarea = textareaRef.current;

    setRecordType(prev => prev === 'observe' ? (template.type === 'special' ? 'special' : prev) : prev);
    setError('');
    setSaved(false);
    setResult(null);

    if (!textarea) {
      setRawText(prev => `${prev}${prev ? '\n' : ''}${insertText}`);
      return;
    }

    const start = textarea.selectionStart ?? rawText.length;
    const end = textarea.selectionEnd ?? rawText.length;
    const before = rawText.slice(0, start);
    const after = rawText.slice(end);
    const spacer = before && !before.endsWith('\n') ? '\n' : '';
    const nextText = `${before}${spacer}${insertText}${after}`;
    const nextCursor = before.length + spacer.length + insertText.length;
    setRawText(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const clearFilters = () => {
    setSearchText('');
    setFilterChildId('all');
    setFilterCategory('all');
    setFilterDate('');
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
                <button onClick={() => { setMode('list'); setResult(null); setFilterDate(today()); }} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>
                  저장 기록 보기
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
      <div style={{ marginBottom: 18 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
        <button
          onClick={() => { setMode('write'); setResult(null); }}
          style={{
            padding: '12px 14px', borderRadius: 14, fontSize: 14, fontWeight: 800,
            background: mode === 'write' ? 'var(--primary)' : 'white',
            color: mode === 'write' ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${mode === 'write' ? 'var(--primary)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <PlusCircle size={16} /> 새 기록
        </button>
        <button
          onClick={() => { setMode('list'); setResult(null); setRecords(getRecords()); }}
          style={{
            padding: '12px 14px', borderRadius: 14, fontSize: 14, fontWeight: 800,
            background: mode === 'list' ? 'var(--primary)' : 'white',
            color: mode === 'list' ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${mode === 'list' ? 'var(--primary)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <List size={16} /> 전체 기록 {records.length > 0 ? records.length : ''}
        </button>
      </div>

      {mode === 'list' ? (
        <RecordsWorkspace
          records={records}
          filteredRecords={filteredRecords}
          children={children}
          searchText={searchText}
          setSearchText={setSearchText}
          filterChildId={filterChildId}
          setFilterChildId={setFilterChildId}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          recordDates={recordDates}
          clearFilters={clearFilters}
          isDesktop={isDesktop}
        />
      ) : (
        <>
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

            <QuickTemplatePanel templates={QUICK_TEMPLATES} onInsert={insertTemplate} />

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
                  <button onClick={() => { setMode('list'); setResult(null); setFilterDate(today()); }} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>
                    저장 기록 보기
                  </button>
                </div>
              )}
            </div>
          )}
        </>
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

function QuickTemplatePanel({ templates, onInsert }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>빠른 문구</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>자주 쓰는 상황을 원터치 입력</span>
      </div>
      <div className="avatar-scroll" style={{ marginLeft: -4, marginRight: -4, padding: '0 4px 4px' }}>
        <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
          {templates.map(t => (
            <button
              key={t.label}
              onClick={() => onInsert(t)}
              style={{
                padding: '8px 12px', borderRadius: 100,
                background: 'white', border: '1.5px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800,
                boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecordsWorkspace({
  records,
  filteredRecords,
  children,
  searchText,
  setSearchText,
  filterChildId,
  setFilterChildId,
  filterCategory,
  setFilterCategory,
  filterDate,
  setFilterDate,
  calendarMonth,
  setCalendarMonth,
  recordDates,
  clearFilters,
  isDesktop,
}) {
  return (
    <div className="slide-up">
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <SummaryCard label="전체 기록" value={`${records.length}건`} icon="🗂️" />
        <SummaryCard label="기록한 날짜" value={`${recordDates.size}일`} icon="📅" />
        {isDesktop && <SummaryCard label="검색 결과" value={`${filteredRecords.length}건`} icon="🔎" />}
      </div>

      <CalendarPanel
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
        recordDates={recordDates}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
      />

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <ListFilter size={16} color="var(--primary)" />
          <span style={{ fontSize: 14, fontWeight: 900 }}>기록 검색/필터</span>
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="아이 이름, 기록 내용, 태그로 검색"
            style={{ width: '100%', padding: '12px 14px 12px 38px', borderRadius: 13, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--gray-50)' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr auto' : '1fr', gap: 8 }}>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={selectStyle}>
            <option value="">전체 날짜</option>
            {[...recordDates.keys()].sort((a, b) => b.localeCompare(a)).map(date => (
              <option key={date} value={date}>{formatDate(date)} · {recordDates.get(date)}건</option>
            ))}
          </select>
          <select value={filterChildId} onChange={e => setFilterChildId(e.target.value)} style={selectStyle}>
            <option value="all">전체 아이</option>
            {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
            <option value="all">전체 카테고리</option>
            {Object.entries(CATEGORIES).map(([key, cat]) => <option key={key} value={key}>{cat.emoji} {cat.label}</option>)}
          </select>
          <button onClick={clearFilters} style={{ padding: '11px 14px', borderRadius: 13, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <X size={14} /> 초기화
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>전체 기록 목록</div>
        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 900 }}>{filteredRecords.length}건</div>
      </div>

      {filteredRecords.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '32px 18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>조건에 맞는 기록이 없어요</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>날짜, 아이 이름, 카테고리 조건을 바꿔보세요.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filteredRecords.map(record => <RecordListCard key={record.id} record={record} />)}
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 13,
  border: '1.5px solid var(--border)',
  background: 'white',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
};

function SummaryCard({ label, value, icon }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 15, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 20, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function CalendarPanel({ calendarMonth, setCalendarMonth, recordDates, filterDate, setFilterDate }) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const leading = first.getDay();
  const days = [];
  for (let i = 0; i < leading; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));

  const moveMonth = (delta) => setCalendarMonth(new Date(year, month + delta, 1));

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarDays size={16} color="var(--primary)" />
          <span style={{ fontSize: 14, fontWeight: 900 }}>캘린더 뷰</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => moveMonth(-1)} style={calendarArrowStyle}><ChevronLeft size={16} /></button>
          <span style={{ minWidth: 92, textAlign: 'center', fontSize: 13, fontWeight: 900 }}>{year}.{String(month + 1).padStart(2, '0')}</span>
          <button onClick={() => moveMonth(1)} style={calendarArrowStyle}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, color: day === '일' ? 'var(--accent)' : 'var(--text-tertiary)' }}>{day}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;
          const dateStr = toDateString(date);
          const count = recordDates.get(dateStr) || 0;
          const selected = filterDate === dateStr;
          const isToday = dateStr === today();
          return (
            <button
              key={dateStr}
              onClick={() => setFilterDate(selected ? '' : dateStr)}
              style={{
                minHeight: 46,
                borderRadius: 13,
                background: selected ? 'var(--primary)' : count ? 'var(--primary-light)' : 'var(--gray-50)',
                color: selected ? 'white' : isToday ? 'var(--primary)' : 'var(--text-secondary)',
                border: isToday && !selected ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                fontSize: 12,
                fontWeight: selected || count || isToday ? 900 : 600,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              }}
            >
              <span>{date.getDate()}</span>
              {count > 0 && (
                <span style={{ minWidth: 6, height: 6, borderRadius: 999, background: selected ? 'white' : 'var(--primary)', display: 'block' }} title={`${count}건`} />
              )}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
        점이 있는 날짜를 누르면 해당 날의 기록만 보여요.
      </div>
    </div>
  );
}

const calendarArrowStyle = {
  width: 30,
  height: 30,
  borderRadius: 10,
  background: 'var(--gray-100)',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function RecordListCard({ record }) {
  const cat = record.category ? CATEGORIES[record.category] : null;
  const body = record.observation || record.rawText || record.softened || '';
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 15, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: getAvatarColor(record.childName), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
          {record.childName?.[0] || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 14 }}>{record.childName || '이름 없음'}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatDateKo(record.date)}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{RECORD_TYPE_LABELS[record.recordType] || '기록'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {cat && <span style={{ background: cat.bg, color: cat.color, borderRadius: 100, padding: '3px 8px', fontSize: 11, fontWeight: 900 }}>{cat.emoji} {cat.label}</span>}
            {record.tags?.slice(0, 3).map(tag => <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: 100, padding: '3px 7px', fontSize: 10, fontWeight: 700 }}>#{tag}</span>)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
        {body.length > 180 ? `${body.slice(0, 180)}...` : body}
      </div>
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
