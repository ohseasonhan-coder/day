import React, { useState, useEffect } from 'react';
import { getEvents, addEvent, updateEvent, deleteEvent } from '../utils/storage';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';

const EVENT_CATEGORIES = ['행사', '교육', '검진', '상담', '기타'];
const CAT_COLORS = {
  '행사': '#4F7FFF',
  '교육': '#4CAF50',
  '검진': '#FF6B6B',
  '상담': '#FF8C42',
  '기타': '#9E9E9E',
};

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function getDayStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

export default function EventsPage({ isDesktop }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState(() => getEvents());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showSeedBanner, setShowSeedBanner] = useState(() => getEvents().length === 0);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState('행사');
  const [formDesc, setFormDesc] = useState('');

  const todayStr = getDayStr(now);

  const refresh = () => setEvents(getEvents());

  const DEFAULT_EVENTS = [
    { title: '입학식', date: `${year}-03-02`, category: '행사' },
    { title: '어린이날', date: `${year}-05-05`, category: '행사' },
    { title: '어버이날 행사', date: `${year}-05-08`, category: '행사' },
    { title: '여름 방학', date: `${year}-07-26`, category: '행사' },
    { title: '개학', date: `${year}-08-26`, category: '행사' },
    { title: '추석', date: `${year}-09-17`, category: '행사' },
    { title: '졸업식', date: `${year}-02-14`, category: '행사' },
  ];

  const seedEvents = () => {
    DEFAULT_EVENTS.forEach(ev => addEvent(ev));
    refresh();
    setShowSeedBanner(false);
  };

  const openAddForm = (dateStr) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDate(dateStr || '');
    setFormCategory('행사');
    setFormDesc('');
    setShowForm(true);
  };

  const openEditForm = (ev) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDate(ev.date);
    setFormCategory(ev.category || '행사');
    setFormDesc(ev.description || '');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formDate) return;
    if (editingEvent) {
      updateEvent(editingEvent.id, { title: formTitle.trim(), date: formDate, category: formCategory, description: formDesc });
    } else {
      addEvent({ title: formTitle.trim(), date: formDate, category: formCategory, description: formDesc });
    }
    refresh();
    setShowForm(false);
  };

  const handleDelete = (id) => {
    deleteEvent(id);
    refresh();
  };

  // Calendar data
  const numDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month); // 0=Sun

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEvents = events.filter(e => e.date && e.date.startsWith(monthStr));

  const eventsByDay = {};
  monthEvents.forEach(ev => {
    const d = parseInt(ev.date.split('-')[2]);
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  });

  const selectedDayEvents = selectedDay
    ? (eventsByDay[selectedDay] || [])
    : [];

  const getDdayLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date(todayStr + 'T00:00:00');
    const diff = Math.ceil((d - t) / 86400000);
    if (diff < 0) return null;
    if (diff === 0) return 'D-day';
    if (diff <= 7) return `D-${diff}`;
    return null;
  };

  const sortedMonthEvents = [...monthEvents].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(248,250,254,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>📅 연간 행사 캘린더</div>
        <button
          onClick={() => openAddForm(todayStr)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 13 }}
        >
          <Plus size={14} /> 행사 추가
        </button>
      </div>

      <div style={{ padding: isDesktop ? '32px 36px' : '20px' }}>
        {/* Seed banner */}
        {showSeedBanner && (
          <div style={{ background: '#EBF0FF', border: '1.5px solid var(--primary)', borderRadius: 14, padding: '13px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>기본 행사를 자동 등록할까요?</span>
            <button onClick={seedEvents} style={{ background: 'var(--primary)', color: 'white', borderRadius: 8, padding: '6px 14px', fontWeight: 800, fontSize: 13 }}>등록</button>
            <button onClick={() => setShowSeedBanner(false)} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 13 }}>건너뛰기</button>
          </div>
        )}

        {/* Year nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
          <button onClick={() => setYear(y => y - 1)} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--gray-100)', color: 'var(--text-primary)', fontWeight: 700 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--gray-100)', color: 'var(--text-primary)', fontWeight: 700 }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Month chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => { setMonth(i); setSelectedDay(null); }}
              style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
                background: month === i ? 'var(--primary)' : 'var(--white)',
                color: month === i ? 'white' : 'var(--text-secondary)',
                border: `1.5px solid ${month === i ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
            {['일','월','화','수','목','금','토'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: numDays }, (_, i) => {
              const day = i + 1;
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dayStr === todayStr;
              const dayEvs = eventsByDay[day] || [];
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    minHeight: 48, borderRadius: 8, padding: '4px 2px',
                    background: isSelected ? 'var(--primary-light)' : isToday ? 'var(--primary)' : 'transparent',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 900 : 500, color: isToday ? 'white' : 'var(--text-primary)' }}>{day}</span>
                  {dayEvs.slice(0, 2).map((ev, ei) => (
                    <div key={ei} style={{
                      width: '90%', fontSize: 9, fontWeight: 700,
                      background: CAT_COLORS[ev.category] || '#9E9E9E',
                      color: 'white', borderRadius: 3, padding: '1px 3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{ev.title}</div>
                  ))}
                  {dayEvs.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{dayEvs.length - 2}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day events */}
        {selectedDay && selectedDayEvents.length > 0 && (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>
              {month + 1}월 {selectedDay}일 행사
            </div>
            {selectedDayEvents.map(ev => (
              <EventListItem key={ev.id} ev={ev} onEdit={openEditForm} onDelete={handleDelete} getDdayLabel={getDdayLabel} />
            ))}
          </div>
        )}

        {/* This month events list */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>이달의 행사 목록 ({sortedMonthEvents.length}건)</div>
          {sortedMonthEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: 14 }}>
              이번 달 등록된 행사가 없어요
              <br />
              <button onClick={() => openAddForm(`${year}-${String(month + 1).padStart(2, '0')}-01`)} style={{ marginTop: 10, fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>+ 행사 추가하기</button>
            </div>
          ) : (
            sortedMonthEvents.map(ev => (
              <EventListItem key={ev.id} ev={ev} onEdit={openEditForm} onDelete={handleDelete} getDdayLabel={getDdayLabel} />
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowForm(false)}>
          <div style={{ width: '100%', background: 'var(--white)', borderRadius: '20px 20px 0 0', padding: 24, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{editingEvent ? '행사 수정' : '행사 추가'}</div>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>제목 *</div>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="행사 제목" style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--white)', color: 'var(--text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>날짜 *</div>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--white)', color: 'var(--text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>카테고리</div>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--white)', color: 'var(--text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                  {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>설명</div>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="메모 (선택)" rows={3} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--white)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 800 }}>
                {editingEvent ? '수정 완료' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventListItem({ ev, onEdit, onDelete, getDdayLabel }) {
  const dday = getDdayLabel(ev.date);
  const color = CAT_COLORS[ev.category] || '#9E9E9E';
  const dateParts = ev.date ? ev.date.split('-') : [];
  const dateLabel = dateParts.length === 3 ? `${parseInt(dateParts[1])}월 ${parseInt(dateParts[2])}일` : ev.date;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>{dateLabel}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{ev.title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: '2px 8px', borderRadius: 100 }}>{ev.category}</span>
          {dday && <span style={{ fontSize: 11, fontWeight: 900, color: 'white', background: 'var(--accent)', padding: '2px 8px', borderRadius: 100 }}>{dday}</span>}
        </div>
        {ev.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{ev.description}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onEdit(ev)} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', borderRadius: 8, padding: '5px 9px' }}>수정</button>
        <button onClick={() => onDelete(ev.id)} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-light)', borderRadius: 8, padding: '5px 9px' }}>삭제</button>
      </div>
    </div>
  );
}
