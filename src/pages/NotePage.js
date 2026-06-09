import React, { useState, useEffect, useCallback } from 'react';
import {
  getChildren, getRecords, getClasses,
  today, formatDateKo, formatDate,
} from '../utils/storage';
import {
  ChevronLeft, ChevronRight, Printer, Copy, Check,
  RefreshCw, Sparkles, PenLine, AlertCircle,
} from 'lucide-react';

const AVATAR_COLORS = [
  '#4F7FFF','#6C63FF','#FF8C42','#00B4D8',
  '#4CAF50','#E91E9A','#FF5722','#607D8B',
];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// 아이의 특정 날짜 기록으로 알림장 문장 생성
function buildNoteText(childName, recs) {
  if (recs.length === 0) return '';

  // 이미 생성된 parent 문장 활용
  const parentTexts = recs.map(r => r.parent).filter(Boolean);
  if (parentTexts.length > 0) return parentTexts.join('\n\n');

  // parent 없으면 observation으로 fallback
  const obs = recs.map(r => r.observation || r.rawText).filter(Boolean);
  if (obs.length === 0) return '';

  const intro = `안녕하세요, ${childName} 학부모님. 오늘 하루 ${childName}의 어린이집 생활을 알려드립니다.`;
  const body  = obs.map(t => `· ${t}`).join('\n');
  const outro = '내일도 건강하고 즐거운 하루 보내길 바랍니다. 감사합니다.';
  return `${intro}\n\n${body}\n\n${outro}`;
}

export default function NotePage({ onNavigate, isDesktop }) {
  const [viewDate, setViewDate]     = useState(today());
  const [children, setChildren]     = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [classes, setClasses]       = useState([]);
  const [notes, setNotes]           = useState({});     // { childId: string }
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState(false);
  const [filter, setFilter]         = useState('all'); // 'all' | 'recorded' | 'empty'

  const todayStr = today();
  const isToday  = viewDate === todayStr;

  useEffect(() => {
    setChildren(getChildren());
    setAllRecords(getRecords());
    setClasses(getClasses());
    setNotes({});
    setGenerated(false);
  }, []);

  const changeDate = (delta) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().split('T')[0];
    setViewDate(next);
    setNotes({});
    setGenerated(false);
  };

  // 날짜별 아이 기록 가져오기
  const getChildRecs = useCallback((childId) =>
    allRecords.filter(r => r.childId === childId && r.date === viewDate),
  [allRecords, viewDate]);

  // 전체 생성
  const handleGenerateAll = () => {
    setGenerating(true);
    setTimeout(() => {
      const newNotes = {};
      children.forEach(child => {
        const recs = getChildRecs(child.id);
        newNotes[child.id] = buildNoteText(child.name, recs);
      });
      setNotes(newNotes);
      setGenerated(true);
      setGenerating(false);
    }, 60);
  };

  // 개별 재생성
  const handleRegenerate = (child) => {
    const recs = getChildRecs(child.id);
    const text = buildNoteText(child.name, recs);
    setNotes(prev => ({ ...prev, [child.id]: text }));
  };

  // 인쇄
  const handlePrint = () => window.print();

  const cl = classes[0];
  const dateRecs = allRecords.filter(r => r.date === viewDate);
  const recordedIds = new Set(dateRecs.map(r => r.childId));

  const filteredChildren = children.filter(c => {
    if (filter === 'recorded') return recordedIds.has(c.id);
    if (filter === 'empty')    return !recordedIds.has(c.id);
    return true;
  });

  const pad = isDesktop ? '32px 36px' : '20px';

  /* ── 인쇄 전용 DOM ─────────────────────────────────── */
  const PrintArea = (
    <div className="print-area" style={{ display: 'none' }}>
      <div className="print-header">
        <div>
          <div style={{ fontSize: '18pt', fontWeight: 900 }}>알림장</div>
          <div style={{ fontSize: '11pt', color: '#666' }}>
            {cl ? `${cl.name} · ${cl.age}세반` : ''}
          </div>
        </div>
        <div style={{ fontSize: '11pt', color: '#444' }}>{formatDate(viewDate)}</div>
      </div>
      {children.map(child => (
        <div key={child.id} className="print-note-card">
          <div className="print-note-name">{child.name}</div>
          <div className="print-note-body">{notes[child.id] || '(알림장 내용 없음)'}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: pad }}>
      {PrintArea}

      {/* ── 헤더 ─────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
          <PenLine size={13} /> 알림장 전용
        </div>
        <div style={{ fontSize: isDesktop ? 24 : 22, fontWeight: 900, letterSpacing: '-0.7px', marginBottom: 4 }}>
          알림장 일괄 작성
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          오늘 기록을 바탕으로 아이별 알림장 문장을 자동으로 만들어줍니다.
        </div>
      </div>

      {/* ── 날짜 네비 ───────────────────────────────────── */}
      <div style={{
        background: 'var(--white)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <button onClick={() => changeDate(-1)} style={{ color: 'var(--text-secondary)', padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{formatDateKo(viewDate)}</div>
          <div style={{ fontSize: 12, color: isToday ? 'var(--primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 700 : 400 }}>
            {isToday ? '오늘' : viewDate} · 기록 {dateRecs.length}건
          </div>
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday} style={{ color: 'var(--text-secondary)', padding: 4 }}>
          <ChevronRight size={20} style={{ opacity: isToday ? 0.3 : 1 }} />
        </button>
      </div>

      {/* ── 상단 액션 바 ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          style={{
            flex: 1, minWidth: 160, padding: '13px 16px', borderRadius: 14,
            background: generating ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: 'white', fontSize: 14, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: generating ? 'none' : '0 6px 18px rgba(79,127,255,0.3)',
          }}
        >
          {generating
            ? <><Spinner /> 생성 중...</>
            : <><Sparkles size={16} /> 전체 알림장 생성</>
          }
        </button>

        {generated && (
          <button
            onClick={handlePrint}
            style={{
              padding: '13px 18px', borderRadius: 14, border: '1.5px solid var(--border)',
              background: 'var(--white)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Printer size={16} color="var(--primary)" /> 인쇄 / PDF
          </button>
        )}
      </div>

      {/* ── 필터 탭 ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[
          ['all',      `전체 (${children.length}명)`],
          ['recorded', `기록 있음 (${recordedIds.size}명)`],
          ['empty',    `기록 없음 (${children.length - recordedIds.size}명)`],
        ].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
            background: filter === k ? 'var(--primary)' : 'var(--gray-100)',
            color:      filter === k ? 'white' : 'var(--text-secondary)',
          }}>
            {v}
          </button>
        ))}
      </div>

      {/* ── 아이별 알림장 카드 ───────────────────────────── */}
      {filteredChildren.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>👶</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>등록된 아이가 없어요</div>
        </div>
      ) : (
        <div style={isDesktop
          ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
          : { display: 'flex', flexDirection: 'column', gap: 14 }
        }>
          {filteredChildren.map(child => {
            const color    = getAvatarColor(child.name);
            const recs     = getChildRecs(child.id);
            const hasRec   = recs.length > 0;
            const noteText = notes[child.id] ?? null; // null=미생성, ''=기록없음, string=생성됨

            return (
              <NoteCard
                key={child.id}
                child={child}
                color={color}
                recs={recs}
                hasRec={hasRec}
                noteText={noteText}
                generated={generated}
                onRegenerate={() => handleRegenerate(child)}
                onNavigate={onNavigate}
                onChange={text => setNotes(prev => ({ ...prev, [child.id]: text }))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 아이별 알림장 카드 ────────────────────────────────────────────────────── */
function NoteCard({ child, color, recs, hasRec, noteText, generated, onRegenerate, onNavigate, onChange }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!noteText) return;
    navigator.clipboard.writeText(noteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{
      background: 'var(--white)', border: `1px solid ${hasRec ? color + '30' : 'var(--border)'}`,
      borderRadius: 18, padding: 18,
      boxShadow: hasRec ? `0 4px 16px ${color}18` : 'var(--shadow-sm)',
    }}>
      {/* 카드 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: `${color}18`, border: `2px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color, flexShrink: 0,
          }}>
            {child.name[0]}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--text-primary)' }}>{child.name}</div>
            <div style={{ fontSize: 11, color: hasRec ? color : 'var(--text-tertiary)', fontWeight: 700 }}>
              {hasRec ? `기록 ${recs.length}건 반영` : '오늘 기록 없음'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!hasRec && (
            <button onClick={() => onNavigate('record', { childId: child.id })} style={{
              fontSize: 12, fontWeight: 800, color: 'var(--primary)',
              background: 'var(--primary-light)', borderRadius: 8, padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <PenLine size={12} /> 기록
            </button>
          )}
          {generated && hasRec && (
            <button onClick={onRegenerate} title="다시 생성" style={{
              width: 30, height: 30, borderRadius: 8, background: 'var(--gray-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}>
              <RefreshCw size={14} />
            </button>
          )}
          {noteText && (
            <button onClick={handleCopy} style={{
              width: 30, height: 30, borderRadius: 8,
              background: copied ? 'var(--cat-play-light)' : 'var(--gray-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: copied ? 'var(--cat-play)' : 'var(--text-secondary)',
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* 알림장 내용 */}
      {noteText !== null ? (
        noteText ? (
          <textarea
            value={noteText}
            onChange={e => onChange(e.target.value)}
            style={{
              width: '100%', minHeight: 130, padding: '12px 14px',
              borderRadius: 12, border: `1.5px solid ${color}30`,
              fontSize: 13, lineHeight: 1.85, resize: 'vertical',
              fontFamily: 'inherit', color: 'var(--text-primary)',
              background: `${color}06`, outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = `${color}30`}
          />
        ) : (
          <div style={{
            background: 'var(--gray-50)', borderRadius: 12, padding: '18px',
            textAlign: 'center', color: 'var(--text-tertiary)',
          }}>
            <AlertCircle size={18} style={{ margin: '0 auto 6px', display: 'block' }} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>오늘 기록이 없어 생성할 수 없어요</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>기록 추가 후 다시 생성해보세요</div>
          </div>
        )
      ) : (
        <div style={{
          background: 'var(--gray-50)', borderRadius: 12, padding: '20px',
          textAlign: 'center', color: 'var(--text-tertiary)',
        }}>
          <div style={{ fontSize: 13 }}>
            {hasRec
              ? '위 버튼으로 알림장을 생성할 수 있어요'
              : '기록을 추가하면 알림장이 자동으로 생성됩니다'}
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: 'white', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', flexShrink: 0,
    }} />
  );
}
