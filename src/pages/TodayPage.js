import React, { useState, useEffect } from 'react';
import { getChildren, getClasses, getRecords, getRecordsByDate, today, formatDateKo, CATEGORIES } from '../utils/storage';
import { PenLine, FileText, CheckSquare, AlertCircle, Sparkles, ChevronRight, Users } from 'lucide-react';

export default function TodayPage({ onNavigate }) {
  const [todayRecords, setTodayRecords] = useState([]);
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const todayStr = today();
  const dateLabel = formatDateKo(todayStr);

  useEffect(() => {
    const ch = getChildren();
    const cl = getClasses();
    const recs = getRecordsByDate(todayStr);
    const allRecs = getRecords();
    setChildren(ch);
    setClasses(cl);
    setTodayRecords(recs);
    setAllRecords(allRecs);
  }, [todayStr]);

  const cl = classes[0];
  const recordedChildIds = new Set(todayRecords.map(r => r.childId));
  const unrecordedChildren = children.filter(c => !recordedChildIds.has(c.id));
  const weeklyCount = allRecords.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    return (now - d) / (1000 * 60 * 60 * 24) <= 7;
  }).length;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? '좋은 아침이에요' : greetingHour < 17 ? '오후도 화이팅이에요' : '오늘 하루도 수고하셨어요';

  return (
    <div style={{ padding: '20px 20px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{dateLabel} · {greeting} 👋</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          {cl ? `${cl.name}` : '오늘의 기록'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {cl ? `${cl.year}학년도 · ${cl.age}세반 · 아이 ${children.length}명` : '반을 설정해주세요'}
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <StatCard
          number={todayRecords.length}
          label="오늘 기록"
          sub="건"
          color="var(--primary)"
          bg="var(--primary-light)"
        />
        <StatCard
          number={`${recordedChildIds.size}/${children.length}`}
          label="기록 완료"
          sub="명"
          color="var(--cat-play)"
          bg="var(--cat-play-light)"
        />
      </div>

      {/* Alerts */}
      {unrecordedChildren.length > 0 && (
        <AlertCard
          icon={<AlertCircle size={16} />}
          color="var(--accent)"
          bg="var(--accent-light)"
          title={`${unrecordedChildren.slice(0, 3).map(c => c.name).join(', ')}${unrecordedChildren.length > 3 ? ` 외 ${unrecordedChildren.length - 3}명` : ''}의 기록이 없어요`}
          action="기록하기"
          onAction={() => onNavigate('record')}
        />
      )}

      {/* Today's Records */}
      {todayRecords.length > 0 && (
        <Section title="오늘 기록한 내용" action="전체 보기" onAction={() => onNavigate('docs')}>
          {todayRecords.slice(0, 3).map(r => (
            <RecordMiniCard key={r.id} record={r} />
          ))}
        </Section>
      )}

      {/* Quick Actions */}
      <Section title="빠른 실행">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction icon={<PenLine size={20} />} label="기록 남기기" desc="아이 관찰 기록" color="var(--primary)" onClick={() => onNavigate('record')} />
          <QuickAction icon={<FileText size={20} />} label="보육일지 생성" desc={`오늘 기록 ${todayRecords.length}건`} color="var(--cat-comm)" onClick={() => onNavigate('docs')} />
          <QuickAction icon={<Users size={20} />} label="아이별 조회" desc="성장 기록 확인" color="var(--cat-peer)" onClick={() => onNavigate('children')} />
          <QuickAction icon={<CheckSquare size={20} />} label="누락 점검" desc="문서 체크리스트" color="var(--cat-play)" onClick={() => onNavigate('check')} />
        </div>
      </Section>

      {/* Weekly summary */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
        borderRadius: 16, padding: 20, marginBottom: 16,
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>이번 주 활동</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{weeklyCount}<span style={{ fontSize: 16, fontWeight: 400, opacity: 0.8 }}>건</span></div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>지난 7일 동안의 기록</div>
      </div>
    </div>
  );
}

function StatCard({ number, label, sub, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-1px' }}>
        {number}<span style={{ fontSize: 14, fontWeight: 500 }}>{sub}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AlertCard({ icon, color, bg, title, action, onAction }) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16, gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color, marginTop: 1, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 13, color, fontWeight: 500, lineHeight: 1.5 }}>{title}</span>
      </div>
      {action && (
        <button onClick={onAction} style={{
          fontSize: 12, fontWeight: 600, color, background: 'transparent',
          border: `1.5px solid ${color}`, borderRadius: 8, padding: '4px 10px',
          cursor: 'pointer', flexShrink: 0,
        }}>
          {action}
        </button>
      )}
    </div>
  );
}

function Section({ title, action, onAction, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {action && (
          <button onClick={onAction} style={{
            fontSize: 13, color: 'var(--primary)', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            {action} <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function RecordMiniCard({ record }) {
  const cat = CATEGORIES[record.category] || CATEGORIES.special;
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '12px 14px',
      marginBottom: 8, border: '1px solid var(--border)',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: cat.color, marginTop: 6, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: cat.color }}>
            {record.childName}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: cat.color,
            background: cat.bg, padding: '2px 8px', borderRadius: 100,
          }}>
            {cat.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {record.observation || record.rawText}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, desc, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'white', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      textAlign: 'left', cursor: 'pointer',
      transition: 'box-shadow 0.15s, transform 0.1s',
      boxShadow: 'var(--shadow-sm)',
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ color, background: `${color}18`, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</div>
      </div>
    </button>
  );
}
