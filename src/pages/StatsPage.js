import React, { useState, useMemo } from 'react';
import { getRecords, getChildren, CATEGORIES, today, formatDateKo } from '../utils/storage';
import { BarChart3, TrendingUp, AlertCircle, Star, Users, PenLine, CalendarDays, Zap } from 'lucide-react';

const AVATAR_COLORS = ['#4F7FFF','#6C63FF','#FF8C42','#00B4D8','#4CAF50','#E91E9A','#FF5722','#607D8B'];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const DAY_LABELS = ['일','월','화','수','목','금','토'];
const MONTH_KO   = (m) => `${m+1}월`;

export default function StatsPage({ onNavigate, isDesktop }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'children' | 'categories'

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

      {/* 탭 */}
      <div style={{ display:'flex', gap:8, marginBottom:18, overflowX:'auto', paddingBottom:2 }}>
        {[['overview','개요'],['children','아이별'],['categories','카테고리']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:'8px 16px', borderRadius:100, fontSize:13, fontWeight:800, whiteSpace:'nowrap', background: tab===k ? 'var(--primary)' : 'white', color: tab===k ? 'white' : 'var(--text-secondary)', border:`1.5px solid ${tab===k ? 'var(--primary)' : 'var(--border)'}`, boxShadow: tab===k ? '0 4px 14px rgba(79,127,255,0.25)' : 'none' }}>
            {v}
          </button>
        ))}
      </div>

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
