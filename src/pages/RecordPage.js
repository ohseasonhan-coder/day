import React, { useState, useEffect, useRef, useMemo } from 'react';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import {
  getChildren,
  getClasses,
  addRecord,
  getRecords,
  updateRecord,
  deleteRecord,
  toggleStarRecord,
  getCustomTemplates,
  addCustomTemplate,
  deleteCustomTemplate,
  getDraft,
  saveDraft,
  clearDraft,
  CATEGORIES,
  today,
  formatDate,
  formatDateKo,
  getAutomationState,
} from '../utils/storage';
import { processRecord } from '../utils/ai';
import {
  Sparkles, Copy, Check, RotateCcw, Save, Mic, Zap,
  Search, CalendarDays, ListFilter, X, ChevronLeft, ChevronRight,
  List, PlusCircle, Pencil, Trash2, Plus, ChevronDown, ChevronUp, Star,
} from 'lucide-react';

/* ── 기본 제공 빠른 문구 (built-in, 삭제 불가) ─────────────────────────────── */
const BUILTIN_TEMPLATES = [
  { id: 'b1', label: '낮잠',       emoji: '😴', type: 'habit',   text: '{child} 낮잠 시간에 편안하게 누워 휴식을 취했고, 교사의 토닥임을 받으며 안정적으로 잠들었다.' },
  { id: 'b2', label: '식사',       emoji: '🍚', type: 'habit',   text: '{child} 점심시간에 스스로 식사 도구를 사용하며 식사에 참여했고, 새로운 반찬도 조금씩 경험해 보았다.' },
  { id: 'b3', label: '바깥놀이',   emoji: '🌤️', type: 'body',    text: '{child} 바깥놀이에서 주변 자연물과 놀이기구에 관심을 보이며 몸을 활발하게 움직였다.' },
  { id: 'b4', label: '친구관계',   emoji: '🤝', type: 'peer',    text: '{child} 친구와 함께 놀이하며 차례를 기다리고 놀잇감을 나누어 사용하는 경험을 하였다.' },
  { id: 'b5', label: '언어표현',   emoji: '💬', type: 'comm',    text: '{child} 자신의 생각과 감정을 말로 표현하려고 시도했고, 교사의 질문에 관심을 가지고 대답하였다.' },
  { id: 'b6', label: '정리',       emoji: '🧺', type: 'habit',   text: '{child} 놀이 후 교사의 안내를 듣고 사용한 놀잇감을 제자리에 정리하려는 모습을 보였다.' },
  { id: 'b7', label: '배변',       emoji: '🚽', type: 'habit',   text: '{child} 배변 의사를 표현하고 화장실을 이용하는 과정에 참여하며 기본생활습관을 경험하였다.' },
  { id: 'b8', label: '건강/컨디션', emoji: '🌡️', type: 'special', text: '{child} 평소와 다른 컨디션이 관찰되어 교사가 가까이에서 살피며 휴식과 안정을 지원하였다.' },
];

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

const RECORD_TYPE_LABELS = RECORD_PRESETS.reduce((acc, item) => {
  acc[item.key] = item.label; return acc;
}, {});

const AVATAR_COLORS = ['#4F7FFF','#6C63FF','#FF8C42','#00B4D8','#4CAF50','#E91E9A','#FF5722','#607D8B'];
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

/* ══════════════════════════════════════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════════════════════════════════════ */
export default function RecordPage({ context, onNavigate, isDesktop }) {
  const [children, setChildren]             = useState([]);
  const [classes, setClasses]               = useState([]);
  const [records, setRecords]               = useState([]);
  const [selectedChild, setSelectedChild]   = useState(null);
  const [recordType, setRecordType]         = useState('observe');
  const [rawText, setRawText]               = useState('');
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState(null);
  const [error, setError]                   = useState('');
  const [saved, setSaved]                   = useState(false);
  const [mode, setMode]                     = useState(context?.mode === 'list' ? 'list' : 'write');
  const [searchText, setSearchText]         = useState('');
  const [filterChildId, setFilterChildId]   = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDate, setFilterDate]         = useState(context?.date || '');
  const [filterStarred, setFilterStarred]   = useState(false);
  const [calendarMonth, setCalendarMonth]   = useState(() => parseDate(context?.date || today()));
  const [customTemplates, setCustomTemplates] = useState(() => getCustomTemplates());
  const [detailRecord, setDetailRecord]     = useState(null);
  const [draftBanner, setDraftBanner]       = useState(() => !!getDraft());
  const textareaRef = useRef(null);
  const autoSaveRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const showToast = useToast();

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setRawText(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  useEffect(() => {
    const ch = getChildren();
    const cl = getClasses();
    setChildren(ch);
    setClasses(cl);
    setRecords(getRecords());
    setCustomTemplates(getCustomTemplates());
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

  // ── 자동 저장 (30초마다) ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'write') return;
    clearInterval(autoSaveRef.current);
    autoSaveRef.current = setInterval(() => {
      if (rawText.trim()) {
        saveDraft({ rawText, recordType, childId: selectedChild?.id, childName: selectedChild?.name });
      }
    }, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [mode, rawText, recordType, selectedChild]);

  const cl = classes[0];
  const currentPreset = RECORD_PRESETS.find(p => p.key === recordType);
  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];

  const recordDates = useMemo(() => {
    const map = new Map();
    records.forEach(r => { if (r.date) map.set(r.date, (map.get(r.date) || 0) + 1); });
    return map;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return records
      .filter(r => {
        if (filterDate && r.date !== filterDate) return false;
        if (filterChildId !== 'all' && r.childId !== filterChildId) return false;
        if (filterCategory !== 'all' && r.category !== filterCategory) return false;
        if (filterStarred && !r.starred) return false;
        if (!q) return true;
        const haystack = [r.childName, r.rawText, r.observation, r.parent, r.support, r.softened, r.title, ...(r.tags || []), ...(r.devAreas || [])].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  }, [records, searchText, filterDate, filterChildId, filterCategory, filterStarred]);

  const handleProcess = async () => {
    if (!selectedChild) return setError('위에서 아이를 먼저 선택해 주세요.');
    if (!rawText.trim())  return setError('기록 내용을 입력해 주세요.');
    setError(''); setLoading(true); setResult(null); setSaved(false);
    try {
      const res = await processRecord({ childName: selectedChild.name, rawText: rawText.trim(), classAge: cl?.age, recordType });
      setResult({ ...res, recordType });
    } catch (e) {
      setError(e.message || '기록을 정리하는 중 오류가 발생했어요.');
    } finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!result || !selectedChild || saved) return;
    const newRecord = addRecord({ childId: selectedChild.id, childName: selectedChild.name, date: today(), rawText, recordType, ...result });
    setRecords(prev => [newRecord, ...prev]);
    setSaved(true);
    clearDraft(); setDraftBanner(false);
    const labels = newRecord.automation?.appliedLabels || [];
    const audit = getAutomationState()?.audit;
    const auditText = audit?.totalCount ? ` 자동화 ${audit.readyCount}/${audit.totalCount} 준비.` : '';
    showToast(labels.length ? `${labels.slice(0, 3).join(', ')}에 자동 반영됐어요.${auditText}` : `기록이 자동 반영됐어요.${auditText}`);
  };

  const handleReset = () => {
    setResult(null); setRawText(''); setError(''); setSaved(false);
    clearDraft(); setDraftBanner(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleRestoreDraft = () => {
    const draft = getDraft();
    if (!draft) return;
    setRawText(draft.rawText || '');
    if (draft.recordType) setRecordType(draft.recordType);
    if (draft.childId) {
      const found = getChildren().find(c => c.id === draft.childId);
      if (found) setSelectedChild(found);
    }
    setDraftBanner(false);
    clearDraft();
  };

  const insertTemplate = (template) => {
    const childText = nameSubject(selectedChild?.name || '아이');
    const insertText = template.text.replace('{child}', childText);
    const textarea = textareaRef.current;
    setError(''); setSaved(false); setResult(null);
    if (!textarea) { setRawText(prev => `${prev}${prev ? '\n' : ''}${insertText}`); return; }
    const start = textarea.selectionStart ?? rawText.length;
    const end   = textarea.selectionEnd   ?? rawText.length;
    const before = rawText.slice(0, start);
    const after  = rawText.slice(end);
    const spacer = before && !before.endsWith('\n') ? '\n' : '';
    const nextText   = `${before}${spacer}${insertText}${after}`;
    const nextCursor = before.length + spacer.length + insertText.length;
    setRawText(nextText);
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(nextCursor, nextCursor); }, 0);
  };

  const handleAddTemplate = (tpl) => {
    const saved = addCustomTemplate(tpl);
    setCustomTemplates(getCustomTemplates());
    return saved;
  };

  const handleDeleteTemplate = (id) => {
    deleteCustomTemplate(id);
    setCustomTemplates(getCustomTemplates());
  };

  const handleToggleStar = (id) => {
    toggleStarRecord(id);
    const refreshed = getRecords();
    setRecords(refreshed);
    if (detailRecord?.id === id) setDetailRecord(refreshed.find(r => r.id === id) || null);
  };

  const handleUpdateRecord = (id, updates) => {
    updateRecord(id, updates);
    const refreshed = getRecords();
    setRecords(refreshed);
    if (detailRecord?.id === id) setDetailRecord(refreshed.find(r => r.id === id) || null);
  };

  const handleDeleteRecord = (id) => {
    deleteRecord(id);
    setRecords(getRecords());
    if (detailRecord?.id === id) setDetailRecord(null);
  };

  const clearFilters = () => { setSearchText(''); setFilterChildId('all'); setFilterCategory('all'); setFilterDate(''); setFilterStarred(false); };

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
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                {selectedChild && (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: getAvatarColor(selectedChild.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: 'white', flexShrink: 0 }}>
                    {selectedChild.name[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedChild?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currentPreset?.emoji} {currentPreset?.label}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', background: 'var(--gray-50)', borderRadius: 12, padding: '12px 14px' }}>{rawText}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={handleReset} style={{ padding: '15px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--white)', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <RotateCcw size={15} /> 다시 입력
              </button>
              <button onClick={handleSave} disabled={saved} style={{ padding: '15px', borderRadius: 14, border: 'none', background: saved ? 'var(--cat-play)' : 'var(--primary)', fontSize: 14, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: saved ? 'none' : '0 4px 14px rgba(79,127,255,0.3)' }}>
                {saved ? <><Check size={15} /> 저장 완료</> : <><Save size={15} /> 저장하기</>}
              </button>
            </div>
            {saved && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={handleReset} style={{ padding: '13px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 14, fontWeight: 800 }}>+ 다음 기록</button>
                <button onClick={() => { setMode('list'); setResult(null); setFilterDate(today()); }} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>저장 기록 보기</button>
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
                <span style={{ background: cat.bg, color: cat.color, padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 800 }}>{cat.emoji} {cat.label}</span>
                {result.tags?.map(tag => <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>#{tag}</span>)}
              </div>
            )}
            {result.devAreas?.length > 0 && (
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>자동 연결 발달영역</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.devAreas.map(a => <span key={a} style={{ fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: 100, fontWeight: 700 }}>{a}</span>)}
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

      {/* ── 페이지 헤더 ─── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          <Zap size={13} /> 3분 기록 자동화
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.7px', marginBottom: 4 }}>짧게 쓰면 문서가 만들어져요</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>교사는 상황만 남기고, 앱이 관찰일지·부모상담·지원계획으로 정리합니다.</div>
      </div>

      {/* ── 탭 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
        <button onClick={() => { setMode('write'); setResult(null); }} style={{ padding: '12px 14px', borderRadius: 14, fontSize: 14, fontWeight: 800, background: mode === 'write' ? 'var(--primary)' : 'white', color: mode === 'write' ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${mode === 'write' ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <PlusCircle size={16} /> 새 기록
        </button>
        <button onClick={() => { setMode('list'); setResult(null); setRecords(getRecords()); }} style={{ padding: '12px 14px', borderRadius: 14, fontSize: 14, fontWeight: 800, background: mode === 'list' ? 'var(--primary)' : 'white', color: mode === 'list' ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${mode === 'list' ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <List size={16} /> 전체 기록 {records.length > 0 ? records.length : ''}
        </button>
      </div>

      {mode === 'list' ? (
        <RecordsWorkspace
          records={records}
          filteredRecords={filteredRecords}
          children={children}
          searchText={searchText}        setSearchText={setSearchText}
          filterChildId={filterChildId}  setFilterChildId={setFilterChildId}
          filterCategory={filterCategory} setFilterCategory={setFilterCategory}
          filterDate={filterDate}        setFilterDate={setFilterDate}
          filterStarred={filterStarred}  setFilterStarred={setFilterStarred}
          calendarMonth={calendarMonth}  setCalendarMonth={setCalendarMonth}
          recordDates={recordDates}
          clearFilters={clearFilters}
          isDesktop={isDesktop}
          onOpenDetail={setDetailRecord}
          onToggleStar={handleToggleStar}
          onStartRecord={() => setMode('write')}
        />
      ) : (
        <>
          {/* 임시저장 복구 배너 */}
          {draftBanner && (
            <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary)', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:900, color:'var(--primary)' }}>💾 작성 중이던 기록이 있어요</div>
                <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
                  {(() => { const d = getDraft(); return d?.savedAt ? `${new Date(d.savedAt).toLocaleString('ko-KR', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 자동저장` : ''; })()}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button onClick={handleRestoreDraft} style={{ padding:'7px 14px', borderRadius:10, background:'var(--primary)', color:'white', fontSize:13, fontWeight:800 }}>복구</button>
                <button onClick={() => { clearDraft(); setDraftBanner(false); }} style={{ padding:'7px 10px', borderRadius:10, background:'var(--white)', border:'1px solid var(--border)', fontSize:13, color:'var(--text-secondary)' }}>무시</button>
              </div>
            </div>
          )}

          {/* STEP 1: 아이 선택 */}
          <StepSection step={1} label="누구의 기록인가요?">
            {children.length === 0 ? (
              <div style={{ padding: '18px 16px', background: 'var(--gray-50)', borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>👶</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10 }}>등록된 아이가 없어요</div>
                <button onClick={() => onNavigate('settings')} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 800, background: 'var(--primary-light)', borderRadius: 100, padding: '7px 14px' }}>설정에서 아이 추가하기 →</button>
              </div>
            ) : (
              <div className="avatar-scroll" style={{ marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, paddingBottom: 6 }}>
                <div style={{ display: 'flex', gap: 16, width: 'max-content' }}>
                  {children.map(child => {
                    const color = getAvatarColor(child.name);
                    const isSelected = selectedChild?.id === child.id;
                    return (
                      <button key={child.id} onClick={() => { setSelectedChild(child); setError(''); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '4px 2px', minWidth: 60 }}>
                        <div style={{ width: 58, height: 58, borderRadius: '50%', background: isSelected ? color : `${color}18`, border: `3px solid ${isSelected ? color : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: isSelected ? 'white' : color, boxShadow: isSelected ? `0 6px 18px ${color}44` : 'none', transition: 'all 0.18s ease', flexShrink: 0 }}>{child.name[0]}</div>
                        <span style={{ fontSize: 12, fontWeight: isSelected ? 800 : 500, color: isSelected ? color : 'var(--text-secondary)', maxWidth: 58, textAlign: 'center', lineHeight: 1.3, wordBreak: 'keep-all' }}>{child.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </StepSection>

          {/* STEP 2: 기록 유형 */}
          <StepSection step={2} label="어떤 기록인가요?">
            <div className="avatar-scroll" style={{ marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, paddingBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
                {RECORD_PRESETS.map(p => {
                  const isActive = recordType === p.key;
                  return (
                    <button key={p.key} onClick={() => setRecordType(p.key)} style={{ padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, background: isActive ? 'var(--primary)' : 'white', color: isActive ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`, whiteSpace: 'nowrap', boxShadow: isActive ? '0 4px 14px rgba(79,127,255,0.3)' : 'var(--shadow-sm)', transition: 'all 0.15s' }}>
                      {p.emoji} {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {currentPreset && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, paddingLeft: 2, lineHeight: 1.5 }}>💡 {currentPreset.hint}</div>}
          </StepSection>

          {/* STEP 3: 내용 입력 */}
          <StepSection step={3} label="무슨 일이 있었나요?">
            {isListening && (
              <div style={{ marginBottom: 8, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎤 말씀하시면 자동으로 입력됩니다 (한국어)
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`있었던 상황을 말하듯 짧게 써주세요.\n\n예) 친구와 블록으로 캠핑장을 만들었다. 차례 문제로 속상해했지만 교사 안내 후 다시 놀이했다.`}
              className={isListening ? 'mic-listening' : ''}
              style={{ width: '100%', minHeight: 160, padding: '16px', borderRadius: 16, border: '1.5px solid var(--border)', fontSize: 15, lineHeight: 1.8, resize: 'vertical', fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--white)', boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.15s' }}
              onFocus={e => { if (!isListening) e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={e  => { if (!isListening) e.target.style.borderColor = 'var(--border)'; }}
            />
            {speechSupported && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  onClick={isListening ? stopListening : startListening}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                    color: isListening ? 'white' : 'var(--text-secondary)',
                    background: isListening ? 'var(--accent)' : 'var(--gray-100)',
                    borderRadius: 100, padding: '6px 14px', fontWeight: 700,
                    animation: isListening ? 'micPulse 1.2s ease infinite' : 'none',
                    border: isListening ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  }}
                >
                  🎤 {isListening ? '듣는 중...' : '음성입력'}
                </button>
              </div>
            )}
            <QuickTemplatePanel
              templates={allTemplates}
              customTemplates={customTemplates}
              onInsert={insertTemplate}
              onAdd={handleAddTemplate}
              onDelete={handleDeleteTemplate}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button onClick={() => setRawText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', borderRadius: 100, padding: '6px 12px' }}>
                <Mic size={13} /> 예시 넣기
              </button>
              <div style={{ fontSize: 12, fontWeight: rawText.length > 0 ? 700 : 400, color: rawText.length > 0 ? 'var(--primary)' : 'var(--text-tertiary)' }}>{rawText.length}자</div>
            </div>
          </StepSection>

          {/* 에러 */}
          {error && (
            <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '13px 16px', borderRadius: 12, fontSize: 14, marginBottom: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ {error}</div>
          )}

          {/* AI 정리 버튼 */}
          {!result && (
            <button onClick={handleProcess} disabled={loading} style={{ width: '100%', padding: '18px', borderRadius: 16, background: loading ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: loading ? 'none' : '0 8px 24px rgba(79,127,255,0.35)', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '-0.3px' }}>
              {loading ? <><Spinner /> AI가 문서 문장으로 정리 중...</> : <><Sparkles size={20} /> AI 자동 정리하기</>}
            </button>
          )}

          {/* 결과 */}
          {result && (
            <div className="slide-up">
              {cat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ background: cat.bg, color: cat.color, padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 800 }}>{cat.emoji} {cat.label}</span>
                  {result.tags?.map(tag => <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>#{tag}</span>)}
                </div>
              )}
              {result.devAreas?.length > 0 && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>자동 연결 발달영역</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.devAreas.map(a => <span key={a} style={{ fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: 100, fontWeight: 700 }}>{a}</span>)}
                  </div>
                </div>
              )}
              <ResultSection title="관찰일지 문장"        text={result.observation} />
              <ResultSection title="부모상담/알림장 문장" text={result.parent}      accent />
              <ResultSection title="교사 지원계획"        text={result.support} />
              <ResultSection title="문서작성 준비 상태"   text={result.documentReadyText} />
              <ResultSection title="원문 순화본"          text={result.softened} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
                <button onClick={handleReset} style={{ padding: '15px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--white)', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RotateCcw size={15} /> 다시 입력
                </button>
                <button onClick={handleSave} disabled={saved} style={{ padding: '15px', borderRadius: 14, border: 'none', background: saved ? 'var(--cat-play)' : 'var(--primary)', fontSize: 14, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: saved ? 'none' : '0 4px 14px rgba(79,127,255,0.3)' }}>
                  {saved ? <><Check size={15} /> 저장 완료</> : <><Save size={15} /> 저장하기</>}
                </button>
              </div>
              {saved && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button onClick={handleReset} style={{ padding: '13px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 14, fontWeight: 800 }}>+ 다음 기록</button>
                  <button onClick={() => { setMode('list'); setResult(null); setFilterDate(today()); }} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800 }}>저장 기록 보기</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 기록 상세 모달 */}
      {detailRecord && (
        <RecordDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onUpdate={handleUpdateRecord}
          onDelete={handleDeleteRecord}
          onToggleStar={handleToggleStar}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   빠른 문구 패널 (추가/삭제 포함)
══════════════════════════════════════════════════════════════════════════════ */
function QuickTemplatePanel({ templates, customTemplates, onInsert, onAdd, onDelete }) {
  const [editMode, setEditMode]   = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmoji, setNewEmoji]   = useState('✏️');
  const [newLabel, setNewLabel]   = useState('');
  const [newText, setNewText]     = useState('');
  const [addError, setAddError]   = useState('');

  const handleAdd = () => {
    if (!newLabel.trim()) return setAddError('문구 이름을 입력해 주세요.');
    if (!newText.trim())  return setAddError('문구 내용을 입력해 주세요.');
    onAdd({ label: newLabel.trim(), emoji: newEmoji, type: 'habit', text: newText.trim() });
    setNewLabel(''); setNewText(''); setNewEmoji('✏️'); setAddError('');
    setShowAddForm(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>빠른 문구</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>원터치 입력</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setShowAddForm(v => !v); setEditMode(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 100, background: showAddForm ? 'var(--primary)' : 'var(--primary-light)', color: showAddForm ? 'white' : 'var(--primary)', fontSize: 11, fontWeight: 800 }}
          >
            <Plus size={12} /> 추가
          </button>
          <button
            onClick={() => { setEditMode(v => !v); setShowAddForm(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 100, background: editMode ? 'var(--accent)' : 'var(--gray-100)', color: editMode ? 'white' : 'var(--text-secondary)', fontSize: 11, fontWeight: 800 }}
          >
            <Pencil size={12} /> 편집
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div style={{ background: 'var(--primary-light)', borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)', marginBottom: 10 }}>새 빠른 문구 추가</div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8, marginBottom: 8 }}>
            <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="이모지" maxLength={4}
              style={{ padding: '9px 10px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 18, textAlign: 'center', background: 'var(--white)' }} />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="이름 (예: 낮잠)" maxLength={10}
              style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--white)' }} />
          </div>
          <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="삽입될 문구 내용을 써주세요. {child}는 아이 이름으로 자동 치환돼요."
            style={{ width: '100%', minHeight: 72, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', resize: 'none', background: 'var(--white)', marginBottom: 8 }} />
          {addError && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>⚠️ {addError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 800 }}>저장</button>
            <button onClick={() => { setShowAddForm(false); setAddError(''); }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--white)', border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>취소</button>
          </div>
        </div>
      )}

      {/* 문구 목록 */}
      <div className="avatar-scroll" style={{ marginLeft: -4, marginRight: -4, padding: '0 4px 4px' }}>
        <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
          {templates.map(t => (
            <div key={t.id} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => !editMode && onInsert(t)}
                style={{ padding: '8px 12px', borderRadius: 100, background: editMode ? 'var(--gray-100)' : 'white', border: `1.5px solid ${editMode && t.custom ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap', cursor: editMode ? 'default' : 'pointer', paddingRight: editMode && t.custom ? 28 : 12 }}
              >
                {t.emoji} {t.label}
                {!t.custom && editMode && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>기본</span>}
              </button>
              {editMode && t.custom && (
                <button onClick={() => onDelete(t.id)}
                  style={{ position: 'absolute', top: -6, right: -4, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {editMode && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>직접 추가한 문구만 삭제할 수 있어요.</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CSV 내보내기 함수
══════════════════════════════════════════════════════════════════════════════ */
export function exportRecordsToCSV(records, children) {
  const childMap = {};
  children.forEach(c => { childMap[c.id] = c.name; });
  const headers = ['날짜', '아이 이름', '기록 유형', '카테고리', '원본 내용', '생성된 내용'];
  const rows = records.map(r => [
    r.date || '',
    childMap[r.childId] || r.childName || '',
    r.recordType || r.type || '',
    r.category || '',
    `"${(r.rawText || '').replace(/"/g, '""')}"`,
    `"${(r.observation || r.result || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
  ]);
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const BOM = '﻿';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `쌤워크_기록_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════════════
   전체 기록 워크스페이스
══════════════════════════════════════════════════════════════════════════════ */
function RecordsWorkspace({
  records, filteredRecords, children,
  searchText, setSearchText,
  filterChildId, setFilterChildId,
  filterCategory, setFilterCategory,
  filterDate, setFilterDate,
  filterStarred, setFilterStarred,
  calendarMonth, setCalendarMonth,
  recordDates, clearFilters, isDesktop,
  onOpenDetail, onToggleStar, onStartRecord,
}) {
  const starCount = records.filter(r => r.starred).length;
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState('all');
  const [exportChildId, setExportChildId] = useState('all');

  const handleExport = () => {
    const now = new Date();
    let filtered = [...records];
    if (exportRange === 'month') {
      const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      filtered = filtered.filter(r => r.date && r.date.startsWith(ym));
    } else if (exportRange === '3months') {
      const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
      filtered = filtered.filter(r => r.date && r.date >= cutoff.toISOString().slice(0,10));
    }
    if (exportChildId !== 'all') filtered = filtered.filter(r => r.childId === exportChildId);
    exportRecordsToCSV(filtered, children);
    setShowExportModal(false);
  };

  return (
    <div className="slide-up">
      {showExportModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end' }} onClick={() => setShowExportModal(false)}>
          <div style={{ width:'100%', background:'var(--white)', borderRadius:'20px 20px 0 0', padding:24, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:900, marginBottom:16 }}>📊 기록 내보내기</div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>기간 선택</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {[['all','전체'],['month','이번 달'],['3months','최근 3개월']].map(([k,v]) => (
                <button key={k} onClick={() => setExportRange(k)} style={{ padding:'8px 16px', borderRadius:100, fontSize:13, fontWeight:800, background: exportRange===k ? 'var(--primary)' : 'var(--gray-100)', color: exportRange===k ? 'white' : 'var(--text-secondary)' }}>{v}</button>
              ))}
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>아이 선택</div>
            <select value={exportChildId} onChange={e => setExportChildId(e.target.value)} style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:14, marginBottom:16, fontFamily:'inherit' }}>
              <option value="all">전체 아이</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:16, lineHeight:1.6 }}>
              💡 엑셀에서 열 때 파일 인코딩을 UTF-8로 선택해주세요
            </div>
            <button onClick={handleExport} style={{ width:'100%', padding:'14px', borderRadius:12, background:'var(--primary)', color:'white', fontSize:15, fontWeight:800 }}>
              CSV 다운로드 (엑셀)
            </button>
          </div>
        </div>
      )}
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

      {/* 검색/필터 */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', marginBottom: 12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <ListFilter size={16} color="var(--primary)" />
            <span style={{ fontSize: 14, fontWeight: 900 }}>기록 검색/필터</span>
          </div>
          <button onClick={() => setFilterStarred(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:100, fontSize:12, fontWeight:800, background: filterStarred ? '#FFF8E1' : 'var(--gray-100)', color: filterStarred ? '#F5A623' : 'var(--text-secondary)', border:`1.5px solid ${filterStarred ? '#F5A623' : 'transparent'}` }}>
            <Star size={13} fill={filterStarred ? '#F5A623' : 'none'} /> 즐겨찾기 {starCount > 0 ? `(${starCount})` : ''}
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="아이 이름, 기록 내용, 태그로 검색"
            style={{ width: '100%', padding: '12px 14px 12px 38px', borderRadius: 13, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--gray-50)' }} />
        </div>
        {/* 카테고리 필터 칩 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={() => setFilterCategory('all')} style={{ padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, background: filterCategory === 'all' ? 'var(--primary)' : 'var(--gray-100)', color: filterCategory === 'all' ? 'white' : 'var(--text-secondary)' }}>전체</button>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button key={key} onClick={() => setFilterCategory(filterCategory === key ? 'all' : key)} style={{ padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, background: filterCategory === key ? cat.color : cat.bg, color: filterCategory === key ? 'white' : cat.color, border: '1px solid ' + cat.color + '30' }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        {searchText && (
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800, marginBottom: 8 }}>검색 결과 {filteredRecords.length}건</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr auto' : '1fr', gap: 8 }}>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={selectStyle}>
            <option value="">전체 날짜</option>
            {[...recordDates.keys()].sort((a, b) => b.localeCompare(a)).map(date => (
              <option key={date} value={date}>{formatDate(date)} · {recordDates.get(date)}건</option>
            ))}
          </select>
          <select value={filterChildId} onChange={e => setFilterChildId(e.target.value)} style={selectStyle}>
            <option value="all">전체 아이</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 900 }}>{filteredRecords.length}건</div>
          <button onClick={() => setShowExportModal(true)} style={{ fontSize:12, fontWeight:800, color:'var(--primary)', background:'var(--primary-light)', borderRadius:100, padding:'5px 12px' }}>
            내보내기
          </button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        records.length === 0 ? (
          <EmptyState emoji="✍️" title="아직 기록이 없어요" desc="오늘 아이들의 관찰 내용을 기록해보세요" actionLabel="첫 기록 남기기" onAction={onStartRecord} />
        ) : (
          <EmptyState emoji="🔍" title="검색 결과가 없어요" desc="다른 키워드로 검색해보세요" />
        )
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filteredRecords.map(record => <RecordListCard key={record.id} record={record} onClick={() => onOpenDetail(record)} onToggleStar={onToggleStar} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   캘린더 패널 (월간 + 연간 뷰)
══════════════════════════════════════════════════════════════════════════════ */
function CalendarPanel({ calendarMonth, setCalendarMonth, recordDates, filterDate, setFilterDate }) {
  const [view, setView] = useState('month'); // 'month' | 'year'
  const year  = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const moveMonth = (delta) => setCalendarMonth(new Date(year, month + delta, 1));
  const moveYear  = (delta) => setCalendarMonth(new Date(year + delta, month, 1));

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarDays size={16} color="var(--primary)" />
          <span style={{ fontSize: 14, fontWeight: 900 }}>캘린더 뷰</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 월간/연간 토글 */}
          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 10, padding: 3 }}>
            <button onClick={() => setView('month')} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: view === 'month' ? 'white' : 'transparent', color: view === 'month' ? 'var(--primary)' : 'var(--text-tertiary)', boxShadow: view === 'month' ? 'var(--shadow-sm)' : 'none' }}>월간</button>
            <button onClick={() => setView('year')}  style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: view === 'year'  ? 'white' : 'transparent', color: view === 'year'  ? 'var(--primary)' : 'var(--text-tertiary)', boxShadow: view === 'year'  ? 'var(--shadow-sm)' : 'none' }}>연간</button>
          </div>
          {view === 'month' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => moveMonth(-1)} style={calArrow}><ChevronLeft size={16} /></button>
              <span style={{ minWidth: 80, textAlign: 'center', fontSize: 13, fontWeight: 900 }}>{year}.{String(month + 1).padStart(2, '0')}</span>
              <button onClick={() => moveMonth(1)}  style={calArrow}><ChevronRight size={16} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => moveYear(-1)} style={calArrow}><ChevronLeft size={16} /></button>
              <span style={{ minWidth: 50, textAlign: 'center', fontSize: 13, fontWeight: 900 }}>{year}년</span>
              <button onClick={() => moveYear(1)}  style={calArrow}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid year={year} month={month} recordDates={recordDates} filterDate={filterDate} setFilterDate={setFilterDate} />
      ) : (
        <YearGrid year={year} recordDates={recordDates} filterDate={filterDate} setFilterDate={setFilterDate}
          onSelectMonth={(m) => { setCalendarMonth(new Date(year, m, 1)); setView('month'); }} />
      )}

      {view === 'month' && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>점이 있는 날짜를 누르면 해당 날의 기록만 보여요.</div>
      )}
    </div>
  );
}

function MonthGrid({ year, month, recordDates, filterDate, setFilterDate }) {
  const first   = new Date(year, month, 1);
  const last    = new Date(year, month + 1, 0);
  const leading = first.getDay();
  const days    = [];
  for (let i = 0; i < leading; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {['일','월','화','수','목','금','토'].map(day => (
          <div key={day} style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, color: day === '일' ? 'var(--accent)' : 'var(--text-tertiary)' }}>{day}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((date, idx) => {
          if (!date) return <div key={`e-${idx}`} />;
          const dateStr  = toDateString(date);
          const count    = recordDates.get(dateStr) || 0;
          const selected = filterDate === dateStr;
          const isToday  = dateStr === today();
          return (
            <button key={dateStr} onClick={() => setFilterDate(selected ? '' : dateStr)} style={{ minHeight: 44, borderRadius: 12, background: selected ? 'var(--primary)' : count ? 'var(--primary-light)' : 'var(--gray-50)', color: selected ? 'white' : isToday ? 'var(--primary)' : 'var(--text-secondary)', border: isToday && !selected ? '1.5px solid var(--primary)' : '1.5px solid transparent', fontSize: 12, fontWeight: selected || count || isToday ? 900 : 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <span>{date.getDate()}</span>
              {count > 0 && <span style={{ width: 6, height: 6, borderRadius: 999, background: selected ? 'white' : 'var(--primary)', display: 'block' }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function YearGrid({ year, recordDates, filterDate, setFilterDate, onSelectMonth }) {
  const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const todayStr    = today();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {MONTH_NAMES.map((label, mIdx) => {
        const first   = new Date(year, mIdx, 1);
        const last    = new Date(year, mIdx + 1, 0);
        const leading = first.getDay();
        const days    = [];
        for (let i = 0; i < leading; i++) days.push(null);
        for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, mIdx, d));

        // 이 달에 기록이 있는 날 수
        const daysWithRecords = days.filter(d => d && recordDates.get(toDateString(d)));
        const hasSelected = days.some(d => d && toDateString(d) === filterDate);

        return (
          <div key={mIdx} style={{ border: `1.5px solid ${hasSelected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 14, padding: '10px 8px', cursor: 'pointer', background: hasSelected ? 'var(--primary-light)' : 'white' }}
            onClick={() => onSelectMonth(mIdx)}>
            <div style={{ fontSize: 12, fontWeight: 900, color: hasSelected ? 'var(--primary)' : 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>{label}</div>
            {/* 미니 캘린더 도트 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {days.map((d, idx) => {
                if (!d) return <div key={`y-e-${mIdx}-${idx}`} style={{ height: 8 }} />;
                const ds   = toDateString(d);
                const cnt  = recordDates.get(ds) || 0;
                const isTd = ds === todayStr;
                const isSel = ds === filterDate;
                return (
                  <div key={ds}
                    onClick={e => { e.stopPropagation(); setFilterDate(isSel ? '' : ds); }}
                    style={{ height: 8, borderRadius: 2, background: isSel ? 'var(--primary)' : cnt ? 'var(--primary)' : isTd ? 'var(--accent-light)' : 'var(--gray-100)', opacity: cnt || isTd || isSel ? 1 : 0.4 }}
                    title={cnt ? `${ds} · ${cnt}건` : ds}
                  />
                );
              })}
            </div>
            {daysWithRecords.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 800, textAlign: 'center', marginTop: 5 }}>{daysWithRecords.length}일 기록</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const calArrow = {
  width: 28, height: 28, borderRadius: 9,
  background: 'var(--gray-100)', color: 'var(--text-secondary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/* ══════════════════════════════════════════════════════════════════════════════
   기록 카드 (클릭 → 상세보기)
══════════════════════════════════════════════════════════════════════════════ */
function RecordListCard({ record, onClick, onToggleStar }) {
  const cat  = record.category ? CATEGORIES[record.category] : null;
  const body = record.observation || record.rawText || record.softened || '';
  return (
    <div
      onClick={onClick}
      style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 15, boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: getAvatarColor(record.childName), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
          {record.childName?.[0] || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 14 }}>{record.childName || '이름 없음'}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatDateKo(record.date)}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{RECORD_TYPE_LABELS[record.recordType] || '기록'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
            {cat && <span style={{ background: cat.bg, color: cat.color, borderRadius: 100, padding: '3px 8px', fontSize: 11, fontWeight: 900 }}>{cat.emoji} {cat.label}</span>}
            {record.tags?.slice(0, 3).map(tag => <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: 100, padding: '3px 7px', fontSize: 10, fontWeight: 700 }}>#{tag}</span>)}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onToggleStar && onToggleStar(record.id); }}
          style={{ flexShrink:0, background:'none', padding:4 }}>
          <Star size={16} color={record.starred ? '#F5A623' : 'var(--gray-300)'} fill={record.starred ? '#F5A623' : 'none'} />
        </button>
        <div style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}><ChevronDown size={16} /></div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
        {body.length > 150 ? `${body.slice(0, 150)}...` : body}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   기록 상세/수정 모달
══════════════════════════════════════════════════════════════════════════════ */
function RecordDetailModal({ record, onClose, onUpdate, onDelete, onToggleStar }) {
  const [editMode, setEditMode]     = useState(false);
  const [editRaw, setEditRaw]       = useState(record.rawText || '');
  const [editObs, setEditObs]       = useState(record.observation || '');
  const [editParent, setEditParent] = useState(record.parent || '');
  const [editSupport, setEditSupport] = useState(record.support || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded]     = useState({});
  const [regenBanner, setRegenBanner] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const cat = record.category ? CATEGORIES[record.category] : null;

  const handleSave = () => {
    onUpdate(record.id, { rawText: editRaw, observation: editObs, parent: editParent, support: editSupport });
    setEditMode(false);
    // Show regen banner if record had AI result
    if (record.observation || record.parent || record.support) {
      setRegenBanner(true);
    }
  };

  const handleRegen = async () => {
    setRegenBanner(false);
    setRegenLoading(true);
    try {
      const classes = getClasses();
      const cl = classes[0];
      const res = await processRecord({ childName: record.childName, rawText: editRaw || record.rawText, classAge: cl?.age, recordType: record.recordType || 'observe' });
      onUpdate(record.id, { ...res });
    } catch (e) {
      alert('재생성 중 오류가 발생했어요: ' + (e.message || ''));
    } finally {
      setRegenLoading(false);
    }
  };

  const toggleSection = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,50,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 600, background: 'var(--white)', borderRadius: '24px 24px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>

        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--gray-200)' }} />
        </div>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarColor(record.childName), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, flexShrink: 0 }}>
              {record.childName?.[0] || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{record.childName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDateKo(record.date)} · {RECORD_TYPE_LABELS[record.recordType] || '기록'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => onToggleStar && onToggleStar(record.id)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:10, background: record.starred ? '#FFF8E1' : 'var(--gray-100)', color: record.starred ? '#F5A623' : 'var(--text-secondary)', fontSize:12, fontWeight:800 }}>
              <Star size={14} fill={record.starred ? '#F5A623' : 'none'} color={record.starred ? '#F5A623' : 'var(--gray-400)'} />
              {record.starred ? '즐겨찾기 해제' : '즐겨찾기'}
            </button>
            {!editMode && (
              <button onClick={() => setEditMode(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 13, fontWeight: 800 }}>
                <Pencil size={14} /> 수정
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 24px', flex: 1 }}>

          {/* AI 재생성 배너 */}
          {regenBanner && (
            <div style={{ background: '#FFF8E1', border: '1px solid #F5A623', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#E65100' }}>✏️ 내용이 수정됐어요. 문서를 다시 생성할까요?</div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button onClick={handleRegen} style={{ padding: '6px 14px', borderRadius: 9, background: '#E65100', color: 'white', fontSize: 12, fontWeight: 800 }}>재생성</button>
                <button onClick={() => setRegenBanner(false)} style={{ padding: '6px 10px', borderRadius: 9, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>유지</button>
              </div>
            </div>
          )}
          {regenLoading && (
            <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: 13, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner /> AI가 문서 문장으로 다시 정리 중...
            </div>
          )}

          {/* 카테고리 & 태그 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
            {cat && <span style={{ background: cat.bg, color: cat.color, padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 900 }}>{cat.emoji} {cat.label}</span>}
            {record.tags?.map(tag => <span key={tag} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', padding: '4px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700 }}>#{tag}</span>)}
          </div>

          {/* 발달영역 */}
          {record.devAreas?.length > 0 && (
            <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>발달영역</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {record.devAreas.map(a => <span key={a} style={{ fontSize: 12, color: 'var(--primary)', background: 'var(--white)', padding: '3px 9px', borderRadius: 100, fontWeight: 700 }}>{a}</span>)}
              </div>
            </div>
          )}

          {editMode ? (
            /* ── 수정 모드 ─────── */
            <div>
              <EditField label="원본 입력" value={editRaw}     onChange={setEditRaw}     rows={3} />
              <EditField label="관찰일지 문장" value={editObs}  onChange={setEditObs}     rows={4} accent />
              <EditField label="알림장 문장"  value={editParent} onChange={setEditParent}  rows={3} />
              <EditField label="교사 지원계획" value={editSupport} onChange={setEditSupport} rows={3} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <button onClick={() => setEditMode(false)} style={{ padding: '13px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--white)', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <X size={14} /> 취소
                </button>
                <button onClick={handleSave} style={{ padding: '13px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 14px rgba(79,127,255,0.3)' }}>
                  <Check size={14} /> 저장
                </button>
              </div>
            </div>
          ) : (
            /* ── 보기 모드 ─────── */
            <div>
              <DetailSection title="원본 입력"   text={record.rawText}    expanded={expanded.raw}    onToggle={() => toggleSection('raw')} />
              <DetailSection title="관찰일지 문장" text={record.observation} expanded={expanded.obs}  onToggle={() => toggleSection('obs')} accent />
              <DetailSection title="알림장 문장"   text={record.parent}    expanded={expanded.par}    onToggle={() => toggleSection('par')} />
              <DetailSection title="교사 지원계획" text={record.support}   expanded={expanded.sup}    onToggle={() => toggleSection('sup')} />
              {record.softened && <DetailSection title="원문 순화본" text={record.softened} expanded={expanded.soft} onToggle={() => toggleSection('soft')} />}

              {/* 삭제 */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 13, fontWeight: 800, background: 'var(--accent-light)', borderRadius: 10, padding: '9px 16px' }}>
                    <Trash2 size={14} /> 기록 삭제
                  </button>
                ) : (
                  <div style={{ background: 'var(--accent-light)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>정말 삭제할까요? 복구할 수 없어요.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button onClick={() => setConfirmDelete(false)} style={{ padding: '10px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--white)', fontSize: 13, fontWeight: 700 }}>취소</button>
                      <button onClick={() => onDelete(record.id)} style={{ padding: '10px', borderRadius: 10, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 800 }}>삭제</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, text, expanded, onToggle, accent }) {
  const showToast = useToast();
  if (!text) return null;
  const handleCopy = () => { navigator.clipboard.writeText(text); showToast('복사했어요! 📋', 'success'); };
  const isLong = text.length > 100;

  return (
    <div style={{ background: accent ? 'var(--primary-light)' : 'var(--gray-50)', border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 13, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded || !isLong ? 8 : 0 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleCopy} style={{ fontSize: 11, color: accent ? 'var(--primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
            <Copy size={12} /> 복사
          </button>
          {isLong && <button onClick={onToggle} style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', fontWeight: 700 }}>{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>}
        </div>
      </div>
      {(!isLong || expanded) && (
        <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{text}</div>
      )}
      {isLong && !expanded && (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={onToggle}>{text.slice(0, 80)}... <span style={{ color: 'var(--primary)', fontWeight: 700 }}>더 보기</span></div>
      )}
    </div>
  );
}

function EditField({ label, value, onChange, rows, accent }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: accent ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${accent ? 'var(--primary)' : 'var(--border)'}`, fontSize: 13, lineHeight: 1.75, fontFamily: 'inherit', resize: 'vertical', background: accent ? 'var(--primary-light)' : 'white' }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   공통 서브 컴포넌트
══════════════════════════════════════════════════════════════════════════════ */
function StepSection({ step, label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step}</div>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, icon }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 15, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 20, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function ResultSection({ title, text, accent }) {
  const showToast = useToast();
  const handleCopy = () => { navigator.clipboard.writeText(text || ''); showToast('복사했어요! 📋', 'success'); };
  if (!text) return null;
  return (
    <div style={{ background: accent ? 'var(--primary-light)' : 'white', border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 15, padding: 16, marginBottom: 12, boxShadow: accent ? '0 8px 18px rgba(79,127,255,0.08)' : 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <button onClick={handleCopy} style={{ fontSize: 12, color: accent ? 'var(--primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
          <Copy size={13} /> 복사
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}

const selectStyle = {
  width: '100%', padding: '11px 12px', borderRadius: 13,
  border: '1.5px solid var(--border)', background: 'var(--white)',
  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
};
