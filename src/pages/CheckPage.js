import React, { useState, useEffect } from 'react';
import { getChildren, getRecords, today, formatDate, CATEGORIES } from '../utils/storage';
import { CheckCircle2, AlertCircle, XCircle, ChevronRight, BarChart2 } from 'lucide-react';

export default function CheckPage({ onNavigate, isDesktop }) {
  const [children, setChildren] = useState([]);
  const [records, setRecords] = useState([]);
  const [period, setPeriod] = useState('thisMonth');

  useEffect(() => {
    setChildren(getChildren());
    setRecords(getRecords());
  }, []);


  // Calculate period range
  const now = new Date();
  const periodDays = period === 'thisMonth' ? now.getDate() : period === 'thisWeek' ? 7 : 30;

  // Records by child in period
  const childStats = children.map(child => {
    const childRecs = records.filter(r => {
      if (r.childId !== child.id) return false;
      const d = new Date(r.date);
      return (now - d) / 86400000 <= periodDays;
    });
    const catSet = new Set(childRecs.map(r => r.category));
    return {
      child,
      count: childRecs.length,
      categories: [...catSet],
      lastDate: childRecs[0]?.date,
    };
  });

  const totalRecords = records.filter(r => (now - new Date(r.date)) / 86400000 <= periodDays).length;

  // Category balance check
  const catCounts = {};
  records.filter(r => (now - new Date(r.date)) / 86400000 <= periodDays)
    .forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });

  const missingCats = Object.keys(CATEGORIES).filter(k => !catCounts[k]);

  // Children with no records
  const noRecordChildren = childStats.filter(s => s.count === 0);
  const lowRecordChildren = childStats.filter(s => s.count > 0 && s.count < 3);

  // Today's coverage
  const todayStr = today();
  const todayRecs = records.filter(r => r.date === todayStr);
  const todayChildIds = new Set(todayRecs.map(r => r.childId));
  const todayCoverage = `${todayChildIds.size}/${children.length}명`;

  const overallScore = Math.round(
    Math.min(100, (totalRecords / Math.max(1, children.length * (periodDays / 7))) * 50 +
    ((Object.keys(CATEGORIES).length - missingCats.length) / Object.keys(CATEGORIES).length) * 50)
  );

  const pad = isDesktop ? '32px 36px' : '20px';

  const PeriodSelector = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {[['thisWeek', '이번 주'], ['thisMonth', '이번 달'], ['last30', '최근 30일']].map(([k, v]) => (
        <button key={k} onClick={() => setPeriod(k)} style={{
          padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
          background: period === k ? 'var(--primary)' : 'var(--gray-100)',
          color: period === k ? 'white' : 'var(--text-secondary)',
        }}>
          {v}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: pad }}>
      <div style={{ fontSize: isDesktop ? 24 : 20, fontWeight: 900, marginBottom: 4, letterSpacing: '-0.5px' }}>점검</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>기록 현황과 누락을 확인해요</div>
      {PeriodSelector}

      {/* Score Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
        borderRadius: 18, padding: 24, marginBottom: 20, color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BarChart2 size={18} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>기록 종합 점수</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 52, fontWeight: 800 }}>{overallScore}</span>
          <span style={{ fontSize: 20, opacity: 0.7 }}>/ 100</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 100, height: 8, marginBottom: 16 }}>
          <div style={{ background: 'white', height: 8, borderRadius: 100, width: `${overallScore}%`, transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <MiniStat label="기간 기록" value={`${totalRecords}건`} />
          <MiniStat label="오늘 완료" value={todayCoverage} />
          <MiniStat label="미기록 아이" value={`${noRecordChildren.length}명`} alert={noRecordChildren.length > 0} />
        </div>
      </div>

      {/* 데스크톱 2컬럼 */}
      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 } : {}}>
      <div>
      {/* Alerts */}
      {noRecordChildren.length > 0 && (
        <CheckSection title="기록 없는 아이" type="error">
          {noRecordChildren.map(({ child }) => (
            <button key={child.id} onClick={() => onNavigate('record', { childId: child.id })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 0', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{child.name}</span>
              <span style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                기록하기 <ChevronRight size={12} />
              </span>
            </button>
          ))}
        </CheckSection>
      )}

      {lowRecordChildren.length > 0 && (
        <CheckSection title="기록이 적은 아이 (3건 미만)" type="warning">
          {lowRecordChildren.map(({ child, count, lastDate }) => (
            <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>{child.name}</span>
              <span style={{ fontSize: 12, color: 'var(--cat-habit)' }}>{count}건 · 최근 {formatDate(lastDate)}</span>
            </div>
          ))}
        </CheckSection>
      )}

      {missingCats.length > 0 && (
        <CheckSection title="기록 없는 카테고리" type="warning">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
            {missingCats.map(k => {
              const cat = CATEGORIES[k];
              return (
                <span key={k} style={{ fontSize: 12, fontWeight: 600, color: cat.color, background: cat.bg, padding: '4px 12px', borderRadius: 100 }}>
                  {cat.emoji} {cat.label}
                </span>
              );
            })}
          </div>
        </CheckSection>
      )}

      </div>{/* left col */}
      <div>
      {/* Category Balance */}
      <CheckSection title="카테고리별 기록 현황" type="info">
        {Object.entries(CATEGORIES).map(([k, meta]) => {
          const count = catCounts[k] || 0;
          const maxCount = Math.max(...Object.values(catCounts), 1);
          return (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{meta.emoji} {meta.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{count}건</span>
              </div>
              <div style={{ background: 'var(--gray-100)', borderRadius: 100, height: 6 }}>
                <div style={{
                  background: count === 0 ? 'var(--gray-200)' : meta.color,
                  height: 6, borderRadius: 100,
                  width: `${(count / maxCount) * 100}%`,
                  transition: 'width 0.5s ease',
                  minWidth: count > 0 ? '6px' : 0,
                }} />
              </div>
            </div>
          );
        })}
      </CheckSection>

      {/* All children overview */}
      <CheckSection title="아이별 기록 현황" type="info">
        {childStats.map(({ child, count, categories }) => (
          <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{child.name}</span>
              {categories.slice(0, 3).map(k => {
                const cat = CATEGORIES[k];
                return <span key={k} style={{ fontSize: 10, color: cat?.color, marginLeft: 6 }}>{cat?.emoji}</span>;
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: count === 0 ? 'var(--accent)' : count < 3 ? 'var(--cat-habit)' : 'var(--cat-play)', fontWeight: 600 }}>
                {count}건
              </span>
              {count === 0 ? <XCircle size={14} color="var(--accent)" /> : count < 3 ? <AlertCircle size={14} color="var(--cat-habit)" /> : <CheckCircle2 size={14} color="var(--cat-play)" />}
            </div>
          </div>
        ))}
      </CheckSection>
      </div>{/* right col */}
      </div>{/* grid */}
    </div>
  );
}

function MiniStat({ label, value, alert }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: alert ? '#FFD600' : 'white' }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
    </div>
  );
}

function CheckSection({ title, type, children }) {
  const colors = {
    error: { bg: 'var(--accent-light)', border: 'var(--accent)', icon: <XCircle size={16} color="var(--accent)" /> },
    warning: { bg: 'var(--cat-habit-light)', border: 'var(--cat-habit)', icon: <AlertCircle size={16} color="var(--cat-habit)" /> },
    info: { bg: 'white', border: 'var(--border)', icon: <CheckCircle2 size={16} color="var(--primary)" /> },
  };
  const style = colors[type] || colors.info;

  return (
    <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {style.icon}
        <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
