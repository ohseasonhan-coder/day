import React, { useEffect, useState } from 'react';
import { getChildren, getConsults, addConsult, updateConsult, deleteConsult, getAutomationState } from '../utils/storage';
import { Plus, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';

const CONSULT_TYPES = ['대면', '전화', '알림장'];
const CONSULT_DURATIONS = [15, 30, 45, 60];
const CONSULT_TOPICS = ['성장 발달', '생활습관', '친구관계', '특이사항', '가정환경', '기타'];
const AVATAR_COLORS = ['#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8', '#4CAF50', '#E91E9A', '#FF5722', '#607D8B'];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function getDdayLabel(dateStr) {
  const today = new Date();
  const target = new Date(`${dateStr}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return 'D-day';
  return `D-${diff}`;
}

export default function ConsultPage({ onNavigate, isDesktop }) {
  const [tab, setTab] = useState('upcoming');
  const [children, setChildren] = useState([]);
  const [consults, setConsults] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingConsult, setEditingConsult] = useState(null);
  const [detailConsult, setDetailConsult] = useState(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [automation, setAutomation] = useState(() => getAutomationState());

  const [formChildId, setFormChildId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formType, setFormType] = useState('대면');
  const [formDuration, setFormDuration] = useState(30);
  const [formTopics, setFormTopics] = useState([]);
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    setChildren(getChildren());
    setConsults(getConsults());
    setAutomation(getAutomationState());
  }, []);

  const refresh = () => setConsults(getConsults());

  const openAddForm = () => {
    setEditingConsult(null);
    setFormChildId(children[0]?.id || '');
    setFormDate('');
    setFormTime('');
    setFormType('대면');
    setFormDuration(30);
    setFormTopics([]);
    setFormNotes('');
    setShowForm(true);
  };

  const openEditForm = (consult) => {
    setEditingConsult(consult);
    setFormChildId(consult.childId);
    setFormDate(consult.date);
    setFormTime(consult.time || '');
    setFormType(consult.type || '대면');
    setFormDuration(consult.duration || 30);
    setFormTopics(consult.topics || []);
    setFormNotes(consult.notes || '');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formChildId || !formDate) return;
    const child = children.find(c => c.id === formChildId);
    const data = {
      childId: formChildId,
      childName: child?.name || '',
      date: formDate,
      time: formTime,
      type: formType,
      duration: formDuration,
      topics: formTopics,
      notes: formNotes,
      status: editingConsult?.status || 'scheduled',
      docGenerated: editingConsult?.docGenerated || false,
    };
    if (editingConsult) updateConsult(editingConsult.id, data);
    else addConsult(data);
    refresh();
    setShowForm(false);
  };

  const handleMarkDone = (id) => {
    updateConsult(id, { status: 'done', doneAt: new Date().toISOString() });
    refresh();
  };

  const handleDelete = (id) => {
    if (!window.confirm('상담 일정을 삭제할까요?')) return;
    deleteConsult(id);
    refresh();
    if (detailConsult?.id === id) setDetailConsult(null);
  };

  const handleUpdateOutcome = (consult) => {
    updateConsult(consult.id, { outcome: outcomeText });
    refresh();
    setDetailConsult({ ...consult, outcome: outcomeText });
  };

  const toggleTopic = (topic) => {
    setFormTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  };

  const upcoming = consults.filter(c => c.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  const done = consults.filter(c => c.status === 'done').sort((a, b) => (b.doneAt || b.date).localeCompare(a.doneAt || a.date));
  const pad = isDesktop ? '32px 36px' : '20px';
  const autoConsultItems = Object.values(automation?.consultAccumulations?.byChild || {}).filter(item => item.ready);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(248,250,254,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>💬 상담 관리</div>
        <button onClick={openAddForm} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 13 }}>
          <Plus size={14} /> 상담 일정 추가
        </button>
      </div>

      <div style={{ padding: pad }}>
        {autoConsultItems.length > 0 && (
          <AutoConsultPanel
            items={autoConsultItems}
            onPrepare={(item) => onNavigate?.('docs', { childId: item.childId, docType: 'parent', period: '1month' })}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <TabButton active={tab === 'upcoming'} onClick={() => setTab('upcoming')} label={`예정된 상담${upcoming.length ? ` (${upcoming.length})` : ''}`} />
          <TabButton active={tab === 'done'} onClick={() => setTab('done')} label={`완료된 상담${done.length ? ` (${done.length})` : ''}`} />
        </div>

        {tab === 'upcoming' && (
          upcoming.length === 0 ? (
            <EmptyState emoji="💬" title="예정된 상담이 없어요" actionLabel="상담 일정 추가하기" onAction={openAddForm} />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {upcoming.map(consult => (
                <ConsultCard
                  key={consult.id}
                  consult={consult}
                  onEdit={openEditForm}
                  onDelete={handleDelete}
                  onMarkDone={handleMarkDone}
                  onPrepareDoc={() => onNavigate?.('docs', { childId: consult.childId, docType: 'parent' })}
                />
              ))}
            </div>
          )
        )}

        {tab === 'done' && (
          done.length === 0 ? (
            <EmptyState emoji="✅" title="완료된 상담이 없어요" />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {done.map(consult => (
                <DoneConsultCard
                  key={consult.id}
                  consult={consult}
                  isOpen={detailConsult?.id === consult.id}
                  outcomeText={outcomeText}
                  onToggle={() => {
                    const willOpen = detailConsult?.id !== consult.id;
                    setDetailConsult(willOpen ? consult : null);
                    setOutcomeText(willOpen ? consult.outcome || '' : '');
                  }}
                  onOutcomeChange={setOutcomeText}
                  onSaveOutcome={() => handleUpdateOutcome(consult)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowForm(false)}>
          <div style={{ width: '100%', background: 'var(--white)', borderRadius: '20px 20px 0 0', padding: 24, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{editingConsult ? '상담 수정' : '상담 일정 추가'}</div>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <FormField label="아이 선택 *">
              <select value={formChildId} onChange={e => setFormChildId(e.target.value)} style={inputStyle}>
                {children.length === 0 && <option value="">아이가 없어요</option>}
                {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
              </select>
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <FormField label="날짜 *">
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
              </FormField>
              <FormField label="시간">
                <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} style={inputStyle} />
              </FormField>
            </div>

            <FormField label="상담 유형">
              <Segmented options={CONSULT_TYPES} value={formType} onChange={setFormType} />
            </FormField>

            <FormField label="소요 시간">
              <Segmented options={CONSULT_DURATIONS} value={formDuration} onChange={setFormDuration} format={v => `${v}분`} />
            </FormField>

            <FormField label="상담 주제">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CONSULT_TOPICS.map(topic => (
                  <button key={topic} onClick={() => toggleTopic(topic)} style={{
                    padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 800,
                    background: formTopics.includes(topic) ? 'var(--primary)' : 'var(--gray-100)',
                    color: formTopics.includes(topic) ? 'white' : 'var(--text-secondary)',
                  }}>
                    {topic}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="메모">
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="상담 전 준비사항, 특이사항 등" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </FormField>

            <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 800 }}>
              {editingConsult ? '수정 완료' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px', borderRadius: 14, fontSize: 14, fontWeight: 800,
      background: active ? 'var(--primary)' : 'white',
      color: active ? 'white' : 'var(--text-secondary)',
      border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    }}>
      {label}
    </button>
  );
}

function AutoConsultPanel({ items, onPrepare }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>자동 누적 상담자료</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>기록을 바탕으로 아이별 상담 문장이 자동으로 쌓입니다.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '5px 10px', height: 24 }}>{items.length}명</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.slice(0, 4).map(item => (
          <div key={item.childId} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 13, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{item.childName}</div>
              <button onClick={() => onPrepare(item)} style={{ fontSize: 11, fontWeight: 900, color: 'white', background: 'var(--primary)', borderRadius: 100, padding: '5px 9px' }}>상담자료</button>
            </div>
            <AutoLine title="최근 성장" text={item.recentGrowth} />
            <AutoLine title="강점" text={item.strengths} />
            <AutoLine title="지원" text={item.supportNeeded} />
            <AutoLine title="가정연계" text={item.homeLink} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AutoLine({ title, text }) {
  if (!text) return null;
  return <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}><b>{title}</b> · {text}</div>;
}

function ConsultCard({ consult, onEdit, onDelete, onMarkDone, onPrepareDoc }) {
  const dday = getDdayLabel(consult.date);
  const color = getAvatarColor(consult.childName);
  const isUrgent = dday && (dday === 'D-day' || parseInt(dday.replace('D-', ''), 10) <= 3);
  return (
    <div style={{ background: 'var(--white)', border: `1px solid ${isUrgent ? '#FF6B6B' : 'var(--border)'}`, borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
      <ConsultHeader consult={consult} color={color} dday={dday} urgent={isUrgent} />
      <TopicList topics={consult.topics} />
      {consult.notes && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6 }}>{consult.notes}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton onClick={onPrepareDoc} color="var(--primary)" bg="var(--primary-light)" label="상담자료 준비" />
        <ActionButton onClick={() => onMarkDone(consult.id)} color="#4CAF50" bg="#E8F5E9" label="완료" />
        <ActionButton onClick={() => onEdit(consult)} color="var(--text-secondary)" bg="var(--gray-100)" label="수정" />
        <ActionButton onClick={() => onDelete(consult.id)} color="var(--accent)" bg="var(--accent-light)" label="삭제" />
      </div>
    </div>
  );
}

function DoneConsultCard({ consult, isOpen, outcomeText, onToggle, onOutcomeChange, onSaveOutcome, onDelete }) {
  const color = getAvatarColor(consult.childName);
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
      <ConsultHeader consult={consult} color={color} done />
      <TopicList topics={consult.topics} muted />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <ActionButton onClick={onToggle} color="var(--primary)" bg="var(--primary-light)" label={isOpen ? '닫기' : '결과 기록'} />
        <ActionButton onClick={() => onDelete(consult.id)} color="var(--accent)" bg="var(--accent-light)" label="삭제" />
      </div>
      {isOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>상담 결과 기록</div>
          <textarea
            value={outcomeText}
            onChange={e => onOutcomeChange(e.target.value)}
            placeholder="상담 결과, 보호자 반응, 후속 조치 등을 기록해주세요."
            rows={4}
            style={{ ...inputStyle, resize: 'none', marginBottom: 10 }}
          />
          <button onClick={onSaveOutcome} style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 800 }}>
            저장
          </button>
          {consult.outcome && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {consult.outcome}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConsultHeader({ consult, color, dday, urgent, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: 'white', flexShrink: 0 }}>
        {consult.childName?.[0] || '?'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 900, fontSize: 15 }}>{consult.childName}</span>
          {done && <Badge bg="#E8F5E9" color="#4CAF50" label="완료" />}
          {!done && dday && <Badge bg={urgent ? '#FF6B6B' : 'var(--primary)'} color="white" label={dday} />}
          <Badge bg="var(--gray-100)" color="var(--text-secondary)" label={consult.type} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {consult.date} {consult.time ? `· ${consult.time}` : ''} {consult.duration ? `· ${consult.duration}분` : ''}
        </div>
      </div>
    </div>
  );
}

function TopicList({ topics, muted }) {
  if (!topics?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {topics.map(topic => (
        <Badge key={topic} bg={muted ? 'var(--gray-100)' : 'var(--primary-light)'} color={muted ? 'var(--text-secondary)' : 'var(--primary)'} label={topic} />
      ))}
    </div>
  );
}

function Badge({ bg, color, label }) {
  return <span style={{ fontSize: 11, fontWeight: 800, background: bg, color, borderRadius: 100, padding: '2px 9px' }}>{label}</span>;
}

function ActionButton({ onClick, color, bg, label }) {
  return <button onClick={onClick} style={{ fontSize: 12, fontWeight: 800, color, background: bg, borderRadius: 8, padding: '7px 12px' }}>{label}</button>;
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>{label}</div>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange, format = v => v }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(option => (
        <button key={option} onClick={() => onChange(option)} style={{
          flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 800,
          background: value === option ? 'var(--primary)' : 'var(--gray-100)',
          color: value === option ? 'white' : 'var(--text-secondary)',
        }}>
          {format(option)}
        </button>
      ))}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1.5px solid var(--border)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'var(--white)',
  color: 'var(--text-primary)',
};
