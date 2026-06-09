import React, { useState, useCallback } from 'react';
import { getRecords, getChildren, CATEGORIES } from '../utils/storage';

const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])
);

function analyzeRecords(records, children) {
  const now = new Date();
  const last30 = records.filter(r => (now - new Date(r.date)) / 86400000 <= 30);
  const insights = [];

  // 1) 카테고리 편중 분석 (아이별)
  children.forEach(child => {
    const childRecs = last30.filter(r => r.childId === child.id);
    if (childRecs.length < 3) return;
    const catCount = {};
    childRecs.forEach(r => { catCount[r.category] = (catCount[r.category] || 0) + 1; });
    const total = childRecs.length;
    const dominant = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] / total > 0.6) {
      insights.push({
        type: 'warning',
        child: child.name,
        message: `${child.name} 아이의 최근 기록 중 '${CATEGORY_LABELS[dominant[0]] || dominant[0]}' 카테고리가 ${Math.round(dominant[1] / total * 100)}%를 차지해요. 다른 발달영역 기록도 균형있게 남겨보세요.`,
      });
    }
  });

  // 2) 기록 공백 감지 (3일 이상 기록 없는 아이)
  children.forEach(child => {
    const childRecs = records.filter(r => r.childId === child.id);
    if (!childRecs.length) return;
    const latest = new Date(childRecs.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date);
    const daysSince = (now - latest) / 86400000;
    if (daysSince >= 3) {
      insights.push({
        type: 'info',
        child: child.name,
        message: `${child.name} 아이의 마지막 기록이 ${Math.floor(daysSince)}일 전이에요. 최근 관찰 내용을 기록해 보세요.`,
      });
    }
  });

  // 3) 이번 주 기록 수 칭찬
  const thisWeek = records.filter(r => (now - new Date(r.date)) / 86400000 <= 7);
  if (thisWeek.length >= 10) {
    insights.push({ type: 'praise', child: null, message: `이번 주에 ${thisWeek.length}건의 기록을 남기셨어요! 꾸준한 관찰 기록이 아이들의 성장을 담아내고 있어요. 👏` });
  } else if (thisWeek.length === 0) {
    insights.push({ type: 'warning', child: null, message: '이번 주 기록이 아직 없어요. 짧은 한 줄이라도 오늘의 관찰을 남겨보세요.' });
  }

  // 4) 발달영역 균형 (전체 반)
  const devAreaCount = {};
  last30.forEach(r => (r.devAreas || []).forEach(a => { devAreaCount[a] = (devAreaCount[a] || 0) + 1; }));
  const allAreas = ['신체운동·건강', '의사소통', '사회관계', '예술경험', '자연탐구', '기본생활습관'];
  const missing = allAreas.filter(a => !devAreaCount[a]);
  if (missing.length > 0) {
    insights.push({ type: 'info', child: null, message: `최근 한 달간 '${missing.join(', ')}' 발달영역 기록이 없어요. 해당 영역의 관찰도 기록해 보세요.` });
  }

  return insights;
}

const TYPE_CONFIG = {
  warning: { icon: '⚠️', color: '#FF6B6B', bg: '#FFF5F5', border: '#FF6B6B' },
  info:    { icon: '💡', color: '#4F7FFF', bg: '#EBF0FF', border: '#4F7FFF' },
  praise:  { icon: '🌟', color: '#4CAF50', bg: '#F0FBF1', border: '#4CAF50' },
};

export default function CoachPage({ isDesktop }) {
  const [insights, setInsights] = useState(() => {
    const records = getRecords();
    const children = getChildren();
    return analyzeRecords(records, children);
  });
  const [records] = useState(() => getRecords());
  const [analysisTime, setAnalysisTime] = useState(() => new Date());

  const refresh = useCallback(() => {
    const r = getRecords();
    const c = getChildren();
    setInsights(analyzeRecords(r, c));
    setAnalysisTime(new Date());
  }, []);

  const last30Count = records.filter(r => (new Date() - new Date(r.date)) / 86400000 <= 30).length;

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${analysisTime.getFullYear()}.${pad(analysisTime.getMonth()+1)}.${pad(analysisTime.getDate())} ${pad(analysisTime.getHours())}:${pad(analysisTime.getMinutes())}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(248,250,254,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>🧠 AI 코칭</div>
        <button
          onClick={refresh}
          style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 13 }}
        >
          분석 새로고침
        </button>
      </div>

      <div style={{ padding: isDesktop ? '32px 36px' : '20px' }}>
        {/* 요약 카드 */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>{last30Count}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>총 분석 기록</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>최근 30일</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>기간</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{timeStr}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>분석 일시</div>
          </div>
        </div>

        {/* 인사이트 카드 목록 */}
        {insights.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>모든 기록이 균형잡혀 있어요!</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>계속 유지해 주세요.</div>
          </div>
        ) : (
          insights.map((insight, i) => {
            const cfg = TYPE_CONFIG[insight.type] || TYPE_CONFIG.info;
            return (
              <div key={i} style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}33`,
                borderLeft: `4px solid ${cfg.border}`,
                borderRadius: 14, padding: '14px 16px', marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    {insight.child && (
                      <span style={{ display: 'inline-block', background: cfg.color, color: 'white', borderRadius: 100, padding: '2px 10px', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                        {insight.child}
                      </span>
                    )}
                    <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {insight.message}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
