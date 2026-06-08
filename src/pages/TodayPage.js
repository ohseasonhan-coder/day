import React, { useState, useEffect } from 'react';
import { getChildren, getClasses, getRecords, getRecordsByDate, today, formatDateKo, CATEGORIES } from '../utils/storage';
import { PenLine, FileText, CheckSquare, AlertCircle, ChevronRight, Users, Clock3, ShieldCheck } from 'lucide-react';

const SERVICE_CARDS = [
  { title: '보육일지', desc: '오늘 기록으로 일일 문서 작성', icon: '📄', nav: 'docs' },
  { title: '주간·월간 놀이평가', desc: '놀이 흐름과 다음 지원계획', icon: '🗓️', nav: 'docs' },
  { title: '부모상담자료', desc: '아이별 상담 문장 자동 정리', icon: '💬', nav: 'children' },
  { title: '발달평가', desc: '6개 발달영역 기반 평가', icon: '🌱', nav: 'children' },
  { title: '안전·행사평가', desc: '견학·안전교육 평가 초안', icon: '🛡️', nav: 'docs' },
  { title: '평가제 준비', desc: '누락 기록과 영역 균형 점검', icon: '✅', nav: 'check' },
];

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
  const weeklyRecords = allRecords.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    return (now - d) / (1000 * 60 * 60 * 24) <= 7;
  });
  const weeklyCount = weeklyRecords.length;
  const uniqueThisWeek = new Set(weeklyRecords.map(r => r.childId)).size;
  const estimatedSavedMinutes = todayRecords.length * 8 + weeklyCount * 3;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? '좋은 아침이에요' : greetingHour < 17 ? '오후도 힘내세요' : '오늘도 정말 수고하셨어요';

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
        borderRadius: 24, padding: 22, marginBottom: 18, color: 'white',
        boxShadow: '0 12px 28px rgba(79,127,255,0.25)',
      }}>
        <div style={{ fontSize: 13, opacity: 0.78, marginBottom: 6 }}>{dateLabel} · {greeting} 👋</div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.9px', lineHeight: 1.25 }}>
          {cl ? `${cl.name} 업무 자동화` : '오늘의 교사 업무'}
        </div>
        <div style={{ fontSize: 13, opacity: 0.82, marginTop: 6, lineHeight: 1.6 }}>
          {cl ? `${cl.year}학년도 · ${cl.age}세반 · 아이 ${children.length}명` : '반을 설정하면 자동화 현황을 볼 수 있어요'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 18 }}>
          <HeroStat label="오늘 기록" value={`${todayRecords.length}건`} />
          <HeroStat label="완료 아이" value={`${recordedChildIds.size}/${children.length}`} />
          <HeroStat label="예상 절약" value={`${estimatedSavedMinutes}분`} />
        </div>
      </div>

      {unrecordedChildren.length > 0 ? (
        <AlertCard
          icon={<AlertCircle size={17} />}
          color="var(--accent)"
          bg="var(--accent-light)"
          title={`${unrecordedChildren.slice(0, 3).map(c => c.name).join(', ')}${unrecordedChildren.length > 3 ? ` 외 ${unrecordedChildren.length - 3}명` : ''}의 오늘 기록이 아직 없어요`}
          desc="짧게 한 줄만 남겨도 보육일지와 평가자료에 반영됩니다."
          action="바로 기록"
          onAction={() => onNavigate('record')}
        />
      ) : children.length > 0 ? (
        <AlertCard
          icon={<ShieldCheck size={17} />}
          color="var(--cat-play)"
          bg="var(--cat-play-light)"
          title="오늘 아이별 기록이 모두 채워졌어요"
          desc="문서함에서 보육일지 초안을 만들 수 있습니다."
          action="문서 생성"
          onAction={() => onNavigate('docs')}
        />
      ) : null}

      <Section title="오늘 해야 할 핵심 업무">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction icon={<PenLine size={20} />} label="3분 기록" desc="관찰·알림장·특이사항" color="var(--primary)" onClick={() => onNavigate('record')} />
          <QuickAction icon={<FileText size={20} />} label="문서 자동화" desc="8종 문서 초안 생성" color="var(--cat-comm)" onClick={() => onNavigate('docs')} />
          <QuickAction icon={<Users size={20} />} label="아이별 리포트" desc="상담자료·발달평가" color="var(--cat-peer)" onClick={() => onNavigate('children')} />
          <QuickAction icon={<CheckSquare size={20} />} label="누락 점검" desc="평가제 준비 체크" color="var(--cat-play)" onClick={() => onNavigate('check')} />
        </div>
      </Section>

      <Section title="자동화 서비스 범위" action="문서함" onAction={() => onNavigate('docs')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SERVICE_CARDS.map(item => (
            <button key={item.title} onClick={() => onNavigate(item.nav)} style={{
              background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 14,
              textAlign: 'left', boxShadow: 'var(--shadow-sm)', minHeight: 104,
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {todayRecords.length > 0 && (
        <Section title="오늘 기록한 내용" action="전체 보기" onAction={() => onNavigate('docs')}>
          {todayRecords.slice(0, 3).map(r => (
            <RecordMiniCard key={r.id} record={r} />
          ))}
        </Section>
      )}

      <div style={{
        background: 'white', border: '1px solid var(--border)',
        borderRadius: 18, padding: 18, marginBottom: 16,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Clock3 size={18} color="var(--primary)" />
          <span style={{ fontWeight: 900, fontSize: 15 }}>이번 주 자동화 현황</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <MiniBox label="기록" value={`${weeklyCount}건`} />
          <MiniBox label="관찰 아이" value={`${uniqueThisWeek}명`} />
          <MiniBox label="문서 가능" value="8종" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 14 }}>
          기록이 누적될수록 주간/월간 놀이평가, 부모상담자료, 발달평가의 개인화 품질이 높아집니다.
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AlertCard({ icon, color, bg, title, desc, action, onAction }) {
  return (
    <div style={{
      background: bg, borderRadius: 16, padding: '15px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 18, gap: 12, border: `1px solid ${color}20`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <span style={{ color, marginTop: 1, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, color, fontWeight: 900, lineHeight: 1.5 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
        </div>
      </div>
      {action && (
        <button onClick={onAction} style={{
          fontSize: 12, fontWeight: 900, color, background: 'white',
          border: `1.5px solid ${color}`, borderRadius: 10, padding: '7px 10px',
          flexShrink: 0,
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
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>{title}</div>
        {action && (
          <button onClick={onAction} style={{
            fontSize: 13, color: 'var(--primary)', fontWeight: 800,
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
      background: 'white', borderRadius: 14, padding: '13px 14px',
      marginBottom: 8, border: '1px solid var(--border)',
      display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 9, height: 9, borderRadius: '50%',
        background: cat.color, marginTop: 7, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 13, color: cat.color }}>
            {record.childName}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 800, color: cat.color,
            background: cat.bg, padding: '2px 8px', borderRadius: 100,
          }}>
            {cat.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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
      borderRadius: 16, padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      textAlign: 'left', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ color, background: `${color}18`, width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</div>
      </div>
    </button>
  );
}

function MiniBox({ label, value }) {
  return (
    <div style={{ background: 'var(--gray-50)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
