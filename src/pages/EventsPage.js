import React, { useState } from 'react';
import { getEvents, addEvent, updateEvent, deleteEvent } from '../utils/storage';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';

const EVENT_CATEGORIES = ['행사', '교육', '검진', '상담', '기타'];
const CAT_COLORS = {
  행사: '#4F7FFF',
  교육: '#4CAF50',
  검진: '#FF6B6B',
  상담: '#FF8C42',
  기타: '#9E9E9E',
};
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getKoreanHolidays(year) {
  return [
    { date: `${year}-01-01`, name: '신정' },
    { date: `${year}-03-01`, name: '삼일절' },
    { date: `${year}-05-05`, name: '어린이날' },
    { date: `${year}-06-06`, name: '현충일' },
    { date: `${year}-08-15`, name: '광복절' },
    { date: `${year}-10-03`, name: '개천절' },
    { date: `${year}-10-09`, name: '한글날' },
    { date: `${year}-12-25`, name: '크리스마스' },
  ];
}

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
  return new Date(year, month, 1).getDay();
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

  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState('행사');
  const [formDesc, setFormDesc] = useState('');

  const todayStr = getDayStr(now);
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const numDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const monthEvents = events.filter(e => e.date && e.date.startsWith(monthStr));
  const holidays = getKoreanHolidays(year);
  const holidayMap = Object.fromEntries(holidays.map(h => [h.date, h.name]));
  const holidayMonthItems = holidays.filter(h => h.date.startsWith(monthStr)).sort((a, b) => a.date.localeCompare(b.date));

  const eventsByDay = {};
  monthEvents.forEach(event => {
    const day = parseInt(event.date.split('-')[2], 10);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(event);
  });

  const selectedDayEvents = selectedDay ? eventsByDay[selectedDay] || [] : [];
  const sortedMonthEvents = [...monthEvents].sort((a, b) => a.date.localeCompare(b.date));

  const refresh = () => setEvents(getEvents());

  const seedEvents = () => {
    [
      { title: '입학식', date: `${year}-03-02`, category: '행사' },
      { title: '어린이날 행사', date: `${year}-05-05`, category: '행사' },
      { title: '부모참여수업', date: `${year}-06-14`, category: '행사' },
      { title: '여름 물놀이', date: `${year}-07-26`, category: '행사' },
      { title: '가을 소풍', date: `${year}-10-18`, category: '행사' },
      { title: '졸업식', date: `${year}-02-14`, category: '행사' },
    ].forEach(event => addEvent(event));
    refresh();
    setShowSeedBanner(false);
  };

  const openAddForm = (dateStr) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDate(dateStr || todayStr);
    setFormCategory('행사');
    setFormDesc('');
    setShowForm(true);
  };

  const openEditForm = (event) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDate(event.date);
    setFormCategory(event.category || '행사');
    setFormDesc(event.description || '');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formDate) return;
    const payload = { title: formTitle.trim(), date: formDate, category: formCategory, description: formDesc };
    if (editingEvent) updateEvent(editingEvent.id, payload);
    else addEvent(payload);
    refresh();
    setShowForm(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('행사를 삭제할까요?')) return;
    deleteEvent(id);
    refresh();
  };

  const getDdayLabel = (dateStr) => {
    const target = new Date(`${dateStr}T00:00:00`);
    const today = new Date(`${todayStr}T00:00:00`);
    const diff = Math.ceil((target - today) / 86400000);
    if (diff < 0) return null;
    if (diff === 0) return 'D-day';
    if (diff <= 7) return `D-${diff}`;
    return null;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(248,250,254,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>📅 연간 행사 캘린더</div>
        <button onClick={() => openAddForm(todayStr)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 13 }}>
          <Plus size={14} /> 행사 추가
        </button>
      </div>

      <div style={{ padding: isDesktop ? '32px 36px' : '20px' }}>
        {showSeedBanner && (
          <div style={{ background: '#EBF0FF', border: '1.5px solid var(--primary)', borderRadius: 14, padding: '13px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>기본 행사를 자동 등록할까요?</span>
            <button onClick={seedEvents} style={{ background: 'var(--primary)', color: 'white', borderRadius: 8, padding: '6px 14px', fontWeight: 800, fontSize: 13 }}>등록</button>
            <button onClick={() => setShowSeedBanner(false)} style={{ background: 'var(--gray-100)', color: 'var(--text-secondary)', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 13 }}>건너뛰기</button>
          </div>
        )}

        <YearNav year={year} onPrev={() => setYear(y => y - 1)} onNext={() => setYear(y => y + 1)} />
        <MonthChips month={month} onSelect={(idx) => { setMonth(idx); setSelectedDay(null); }} />

        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
            {WEEKDAYS.map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', padding: '4px 0' }}>{day}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, idx) => <div key={`empty-${idx}`} />)}
            {Array.from({ length: numDays }, (_, idx) => {
              const day = idx + 1;
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDay[day] || [];
              const isToday = dayStr === todayStr;
              const isSelected = selectedDay === day;
              const weekday = new Date(year, month, day).getDay();
              const isHoliday = !!holidayMap[dayStr];
              const numberColor = isToday ? 'white' : isHoliday || weekday === 0 ? '#FF4B4B' : weekday === 6 ? '#4F7FFF' : 'var(--text-primary)';
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    minHeight: 56, borderRadius: 8, padding: '4px 2px',
                    background: isSelected ? 'var(--primary-light)' : isToday ? 'var(--primary)' : 'transparent',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 900 : 600, color: numberColor }}>{day}</span>
                  {isHoliday && !isToday && <span style={{ fontSize: 8, fontWeight: 700, color: '#FF4B4B', maxWidth: 36, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holidayMap[dayStr]}</span>}
                  {dayEvents.slice(0, 2).map((event, eventIdx) => (
                    <div key={eventIdx} style={{ width: '90%', fontSize: 9, fontWeight: 700, background: CAT_COLORS[event.category] || '#9E9E9E', color: 'white', borderRadius: 3, padding: '1px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{dayEvents.length - 2}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDay && selectedDayEvents.length > 0 && (
          <EventList title={`${month + 1}월 ${selectedDay}일 행사`} events={selectedDayEvents} onEdit={openEditForm} onDelete={handleDelete} getDdayLabel={getDdayLabel} />
        )}

        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>이달의 행사 목록 ({sortedMonthEvents.length + holidayMonthItems.length}건)</div>
          {holidayMonthItems.map(holiday => <HolidayItem key={holiday.date} holiday={holiday} />)}
          {sortedMonthEvents.length === 0 && holidayMonthItems.length === 0 ? (
            <EmptyState emoji="📅" title="이번 달 등록된 행사가 없어요" actionLabel="행사 추가하기" onAction={() => openAddForm(`${year}-${String(month + 1).padStart(2, '0')}-01`)} />
          ) : (
            sortedMonthEvents.map(event => <EventListItem key={event.id} event={event} onEdit={openEditForm} onDelete={handleDelete} getDdayLabel={getDdayLabel} />)
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowForm(false)}>
          <div style={{ width: '100%', background: 'var(--white)', borderRadius: '20px 20px 0 0', padding: 24, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{editingEvent ? '행사 수정' : '행사 추가'}</div>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <FormField label="제목 *">
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="행사 제목" style={inputStyle} />
            </FormField>
            <FormField label="날짜 *">
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="카테고리">
              <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
                {EVENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </FormField>
            <FormField label="설명">
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="메모 선택" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </FormField>
            <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 800 }}>
              {editingEvent ? '수정 완료' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function YearNav({ year, onPrev, onNext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
      <button onClick={onPrev} style={navBtn}><ChevronLeft size={16} /></button>
      <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{year}</span>
      <button onClick={onNext} style={navBtn}><ChevronRight size={16} /></button>
    </div>
  );
}

function MonthChips({ month, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
      {MONTHS.map((label, idx) => (
        <button key={label} onClick={() => onSelect(idx)} style={{
          padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
          background: month === idx ? 'var(--primary)' : 'var(--white)',
          color: month === idx ? 'white' : 'var(--text-secondary)',
          border: `1.5px solid ${month === idx ? 'var(--primary)' : 'var(--border)'}`,
        }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function EventList({ title, events, onEdit, onDelete, getDdayLabel }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>{title}</div>
      {events.map(event => <EventListItem key={event.id} event={event} onEdit={onEdit} onDelete={onDelete} getDdayLabel={getDdayLabel} />)}
    </div>
  );
}

function HolidayItem({ holiday }) {
  const [, month, day] = holiday.date.split('-');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px', borderBottom: '1px solid var(--border)', background: 'rgba(255,75,75,0.04)', borderRadius: 8 }}>
      <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#FF4B4B' }}>{parseInt(month, 10)}월 {parseInt(day, 10)}일</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>🇰🇷</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#FF4B4B' }}>{holiday.name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF4B4B', background: 'rgba(255,75,75,0.12)', padding: '2px 8px', borderRadius: 100 }}>공휴일</span>
      </div>
    </div>
  );
}

function EventListItem({ event, onEdit, onDelete, getDdayLabel }) {
  const dday = getDdayLabel(event.date);
  const color = CAT_COLORS[event.category] || '#9E9E9E';
  const [, month, day] = event.date ? event.date.split('-') : [];
  const dateLabel = month && day ? `${parseInt(month, 10)}월 ${parseInt(day, 10)}일` : event.date;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>{dateLabel}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{event.title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: '2px 8px', borderRadius: 100 }}>{event.category}</span>
          {dday && <span style={{ fontSize: 11, fontWeight: 900, color: 'white', background: 'var(--accent)', padding: '2px 8px', borderRadius: 100 }}>{dday}</span>}
        </div>
        {event.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{event.description}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onEdit(event)} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', borderRadius: 8, padding: '5px 9px' }}>수정</button>
        <button onClick={() => onDelete(event.id)} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-light)', borderRadius: 8, padding: '5px 9px' }}>삭제</button>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>{label}</div>
      {children}
    </div>
  );
}

const navBtn = {
  padding: '6px 10px',
  borderRadius: 8,
  background: 'var(--gray-100)',
  color: 'var(--text-primary)',
  fontWeight: 700,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1.5px solid var(--border)',
  fontSize: 14,
  background: 'var(--white)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
