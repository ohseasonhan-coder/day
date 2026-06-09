import React, { useEffect, useState } from 'react';
import { getRecordsByChild, CATEGORIES, formatDate } from '../utils/storage';
import { ArrowLeft, BarChart3 } from 'lucide-react';

const AVATAR_COLORS = ['#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8', '#4CAF50', '#E91E9A', '#FF5722', '#607D8B'];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function PortfolioPage({ childId, childName, onBack, isDesktop }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    setRecords(getRecordsByChild(childId));
  }, [childId]);

  const avatarColor = getAvatarColor(childName);
  const catCounts = {};
  records.forEach(record => {
    const category = record.category || 'special';
    catCounts[category] = (catCounts[category] || 0) + 1;
  });

  const totalRecs = records.length;
  const uniqueDays = new Set(records.map(record => record.date).filter(Boolean)).size;
  const monthMap = {};
  records.forEach(record => {
    if (!record.date) return;
    const ym = record.date.slice(0, 7);
    monthMap[ym] = (monthMap[ym] || 0) + 1;
  });
  const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthCount = Math.max(...months.map(([, value]) => value), 1);

  const now = new Date();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const monthlyTotals = last6Months.map(ym => records.filter(record => record.date?.startsWith(ym)).length);
  const monthLabels = last6Months.map(ym => `${parseInt(ym.split('-')[1], 10)}월`);

  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthCount = records.filter(record => record.date?.startsWith(thisMonth)).length;
  const lastMonthCount = records.filter(record => record.date?.startsWith(lastMonth)).length;
  const growthScore = calcGrowthScore(records);
  const pad = isDesktop ? '32px 36px' : '20px';

  return (
    <div style={{ padding: pad }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>
          <ArrowLeft size={18} /> 돌아가기
        </button>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
        borderRadius: 24, padding: '22px 22px 20px', marginBottom: 20, color: 'white',
        boxShadow: '0 12px 32px rgba(79,127,255,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: avatarColor, border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, flexShrink: 0 }}>
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

      <SectionCard title="카테고리 분포">
        {totalRecs === 0 ? <EmptyMsg /> : Object.entries(CATEGORIES).map(([key, category]) => {
          const count = catCounts[key] || 0;
          const pct = totalRecs > 0 ? Math.round((count / totalRecs) * 100) : 0;
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? category.color : 'var(--text-tertiary)' }}>
                  {category.emoji} {category.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: count > 0 ? category.color : 'var(--text-tertiary)' }}>{count}건 ({pct}%)</span>
              </div>
              <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: 8, background: count > 0 ? category.color : 'transparent', borderRadius: 100, width: `${pct}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </SectionCard>

      <SectionCard title="월별 기록 타임라인">
        {months.length === 0 ? <EmptyMsg /> : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 4 }}>
            {months.map(([ym, count]) => {
              const barH = Math.max(20, Math.round((count / maxMonthCount) * 80));
              const [y, m] = ym.split('-');
              return (
                <div key={ym} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 44 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--primary)' }}>{count}</span>
                  <div style={{ width: 36, height: barH, background: 'var(--primary)', borderRadius: '6px 6px 0 0', opacity: 0.85 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{m}월</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>{y}</span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="📊 성장 점수">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <CircleProgress value={growthScore} size={80} color="var(--primary)" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>{getGrowthLabel(growthScore)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              카테고리 다양성, 누적 기록 수, 기록 빈도를 기반으로 계산돼요.
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="📈 월별 기록 추이">
        {records.length === 0 ? <EmptyMsg /> : <LineChart data={monthlyTotals} labels={monthLabels} color="var(--primary)" />}
      </SectionCard>

      <SectionCard title="📊 이번 달 vs 지난 달">
        {records.length === 0 ? <EmptyMsg /> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['지난 달', lastMonthCount, 'var(--gray-300)'], ['이번 달', thisMonthCount, 'var(--primary)']].map(([label, count, color]) => {
              const maxH = Math.max(lastMonthCount, thisMonthCount, 1);
              const barH = Math.max(8, Math.round((count / maxH) * 80));
              return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color }}>{count}건</div>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ width: 48, height: barH, background: color, borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="최근 기록">
        {records.length === 0 ? <EmptyMsg /> : records.slice(0, 10).map(record => {
          const category = CATEGORIES[record.category] || CATEGORIES.special;
          const preview = record.rawText || record.observation || '';
          return (
            <div key={record.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{category.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: category.color, background: category.bg, padding: '2px 8px', borderRadius: 100 }}>{category.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{formatDate(record.date)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {preview || '(내용 없음)'}
              </div>
            </div>
          );
        })}
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

function LineChart({ data, labels, color = 'var(--primary)' }) {
  const W = 300;
  const H = 120;
  const PAD = 20;
  const max = Math.max(...data, 1);
  const points = data.map((value, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - (value / max) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points.join(' ')} />
      {data.map((value, i) => {
        const [x, y] = points[i].split(',').map(Number);
        return (
          <g key={labels[i]}>
            <circle cx={x} cy={y} r="4" fill={color} />
            <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">{labels[i]}</text>
            <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">{value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function CircleProgress({ value, max = 100, size = 80, color = 'var(--primary)' }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / max) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{value}</text>
    </svg>
  );
}

function calcGrowthScore(records) {
  const cats = new Set(records.map(record => record.category)).size;
  const total = Math.min(records.length, 50);
  const dates = new Set(records.map(record => record.date)).size;
  return Math.min(100, cats * 10 + total + dates * 2);
}

function getGrowthLabel(score) {
  if (score >= 80) return '매우 우수';
  if (score >= 60) return '우수';
  if (score >= 40) return '보통';
  return '기록 필요';
}
