import React, { useState, useEffect } from 'react';
import { getChildren, getClasses, getRecords, getRecordsByDate, today, formatDateKo, CATEGORIES } from '../utils/storage';
import { PenLine, FileText, CheckSquare, ChevronRight, Users, Clock3, ShieldCheck, AlertCircle, BookOpen, BarChart3 } from 'lucide-react';

const SERVICE_CARDS = [
  { title: '보육일지',          desc: '오늘 기록으로 일일 문서 작성',    icon: '📄', nav: 'docs' },
  { title: '주간·월간 놀이평가', desc: '놀이 흐름과 다음 지원계획',       icon: '🗓️', nav: 'docs' },
  { title: '부모상담자료',       desc: '아이별 상담 문장 자동 정리',      icon: '💬', nav: 'children' },
  { title: '발달평가',          desc: '6개 발달영역 기반 평가',          icon: '🌱', nav: 'children' },
  { title: '안전·행사평가',     desc: '견학·안전교육 평가 초안',         icon: '🛡️', nav: 'docs' },
  { title: '평가제 준비',       desc: '누락 기록과 영역 균형 점검',       icon: '✅', nav: 'check' },
];

const AVATAR_COLORS = ['#4F7FFF','#6C63FF','#FF8C42','#00B4D8','#4CAF50','#E91E9A','#FF5722','#607D8B'];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function TodayPage({ onNavigate, isDesktop }) {
  const [todayRecords, setTodayRecords] = useState([]);
  const [children, setChildren]         = useState([]);
  const [classes, setClasses]           = useState([]);
  const [allRecords, setAllRecords]     = useState([]);

  const todayStr  = today();
  const dateLabel = formatDateKo(todayStr);

  useEffect(() => {
    setChildren(getChildren());
    setClasses(getClasses());
    setTodayRecords(getRecordsByDate(todayStr));
    setAllRecords(getRecords());
  }, [todayStr]);

  const cl                 = classes[0];
  const recordedChildIds   = new Set(todayRecords.map(r => r.childId));
  const unrecordedChildren = children.filter(c => !recordedChildIds.has(c.id));
  const recordedPercent    = children.length > 0
    ? Math.round((recordedChildIds.size / children.length) * 100) : 0;

  const weeklyRecords = allRecords.filter(r => {
    const d = new Date(r.date);
    return (new Date() - d) / 86400000 <= 7;
  });
  const weeklyCount           = weeklyRecords.length;
  const uniqueThisWeek        = new Set(weeklyRecords.map(r => r.childId)).size;
  const estimatedSavedMinutes = todayRecords.length * 8 + weeklyCount * 3;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 17 ? '오후도 힘내세요' : '오늘도 수고하셨어요';

  /* ── 공통 블록들 ──────────────────────────────── */
  const HeroCard = (
    <div style={{
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
      borderRadius: 24, padding: '22px 22px 18px', marginBottom: 18, color: 'white',
      boxShadow: '0 12px 32px rgba(79,127,255,0.28)',
    }}>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 5 }}>{dateLabel} · {greeting} 👋</div>
      <div style={{ fontSize: isDesktop ? 26 : 24, fontWeight: 900, letterSpacing: '-0.9px', lineHeight: 1.25 }}>
        {cl ? `${cl.name} 업무 자동화` : '오늘의 교사 업무'}
      </div>
      <div style={{ fontSize: 13, opacity: 0.82, marginTop: 5, lineHeight: 1.6 }}>
        {cl ? `${cl.year}학년도 · ${cl.age}세반 · 아이 ${children.length}명` : '반을 설정하면 자동화 현황을 볼 수 있어요'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
        <HeroStat label="오늘 기록"  value={`${todayRecords.length}건`} />
        <HeroStat label="완료 아이"  value={`${recordedChildIds.size}/${children.length}`} />
        <HeroStat label="예상 절약"  value={`${estimatedSavedMinutes}분`} />
      </div>
      {children.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.75, marginBottom: 5 }}>
            <span>오늘 기록 진행률</span><span>{recordedPercent}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 100, height: 7 }}>
            <div style={{
              background: recordedPercent === 100 ? '#69f0ae' : 'white',
              height: 7, borderRadius: 100,
              width: `${recordedPercent}%`,
              transition: 'width 0.8s ease',
              minWidth: recordedPercent > 0 ? 7 : 0,
            }} />
          </div>
        </div>
      )}
    </div>
  );

  const UnrecordedSection = unrecordedChildren.length > 0 ? (
    <div style={{
      background: '#FFF5F5', border: '1px solid rgba(255,107,107,0.25)',
      borderRadius: 18, padding: '15px 16px', marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <AlertCircle size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
          오늘 기록이 없는 아이 {unrecordedChildren.length}명
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {unrecordedChildren.map(child => {
          const color = getAvatarColor(child.name);
          return (
            <button key={child.id} onClick={() => onNavigate('record', { childId: child.id })} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--white)', border: `1.5px solid ${color}35`,
              borderRadius: 100, padding: '7px 14px 7px 8px',
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                {child.name[0]}
              </div>
              {child.name} 기록하기
            </button>
          );
        })}
      </div>
      <button onClick={() => onNavigate('record')} style={{
        width: '100%', padding: '11px', borderRadius: 12,
        background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        boxShadow: '0 4px 14px rgba(255,107,107,0.3)',
      }}>
        <PenLine size={15} /> 지금 바로 기록하기
      </button>
    </div>
  ) : children.length > 0 ? (
    <div style={{
      background: '#F0FBF1', border: '1px solid rgba(76,175,80,0.25)',
      borderRadius: 18, padding: '15px 16px', marginBottom: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <ShieldCheck size={22} color="var(--cat-play)" style={{ marginTop: 1, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--cat-play)' }}>오늘 기록이 모두 완료됐어요 🎉</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>문서함에서 보육일지 초안을 만들 수 있어요.</div>
        </div>
      </div>
      <button onClick={() => onNavigate('docs')} style={{ fontSize: 12, fontWeight: 800, color: 'var(--cat-play)', background: 'var(--white)', border: '1.5px solid var(--cat-play)', borderRadius: 10, padding: '8px 12px', flexShrink: 0 }}>
        문서 생성
      </button>
    </div>
  ) : null;

  const QuickActions = (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(6,1fr)' : '1fr 1fr', gap: 10 }}>
      <QuickAction icon={<PenLine size={20} />}    label="3분 기록"     desc="관찰·알림장·특이사항" color="var(--primary)"  onClick={() => onNavigate('record')} />
      <QuickAction icon={<BookOpen size={20} />}   label="알림장 쓰기"  desc="아이별 일괄 자동 작성" color="#E91E9A"        onClick={() => onNavigate('note')} />
      <QuickAction icon={<FileText size={20} />}   label="문서 자동화"  desc="8종 문서 초안 생성"  color="var(--cat-comm)" onClick={() => onNavigate('docs')} />
      <QuickAction icon={<Users size={20} />}      label="아이별 리포트" desc="상담자료·발달평가"   color="var(--cat-peer)" onClick={() => onNavigate('children')} />
      <QuickAction icon={<CheckSquare size={20} />} label="누락 점검"  desc="평가제 준비 체크"    color="var(--cat-play)" onClick={() => onNavigate('check')} />
      <QuickAction icon={<BarChart3 size={20} />}  label="통계"         desc="기록 현황 분석"      color="var(--cat-nature)" onClick={() => onNavigate('stats')} />
    </div>
  );

  const ServiceCards = (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
      {SERVICE_CARDS.map(item => (
        <button key={item.title} onClick={() => onNavigate(item.nav)} className="card-lift" style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 14, textAlign: 'left',
          boxShadow: 'var(--shadow-sm)', minHeight: 100,
        }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 3, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.title}</div>
          <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{item.desc}</div>
        </button>
      ))}
    </div>
  );

  const WeeklyStats = (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Clock3 size={18} color="var(--primary)" />
        <span style={{ fontWeight: 900, fontSize: 15 }}>이번 주 자동화 현황</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <MiniBox label="기록"    value={`${weeklyCount}건`} />
        <MiniBox label="관찰 아이" value={`${uniqueThisWeek}명`} />
        <MiniBox label="문서 가능" value="8종" />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        기록이 누적될수록 주간/월간 놀이평가, 부모상담자료, 발달평가의 개인화 품질이 높아집니다.
      </div>
    </div>
  );

  const TodayRecordList = todayRecords.length > 0 ? (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow-sm)', marginTop: isDesktop ? 16 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 900, fontSize: 15 }}>오늘 기록한 내용</span>
        <button onClick={() => onNavigate('docs')} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2 }}>
          문서 만들기 <ChevronRight size={14} />
        </button>
      </div>
      {todayRecords.slice(0, isDesktop ? 5 : 3).map(r => <RecordMiniCard key={r.id} record={r} />)}
      {todayRecords.length > (isDesktop ? 5 : 3) && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
          외 {todayRecords.length - (isDesktop ? 5 : 3)}건 더 있어요
        </div>
      )}
    </div>
  ) : null;

  /* ── 데스크톱 레이아웃 ─────────────────────────── */
  if (isDesktop) {
    return (
      <div style={{ padding: '32px 36px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>
        {/* 왼쪽 메인 */}
        <div>
          {HeroCard}
          {UnrecordedSection}

          <SectionTitle title="오늘 핵심 업무" style={{ marginBottom: 12 }} />
          <div style={{ marginBottom: 24 }}>{QuickActions}</div>

          <SectionTitle title="자동화 서비스 범위" action="문서함" onAction={() => onNavigate('docs')} style={{ marginBottom: 12 }} />
          {ServiceCards}
        </div>

        {/* 오른쪽 사이드 */}
        <div style={{ position: 'sticky', top: 80 }}>
          {WeeklyStats}
          {TodayRecordList}
        </div>
      </div>
    );
  }

  /* ── 모바일 레이아웃 ────────────────────────────── */
  return (
    <div style={{ padding: '20px 20px 0' }}>
      {HeroCard}
      {UnrecordedSection}

      <Section title="오늘 핵심 업무">{QuickActions}</Section>
      <Section title="자동화 서비스 범위" action="문서함" onAction={() => onNavigate('docs')}>
        {ServiceCards}
      </Section>

      {todayRecords.length > 0 && (
        <Section title="오늘 기록한 내용" action="문서 만들기" onAction={() => onNavigate('docs')}>
          {todayRecords.slice(0, 3).map(r => <RecordMiniCard key={r.id} record={r} />)}
        </Section>
      )}

      <div style={{ marginBottom: 16 }}>{WeeklyStats}</div>
    </div>
  );
}

/* ── 서브 컴포넌트 ──────────────────────────────── */
function HeroStat({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.78, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>{title}</div>
      {action && (
        <button onClick={onAction} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2 }}>
          {action} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function Section({ title, action, onAction, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <SectionTitle title={title} action={action} onAction={onAction} />
      {children}
    </div>
  );
}

function RecordMiniCard({ record }) {
  const cat = CATEGORIES[record.category] || CATEGORIES.special;
  return (
    <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color, marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 13, color: cat.color }}>{record.childName}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: cat.color, background: cat.bg, padding: '2px 8px', borderRadius: 100 }}>{cat.label}</span>
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
    <button onClick={onClick} className="card-lift" style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 9,
      textAlign: 'left', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ color, background: `${color}18`, width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
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
