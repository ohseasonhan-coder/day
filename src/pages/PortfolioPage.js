import React, { useEffect, useState, useMemo } from 'react';
import { getRecordsByChild, CATEGORIES, formatDate, addCopyHistory, getClasses } from '../utils/storage';
import { NURI, AREA_COLORS, loadChecks } from './ChecklistPage';
import { getStandardChecklist, ageKeyForClassAge } from '../utils/standardCurriculum';
import { buildDevelopmentReport } from '../utils/developmentReport';
import { exportDocx } from '../utils/docxExport';
import { ArrowLeft, BarChart3, FileText, Copy, Check, Sparkles, Download } from 'lucide-react';

const AVATAR_COLORS = ['#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8', '#4CAF50', '#E91E9A', '#FF5722', '#607D8B'];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// 누리과정 6개 영역 ↔ 기록 카테고리 매핑 (StatsPage 발달추이와 동일 기준)
const NURI_AREAS = [
  { key: 'body',   label: '신체운동·건강',          cats: ['body'],          color: '#4CAF50' },
  { key: 'nature', label: '자연탐구',               cats: ['nature', 'play'], color: '#FF8C42' },
  { key: 'art',    label: '예술경험',               cats: ['art'],           color: '#E91E9A' },
  { key: 'peer',   label: '사회관계',               cats: ['peer'],          color: '#9C27B0' },
  { key: 'comm',   label: '의사소통',               cats: ['comm'],          color: '#4F7FFF' },
  { key: 'habit',  label: '일상생활(기본생활습관)',  cats: ['habit'],         color: '#00B4D8' },
];

const REPORT_PERIODS = [
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난 달' },
  { key: 'semester1', label: '1학기 (3~8월)' },
  { key: 'semester2', label: '2학기 (9~2월)' },
  { key: 'all',       label: '전체' },
];

function getPeriodRange(periodKey) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const ym = (yy, mm) => `${yy}-${String(mm + 1).padStart(2, '0')}`;
  switch (periodKey) {
    case 'thisMonth': {
      const k = ym(y, m);
      return { from: `${k}-01`, to: `${k}-31`, label: `${y}년 ${m + 1}월` };
    }
    case 'lastMonth': {
      const d = new Date(y, m - 1, 1);
      const k = ym(d.getFullYear(), d.getMonth());
      return { from: `${k}-01`, to: `${k}-31`, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` };
    }
    case 'semester1': {
      // 1학기: 3월~8월 (지난 3월 기준)
      const startYear = m >= 2 ? y : y - 1;
      return { from: `${startYear}-03-01`, to: `${startYear}-08-31`, label: `${startYear}학년도 1학기` };
    }
    case 'semester2': {
      // 2학기: 9월~다음해 2월
      const startYear = m >= 8 ? y : y - 1;
      return { from: `${startYear}-09-01`, to: `${startYear + 1}-02-29`, label: `${startYear}학년도 2학기` };
    }
    default:
      return { from: '0000-01-01', to: '9999-12-31', label: '전체 기간' };
  }
}

// 기간 내 기록으로 아동별 보고서 텍스트 생성 (입력된 기록 사실만 사용)
function buildChildReport(records, childName, range) {
  const inRange = records.filter(r => r.date && r.date >= range.from && r.date <= range.to);
  const lines = [];
  lines.push(`📋 ${childName} 발달 기록 보고서 — ${range.label}`);
  lines.push(`기록 ${inRange.length}건 · 기록일 ${new Set(inRange.map(r => r.date)).size}일`);
  lines.push('');

  if (inRange.length === 0) {
    lines.push('해당 기간에 저장된 기록이 없습니다.');
    return lines.join('\n');
  }

  lines.push('[발달 영역별 기록 수]');
  NURI_AREAS.forEach(area => {
    const count = inRange.filter(r => area.cats.includes(r.category)).length;
    lines.push(`· ${area.label}: ${count}건`);
  });
  const specialCount = inRange.filter(r => r.category === 'special' || !NURI_AREAS.some(a => a.cats.includes(r.category))).length;
  if (specialCount > 0) lines.push(`· 특이사항: ${specialCount}건`);
  lines.push('');

  lines.push('[영역별 주요 관찰 내용]');
  const sorted = [...inRange].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  NURI_AREAS.forEach(area => {
    const rec = sorted.find(r => area.cats.includes(r.category));
    if (!rec) return;
    const text = (rec.observation || rec.rawText || '').trim();
    if (!text) return;
    lines.push(`· (${area.label}, ${formatDate(rec.date)}) ${text}`);
  });
  const specials = sorted.filter(r => r.category === 'special');
  if (specials.length > 0) {
    lines.push('');
    lines.push('[특이사항]');
    specials.slice(0, 5).forEach(r => {
      const text = (r.observation || r.rawText || '').trim();
      if (text) lines.push(`· (${formatDate(r.date)}) ${text}`);
    });
  }
  return lines.join('\n');
}

export default function PortfolioPage({ childId, childName, onBack, isDesktop }) {
  const [records, setRecords] = useState([]);
  const [reportPeriod, setReportPeriod] = useState('thisMonth');
  const [reportCopied, setReportCopied] = useState(false);
  // 발달평가서
  const [evalPeriod, setEvalPeriod] = useState('semester1');
  const [evalDoc, setEvalDoc] = useState(null);
  const [evalCopied, setEvalCopied] = useState(false);

  useEffect(() => {
    setRecords(getRecordsByChild(childId));
  }, [childId]);

  const avatarColor = getAvatarColor(childName);
  const catCounts = {};
  records.forEach(record => {
    const category = record.category || 'special';
    catCounts[category] = (catCounts[category] || 0) + 1;
  });

  // 6개 누리과정 영역 집계
  const areaCounts = NURI_AREAS.map(area => ({
    ...area,
    count: records.filter(r => area.cats.includes(r.category)).length,
  }));
  const specialCount = catCounts.special || 0;

  // 월간/학기 보고서
  const { reportText, reportRange } = useMemo(() => {
    const range = getPeriodRange(reportPeriod);
    return { reportText: buildChildReport(records, childName, range), reportRange: range };
  }, [records, childName, reportPeriod]);

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    addCopyHistory({ title: `${childName} 보고서 (${reportRange.label})`, text: reportText, source: 'portfolio' });
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 1600);
  };

  // ── 발달평가서 자동 생성 ──
  const handleGenerateEval = () => {
    const cl = getClasses()[0];
    const age = parseInt(cl?.age || '4', 10);
    const ageKey = ageKeyForClassAge(age);
    const range = getPeriodRange(evalPeriod);
    const cs = checklistSummary;
    const checksByArea = cs ? Object.fromEntries(cs.byArea.map(a => [a.name, { done: a.done, total: a.total }])) : {};
    const doc = buildDevelopmentReport({
      records, childName, className: cl?.name || '', ageKey, range, checksByArea,
    });
    setEvalDoc(doc);
  };

  const evalDocToText = (d) =>
    `${d.title}\n${d.badge || ''}\n\n` + (d.sections || []).map(s => `[${s.title}]\n${s.text}`).join('\n\n');

  const handleCopyEval = async () => {
    if (!evalDoc) return;
    const text = evalDocToText(evalDoc);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    addCopyHistory({ title: evalDoc.title, text, source: 'portfolio-eval' });
    setEvalCopied(true);
    setTimeout(() => setEvalCopied(false), 1600);
  };

  const handleWordEval = async () => {
    if (!evalDoc) return;
    try { await exportDocx(evalDoc); } catch {}
  };

  // 발달 체크리스트 현황 — 최근 6개월 중 체크 데이터가 있는 가장 최근 달
  const checklistSummary = useMemo(() => {
    const age = parseInt(getClasses()[0]?.age || '4', 10);
    const ageKey = ageKeyForClassAge(age);
    // 0~2세는 표준보육과정, 3세 이상은 누리과정 체크리스트 기준으로 집계
    const areas = (ageKey === 'age01' || ageKey === 'age2')
      ? getStandardChecklist(ageKey)
      : (NURI[age] || NURI[4]);
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const checks = loadChecks(childId, ym);
      if (Object.keys(checks).length === 0) continue;
      const byArea = Object.entries(areas).map(([name, items]) => ({
        name,
        done: items.filter(it => checks[it.id]).length,
        total: items.length,
      }));
      return {
        ym,
        byArea,
        done: byArea.reduce((s, a) => s + a.done, 0),
        total: byArea.reduce((s, a) => s + a.total, 0),
      };
    }
    return null;
  }, [childId]);

  // 전체 기록 타임라인 (월별 그룹, 최신순)
  const timeline = useMemo(() => {
    const sorted = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const groups = [];
    sorted.forEach(record => {
      const ym = record.date ? record.date.slice(0, 7) : '날짜 없음';
      const last = groups[groups.length - 1];
      if (last && last.ym === ym) last.items.push(record);
      else groups.push({ ym, items: [record] });
    });
    return groups;
  }, [records]);

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

      <SectionCard title="🌱 누리과정 6개 영역 분포">
        {totalRecs === 0 ? <EmptyMsg /> : (
          <>
            {areaCounts.map(area => {
              const pct = totalRecs > 0 ? Math.round((area.count / totalRecs) * 100) : 0;
              return (
                <div key={area.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: area.count > 0 ? area.color : 'var(--text-tertiary)' }}>
                      {area.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: area.count > 0 ? area.color : 'var(--text-tertiary)' }}>{area.count}건 ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: 8, background: area.count > 0 ? area.color : 'transparent', borderRadius: 100, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
            {specialCount > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                📋 특이사항 {specialCount}건은 영역 분포에서 제외돼요.
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="✅ 발달 체크리스트 현황">
        {!checklistSummary ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
            아직 체크한 항목이 없어요.<br />발달 체크 메뉴에서 체크하면 여기에 요약돼요.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)' }}>
                {parseInt(checklistSummary.ym.split('-')[1], 10)}월 기준
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary)' }}>
                {checklistSummary.done}/{checklistSummary.total} 달성
              </span>
            </div>
            {checklistSummary.byArea.map(area => {
              const colorInfo = AREA_COLORS[area.name] || { color: 'var(--primary)' };
              const pct = area.total > 0 ? Math.round((area.done / area.total) * 100) : 0;
              return (
                <div key={area.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colorInfo.color }}>
                      {colorInfo.emoji} {area.name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: colorInfo.color }}>{area.done}/{area.total}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: 8, background: colorInfo.color, borderRadius: 100, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </SectionCard>

      <SectionCard title="🌱 발달평가서 자동 생성">
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          누적 기록 · 표준보육과정 · 발달 체크 달성도를 합쳐 <b>학기별 발달평가서 초안</b>을 만들어요.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {REPORT_PERIODS.filter(p => p.key !== 'thisMonth' && p.key !== 'lastMonth').map(p => (
            <button key={p.key} onClick={() => { setEvalPeriod(p.key); setEvalDoc(null); }} style={{
              padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700,
              background: evalPeriod === p.key ? 'var(--cat-nature)' : 'var(--gray-100)',
              color: evalPeriod === p.key ? 'white' : 'var(--text-secondary)',
            }}>
              {p.label}
            </button>
          ))}
        </div>
        {!evalDoc ? (
          <button onClick={handleGenerateEval} style={{
            width: '100%', padding: '13px', borderRadius: 12, background: 'var(--cat-nature)', color: 'white',
            fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Sparkles size={16} /> 발달평가서 만들기
          </button>
        ) : (
          <>
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', maxHeight: 380, overflowY: 'auto', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 900, textAlign: 'center' }}>{evalDoc.title}</div>
              {evalDoc.badge && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 2, marginBottom: 10 }}>{evalDoc.badge}</div>}
              {evalDoc.sections.map((s, i) => (
                <div key={i} style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--cat-nature)', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.text}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopyEval} style={{ flex: 1, padding: '12px', borderRadius: 12, background: evalCopied ? 'var(--cat-play)' : 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {evalCopied ? <><Check size={15} /> 복사됨</> : <><Copy size={15} /> 복사</>}
              </button>
              <button onClick={handleWordEval} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#2B579A', color: 'white', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Download size={15} /> Word
              </button>
              <button onClick={() => setEvalDoc(null)} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 800 }}>
                다시
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
              실제 기록만으로 만든 초안이에요. 복사·Word로 내보내 검토 후 사용하세요.
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="📝 월간·학기 보고서">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {REPORT_PERIODS.map(p => (
            <button key={p.key} onClick={() => setReportPeriod(p.key)} style={{
              padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700,
              background: reportPeriod === p.key ? 'var(--primary)' : 'var(--gray-100)',
              color: reportPeriod === p.key ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{
          background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 16px', fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 360, overflowY: 'auto',
        }}>
          {reportText}
        </div>
        <button onClick={handleCopyReport} style={{
          marginTop: 12, width: '100%', padding: '12px', borderRadius: 12,
          background: reportCopied ? 'var(--cat-play)' : 'var(--primary)', color: 'white',
          fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {reportCopied ? <><Check size={16} /> 복사 완료!</> : <><Copy size={16} /> 보고서 복사하기</>}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <FileText size={12} /> 입력한 기록 사실만으로 구성돼요. 복사 후 한글·워드에 붙여넣어 다듬어 쓰세요.
        </div>
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

      <SectionCard title={`📚 전체 기록 타임라인 (${records.length}건)`}>
        {records.length === 0 ? <EmptyMsg /> : timeline.map(group => {
          const [gy, gm] = group.ym.includes('-') ? group.ym.split('-') : [null, null];
          const monthLabel = gy ? `${gy}년 ${parseInt(gm, 10)}월` : group.ym;
          return (
            <div key={group.ym} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary)' }}>{monthLabel}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 100 }}>{group.items.length}건</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {group.items.map(record => {
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
