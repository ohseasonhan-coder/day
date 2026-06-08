import React, { useState, useEffect } from 'react';
import { getChildren, getRecordsByChild, getClasses, CATEGORIES, formatDate, genId, saveChildren, getChildren as reloadChildren, updateRecord, deleteRecord } from '../utils/storage';
import { generateGrowthSummary, generateConsultDoc } from '../utils/ai';
import { ChevronRight, Plus, Search, Sparkles, Copy, Check, X, User, FileText, BarChart3, Pencil, Trash2, Save } from 'lucide-react';

const PERIOD_LABELS = {
  '1month': '최근 1개월',
  '3months': '최근 3개월',
  '6months': '최근 6개월',
  '1year': '최근 1년',
};

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

  const loadRecords = (child, nextPeriod = period) => {
    const recs = getRecordsByChild(child.id);
    const now = new Date();
    const days = nextPeriod === '1month' ? 30 : nextPeriod === '3months' ? 90 : nextPeriod === '6months' ? 180 : 365;
    return recs.filter(r => (now - new Date(r.date)) / 86400000 <= days);
  };

  const selectChild = (child, nextPeriod = period) => {
    setSelected(child);
    setRecords(loadRecords(child, nextPeriod));
    setSummary(null);
    setConsultDoc(null);
  };

  const handlePeriodChange = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (selected) selectChild(selected, nextPeriod);
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
      alert(e.message || '성장 요약 생성 중 오류가 발생했어요.');
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
      alert(e.message || '상담자료 생성 중 오류가 발생했어요.');
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

  const refreshSelectedRecords = () => {
    if (!selected) return;
    setRecords(loadRecords(selected));
  };

  if (selected) {
    const catCounts = {};
    records.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const lastRecord = records[0];

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={() => setSelected(null)} style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={18} /> 목록
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.7px' }}>{selected.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              기록 {records.length}건 · {PERIOD_LABELS[period]} {lastRecord ? `· 최근 ${formatDate(lastRecord.date)}` : ''}
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', borderRadius: 18, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BarChart3 size={18} />
            <span style={{ fontSize: 15, fontWeight: 900 }}>개인화 성장 리포트</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <MiniStat label="누적 기록" value={`${records.length}건`} />
            <MiniStat label="영역 수" value={`${sortedCats.length}개`} />
            <MiniStat label="대표 영역" value={sortedCats[0] ? CATEGORIES[sortedCats[0][0]]?.label : '-'} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
          {Object.entries(PERIOD_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => handlePeriodChange(k)}
              style={{
                padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 800,
                background: period === k ? 'var(--primary)' : 'var(--gray-100)',
                color: period === k ? 'white' : 'var(--text-secondary)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {sortedCats.length > 0 && (
          <Card title="카테고리별 기록 균형">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sortedCats.map(([cat, count]) => {
                const catMeta = CATEGORIES[cat] || CATEGORIES.special;
                return (
                  <div key={cat} style={{
                    background: catMeta.bg, color: catMeta.color,
                    padding: '7px 13px', borderRadius: 100, fontSize: 13, fontWeight: 800,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {catMeta.emoji} {catMeta.label}
                    <span style={{ background: catMeta.color, color: 'white', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 100, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <AIButton
            icon={<Sparkles size={16} />}
            label="성장 요약"
            sub="발달평가 기반"
            loading={loadingSum}
            onClick={handleGenerateSummary}
          />
          <AIButton
            icon={<FileText size={16} />}
            label="상담자료"
            sub="가정연계 문장"
            loading={loadingConsult}
            onClick={handleGenerateConsult}
            accent
          />
        </div>

        {summary && (
          <div style={{ marginBottom: 18 }} className="slide-up">
            <SectionTitle>성장 요약</SectionTitle>
            <CopyCard title="전체 요약" text={summary.overall} />
            <CopyCard title="강점" text={summary.strengths} />
            <CopyCard title="지원이 필요한 부분" text={summary.support} />
            <CopyCard title="부모상담 문장" text={summary.parentMessage} accent />
            <CopyCard title="다음 지원계획" text={summary.nextSteps} />
          </div>
        )}

        {consultDoc && (
          <div style={{ marginBottom: 18 }} className="slide-up">
            <SectionTitle>부모상담자료</SectionTitle>
            <CopyCard title="상담 시작 인사말" text={consultDoc.openingMessage} accent />
            <CopyCard title="최근 성장 흐름" text={consultDoc.recentGrowth} />
            <CopyCard title="강점" text={consultDoc.strengths} />
            <CopyCard title="지원이 필요한 부분" text={consultDoc.supportNeeded} />
            <CopyCard title="가정 연계 제안" text={consultDoc.homeLinks} />
            <CopyCard title="교사 지원 방향" text={consultDoc.teacherSupport} />
          </div>
        )}

        <SectionTitle>기록 목록</SectionTitle>
        {records.length === 0 ? (
          <EmptyState text="이 기간의 기록이 없어요" action="기록 추가하기" onAction={() => onNavigate('record', { childId: selected.id })} />
        ) : (
          records.map(r => <RecordCard key={r.id} record={r} onChange={refreshSelectedRecords} />)
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
            <Sparkles size={13} /> 아이별 개인화
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.7px' }}>아이들</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{children.length}명 · 기록 기반 성장관리</div>
        </div>
        <button onClick={() => setShowAddChild(!showAddChild)} style={{
          background: 'var(--primary)', color: 'white', width: 42, height: 42,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 18px rgba(79,127,255,0.28)',
        }}>
          <Plus size={20} />
        </button>
      </div>

      {showAddChild && (
        <div style={{ background: 'var(--primary-light)', borderRadius: 14, padding: 16, marginBottom: 16 }} className="slide-up">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newChildName}
              onChange={e => setNewChildName(e.target.value)}
              placeholder="아이 이름 입력"
              onKeyDown={e => e.key === 'Enter' && handleAddChild()}
              style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--primary)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={handleAddChild} style={{ background: 'var(--primary)', color: 'white', padding: '0 16px', borderRadius: 12, fontWeight: 800, fontSize: 14 }}>
              추가
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 14, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <DashboardStat label="전체 아이" value={`${children.length}명`} />
          <DashboardStat label="누적 기록" value={`${children.reduce((sum, c) => sum + getRecordsByChild(c.id).length, 0)}건`} />
          <DashboardStat label="자동 문서" value="상담·평가" />
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="아이 이름으로 검색"
          style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}
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
              borderRadius: 16, padding: '15px 16px', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: 'var(--shadow-sm)', textAlign: 'left',
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: topCatMeta?.bg || 'var(--gray-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {topCatMeta?.emoji || <User size={20} color="var(--gray-400)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 3 }}>{child.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                기록 {recs.length}건{lastRec ? ` · 최근 ${formatDate(lastRec.date)}` : ' · 아직 기록 없음'}
              </div>
              {topCatMeta && (
                <div style={{ fontSize: 11, color: topCatMeta.color, marginTop: 4, fontWeight: 800 }}>
                  {topCatMeta.emoji} {topCatMeta.label} 기록이 가장 많아요
                </div>
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

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.75 }}>{label}</div>
    </div>
  );
}

function DashboardStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12, color: 'var(--text-primary)' }}>{children}</div>;
}

function Card({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function AIButton({ icon, label, sub, loading, onClick, accent }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      padding: '13px 12px', borderRadius: 15, border: 'none',
      background: accent ? 'var(--primary)' : 'white',
      color: accent ? 'white' : 'var(--text-primary)',
      fontSize: 13, fontWeight: 900,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      boxShadow: accent ? '0 8px 18px rgba(79,127,255,0.25)' : 'var(--shadow-sm)',
      minHeight: 72,
    }}>
      {loading
        ? <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: accent ? 'white' : 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        : icon
      }
      <span>{label}</span>
      <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{sub}</span>
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
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{
      background: accent ? 'var(--primary-light)' : 'white',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 15, padding: 15, marginBottom: 10,
      boxShadow: accent ? '0 8px 18px rgba(79,127,255,0.08)' : 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <button onClick={handleCopy} style={{ fontSize: 12, color: accent ? 'var(--primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
          {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{textStr}</div>
    </div>
  );
}

function RecordCard({ record, onChange }) {
  const cat = CATEGORIES[record.category] || CATEGORIES.special;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    rawText: record.rawText || '',
    observation: record.observation || '',
    parent: record.parent || '',
    support: record.support || '',
  });

  const handleSave = () => {
    updateRecord(record.id, {
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    setEditing(false);
    onChange?.();
  };

  const handleDelete = () => {
    if (!window.confirm('이 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없습니다.')) return;
    deleteRecord(record.id);
    onChange?.();
  };

  if (editing) {
    return (
      <div style={{ background: 'white', border: `1.5px solid ${cat.color}`, borderRadius: 15, padding: 15, marginBottom: 9, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: cat.color, background: cat.bg, padding: '3px 10px', borderRadius: 100 }}>
            {cat.emoji} {cat.label} 수정 중
          </span>
          <button onClick={() => setEditing(false)} style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800 }}>
            <X size={13} /> 취소
          </button>
        </div>

        <EditField label="원본 기록" value={draft.rawText} onChange={v => setDraft(d => ({ ...d, rawText: v }))} />
        <EditField label="관찰일지 문장" value={draft.observation} onChange={v => setDraft(d => ({ ...d, observation: v }))} />
        <EditField label="부모상담 문장" value={draft.parent} onChange={v => setDraft(d => ({ ...d, parent: v }))} />
        <EditField label="지원계획" value={draft.support} onChange={v => setDraft(d => ({ ...d, support: v }))} />

        <button onClick={handleSave} style={{
          width: '100%', marginTop: 4, padding: '12px', borderRadius: 12,
          background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Save size={15} /> 수정 저장
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 15, padding: 15, marginBottom: 9, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: cat.color, background: cat.bg, padding: '3px 10px', borderRadius: 100 }}>
            {cat.emoji} {cat.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(record.date)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setEditing(true)} title="수정" style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--gray-100)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Pencil size={14} />
          </button>
          <button onClick={handleDelete} title="삭제" style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {record.observation && (
        <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-primary)' }}>{record.observation}</div>
      )}
      {record.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
          {record.tags.map(tag => (
            <span key={tag} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 100 }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EditField({ label, value, onChange }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)', marginBottom: 5 }}>{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', minHeight: 72, padding: '10px 12px',
          borderRadius: 12, border: '1.5px solid var(--border)',
          fontSize: 13, lineHeight: 1.7, resize: 'vertical',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
    </label>
  );
}

function EmptyState({ text, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '36px 0' }}>
      <div style={{ marginBottom: 10 }}>{text}</div>
      {action && <button onClick={onAction} style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontWeight: 800 }}>{action}</button>}
    </div>
  );
}
