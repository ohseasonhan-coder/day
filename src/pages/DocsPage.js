﻿﻿﻿﻿import React, { useState, useEffect } from 'react';
import { getRecordsByDate, getClasses, today, formatDateKo, CATEGORIES } from '../utils/storage';
import { generateDailyJournal } from '../utils/ai';
import { FileText, Sparkles, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DocsPage({ onNavigate }) {
  const [viewDate, setViewDate] = useState(today());
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('journal'); // 'journal' | 'records'

  useEffect(() => {
    const recs = getRecordsByDate(viewDate);
    setRecords(recs);
    setClasses(getClasses());
    setJournal(null);
  }, [viewDate]);

  const cl = classes[0];

  const changeDate = (delta) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const handleGenerateJournal = async () => {
    if (records.length === 0) return alert('???좎쭨??湲곕줉???놁뼱?? 癒쇱? 湲곕줉???④꺼二쇱꽭??');
    setLoading(true);
    try {
      const res = await generateDailyJournal({
        records,
        date: viewDate,
        classAge: cl?.age,
        className: cl?.name,
      });
      setJournal(res);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isToday = viewDate === today();

  return (
    <div style={{ padding: '20px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>보육일지</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>湲곕줉??諛뷀깢?쇰줈 臾몄꽌瑜??먮룞 ?앹꽦?댁슂</div>

      {/* Date Navigator */}
      <div style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <button onClick={() => changeDate(-1)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{formatDateKo(viewDate)}</div>
          <div style={{ fontSize: 12, color: isToday ? 'var(--primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 600 : 400 }}>
            {isToday ? '?ㅻ뒛' : viewDate}
          </div>
        </div>
        <button onClick={() => changeDate(1)} style={{ color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }} disabled={isToday}>
          <ChevronRight size={20} style={{ opacity: isToday ? 0.3 : 1 }} />
        </button>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['journal', '?뱞 蹂댁쑁?쇱?'], ['records', `?뱷 湲곕줉 ${records.length}건`]].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 500,
              background: activeTab === tab ? 'var(--primary)' : 'var(--gray-100)',
              color: activeTab === tab ? 'white' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Journal Tab */}
      {activeTab === 'journal' && (
        <div>
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>?뱥</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>오늘 기록이 없어요</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>먼저 기록 탭에서 관찰기록을 남겨주세요</div>
              <button
                onClick={() => onNavigate('record')}
                style={{ padding: '12px 24px', background: 'var(--primary)', color: 'white', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none' }}
              >
                湲곕줉 ?④린??媛湲?              </button>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{records.length}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>嫄댁쓽 愿李?湲곕줉</div>
                  <div style={{ fontSize: 12, color: 'var(--primary)', opacity: 0.7 }}>
                    {[...new Set(records.map(r => r.childName))].join(', ')}
                  </div>
                </div>
              </div>

              {!journal && (
                <button
                  onClick={handleGenerateJournal}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14,
                    background: loading ? 'var(--gray-300)' : 'var(--primary)',
                    color: 'white', fontSize: 15, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: loading ? 'none' : '0 4px 16px rgba(79,127,255,0.3)',
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    marginBottom: 20,
                  }}
                >
                  {loading ? (
                    <><Spinner /> 蹂댁쑁?쇱? ?묒꽦 以?..</>
                  ) : (
                    <><Sparkles size={18} /> AI濡?蹂댁쑁?쇱? 珥덉븞 ?앹꽦</>
                  )}
                </button>
              )}

              {journal && (
                <div className="slide-up">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <FileText size={18} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: 16 }}>蹂댁쑁?쇱? 珥덉븞</span>
                    <span style={{ fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 100, fontWeight: 600 }}>
                      AI ?앹꽦
                    </span>
                  </div>

                  <JournalSection title="?렜 ????먮쫫 諛??쒕룞" text={journal.playFlow} />
                  <JournalSection title="?뫔 ?좎븘 諛섏쓳" text={journal.childResponse} />
              <JournalSection title="교사 지원" text={journal.teacherSupport} />
                  <JournalSection title="?뱤 ?ㅻ뒛 ?됯?" text={journal.evaluation} />
              <JournalSection title="다음 지원계획" text={journal.nextPlan} accent />

                  <CopyAllButton journal={journal} date={viewDate} cl={cl} />

                  <button
                    onClick={() => { setJournal(null); handleGenerateJournal(); }}
                    style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none' }}
                  >
                    ?ㅼ떆 ?앹꽦?섍린
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div>
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
              ????湲곕줉???놁뼱??            </div>
          ) : (
            records.map(r => {
              const cat = CATEGORIES[r.category] || CATEGORIES.special;
              return (
                <div key={r.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.childName}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, background: cat.bg, padding: '3px 10px', borderRadius: 100 }}>
                      {cat.emoji} {cat.label}
                    </span>
                  </div>
                  {r.observation && (
                    <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>{r.observation}</div>
                  )}
                  {r.parent && (
                    <div style={{ fontSize: 13, color: 'var(--primary)', background: 'var(--primary-light)', padding: '8px 12px', borderRadius: 8, lineHeight: 1.6 }}>
                      ?뮠 {r.parent}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function JournalSection({ title, text, accent }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div style={{
      background: accent ? 'var(--primary-light)' : 'white',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 12, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', background: 'transparent', border: 'none' }}>
          {copied ? <><Check size={11} /> 蹂듭궗</> : <><Copy size={11} /> 蹂듭궗</>}
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)' }}>{text}</div>
    </div>
  );
}

function CopyAllButton({ journal, date, cl }) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    const text = `蹂댁쑁?쇱? (${date})\n${cl?.name || ''} ${cl?.age ? cl.age + '?몃컲' : ''}\n\n` +
      `??????먮쫫\n${journal.playFlow}\n\n` +
      `???좎븘 諛섏쓳\n${journal.childResponse}\n\n` +
      `??援먯궗 吏??n${journal.teacherSupport}\n\n` +
      `???됯?\n${journal.evaluation}\n\n` +
      `???ㅼ쓬 吏?먭퀎??n${journal.nextPlan}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopyAll} style={{
      width: '100%', padding: '13px', borderRadius: 12, background: 'var(--gray-800)', color: 'white',
      fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: 'pointer', border: 'none', marginTop: 4,
    }}>
      {copied ? <><Check size={16} /> ?꾩껜 蹂듭궗??</> : <><Copy size={16} /> ?꾩껜 蹂듭궗 (?쒓?/?뚮뱶??遺숈뿬?ｊ린)</>}
    </button>
  );
}

function Spinner() {
  return <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}
