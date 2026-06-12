import React, { useState, useMemo } from 'react';
import { getRecords, getChildren, CATEGORIES, today, formatDateKo } from '../utils/storage';
import PrintPreviewModal from '../components/PrintPreviewModal';
import { BarChart3, TrendingUp, AlertCircle, Star, Users, PenLine, CalendarDays, Zap, Download, Printer } from 'lucide-react';

function downloadCSV(filename, rows) {
  const bom = '﻿';
  const csv = bom + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const AVATAR_COLORS = ['#4F7FFF','#6C63FF','#FF8C42','#00B4D8','#4CAF50','#E91E9A','#FF5722','#607D8B'];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}


const DAY_LABELS = ['일','월','화','수','목','금','토'];
const MONTH_KO   = (m) => `${m+1}월`;

export default function StatsPage({ onNavigate, isDesktop }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'children' | 'categories' | 'trend' | 'heatmap'
  const [showPrint, setShowPrint] = useState(false);

  const records  = useMemo(() => getRecords(), []);
  const children = useMemo(() => getChildren(), []);

  // ── 기본 집계 ─────────────────────────────────────────────────────────────
  const todayStr   = today();
  const now        = new Date();
  const thisMonth  = now.getMonth();
  const thisYear   = now.getFullYear();

  const thisMonthRecs  = records.filter(r => { const d = new Date(r.date); return d.getFullYear()===thisYear && d.getMonth()===thisMonth; });
  const thisWeekRecs   = records.filter(r => (now - new Date(r.date))/86400000 <= 7);
  const todayRecs      = records.filter(r => r.date === todayStr);
  const starredRecs    = records.filter(r => r.starred);

  const recordedDays   = new Set(records.map(r => r.date)).size;
  const recordedThisMonth = new Set(thisMonthRecs.map(r => r.date)).size;

  // ── 최근 6개월 월별 기록 수 ───────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const count = records.filter(r => { const rd = new Date(r.date); return rd.getFullYear()===y && rd.getMonth()===m; }).length;
      months.push({ label: MONTH_KO(m), year: y, month: m, count });
    }
    return months;
  }, [records, thisMonth, thisYear]);

  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);

  // ── 요일별 기록 수 ────────────────────────────────────────────────────────
  const weekdayData = useMemo(() => {
    const counts = [0,0,0,0,0,0,0];
    records.forEach(r => { if (r.date) counts[new Date(r.date).getDay()]++; });
    return counts;
  }, [records]);
  const maxWeekday = Math.max(...weekdayData, 1);

  // ── 카테고리 분포 ─────────────────────────────────────────────────────────
  const catData = useMemo(() => {
    const counts = {};
    records.forEach(r => { if (r.category) counts[r.category] = (counts[r.category]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  }, [records]);
  const totalCatCount = records.filter(r => r.category).length || 1;

  // ── 아이별 기록 현황 ──────────────────────────────────────────────────────
  const childData = useMemo(() => {
    return children.map(c => {
      const recs = records.filter(r => r.childId === c.id);
      const thisM = recs.filter(r => { const d=new Date(r.date); return d.getFullYear()===thisYear && d.getMonth()===thisMonth; });
      const last  = recs.sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      return { ...c, total: recs.length, thisMonth: thisM.length, last };
    }).sort((a,b)=>b.total-a.total);
  }, [children, records, thisMonth, thisYear]);

  const maxChildCount = Math.max(...childData.map(c=>c.total), 1);

  // ── 주의 필요 아이 (이번 달 기록 0) ────────────────────────────────────
  const needAttention = childData.filter(c => c.thisMonth === 0);

  // ── 발달 영역별 추이 (최근 6개월) ─────────────────────────────────────
  const TREND_AREAS = [
    { key: 'body',   label: '신체운동·건강',      cats: ['body'],           color: '#4CAF50' },
    { key: 'nature', label: '자연탐구',           cats: ['nature','play'],  color: '#FF8C42' },
    { key: 'art',    label: '예술경험',           cats: ['art'],            color: '#E91E9A' },
    { key: 'peer',   label: '사회관계',           cats: ['peer'],           color: '#9C27B0' },
    { key: 'comm',   label: '의사소통',           cats: ['comm'],           color: '#4F7FFF' },
    { key: 'habit',  label: '일상생활(기본생활습관)', cats: ['habit'],         color: '#00B4D8' },
  ];
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const mRecs = records.filter(r => { const rd = new Date(r.date); return rd.getFullYear()===y && rd.getMonth()===m; });
      const areaData = {};
      TREND_AREAS.forEach(a => { areaData[a.key] = mRecs.filter(r => a.cats.includes(r.category)).length; });
      months.push({ label: MONTH_KO(m), areaData });
    }
    const allCounts = months.flatMap(m => TREND_AREAS.map(a => m.areaData[a.key]));
    const maxY = Math.max(...allCounts, 1);
    return { months, maxY };
  }, [records, thisMonth, thisYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 연간 히트맵 ─────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const countByDate = {};
    records.forEach(r => { if (r.date) countByDate[r.date] = (countByDate[r.date]||0) + 1; });
    const weeks = [];
    const todayDate = new Date();
    const start = new Date(todayDate);
    start.setDate(start.getDate() - 364 - start.getDay());
    let d = new Date(start);
    while (d <= todayDate) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        week.push({ date: ds, count: countByDate[ds]||0, isFuture: d > todayDate });
        d.setDate(d.getDate()+1);
      }
      weeks.push(week);
    }
    const maxCount = Math.max(...Object.values(countByDate), 1);
    return { weeks, maxCount };
  }, [records]);

  // ── 인쇄용 리포트 (평가제·보고용 A4) ──────────────────────────────────
  const buildPrintSections = () => {
    const catLabel = (c) => CATEGORIES[c]?.label || c || '미분류';
    const sections = [
      {
        title: '전체 현황',
        content:
          `누적 기록 ${records.length}건 · 기록한 날 ${recordedDays}일 · 아이 ${children.length}명\n` +
          `이번 달 기록 ${thisMonthRecs.length}건 (${recordedThisMonth}일) · 최근 7일 ${thisWeekRecs.length}건 · 즐겨찾기 ${starredRecs.length}건`,
      },
      {
        title: '아이별 기록 현황',
        content: childData.length === 0 ? '등록된 아이가 없습니다.'
          : childData.map(c => `· ${c.name}: 누적 ${c.total}건 / 이번 달 ${c.thisMonth}건${c.last?.date ? ` / 최근 기록 ${c.last.date}` : ' / 기록 없음'}`).join('\n'),
      },
      {
        title: '발달 영역 분포 (누리과정 6개 영역)',
        content: TREND_AREAS.map(a => {
          const count = records.filter(r => a.cats.includes(r.category)).length;
          const pct = records.length > 0 ? Math.round((count / records.length) * 100) : 0;
          return `· ${a.label}: ${count}건 (${pct}%)`;
        }).join('\n'),
      },
      {
        title: '카테고리별 기록',
        content: catData.length === 0 ? '기록이 없습니다.'
          : catData.map(([cat, count]) => `· ${catLabel(cat)}: ${count}건 (${Math.round((count / totalCatCount) * 100)}%)`).join('\n'),
      },
      {
        title: '월별 기록 추이 (최근 6개월)',
        content: monthlyData.map(m => `· ${m.year}년 ${m.label}: ${m.count}건`).join('\n'),
      },
    ];
    if (needAttention.length > 0) {
      sections.push({
        title: '이번 달 기록이 없는 아이',
        content: needAttention.map(c => `· ${c.name}`).join('\n'),
      });
    }
    return sections;
  };

  // ── CSV 내보내기 ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const header = ['이름','날짜','카테고리','입력내용','관찰일지문장','부모상담문장','지원계획','태그'];
    const catLabel = (c) => CATEGORIES[c]?.label || c || '';
    const rows = records.map(r => [
      r.childName || '',
      r.date || '',
      catLabel(r.category),
      r.rawText || '',
      r.observation || '',
      r.parent || '',
      r.support || '',
      (r.tags || []).join(', '),
    ]);
    downloadCSV(`saemwork_records_${today()}.csv`, [header, ...rows]);
  };

  const pad = isDesktop ? '32px 36px' : '20px';

  return (
    <div style={{ padding: pad }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--primary-light)', color:'var(--primary)', borderRadius:100, padding:'5px 10px', fontSize:12, fontWeight:700, marginBottom:10 }}>
          <BarChart3 size={13} /> 통계 대시보드
        </div>
        <div style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.7px', marginBottom:4 }}>기록 현황 한눈에 보기</div>
        <div style={{ fontSize:14, color:'var(--text-secondary)' }}>쌓인 기록을 분석해 교사의 패턴을 보여드려요.</div>
      </div>

      {/* 요약 카드 행 */}
      <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap:10, marginBottom:20 }}>
        <SummaryCard icon={<PenLine size={18} color="var(--primary)" />} label="전체 기록" value={`${records.length}건`} sub={`오늘 ${todayRecs.length}건`} color="var(--primary)" />
        <SummaryCard icon={<CalendarDays size={18} color="var(--cat-comm)" />} label="기록한 날" value={`${recordedDays}일`} sub={`이번 달 ${recordedThisMonth}일`} color="var(--cat-comm)" />
        <SummaryCard icon={<Users size={18} color="var(--cat-play)" />} label="아이 수" value={`${children.length}명`} sub={needAttention.length > 0 ? `⚠️ ${needAttention.length}명 미기록` : '모두 기록 있음'} color="var(--cat-play)" />
        <SummaryCard icon={<Star size={18} color="#F5A623" />} label="즐겨찾기" value={`${starredRecs.length}건`} sub="중요 기록" color="#F5A623" />
      </div>

      {/* 탭 + CSV 버튼 */}
      <div style={{ display:'flex', gap:8, marginBottom:18, overflowX:'auto', paddingBottom:2, alignItems:'center' }}>
        {[['overview','개요'],['children','아이별'],['categories','카테고리'],['trend','발달추이'],['heatmap','히트맵']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:'8px 16px', borderRadius:100, fontSize:13, fontWeight:800, whiteSpace:'nowrap', background: tab===k ? 'var(--primary)' : 'white', color: tab===k ? 'white' : 'var(--text-secondary)', border:`1.5px solid ${tab===k ? 'var(--primary)' : 'var(--border)'}`, boxShadow: tab===k ? '0 4px 14px rgba(79,127,255,0.25)' : 'none', flexShrink:0 }}>
            {v}
          </button>
        ))}
        <button onClick={() => setShowPrint(true)} style={{ marginLeft:'auto', flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:100, fontSize:12, fontWeight:800, background:'var(--primary-light)', color:'var(--primary)', border:'1.5px solid var(--primary)', whiteSpace:'nowrap' }}>
          <Printer size={13} /> 인쇄
        </button>
        <button onClick={handleExportCSV} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:100, fontSize:12, fontWeight:800, background:'var(--cat-play-light)', color:'var(--cat-play)', border:'1.5px solid var(--cat-play)', whiteSpace:'nowrap' }}>
          <Download size={13} /> CSV 내보내기
        </button>
      </div>

      {showPrint && (
        <PrintPreviewModal
          title={`기록 통계 리포트 (${formatDateKo(todayStr)})`}
          sections={buildPrintSections()}
          meta={{ date: todayStr, className: '' }}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* ── 개요 탭 ──────────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          {/* 주의 필요 알림 */}
          {needAttention.length > 0 && (
            <div style={{ background:'var(--accent-light)', border:'1px solid var(--accent)', borderRadius:16, padding:'14px 16px', marginBottom:18, display:'flex', gap:12, alignItems:'flex-start' }}>
              <AlertCircle size={20} color="var(--accent)" style={{ flexShrink:0, marginTop:1 }} />
              <div>
                <div style={{ fontSize:14, fontWeight:900, color:'var(--accent)', marginBottom:4 }}>이번 달 기록이 없는 아이</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {needAttention.map(c => (
                    <button key={c.id} onClick={() => onNavigate('record',{childId:c.id})}
                      style={{ background:'var(--accent)', color:'white', padding:'4px 12px', borderRadius:100, fontSize:12, fontWeight:800 }}>
                      {c.name} →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 최근 6개월 기록량 */}
          <StatCard title="최근 6개월 기록량" icon={<TrendingUp size={15} color="var(--primary)" />}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:110, paddingTop:10 }}>
              {monthlyData.map((m, i) => {
                const isCurrentMonth = m.year===thisYear && m.month===thisMonth;
                const heightPct = m.count === 0 ? 4 : Math.max(10, Math.round((m.count/maxMonthly)*90));
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <div style={{ fontSize:11, fontWeight:900, color: isCurrentMonth ? 'var(--primary)' : 'var(--text-secondary)' }}>{m.count || ''}</div>
                    <div style={{ width:'100%', height: heightPct, borderRadius:'6px 6px 0 0', background: isCurrentMonth ? 'var(--primary)' : 'var(--primary-light)', transition:'height 0.3s' }} />
                    <div style={{ fontSize:11, fontWeight: isCurrentMonth ? 900 : 600, color: isCurrentMonth ? 'var(--primary)' : 'var(--text-tertiary)' }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </StatCard>

          {/* 요일별 기록 패턴 */}
          <StatCard title="요일별 기록 패턴" icon={<CalendarDays size={15} color="var(--cat-comm)" />}>
            <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:80 }}>
              {weekdayData.map((count, i) => {
                const h = count===0 ? 4 : Math.max(8, Math.round((count/maxWeekday)*64));
                const isSun = i===0, isSat = i===6;
                const color = isSun ? 'var(--accent)' : isSat ? 'var(--cat-peer)' : 'var(--cat-comm)';
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)' }}>{count||''}</div>
                    <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background: count>0 ? color : 'var(--gray-100)' }} />
                    <div style={{ fontSize:11, fontWeight:700, color: isSun?'var(--accent)':isSat?'var(--cat-peer)':'var(--text-secondary)' }}>{DAY_LABELS[i]}</div>
                  </div>
                );
              })}
            </div>
          </StatCard>

          {/* 이번 주 기록 현황 */}
          <StatCard title="이번 주 기록 현황" icon={<Zap size={15} color="#F5A623" />}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:28, fontWeight:900, color:'var(--primary)' }}>{thisWeekRecs.length}<span style={{ fontSize:14, fontWeight:700, color:'var(--text-secondary)', marginLeft:4 }}>건</span></div>
                <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>최근 7일간 기록</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:22, fontWeight:900, color:'var(--cat-peer)' }}>{thisMonthRecs.length}<span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginLeft:3 }}>건</span></div>
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>이번 달</div>
              </div>
            </div>
            {/* 최근 기록된 날짜들 */}
            {thisWeekRecs.length > 0 && (
              <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:6 }}>
                {[...new Set(thisWeekRecs.map(r=>r.date))].sort((a,b)=>b.localeCompare(a)).map(d => (
                  <button key={d} onClick={() => onNavigate('record',{date:d,mode:'list'})}
                    style={{ fontSize:12, color:'var(--primary)', background:'var(--primary-light)', padding:'4px 10px', borderRadius:100, fontWeight:800 }}>
                    {formatDateKo(d)} ({thisWeekRecs.filter(r=>r.date===d).length}건)
                  </button>
                ))}
              </div>
            )}
          </StatCard>
        </div>
      )}

      {/* ── 아이별 탭 ────────────────────────────────────── */}
      {tab === 'children' && (
        <div>
          <StatCard title="아이별 누적 기록" icon={<Users size={15} color="var(--cat-play)" />}>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {childData.length === 0 && <div style={{ color:'var(--text-tertiary)', fontSize:14, textAlign:'center', padding:'20px 0' }}>등록된 아이가 없어요</div>}
              {childData.map(c => {
                const color = getAvatarColor(c.name);
                const pct   = Math.max(4, Math.round((c.total/maxChildCount)*100));
                return (
                  <div key={c.id}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, flexShrink:0 }}>{c.name[0]}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)' }}>{c.name}</span>
                          <span style={{ fontSize:12, color:'var(--text-tertiary)', fontWeight:700 }}>전체 {c.total}건 · 이번달 {c.thisMonth}건</span>
                        </div>
                        <div style={{ height:8, background:'var(--gray-100)', borderRadius:100, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:100, transition:'width 0.4s' }} />
                        </div>
                      </div>
                      <button onClick={() => onNavigate('children')} style={{ fontSize:11, color:'var(--primary)', fontWeight:800, background:'var(--primary-light)', padding:'4px 8px', borderRadius:8, flexShrink:0 }}>보기</button>
                    </div>
                    {c.last && <div style={{ paddingLeft:42, fontSize:11, color:'var(--text-tertiary)' }}>마지막 기록: {formatDateKo(c.last.date)}</div>}
                    {c.thisMonth === 0 && <div style={{ paddingLeft:42, fontSize:11, color:'var(--accent)', fontWeight:800 }}>⚠️ 이번 달 기록 없음</div>}
                  </div>
                );
              })}
            </div>
          </StatCard>

          {/* 이번 달 아이별 기록 수 */}
          <StatCard title="이번 달 아이별 기록" icon={<CalendarDays size={15} color="var(--primary)" />}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120, paddingTop:10 }}>
              {childData.map(c => {
                const maxThisMonth = Math.max(...childData.map(x=>x.thisMonth), 1);
                const h = c.thisMonth===0 ? 4 : Math.max(10, Math.round((c.thisMonth/maxThisMonth)*90));
                const color = getAvatarColor(c.name);
                return (
                  <div key={c.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div style={{ fontSize:11, fontWeight:900, color:c.thisMonth>0?color:'var(--text-tertiary)' }}>{c.thisMonth||''}</div>
                    <div style={{ width:'100%', maxWidth:40, height:h, borderRadius:'6px 6px 0 0', background: c.thisMonth>0?color:'var(--gray-200)' }} />
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', maxWidth:36, textAlign:'center', lineHeight:1.2, wordBreak:'keep-all' }}>{c.name}</div>
                  </div>
                );
              })}
            </div>
          </StatCard>
        </div>
      )}

      {/* ── 카테고리 탭 ──────────────────────────────────── */}
      {tab === 'categories' && (
        <div>
          <StatCard title="카테고리 분포" icon={<BarChart3 size={15} color="var(--cat-art)" />}>
            {catData.length === 0
              ? <div style={{ color:'var(--text-tertiary)', textAlign:'center', padding:'20px 0', fontSize:14 }}>기록이 없어요</div>
              : catData.map(([cat, count]) => {
                  const meta = CATEGORIES[cat] || CATEGORIES.special;
                  const pct  = Math.round((count/totalCatCount)*100);
                  return (
                    <div key={cat} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:meta.color, display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:16 }}>{meta.emoji}</span>{meta.label}
                        </span>
                        <span style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)' }}>{count}건 <span style={{ color:'var(--text-tertiary)', fontWeight:600 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height:10, background:'var(--gray-100)', borderRadius:100, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:meta.color, borderRadius:100, transition:'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })
            }
          </StatCard>

          {/* 카테고리 시각 도넛 (CSS) */}
          {catData.length > 0 && (
            <StatCard title="카테고리 비율 요약" icon={<TrendingUp size={15} color="var(--text-secondary)" />}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {catData.map(([cat, count]) => {
                  const meta = CATEGORIES[cat] || CATEGORIES.special;
                  const pct  = Math.round((count/totalCatCount)*100);
                  return (
                    <div key={cat} style={{ background:meta.bg, color:meta.color, padding:'8px 14px', borderRadius:12, fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
                      {meta.emoji}
                      <span>{meta.label}</span>
                      <span style={{ background:meta.color, color:'white', padding:'2px 7px', borderRadius:100, fontSize:11 }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:12, fontSize:12, color:'var(--text-tertiary)' }}>
                가장 많은 영역: <strong style={{ color:'var(--text-primary)' }}>{catData[0] ? CATEGORIES[catData[0][0]]?.label : '-'}</strong>
                {catData.length >= 2 && ` · 두 번째: ${CATEGORIES[catData[1][0]]?.label}`}
              </div>
            </StatCard>
          )}
        </div>
      )}

      {/* ── 발달 추이 탭 ─────────────────────────────────── */}
      {tab === 'trend' && (
        <div>
          <StatCard title="발달 영역별 기록 추이 (최근 6개월)" icon={<TrendingUp size={15} color="var(--primary)" />}>
            {records.length === 0
              ? <div style={{ color:'var(--text-tertiary)', textAlign:'center', padding:'20px 0', fontSize:14 }}>기록이 없어요</div>
              : (() => {
                const W = 360, H = 160, PL = 36, PR = 12, PT = 10, PB = 28;
                const cW = W - PL - PR, cH = H - PT - PB;
                const xOf = (i) => PL + (i / 5) * cW;
                const yOf = (v) => PT + cH - (v / trendData.maxY) * cH;
                const months = trendData.months;
                return (
                  <div style={{ overflowX:'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', minWidth:280, display:'block' }}>
                      {/* grid lines */}
                      {[0,0.25,0.5,0.75,1].map(f => {
                        const y = PT + cH * (1-f);
                        return <line key={f} x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border)" strokeWidth={0.8} />;
                      })}
                      {/* y-axis labels */}
                      {[0,0.5,1].map(f => (
                        <text key={f} x={PL-4} y={PT + cH*(1-f)+4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
                          {Math.round(f * trendData.maxY)}
                        </text>
                      ))}
                      {/* x-axis labels */}
                      {months.map((m,i) => (
                        <text key={i} x={xOf(i)} y={H-4} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">{m.label}</text>
                      ))}
                      {/* lines */}
                      {TREND_AREAS.map(area => {
                        const pts = months.map((m,i) => `${xOf(i)},${yOf(m.areaData[area.key])}`).join(' ');
                        return (
                          <g key={area.key}>
                            <polyline points={pts} fill="none" stroke={area.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                            {months.map((m,i) => (
                              <circle key={i} cx={xOf(i)} cy={yOf(m.areaData[area.key])} r={3} fill={area.color} />
                            ))}
                          </g>
                        );
                      })}
                    </svg>
                    {/* legend */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 12px', marginTop:10 }}>
                      {TREND_AREAS.map(a => (
                        <div key={a.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)', fontWeight:700 }}>
                          <div style={{ width:12, height:3, borderRadius:2, background:a.color }} />
                          {a.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            }
          </StatCard>

          {/* 월별 영역 요약 테이블 */}
          <StatCard title="최근 3개월 영역별 건수" icon={<CalendarDays size={15} color="var(--text-secondary)" />}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'var(--text-tertiary)', fontWeight:700, borderBottom:'1px solid var(--border)' }}>영역</th>
                    {trendData.months.slice(3).map((m,i) => (
                      <th key={i} style={{ textAlign:'center', padding:'6px 8px', color:'var(--text-tertiary)', fontWeight:700, borderBottom:'1px solid var(--border)' }}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TREND_AREAS.map(area => (
                    <tr key={area.key}>
                      <td style={{ padding:'7px 8px', fontWeight:800, color:area.color, whiteSpace:'nowrap' }}>{area.label}</td>
                      {trendData.months.slice(3).map((m,i) => (
                        <td key={i} style={{ textAlign:'center', padding:'7px 8px', fontWeight: m.areaData[area.key]>0 ? 700 : 400, color: m.areaData[area.key]>0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {m.areaData[area.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StatCard>
        </div>
      )}

      {/* ── 히트맵 탭 ────────────────────────────────────── */}
      {tab === 'heatmap' && (
        <div>
          <StatCard title="연간 기록 히트맵" icon={<CalendarDays size={15} color="var(--primary)" />}>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:14 }}>최근 1년간 기록 밀도를 보여드려요</div>
            <div style={{ overflowX:'auto', paddingBottom:4 }}>
              <div style={{ display:'flex', gap:3, minWidth:'max-content' }}>
                {heatmapData.weeks.map((week, wi) => (
                  <div key={wi} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {week.map((day, di) => {
                      const pct = day.isFuture ? 0 : Math.min(4, Math.floor(day.count > 0 ? 1 + (day.count / heatmapData.maxCount) * 3 : 0));
                      const HEAT = ['var(--gray-100)', '#DBEAFE', '#93C5FD', '#4F7FFF', '#2952CC'];
                      return (
                        <div
                          key={di}
                          title={day.isFuture ? '' : `${day.date}: ${day.count}건`}
                          style={{ width:11, height:11, borderRadius:2, background: day.isFuture ? 'transparent' : HEAT[pct], cursor: day.count>0 ? 'default' : 'default' }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {/* 요일 레이블 */}
            <div style={{ display:'flex', gap:4, marginTop:8 }}>
              <div style={{ width:11, fontSize:9, color:'var(--text-tertiary)', textAlign:'center', marginRight: heatmapData.weeks.length*14 - 60 }} />
              {['일','월','화','수','목','금','토'].map((d,i) => (
                <div key={i} style={{ fontSize:9, color:'var(--text-tertiary)', width:11, textAlign:'center' }}>{i%2===0 ? d : ''}</div>
              ))}
            </div>
            {/* 범례 */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:12 }}>
              <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>적음</span>
              {['var(--gray-100)', '#DBEAFE', '#93C5FD', '#4F7FFF', '#2952CC'].map((c,i) => (
                <div key={i} style={{ width:11, height:11, borderRadius:2, background:c }} />
              ))}
              <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>많음</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-secondary)', fontWeight:700 }}>
                총 {records.length}건 · {new Set(records.map(r=>r.date)).size}일
              </span>
            </div>
          </StatCard>

          {/* 월별 기록 밀도 */}
          <StatCard title="월별 기록 건수" icon={<BarChart3 size={15} color="var(--cat-comm)" />}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100, paddingTop:10 }}>
              {monthlyData.map((m,i) => {
                const isNow = m.year===thisYear && m.month===thisMonth;
                const h = m.count===0 ? 4 : Math.max(10, Math.round((m.count/maxMonthly)*80));
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div style={{ fontSize:10, fontWeight:900, color: isNow?'var(--primary)':'var(--text-secondary)' }}>{m.count||''}</div>
                    <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background: isNow?'var(--primary)':'#93C5FD' }} />
                    <div style={{ fontSize:10, fontWeight: isNow?900:600, color: isNow?'var(--primary)':'var(--text-tertiary)' }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </StatCard>
        </div>
      )}
    </div>
  );
}

/* ── 서브 컴포넌트 ──────────────────────────────────────── */
function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:16, padding:'15px 16px', boxShadow:'var(--shadow-sm)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
        <span style={{ fontSize:12, color:'var(--text-tertiary)', fontWeight:700 }}>{label}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:900, color:'var(--text-primary)', marginBottom:2 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>{sub}</div>
    </div>
  );
}

function StatCard({ title, icon, children }) {
  return (
    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:18, padding:'16px', marginBottom:14, boxShadow:'var(--shadow-sm)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:16 }}>
        {icon}
        <span style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
