import React, { useState, useEffect } from 'react';
import { getChildren, getRecords, today, formatDate, CATEGORIES, getAutomationState, getAutomationLog } from '../utils/storage';
import { CheckCircle2, AlertCircle, XCircle, ChevronRight, BarChart2, CalendarCheck } from 'lucide-react';

export default function CheckPage({ onNavigate, isDesktop }) {
  const [children, setChildren] = useState([]);
  const [records, setRecords] = useState([]);
  const [period, setPeriod] = useState('thisMonth');
  const [automation, setAutomation] = useState(() => getAutomationState());
  const [automationLog, setAutomationLog] = useState(() => getAutomationLog());

  useEffect(() => {
    setChildren(getChildren());
    setRecords(getRecords());
    setAutomation(getAutomationState());
    setAutomationLog(getAutomationLog());
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
  const autoDocs = automation?.documents || {};
  const autoChecklist = automation?.checklist || {};
  const audit = automation?.audit || { readyCount: 0, totalCount: 0, percent: 0, items: [] };
  const recommendations = automation?.recommendations || [];
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = records.filter(r => r.date?.startsWith(monthKey));
  const monthChildStats = children.map(child => ({
    child,
    count: monthRecords.filter(r => r.childId === child.id).length,
  }));
  const monthLowChildren = monthChildStats.filter(item => item.count < 3);
  const monthDocItems = [
    { key: 'daily', label: '보육일지', ready: autoDocs.daily?.ready, count: autoDocs.daily?.count || 0, nav: { docType: 'daily', period: 'date' } },
    { key: 'weekly', label: '주간평가', ready: autoDocs.weekly?.ready, count: autoDocs.weekly?.count || 0, nav: { docType: 'weekly', period: '1week' } },
    { key: 'monthly', label: '월간평가', ready: autoDocs.monthly?.ready, count: autoDocs.monthly?.count || 0, nav: { docType: 'monthly', period: '1month' } },
    { key: 'parent', label: '상담자료', ready: autoDocs.parent?.ready, count: autoDocs.parent?.count || 0, nav: { docType: 'parent', period: '1month' } },
    { key: 'development', label: '발달평가', ready: autoDocs.development?.ready, count: autoDocs.development?.count || 0, nav: { docType: 'development', period: '1month' } },
  ];
  const monthCloseScore = Math.round(Math.min(100,
    (monthRecords.length / Math.max(1, children.length * 3)) * 45 +
    ((children.length - monthLowChildren.length) / Math.max(1, children.length)) * 30 +
    (monthDocItems.filter(item => item.ready).length / monthDocItems.length) * 25
  ));

  const overallScore = Math.round(
    Math.min(100, (totalRecords / Math.max(1, children.length * (periodDays / 7))) * 50 +
    ((Object.keys(CATEGORIES).length - missingCats.length) / Object.keys(CATEGORIES).length) * 50)
  );
  const actionItems = [
    {
      title: '오늘 보육일지 초안',
      desc: autoDocs.daily?.ready ? `${autoDocs.daily.count}건으로 바로 만들 수 있습니다.` : '오늘 기록을 먼저 남기면 자동 준비됩니다.',
      action: '문서 만들기',
      active: autoDocs.daily?.ready,
      onClick: () => onNavigate('docs', { docType: 'daily', period: 'date' }),
    },
    {
      title: '주간평가 초안',
      desc: autoDocs.weekly?.ready ? `최근 7일 기록 ${autoDocs.weekly.count}건이 준비됐습니다.` : '최근 7일 기록이 더 필요합니다.',
      action: '주간평가',
      active: autoDocs.weekly?.ready,
      onClick: () => onNavigate('docs', { docType: 'weekly', period: '1week' }),
    },
    {
      title: '부모상담자료',
      desc: autoDocs.parent?.ready ? `상담용 문장 ${autoDocs.parent.count}건이 누적됐습니다.` : '상담용 기록을 남기면 자동 누적됩니다.',
      action: '상담자료',
      active: autoDocs.parent?.ready,
      onClick: () => onNavigate('docs', { docType: 'parent', period: '1month' }),
    },
    {
      title: '부족 영역 보완',
      desc: (autoChecklist.missingCategoryKeys?.length || 0) > 0 ? `부족한 카테고리 ${autoChecklist.missingCategoryKeys.length}개가 있습니다.` : '카테고리 기록 균형이 좋습니다.',
      action: '기록 추가',
      active: (autoChecklist.missingCategoryKeys?.length || 0) > 0,
      onClick: () => onNavigate('record'),
    },
  ];

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
      <MonthClosePanel
        score={monthCloseScore}
        monthKey={monthKey}
        totalRecords={monthRecords.length}
        lowChildren={monthLowChildren}
        docItems={monthDocItems}
        onNavigate={onNavigate}
      />
      <AutomationActionPanel items={actionItems} />
      <AutomationAuditPanel audit={audit} onNavigate={onNavigate} />
      <RecommendationPanel items={recommendations} onNavigate={onNavigate} />
      <AutomationHistoryPanel items={automationLog} />

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
          <div style={{ background: 'var(--white)', height: 8, borderRadius: 100, width: `${overallScore}%`, transition: 'width 1s ease' }} />
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

function MonthClosePanel({ score, monthKey, totalRecords, lowChildren, docItems, onNavigate }) {
  const doneCount = docItems.filter(item => item.ready).length;
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>월말 마감 모드</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{monthKey} 기준 문서와 기록 균형을 한 번에 확인합니다.</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: score >= 80 ? 'var(--cat-play)' : score >= 50 ? 'var(--cat-habit)' : 'var(--accent)' }}>{score}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>마감 준비도</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <CloseMini label="이번 달 기록" value={`${totalRecords}건`} />
        <CloseMini label="문서 준비" value={`${doneCount}/${docItems.length}`} />
        <CloseMini label="보완 아이" value={`${lowChildren.length}명`} alert={lowChildren.length > 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: lowChildren.length ? 12 : 0 }}>
        {docItems.map(item => (
          <button key={item.key} onClick={() => onNavigate('docs', item.nav)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '10px 12px', borderRadius: 12,
            background: item.ready ? 'rgba(76,175,80,0.08)' : 'var(--gray-50)',
            border: `1px solid ${item.ready ? 'rgba(76,175,80,0.25)' : 'var(--border)'}`,
            textAlign: 'left',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{item.count}건 반영 가능</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: item.ready ? 'white' : 'var(--text-secondary)', background: item.ready ? 'var(--cat-play)' : 'var(--gray-200)', borderRadius: 100, padding: '5px 9px' }}>
              {item.ready ? '작성' : '대기'}
            </span>
          </button>
        ))}
      </div>

      {lowChildren.length > 0 && (
        <div style={{ background: 'var(--accent-light)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', marginBottom: 7 }}>월말 전 보완하면 좋은 아이</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {lowChildren.slice(0, 8).map(({ child, count }) => (
              <button key={child.id} onClick={() => onNavigate('record', { childId: child.id })} style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', background: 'var(--white)', borderRadius: 100, padding: '6px 10px' }}>
                {child.name} {count}건
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CloseMini({ label, value, alert }) {
  return (
    <div style={{ background: alert ? 'var(--accent-light)' : 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: alert ? 'var(--accent)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AutomationActionPanel({ items }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>자동 실행 제안</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>현재 기록 상태를 기준으로 바로 이어서 할 수 있는 작업입니다.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {items.map(item => (
          <button key={item.title} onClick={item.onClick} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 13px',
            borderRadius: 13,
            border: `1px solid ${item.active ? 'rgba(79,127,255,0.3)' : 'var(--border)'}`,
            background: item.active ? 'var(--primary-light)' : 'var(--gray-50)',
            textAlign: 'left',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: item.active ? 'var(--primary)' : 'var(--text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>{item.desc}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: item.active ? 'white' : 'var(--text-secondary)', background: item.active ? 'var(--primary)' : 'var(--gray-200)', borderRadius: 100, padding: '5px 9px', flexShrink: 0 }}>
              {item.action}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AutomationAuditPanel({ audit, onNavigate }) {
  const items = audit.items || [];
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>기록 1개 자동화 체크</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            최근 기록 기준으로 자동화 가능한 업무를 점검합니다.
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '6px 10px', flexShrink: 0 }}>
          {audit.readyCount || 0}/{audit.totalCount || 0}
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 100, marginBottom: 12 }}>
        <div style={{ height: 8, width: `${audit.percent || 0}%`, background: 'var(--primary)', borderRadius: 100, transition: 'width 0.4s ease' }} />
      </div>
      {audit.latestRecord && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--gray-50)', borderRadius: 12, padding: '9px 11px', marginBottom: 12 }}>
          최근 기록: <b>{audit.latestRecord.childName}</b> · {(audit.latestRecord.appliedLabels || []).slice(0, 4).join(', ')}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {items.map(item => (
          <div key={item.key} style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 9,
            alignItems: 'center',
            padding: '10px 11px',
            borderRadius: 12,
            background: item.ready ? 'rgba(76,175,80,0.08)' : 'var(--gray-50)',
            border: `1px solid ${item.ready ? 'rgba(76,175,80,0.24)' : 'var(--border)'}`,
          }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.ready ? 'var(--cat-play)' : 'var(--gray-300)', color: 'white', fontSize: 12, fontWeight: 900 }}>
              {item.ready ? '✓' : '!'}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>{item.detail}</div>
            </div>
            {!item.ready && (
              <button onClick={() => onNavigate(item.key === 'missingCheck' ? 'settings' : 'record')} style={{ fontSize: 11, fontWeight: 900, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '5px 8px' }}>
                보완
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationPanel({ items, onNavigate }) {
  if (!items.length) return null;
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>부족 기록 추천</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>평가제 균형을 위해 다음 기록을 추가해보세요.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 100, padding: '5px 10px', height: 24 }}>{items.length}개</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.slice(0, 5).map(item => (
          <div key={item.key} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 13, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{item.label}</div>
              <button
                onClick={() => onNavigate('record', {
                  mode: 'write',
                  prefillText: item.example || item.prompt,
                  recordType: item.key === 'special' ? 'special' : 'observe',
                })}
                style={{ fontSize: 11, fontWeight: 900, color: 'white', background: 'var(--primary)', borderRadius: 100, padding: '5px 9px' }}
              >
                기록하기
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.prompt}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45, marginTop: 5 }}>{item.example}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationHistoryPanel({ items }) {
  const recent = (items || []).slice(0, 5);
  if (!recent.length) return null;

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>자동화 이력</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>기록 1개가 어디까지 다시 반영됐는지 보여줍니다.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '5px 10px', height: 24 }}>
          최근 {recent.length}건
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {recent.map(item => (
          <div key={item.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 13, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{item.actionLabel || '자동화 반영'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{item.message}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {(item.changedLabels || []).slice(0, 6).map(label => (
                <span key={label} style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '3px 7px' }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
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
