import React, { useState, useMemo } from 'react';
import { getRecords, getChildren, getClasses, today, addDocumentDraft } from '../utils/storage';
import { buildWeeklyPlan, buildBatchNotices, buildWeeklySummary } from '../utils/planningDocs';
import { exportDocx } from '../utils/docxExport';
import { useToast } from '../components/Toast';
import { Sparkles, Copy, Check, Download, CalendarRange, MessageSquare, TrendingUp, Save } from 'lucide-react';

const AREA_COLORS = {
  '신체운동·건강': '#4CAF50', '의사소통': '#4F7FFF', '사회관계': '#9C27B0',
  '예술경험': '#E91E9A', '자연탐구': '#FF8C42',
};

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function docToText(d) { return `${d.title}\n${d.badge || ''}\n\n` + (d.sections || []).map(s => `[${s.title}]\n${s.text}`).join('\n\n'); }

export default function AutomationPage({ isDesktop }) {
  const showToast = useToast();
  const [tab, setTab] = useState('plan'); // 'plan' | 'notice' | 'summary'

  const records  = useMemo(() => getRecords(), []);
  const children = useMemo(() => getChildren(), []);
  const cl = getClasses()[0];

  // 최근 14일 기록 (계획·요약 기준)
  const now = new Date();
  const from14 = new Date(now); from14.setDate(from14.getDate() - 14);
  const recent = records.filter(r => r.date && r.date >= ymd(from14));
  const from7 = new Date(now); from7.setDate(from7.getDate() - 7);
  const week  = records.filter(r => r.date && r.date >= ymd(from7));
  const todayRecs = records.filter(r => r.date === today());

  const pad = isDesktop ? '32px 36px' : '20px';

  return (
    <div style={{ padding: pad, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={22} color="var(--primary)" /> 자동화 작업
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>기록을 모아 계획안·알림장·주간요약을 한 번에 만들어요.</div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['plan', '주간 계획안', CalendarRange], ['notice', '알림장 일괄', MessageSquare], ['summary', '주간 요약·코칭', TrendingUp]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 100, fontSize: 13, fontWeight: 800,
            background: tab === k ? 'var(--primary)' : 'white', color: tab === k ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${tab === k ? 'var(--primary)' : 'var(--border)'}`,
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'plan'    && <WeeklyPlanTab recent={recent} cl={cl} showToast={showToast} />}
      {tab === 'notice'  && <BatchNoticeTab todayRecs={todayRecs} showToast={showToast} />}
      {tab === 'summary' && <WeeklySummaryTab week={week} children={children} showToast={showToast} />}
    </div>
  );
}

// ── 주간 계획안 ──
function WeeklyPlanTab({ recent, cl, showToast }) {
  const [doc, setDoc] = useState(null);
  const [copied, setCopied] = useState(false);
  const generate = () => {
    const d = new Date(); const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + 7); // 다음 주 월요일
    const weekLabel = `${monday.getMonth() + 1}월 ${Math.ceil(monday.getDate() / 7)}주`;
    setDoc(buildWeeklyPlan({ recentRecords: recent, className: cl?.name, classAge: cl?.age, weekLabel }));
  };
  const copy = () => { navigator.clipboard?.writeText(docToText(doc)).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); showToast('복사했어요 📋', 'success'); };
  const save = () => { addDocumentDraft({ title: doc.title, badge: doc.badge, sections: doc.sections, docType: 'weekplan', source: 'automation' }); showToast('문서함에 저장했어요 📁', 'success'); };

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        최근 2주 기록 흐름 + 계절 + 표준보육과정을 바탕으로 <b>다음 주 놀이 계획안</b>을 제안해요. (부족했던 영역을 자동으로 보완)
      </div>
      {!doc ? (
        <GenerateButton onClick={generate} label="다음 주 계획안 만들기" />
      ) : (
        <DocResult doc={doc} accent="var(--primary)" onCopy={copy} copied={copied} onWord={() => exportDocx(doc).catch(() => {})} onSave={save} onReset={() => setDoc(null)} />
      )}
    </div>
  );
}

// ── 알림장 일괄 ──
function BatchNoticeTab({ todayRecs, showToast }) {
  const [batch, setBatch] = useState(null);
  const generate = () => setBatch(buildBatchNotices({ records: todayRecs, date: today() }));
  const copyAll = () => {
    const text = batch.notices.map(n => `[${n.name}]\n${n.text}`).join('\n\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    showToast('전체 복사했어요 📋', 'success');
  };
  const copyOne = (n) => { navigator.clipboard?.writeText(n.text).catch(() => {}); showToast(`${n.name} 알림장 복사`, 'success'); };

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        오늘 기록한 아이들의 <b>알림장 문구를 한 번에</b> 만들어요. 아이별로 복사해 알림장에 붙여넣으세요.
      </div>
      {todayRecs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>오늘 작성한 기록이 아직 없어요. 기록을 먼저 남겨주세요.</div>
      ) : !batch ? (
        <GenerateButton onClick={generate} label={`오늘 알림장 일괄 만들기 (${new Set(todayRecs.map(r => r.childName)).size}명)`} />
      ) : (
        <>
          <button onClick={copyAll} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            <Copy size={15} /> 전체 복사
          </button>
          {batch.notices.map(n => (
            <div key={n.name} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 15px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)' }}>{n.name}</span>
                <button onClick={() => copyOne(n)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800 }}>
                  <Copy size={13} /> 복사
                </button>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>{n.text}</div>
            </div>
          ))}
          <button onClick={() => setBatch(null)} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 800, marginTop: 4 }}>다시 만들기</button>
        </>
      )}
    </div>
  );
}

// ── 주간 요약·코칭 ──
function WeeklySummaryTab({ week, children, showToast }) {
  const summary = useMemo(() => buildWeeklySummary({ weekRecords: week, children }), [week, children]);
  const maxCount = Math.max(...Object.values(summary.areaCounts), 1);
  return (
    <div>
      <div style={{ background: 'var(--primary-light)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)', lineHeight: 1.6 }}>📊 {summary.headline}</div>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>영역별 기록 (최근 7일)</div>
        {Object.entries(summary.areaCounts).map(([area, n]) => (
          <div key={area} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: AREA_COLORS[area] }}>{area}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: AREA_COLORS[area] }}>{n}건</span>
            </div>
            <div style={{ height: 7, background: 'var(--gray-100)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: 7, width: `${(n / maxCount) * 100}%`, background: AREA_COLORS[area], borderRadius: 100, transition: 'width 0.5s' }} />
            </div>
          </div>
        ))}
      </div>

      {summary.tips.length > 0 && (
        <div style={{ background: '#FFF8E1', border: '1px solid #F5C518', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#E07B2E', marginBottom: 8 }}>💡 이번 주 보완 제안</div>
          {summary.tips.map((t, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>{t}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 공통 컴포넌트 ──
function GenerateButton({ onClick, label }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '15px', borderRadius: 14,
      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white',
      fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: '0 8px 24px rgba(79,127,255,0.3)',
    }}>
      <Sparkles size={18} /> {label}
    </button>
  );
}

function DocResult({ doc, accent, onCopy, copied, onWord, onSave, onReset }) {
  return (
    <>
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', maxHeight: 420, overflowY: 'auto', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900, textAlign: 'center' }}>{doc.title}</div>
        {doc.badge && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 2, marginBottom: 12 }}>{doc.badge}</div>}
        {doc.sections.map((s, i) => (
          <div key={i} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: accent, marginBottom: 5 }}>{s.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{s.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCopy} style={{ flex: 1, padding: '12px', borderRadius: 12, background: copied ? 'var(--cat-play)' : 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {copied ? <><Check size={15} /> 복사됨</> : <><Copy size={15} /> 복사</>}
        </button>
        <button onClick={onWord} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#2B579A', color: 'white', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Download size={15} /> Word
        </button>
        <button onClick={onSave} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--white)', border: '2px solid var(--primary)', color: 'var(--primary)', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Save size={14} /> 저장
        </button>
        <button onClick={onReset} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 800 }}>다시</button>
      </div>
    </>
  );
}
