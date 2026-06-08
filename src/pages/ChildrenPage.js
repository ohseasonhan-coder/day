﻿﻿﻿﻿import React, { useState, useEffect } from 'react';
import { getChildren, getRecordsByChild, getClasses, CATEGORIES, formatDate, genId, saveChildren, getChildren as reloadChildren } from '../utils/storage';
import { generateGrowthSummary, generateConsultDoc } from '../utils/ai';
import { ChevronRight, Plus, Search, Sparkles, Copy, Check, X, User } from 'lucide-react';

export default function ChildrenPage({ onNavigate }) {
  const [children, setChildren] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [period, setPeriod] = useState('1month');
  const [summary, setSummary] = useState(null);
  const [consultDoc, setConsultDoc] = useState(null);
  const [loadingSum, setLoadingSum] = useState(false);
  const [loadingConsult, setLoadingConsult] = useState(false);
  const [classes, setClasses] = useState([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  useEffect(() => {
    setChildren(getChildren());
    setClasses(getClasses());
  }, []);

  const filtered = children.filter(c => c.name.includes(search));
  const cl = classes[0];

  const selectChild = (child) => {
    setSelected(child);
    const recs = getRecordsByChild(child.id);
    // Filter by period
    const now = new Date();
    const days = period === '1month' ? 30 : period === '3months' ? 90 : period === '6months' ? 180 : 365;
    const filtered = recs.filter(r => (now - new Date(r.date)) / 86400000 <= days);
    setRecords(filtered);
    setSummary(null);
    setConsultDoc(null);
  };

  const handleGenerateSummary = async () => {
    if (!selected) return;
    setLoadingSum(true);
    try {
      const recs = getRecordsByChild(selected.id);
      const res = await generateGrowthSummary({
        childName: selected.name,
        records: recs,
        period: PERIOD_LABELS[period],
        childAge: cl?.age,
      });
      setSummary(res);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingSum(false);
    }
  };

  const handleGenerateConsult = async () => {
    if (!selected) return;
    setLoadingConsult(true);
    try {
      const recs = getRecordsByChild(selected.id);
      const res = await generateConsultDoc({
        childName: selected.name,
        records: recs,
        childAge: cl?.age,
      });
      setConsultDoc(res);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingConsult(false);
    }
  };

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    const ch = reloadChildren();
    const newChild = { id: genId(), name: newChildName.trim(), classId: cl?.id };
    saveChildren([...ch, newChild]);
    setChildren([...ch, newChild]);
    setNewChildName('');
    setShowAddChild(false);
  };

  if (selected) {
    const catCounts = {};
    records.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    return (
      <div style={{ padding: '20px' }}>
        {/* Back + Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setSelected(null)} style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={18} />
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{selected.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>湲곕줉 {records.length}占?쨌 {PERIOD_LABELS[period]}</div>
          </div>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {Object.entries(PERIOD_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { setPeriod(k); selectChild(selected); }}
              style={{
                padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500,
                background: period === k ? 'var(--primary)' : 'var(--gray-100)',
                color: period === k ? 'white' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Category breakdown */}
        {sortedCats.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>移댄뀒怨좊━占?湲곕줉</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sortedCats.map(([cat, count]) => {
                const catMeta = CATEGORIES[cat] || CATEGORIES.special;
                return (
                  <div key={cat} style={{
                    background: catMeta.bg, color: catMeta.color,
                    padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {catMeta.emoji} {catMeta.label}
                    <span style={{ background: catMeta.color, color: 'white', width: 20, height: 20, borderRadius: '50%', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <AIButton
            icon={<Sparkles size={16} />}
            label="?占쎌옣 ?占쎌빟"
            loading={loadingSum}
            onClick={handleGenerateSummary}
          />
          <AIButton
            icon={<Sparkles size={16} />}
            label="?占쎈떞?占쎈즺 ?占쎌꽦"
            loading={loadingConsult}
            onClick={handleGenerateConsult}
            accent
          />
        </div>

        {/* Growth Summary */}
        {summary && (
          <div style={{ marginBottom: 20 }} className="slide-up">
            <SectionTitle>?占쎌옣 ?占쎌빟</SectionTitle>
            <CopyCard title="전체 요약" text={summary.overall} />
            <CopyCard title="媛뺤젏" text={summary.strengths} />
            <CopyCard title="지원이 필요한 부분" text={summary.support} />
            <CopyCard title="부모상담 문장" text={summary.parentMessage} accent />
          </div>
        )}

        {/* Consultation Doc */}
        {consultDoc && (
          <div style={{ marginBottom: 20 }} className="slide-up">
            <SectionTitle>?占쎈떞?占쎈즺</SectionTitle>
            <CopyCard title="理쒓렐 ?占쎌옣 ?占쎈쫫" text={consultDoc.recentGrowth} />
            <CopyCard title="媛뺤젏" text={consultDoc.strengths} />
            <CopyCard title="媛???占쎄퀎 ?占쎌븞" text={consultDoc.homeLinks} />
            <CopyCard title="상담 시작 인사말" text={consultDoc.openingMessage} accent />
          </div>
        )}

        {/* Record List */}
        <SectionTitle>湲곕줉 紐⑸줉</SectionTitle>
        {records.length === 0 ? (
          <EmptyState text="이 기간의 기록이 없어요" />
        ) : (
          records.map(r => <RecordCard key={r.id} record={r} />)
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>아이들</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{children.length}명</div>
        </div>
        <button onClick={() => setShowAddChild(!showAddChild)} style={{
          background: 'var(--primary)', color: 'white', width: 36, height: 36,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Plus size={18} />
        </button>
      </div>

      {showAddChild && (
        <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: 16, marginBottom: 16 }} className="slide-up">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newChildName}
              onChange={e => setNewChildName(e.target.value)}
              placeholder="?占쎌씠 ?占쎈쫫 ?占쎈젰"
              onKeyDown={e => e.key === 'Enter' && handleAddChild()}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--primary)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={handleAddChild} style={{ background: 'var(--primary)', color: 'white', padding: '0 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 14 }}>
              異뷂옙?
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
                    placeholder="아이 이름으로 검색"
          style={{ width: '100%', padding: '11px 16px 11px 38px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white', color: 'var(--text-primary)' }}
        />
      </div>

      {filtered.map(child => {
        const recs = getRecordsByChild(child.id);
        const lastRec = recs[0];
        const catCounts = {};
        recs.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
        const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topCatMeta = topCat ? CATEGORIES[topCat] : null;

        return (
          <button
            key={child.id}
            onClick={() => selectChild(child)}
            style={{
              width: '100%', background: 'white', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: topCatMeta?.bg || 'var(--gray-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {topCatMeta?.emoji || <User size={20} color="var(--gray-400)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{child.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                湲곕줉 {recs.length}占?{lastRec ? `쨌 理쒓렐 ${formatDate(lastRec.date)}` : '쨌 湲곕줉 ?占쎌쓬'}
              </div>
              {topCatMeta && (
                <div style={{ fontSize: 11, color: topCatMeta.color, marginTop: 3, fontWeight: 500 }}>
                  {topCatMeta.emoji} {topCatMeta.label} 湲곕줉??媛??留롮븘??                </div>
              )}
            </div>
            <ChevronRight size={16} color="var(--text-tertiary)" />
          </button>
        );
      })}

        {filtered.length === 0 && <EmptyState text="해당하는 아이가 없어요" />}
    </div>
  );
}

const PERIOD_LABELS = {
  '1month': '理쒓렐 1媛쒖썡',
  '3months': '理쒓렐 3媛쒖썡',
  '6months': '理쒓렐 6媛쒖썡',
  '1year': '1???占쎌껜',
};

function SectionTitle({ children }) {
  return <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>{children}</div>;
}

function AIButton({ icon, label, loading, onClick, accent }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
      background: accent ? 'var(--primary)' : 'var(--gray-100)',
      color: accent ? 'white' : 'var(--text-secondary)',
      fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      boxShadow: accent ? '0 4px 12px rgba(79,127,255,0.25)' : 'none',
    }}>
      {loading
        ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: accent ? 'white' : 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        : icon
      }
      {label}
    </button>
  );
}

function CopyCard({ title, text, accent }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;

  const textStr = Array.isArray(text) ? text.join('\n') : text;
  const handleCopy = () => {
    navigator.clipboard.writeText(textStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: accent ? 'var(--primary-light)' : 'white',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 12, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <button onClick={handleCopy} style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', background: 'transparent', border: 'none' }}>
          {copied ? <><Check size={11} /> 蹂듭궗</> : <><Copy size={11} /> 蹂듭궗</>}
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{textStr}</div>
    </div>
  );
}

function RecordCard({ record }) {
  const cat = CATEGORIES[record.category] || CATEGORIES.special;
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, background: cat.bg, padding: '3px 10px', borderRadius: 100 }}>
          {cat.emoji} {cat.label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(record.date)}</span>
      </div>
      {record.observation && (
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)' }}>{record.observation}</div>
      )}
      {record.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {record.tags.map(tag => (
            <span key={tag} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 100 }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '40px 0' }}>
      {text}
    </div>
  );
}
