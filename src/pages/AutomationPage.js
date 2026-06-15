import React, { useState, useMemo } from 'react';
import { getRecords, getChildren, getClasses, today, addDocumentDraft } from '../utils/storage';
import { buildWeeklyPlan, buildBatchNotices, buildWeeklySummary,
  dailyJournalToDoc, batchNoticesToDoc, buildMonthlyEvaluation, buildChildrenMonthlyDigest, buildMonthlyNewsletter } from '../utils/planningDocs';
import { generateDailyJournal } from '../utils/ai';
import { buildAccreditationReadiness } from '../utils/accreditation';
import { exportDocx } from '../utils/docxExport';
import { useToast } from '../components/Toast';
import { Sparkles, Copy, Check, Download, CalendarRange, MessageSquare, TrendingUp, Save, Zap, FileText, ShieldCheck } from 'lucide-react';

const AREA_COLORS = {
  '신체운동·건강': '#4CAF50', '의사소통': '#4F7FFF', '사회관계': '#9C27B0',
  '예술경험': '#E91E9A', '자연탐구': '#FF8C42',
};

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function docToText(d) { return `${d.title}\n${d.badge || ''}\n\n` + (d.sections || []).map(s => `[${s.title}]\n${s.text}`).join('\n\n'); }

export default function AutomationPage({ isDesktop, context }) {
  const showToast = useToast();
  const [tab, setTab] = useState(context?.tab || 'oneclick'); // 'oneclick' | 'plan' | 'notice' | 'summary'

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
        {[['oneclick', '원클릭 일괄', Zap], ['plan', '주간 계획안', CalendarRange], ['notice', '알림장 일괄', MessageSquare], ['summary', '주간 요약·코칭', TrendingUp], ['accredit', '평가제 준비', ShieldCheck]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 100, fontSize: 13, fontWeight: 800,
            background: tab === k ? 'var(--primary)' : 'white', color: tab === k ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${tab === k ? 'var(--primary)' : 'var(--border)'}`,
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'oneclick' && <OneClickTab records={records} children={children} cl={cl} todayRecs={todayRecs} showToast={showToast} />}
      {tab === 'plan'    && <WeeklyPlanTab recent={recent} cl={cl} showToast={showToast} />}
      {tab === 'notice'  && <BatchNoticeTab todayRecs={todayRecs} showToast={showToast} />}
      {tab === 'summary' && <WeeklySummaryTab week={week} children={children} showToast={showToast} />}
      {tab === 'accredit' && <AccreditTab />}
    </div>
  );
}

// ── 원클릭 일괄 ──
function OneClickTab({ records, children, cl, todayRecs, showToast }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { kind, docs:[{title}] }

  const monthRange = () => {
    const d = new Date();
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`;
    return { from, to, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` };
  };

  const runDaily = async () => {
    if (todayRecs.length === 0) { showToast('오늘 작성한 기록이 없어요.', 'error'); return; }
    setBusy(true);
    try {
      const journal = await generateDailyJournal({ records: todayRecs, date: today(), classAge: cl?.age, className: cl?.name });
      const journalDoc = dailyJournalToDoc(journal, { className: cl?.name, date: today() });
      const noticeDoc = batchNoticesToDoc(buildBatchNotices({ records: todayRecs, date: today() }), { className: cl?.name });
      [journalDoc, noticeDoc].forEach(doc => addDocumentDraft({ ...doc, source: 'oneclick' }));
      setResult({ kind: '오늘 마감', docs: [journalDoc, noticeDoc] });
      showToast('보육일지·알림장을 만들어 문서함에 저장했어요 📁', 'success');
    } catch { showToast('생성 중 오류가 발생했어요.', 'error'); }
    finally { setBusy(false); }
  };

  const runMonthly = () => {
    const range = monthRange();
    const monthRecs = records.filter(r => r.date && r.date >= range.from && r.date <= range.to);
    if (monthRecs.length === 0) { showToast('이달 기록이 없어요.', 'error'); return; }
    setBusy(true);
    try {
      const evalDoc = buildMonthlyEvaluation({ monthRecords: monthRecs, className: cl?.name, monthLabel: range.label });
      const digestDoc = buildChildrenMonthlyDigest({ records, children, range, monthLabel: range.label, className: cl?.name });
      const newsletterDoc = { title: `${range.label.split('년 ')[1]} 가정통신문`, badge: range.label, docType: 'newsletter', sections: [{ title: '가정통신문', text: buildMonthlyNewsletter({ className: cl?.name }) }] };
      [evalDoc, digestDoc, newsletterDoc].forEach(doc => addDocumentDraft({ ...doc, source: 'oneclick' }));
      setResult({ kind: '이달 마감', docs: [evalDoc, digestDoc, newsletterDoc] });
      showToast('월간평가·아이별 요약·통신문을 문서함에 저장했어요 📁', 'success');
    } catch { showToast('생성 중 오류가 발생했어요.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
        버튼 한 번으로 여러 문서를 <b>한꺼번에 만들어 문서함에 저장</b>해요. 화면 이동 없이 끝나요.
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>📅 오늘 마감</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
          오늘 기록 {todayRecs.length}건 → <b>보육일지</b> + <b>아이별 알림장</b>을 자동 생성·저장
        </div>
        <button onClick={runDaily} disabled={busy} style={{
          width: '100%', padding: '14px', borderRadius: 12, background: busy ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
          color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Zap size={17} /> {busy ? '만드는 중…' : '오늘 문서 한 번에 만들기'}
        </button>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>🗓️ 이달 마감</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
          이달 기록 → <b>월간 놀이평가</b> + <b>아이별 월간 요약</b> + <b>가정통신문</b>을 자동 생성·저장
        </div>
        <button onClick={runMonthly} disabled={busy} style={{
          width: '100%', padding: '14px', borderRadius: 12, background: busy ? 'var(--gray-300)' : 'var(--cat-nature)',
          color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Zap size={17} /> {busy ? '만드는 중…' : '이달 문서 한 번에 만들기'}
        </button>
      </div>

      {result && (
        <div style={{ background: '#E8F5E9', border: '1px solid #4CAF50', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#2E7D32', marginBottom: 8 }}>✅ {result.kind} — {result.docs.length}개 문서를 문서함에 저장했어요</div>
          {result.docs.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-primary)', padding: '3px 0' }}>
              <FileText size={14} color="#388E3C" /> {d.title}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>문서함에서 열어 검토·수정 후 복사·Word로 내보내세요.</div>
        </div>
      )}
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

// ── 평가제 준비 ──
function AccreditTab() {
  const data = useMemo(() => buildAccreditationReadiness(), []);
  return (
    <div>
      <div style={{ background: 'var(--primary-light)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)' }}>🛡️ 평가 준비도 {data.overall}% ({data.doneItems}/{data.totalItems} 항목 충족)</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
          앱에 쌓인 기록·문서를 어린이집 평가 4개 영역에 자동으로 연결했어요. 부족한 항목을 채워보세요.
        </div>
      </div>

      {data.areas.map(area => (
        <div key={area.key} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 900 }}>{area.title}</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: area.percent === 100 ? 'var(--cat-play)' : 'var(--primary)', background: area.percent === 100 ? 'var(--cat-play-light)' : 'var(--primary-light)', borderRadius: 100, padding: '4px 10px' }}>{area.percent}%</span>
          </div>
          {area.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: it.ok ? 'var(--cat-play)' : 'var(--gray-200)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {it.ok ? <Check size={13} /> : <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-tertiary)' }}>!</span>}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: it.ok ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {it.label} <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>({it.count}건)</span>
                </div>
                {!it.ok && <div style={{ fontSize: 11.5, color: '#E07B2E', marginTop: 2, lineHeight: 1.5 }}>{it.hint}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
        ※ 실제 평가지표는 기관 상황·연도별 지침에 따라 다를 수 있어요. 준비 현황 참고용으로 사용하세요.
      </div>
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
