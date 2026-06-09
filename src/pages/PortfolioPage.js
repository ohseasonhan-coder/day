import React, { useState, useEffect } from 'react';
import { getRecordsByChild, CATEGORIES, formatDate, formatDateKo } from '../utils/storage';
import { ArrowLeft, BarChart3 } from 'lucide-react';

const AVATAR_COLORS = ['#4F7FFF','#6C63FF','#FF8C42','#00B4D8','#4CAF50','#E91E9A','#FF5722','#607D8B'];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function PortfolioPage({ childId, childName, onBack, isDesktop }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    setRecords(getRecordsByChild(childId));
  }, [childId]);

  const color = getAvatarColor(childName);

  // 카테고리 분포
  const catCounts = {};
  records.forEach(r => { catCounts[r.category || 'special'] = (catCounts[r.category || 'special'] || 0) + 1; });
  const totalRecs = records.length;

  // 월별 그룹
  const monthMap = {};
  records.forEach(r => {
    if (!r.date) return;
    const ym = r.date.slice(0, 7);
    monthMap[ym] = (monthMap[ym] || 0) + 1;
  });
  const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthCount = Math.max(...months.map(([,v]) => v), 1);

  // 기록한 날짜 수
  const uniqueDays = new Set(records.map(r => r.date).filter(Boolean)).size;

  const pad = isDesktop ? '32px 36px' : '20px';

  return (
    <div style={{ padding: pad }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>
          <ArrowLeft size={18} /> 돌아가기
        </button>
      </div>

      {/* 아이 프로필 카드 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
        borderRadius: 24, padding: '22px 22px 20px', marginBottom: 20, color: 'white',
        boxShadow: '0 12px 32px rgba(79,127,255,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, flexShrink: 0 }}>
            {childName?.[0] || '?'}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>{childName}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>성장 포트폴리오</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <BarChart3 size={28} style={{ opacity: 0.7 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <HeroStat label="누적 기록" value={`${totalRecs}건`} />
          <HeroStat label="기록한 날" value={`${uniqueDays}일`} />
          <HeroStat label="발달 영역" value={`${Object.keys(catCounts).length}개`} />
        </div>
      </div>

      {/* 카테고리 분포 */}
      <SectionCard title="카테고리 분포">
        {totalRecs === 0 ? (
          <EmptyMsg />
        ) : (
          Object.entries(CATEGORIES).map(([key, cat]) => {
            const count = catCounts[key] || 0;
            const pct = totalRecs > 0 ? Math.round((count / totalRecs) * 100) : 0;
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? cat.color : 'var(--text-tertiary)' }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: count > 0 ? cat.color : 'var(--text-tertiary)' }}>
                    {count}건 ({pct}%)
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ height: 8, background: count > 0 ? cat.color : 'transparent', borderRadius: 100, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      {/* 월별 기록 타임라인 */}
      <SectionCard title="월별 기록 타임라인">
        {months.length === 0 ? (
          <EmptyMsg />
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 4 }}>
            {months.map(([ym, count]) => {
              const barH = Math.max(20, Math.round((count / maxMonthCount) * 80));
              const [y, m] = ym.split('-');
              return (
                <div key={ym} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 44 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--primary)' }}>{count}</span>
                  <div style={{ width: 36, height: barH, background: 'var(--primary)', borderRadius: '6px 6px 0 0', opacity: 0.85 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {m}월
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>{y}</span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 최근 기록 */}
      <SectionCard title="최근 기록">
        {records.length === 0 ? (
          <EmptyMsg />
        ) : (
          records.slice(0, 10).map(r => {
            const cat = CATEGORIES[r.category] || CATEGORIES.special;
            const preview = r.rawText || r.observation || '';
            return (
              <div key={r.id} style={{
                background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: cat.color, background: cat.bg, padding: '2px 8px', borderRadius: 100 }}>{cat.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{formatDate(r.date)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {preview || '(내용 없음)'}
                </div>
              </div>
            );
          })
        )}
      </SectionCard>
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.78, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14, color: 'var(--text-primary)' }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyMsg() {
  return <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>기록이 없어요</div>;
}
