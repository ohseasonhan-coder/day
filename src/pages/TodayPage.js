import React, { useState, useEffect } from 'react';
import { getChildren, getClasses, getRecords, getRecordsByDate, today, formatDateKo, CATEGORIES, getRoutines, getMedicines, getEvents } from '../utils/storage';
import { PenLine, FileText, CheckSquare, ChevronRight, Users, Clock3, ShieldCheck, AlertCircle, BookOpen, BarChart3, Pill, AlertTriangle, Newspaper } from 'lucide-react';

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

function getDayStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function TodayPage({ onNavigate, isDesktop }) {
  const [todayRecords, setTodayRecords] = useState([]);
  const [children, setChildren]         = useState([]);
  const [classes, setClasses]           = useState([]);
  const [allRecords, setAllRecords]     = useState([]);
  const [todayMedicineCount, setTodayMedicineCount] = useState(0);
  const [coachInsightCount, setCoachInsightCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  const todayStr  = today();
  const dateLabel = formatDateKo(todayStr);
  const [todayChecks, setTodayChecks] = useState(() => {
    try {
      const s = localStorage.getItem('sw_session');
      const uid = s ? (JSON.parse(s)?.userId || 'default') : 'default';
      return JSON.parse(localStorage.getItem('sw_' + uid + '_checklist_' + today()) || '{}');
    } catch { return {}; }
  });
  const [todayRoutines, setTodayRoutines] = useState([]);
  useEffect(() => {
    const day = new Date().getDay();
    setTodayRoutines(getRoutines().filter(r => Array.isArray(r.days) && r.days.includes(day)));
  }, []);

  useEffect(() => {
    setChildren(getChildren());
    setClasses(getClasses());
    setTodayRecords(getRecordsByDate(todayStr));
    const recs = getRecords();
    setAllRecords(recs);
    try {
      const meds = getMedicines();
      setTodayMedicineCount(meds.filter(m => m.date === todayStr).length);
    } catch {}

    // Upcoming events (next 7 days)
    try {
      const now = new Date();
      const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
      const todayISO = getDayStr(now);
      const in7ISO = getDayStr(in7);
      const evs = getEvents().filter(e => e.date >= todayISO && e.date <= in7ISO);
      evs.sort((a, b) => a.date.localeCompare(b.date));
      setUpcomingEvents(evs.slice(0, 3));
    } catch {}

    // Coach insight count (simple heuristic)
    try {
      const recs = getRecords();
      const children2 = getChildren();
      const now2 = new Date();
      let cnt = 0;
      children2.forEach(child => {
        const childRecs = recs.filter(r => r.childId === child.id);
        if (!childRecs.length) return;
        const latest = new Date(childRecs.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date);
        if ((now2 - latest) / 86400000 >= 3) cnt++;
      });
      const thisWeek = recs.filter(r => (now2 - new Date(r.date)) / 86400000 <= 7);
      if (thisWeek.length === 0) cnt++;
      setCoachInsightCount(cnt);
    } catch {}
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

  // 체크리스트 저장 함수
  const saveCheck = (key, value) => {
    try {
      const s = localStorage.getItem('sw_session');
      const uid = s ? (JSON.parse(s)?.userId || 'default') : 'default';
      const storageKey = 'sw_' + uid + '_checklist_' + todayStr;
      const prev = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const next = { ...prev, [key]: value };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setTodayChecks(next);
    } catch {}
  };

  const allCheckItems = [
    ...unrecordedChildren.map(c => ({ id: 'rec_' + c.id, label: c.name + ' 기록', type: 'record', childId: c.id })),
    { id: 'doc_daily', label: '보육일지 작성', type: 'doc', nav: 'docs' },
    { id: 'doc_note',  label: '알림장 작성',  type: 'doc', nav: 'note' },
    ...todayRoutines.map(r => ({ id: 'routine_' + r.id, label: r.title + ' 완료', type: 'routine' })),
  ];
  const checkedCount = allCheckItems.filter(item => todayChecks[item.id]).length;
  const checkPct = allCheckItems.length > 0 ? Math.round((checkedCount / allCheckItems.length) * 100) : 100;

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

  const ChecklistSection = (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 15 }}>오늘 할 일</span>
          <span style={{ fontSize: 12, color: checkPct === 100 ? 'var(--cat-play)' : 'var(--primary)', fontWeight: 800, background: checkPct === 100 ? 'var(--cat-play-light)' : 'var(--primary-light)', padding: '3px 9px', borderRadius: 100 }}>{checkedCount}/{allCheckItems.length}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 900, color: checkPct === 100 ? 'var(--cat-play)' : 'var(--primary)' }}>{checkPct}%</span>
      </div>
      <div style={{ height: 7, background: 'var(--gray-100)', borderRadius: 100, marginBottom: 14 }}>
        <div style={{ height: 7, borderRadius: 100, background: checkPct === 100 ? 'var(--cat-play)' : 'var(--primary)', width: checkPct + '%', transition: 'width 0.5s ease' }} />
      </div>
      {allCheckItems.length === 0 ? (
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>오늘 할 일이 없어요 🎉</div>
      ) : (
        allCheckItems.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: todayChecks[item.id] ? 0.55 : 1 }}>
            <input type='checkbox' checked={!!todayChecks[item.id]} onChange={e => saveCheck(item.id, e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--primary)', flexShrink: 0, cursor: 'pointer' }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, textDecoration: todayChecks[item.id] ? 'line-through' : 'none', color: todayChecks[item.id] ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{item.label}</span>
            {!todayChecks[item.id] && item.type === 'record' && (
              <button onClick={() => onNavigate('record', { childId: item.childId })} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, background: 'var(--primary-light)', borderRadius: 8, padding: '4px 8px' }}>기록</button>
            )}
            {!todayChecks[item.id] && item.type === 'doc' && (
              <button onClick={() => onNavigate(item.nav)} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, background: 'var(--primary-light)', borderRadius: 8, padding: '4px 8px' }}>이동</button>
            )}
          </div>
        ))
      )}
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

  // ── 7일 히트맵 데이터 ────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return getDayStr(d);
  });
  const recordsByDay = weekDays.map(ds => allRecords.filter(r => r.date === ds).length);

  // ── 이번 달 문서 수 ──────────────────────────────
  const thisMonthStr = todayStr.slice(0, 7);
  // can't import getDocuments here simply, skip count

  // ── 이번 주 카테고리 분포 ────────────────────────
  const weekCatCount = {};
  weeklyRecords.forEach(r => {
    if (r.category) weekCatCount[r.category] = (weekCatCount[r.category] || 0) + 1;
  });
  const topCats = Object.entries(weekCatCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalCatCount = topCats.reduce((s, [, c]) => s + c, 0) || 1;

  // ── 평균 기록/일 ─────────────────────────────────
  const uniqueDays = new Set(allRecords.slice(0, 100).map(r => r.date)).size;
  const avgPerDay = uniqueDays > 0 ? (allRecords.slice(0, 100).length / uniqueDays).toFixed(1) : '0.0';

  // ── 미기록 아이 수 ───────────────────────────────
  const unrecordedThisWeek = children.filter(c => {
    const childRecs = weeklyRecords.filter(r => r.childId === c.id);
    return childRecs.length === 0;
  }).length;

  const QuickStatsRow = (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
      <QuickStatCard label="이번 주 기록" value={`${weeklyCount}건`} color="var(--primary)" />
      <QuickStatCard label="미기록 아이" value={`${unrecordedThisWeek}명`} color={unrecordedThisWeek > 0 ? 'var(--accent)' : 'var(--cat-play)'} />
      <QuickStatCard label="평균 기록/일" value={`${avgPerDay}건`} color="var(--cat-comm)" />
      <QuickStatCard label="이번 달 기록" value={`${allRecords.filter(r => r.date?.startsWith(thisMonthStr)).length}건`} color="var(--cat-nature)" />
    </div>
  );

  const HeatmapSection = (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>이번 주 기록 현황</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {weekDays.map((ds, i) => {
          const count = recordsByDay[i];
          const isToday_ = ds === todayStr;
          const intensity = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
          const bg = ['var(--gray-100)', '#BBDEFB', '#64B5F6', '#1976D2'][intensity];
          const dayLabel = ['월','화','수','목','금','토','일'][new Date(ds + 'T00:00:00').getDay() === 0 ? 6 : new Date(ds + 'T00:00:00').getDay() - 1];
          return (
            <div key={ds} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: isToday_ ? 900 : 400 }}>{dayLabel}</div>
              <div style={{ height: 40, borderRadius: 10, background: bg, border: isToday_ ? '2.5px solid var(--primary)' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: intensity >= 2 ? 'white' : 'var(--text-secondary)' }}>{count > 0 ? count : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const CoachWidget = coachInsightCount > 0 ? (
    <button
      onClick={() => onNavigate('coach')}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#EBF0FF', border: '1.5px solid var(--primary)', borderRadius: 14, padding: '13px 16px', marginBottom: 12, textAlign: 'left', boxShadow: 'var(--shadow-sm)' }}
    >
      <span style={{ fontSize: 22 }}>💡</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{coachInsightCount}개의 코칭 알림</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>AI 코칭 페이지에서 확인해 보세요</div>
      </div>
      <ChevronRight size={16} color="var(--primary)" />
    </button>
  ) : null;

  const UpcomingEventsWidget = upcomingEvents.length > 0 ? (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 900, fontSize: 14 }}>📅 다가오는 행사</span>
        <button onClick={() => onNavigate('events')} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800 }}>전체 보기</button>
      </div>
      {upcomingEvents.map(ev => {
        const evDate = new Date(ev.date + 'T00:00:00');
        const daysLeft = Math.ceil((evDate - new Date(todayStr + 'T00:00:00')) / 86400000);
        return (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: daysLeft === 0 ? 'var(--accent)' : 'var(--primary)', background: daysLeft === 0 ? 'var(--accent-light)' : 'var(--primary-light)', padding: '3px 8px', borderRadius: 100, minWidth: 40, textAlign: 'center' }}>
              {daysLeft === 0 ? '오늘' : `D-${daysLeft}`}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{ev.title}</span>
          </div>
        );
      })}
    </div>
  ) : null;

  const QuickLinks = (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>빠른 바로가기</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <QuickLinkBtn icon={<Pill size={18} />} label="오늘 투약" sub={`${todayMedicineCount}건`} color="#7C4DFF" onClick={() => onNavigate('medicine')} />
        <QuickLinkBtn icon={<AlertTriangle size={18} />} label="사고 기록" sub="" color="var(--accent)" onClick={() => onNavigate('accident')} />
        <QuickLinkBtn icon={<Newspaper size={18} />} label="가정통신문" sub="" color="var(--cat-comm)" onClick={() => onNavigate('newsletter')} />
        <QuickLinkBtn icon={<Users size={18} />} label="아이 포트폴리오" sub="" color="var(--cat-peer)" onClick={() => onNavigate('children')} />
      </div>
    </div>
  );

  const CatDistribution = topCats.length > 0 ? (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>이번 주 카테고리 분포</div>
      {topCats.map(([cat, count]) => {
        const c = CATEGORIES[cat] || CATEGORIES.special;
        const pct = Math.round((count / totalCatCount) * 100);
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: c.color, marginBottom: 4 }}>
              <span>{c.emoji} {c.label}</span><span>{pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 100 }}>
              <div style={{ height: 8, borderRadius: 100, background: c.color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        );
      })}
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
          {QuickStatsRow}
          {HeatmapSection}
          {CoachWidget}
          {UpcomingEventsWidget}
          {QuickLinks}
          {CatDistribution}
          {ChecklistSection}
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
      {QuickStatsRow}
      {HeatmapSection}
      {CoachWidget}
      {UpcomingEventsWidget}
      {QuickLinks}
      {CatDistribution}

      {ChecklistSection}
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

function QuickStatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 12px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

function QuickLinkBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  );
}
