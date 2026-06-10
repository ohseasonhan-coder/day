import React, { useState, useEffect } from 'react';
import { getChildren, getRecordsByChild, getClasses, CATEGORIES, formatDate, genId, saveChildren, getChildren as reloadChildren, updateRecord, deleteRecord, updateChild, deleteChild, getAutomationState } from '../utils/storage';
import { generateGrowthSummary, generateConsultDoc, processRecord } from '../utils/ai';
import { ChevronRight, Plus, Search, Sparkles, Copy, X, FileText, BarChart3, Pencil, Trash2, Save } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';

const PREDEFINED_TAGS = ['알레르기', '발달지연', '언어지연', '편식', '투약중', '특별지원', '다문화', '한부모', 'ADHD경향', '분리불안'];

const PERIOD_LABELS = {
  '1month': '최근 1개월',
  '3months': '최근 3개월',
  '6months': '최근 6개월',
  '1year': '최근 1년',
};

const AVATAR_COLORS = [
  '#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8',
  '#4CAF50', '#E91E9A', '#FF5722', '#607D8B',
];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function AutoGrowthPanel({ growth }) {
  const missing = growth.missingCategoryKeys || [];
  const devAreaEntries = Object.entries(growth.devAreaCounts || {}).slice(0, 4);
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>자동 성장 요약</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>최근 1개월 기록 기준으로 자동 갱신됩니다.</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '5px 10px', height: 24 }}>{growth.recordIds?.length || 0}건</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65, background: 'var(--gray-50)', borderRadius: 12, padding: 12 }}>{growth.summary}</div>
      {devAreaEntries.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {devAreaEntries.map(([area, count]) => <span key={area} style={{ fontSize: 11, fontWeight: 900, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '4px 9px' }}>{area} {count}</span>)}
        </div>
      )}
      {missing.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 12, padding: '9px 11px', fontWeight: 800 }}>
          부족한 기록 영역 {missing.length}개가 있습니다.
        </div>
      )}
    </div>
  );
}

export default function ChildrenPage({ onNavigate, isDesktop }) {
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
  const [newChildBirth, setNewChildBirth] = useState('');
  const [newChildNotes, setNewChildNotes] = useState('');
  const [editingChild, setEditingChild] = useState(null); // { id, name, birthdate, notes, allergies }
  const [automation, setAutomation] = useState(() => getAutomationState());

  useEffect(() => {
    setChildren(getChildren());
    setClasses(getClasses());
    setAutomation(getAutomationState());
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
    const newChild = { id: genId(), name: newChildName.trim(), classId: cl?.id, birthdate: newChildBirth || '', notes: newChildNotes.trim() };
    saveChildren([...ch, newChild]);
    setChildren([...ch, newChild]);
    setNewChildName(''); setNewChildBirth(''); setNewChildNotes('');
    setShowAddChild(false);
  };

  const handleSaveEdit = () => {
    if (!editingChild?.name?.trim()) return;
    updateChild(editingChild.id, { name: editingChild.name.trim(), birthdate: editingChild.birthdate || '', notes: editingChild.notes || '', allergies: editingChild.allergies || '', tags: editingChild.tags || [] });
    setChildren(getChildren());
    if (selected?.id === editingChild.id) setSelected(c => ({ ...c, ...editingChild }));
    setEditingChild(null);
  };

  const handleDeleteChild = (childId) => {
    deleteChild(childId);
    setChildren(getChildren());
    if (selected?.id === childId) setSelected(null);
    setEditingChild(null);
  };

  const refreshSelectedRecords = () => {
    if (!selected) return;
    setRecords(loadRecords(selected));
  };

  const containerPad = isDesktop ? '32px 36px' : '20px';

  // 월령 계산 헬퍼
  const calcAge = (birthdate) => {
    if (!birthdate) return null;
    const b = new Date(birthdate);
    const n = new Date();
    const months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    if (months < 24) return `${months}개월`;
    return `${Math.floor(months/12)}세 ${months%12}개월`;
  };

  if (selected) {
    const catCounts = {};
    records.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const lastRecord = records[0];
    const ageStr = calcAge(selected.birthdate);
    const autoGrowth = automation?.growthSummaries?.byChild?.[selected.id];

    return (
      <div style={{ padding: containerPad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={() => setSelected(null)} style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={18} /> 목록
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.7px' }}>{selected.name}
              {ageStr && <span style={{ fontSize:14, fontWeight:700, color:'var(--primary)', marginLeft:8 }}>{ageStr}</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              기록 {records.length}건 · {PERIOD_LABELS[period]} {lastRecord ? `· 최근 ${formatDate(lastRecord.date)}` : ''}
            </div>
          </div>
          <button onClick={() => setEditingChild({ ...selected })} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:10, background:'var(--gray-100)', color:'var(--text-secondary)', fontSize:13, fontWeight:800 }}>
            <Pencil size={14} /> 편집
          </button>
          <button onClick={() => onNavigate('portfolio', { childId: selected.id, childName: selected.name })} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:10, background:'var(--primary-light)', color:'var(--primary)', fontSize:13, fontWeight:800 }}>
            <BarChart3 size={14} /> 포트폴리오
          </button>
        </div>

        {/* 메모/알레르기 표시 */}
        {(selected.notes || selected.allergies) && (
          <div style={{ background:'var(--gray-50)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', gap:16, flexWrap:'wrap' }}>
            {selected.notes && <div style={{ fontSize:13, color:'var(--text-secondary)' }}>📝 {selected.notes}</div>}
            {selected.allergies && <div style={{ fontSize:13, color:'var(--accent)', fontWeight:700 }}>⚠️ 알레르기: {selected.allergies}</div>}
          </div>
        )}

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

        {autoGrowth?.ready && (
          <AutoGrowthPanel growth={autoGrowth} />
        )}

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
          <EmptyState emoji="📝" title="이 기간의 기록이 없어요" actionLabel="기록 추가하기" onAction={() => onNavigate('record', { childId: selected.id })} />
        ) : (
          records.map(r => <RecordCard key={r.id} record={r} classAge={classes[0]?.age} onChange={refreshSelectedRecords} />)
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: containerPad }}>
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
          <div style={{ fontSize:13, fontWeight:900, color:'var(--primary)', marginBottom:10 }}>새 아이 추가</div>
          <div style={{ display: 'flex', gap: 8, marginBottom:8 }}>
            <input value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="이름 *" onKeyDown={e => e.key === 'Enter' && handleAddChild()}
              style={{ flex: 2, padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background:'white' }} />
            <input value={newChildBirth} onChange={e => setNewChildBirth(e.target.value)} type="date"
              style={{ flex: 1, padding: '11px 10px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, outline: 'none', fontFamily: 'inherit', background:'white' }} />
          </div>
          <input value={newChildNotes} onChange={e => setNewChildNotes(e.target.value)} placeholder="메모 (알레르기, 특이사항 등 선택)"
            style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:13, outline:'none', fontFamily:'inherit', background:'white', marginBottom:8 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleAddChild} style={{ flex:1, background: 'var(--primary)', color: 'white', padding: '11px', borderRadius: 12, fontWeight: 800, fontSize: 14 }}>추가</button>
            <button onClick={() => setShowAddChild(false)} style={{ flex:1, background:'white', border:'1.5px solid var(--border)', padding: '11px', borderRadius: 12, fontWeight: 700, fontSize: 14, color:'var(--text-secondary)' }}>취소</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
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
          style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--white)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}
        />
      </div>

      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } : {}}>
      {filtered.map(child => {
        const recs = getRecordsByChild(child.id);
        const lastRec = recs[0];
        const catCounts = {};
        recs.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
        const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topCatMeta = topCat ? CATEGORIES[topCat] : null;

        const avatarColor = getAvatarColor(child.name);
        return (
          <button
            key={child.id}
            onClick={() => selectChild(child)}
            className="card-lift"
            style={{
              width: '100%', background: 'var(--white)', border: '1px solid var(--border)',
              borderRadius: 18, padding: '15px 16px', marginBottom: isDesktop ? 0 : 10,
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: 'var(--shadow-sm)', textAlign: 'left',
            }}
          >
            {/* 컬러 이니셜 아바타 */}
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: `${avatarColor}18`,
              border: `2px solid ${avatarColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900, color: avatarColor,
              flexShrink: 0, position: 'relative',
            }}>
              {child.name[0]}
              {/* 카테고리 이모지 뱃지 */}
              {topCatMeta && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: topCatMeta.bg, border: '2px solid white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10,
                }}>
                  {topCatMeta.emoji}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 3, color: 'var(--text-primary)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                {child.name}
                {child.birthdate && <span style={{ fontSize:11, fontWeight:700, color:'var(--primary)', background:'var(--primary-light)', padding:'2px 7px', borderRadius:100 }}>{calcAge(child.birthdate)}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                기록 {recs.length}건{lastRec ? ` · 최근 ${formatDate(lastRec.date)}` : ' · 아직 기록 없음'}
              </div>
              {child.allergies && <div style={{ fontSize:11, color:'var(--accent)', fontWeight:700, marginBottom:2 }}>⚠️ {child.allergies}</div>}
              {child.tags?.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:2 }}>
                  {child.tags.slice(0,3).map(tag => (
                    <span key={tag} style={{ fontSize:10, fontWeight:700, color:'var(--primary)', background:'var(--primary-light)', padding:'2px 7px', borderRadius:100 }}>{tag}</span>
                  ))}
                  {child.tags.length > 3 && <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>+{child.tags.length - 3}</span>}
                </div>
              )}
              {/* 기록 수 바 */}
              {recs.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--gray-100)', borderRadius: 100 }}>
                    <div style={{
                      height: 4, borderRadius: 100,
                      background: avatarColor,
                      width: `${Math.min(100, recs.length * 10)}%`,
                    }} />
                  </div>
                  {topCatMeta && (
                    <span style={{ fontSize: 11, color: topCatMeta.color, fontWeight: 700 }}>
                      {topCatMeta.label}
                    </span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight size={16} color="var(--text-tertiary)" />
          </button>
        );
      })}

      {filtered.length === 0 && children.length === 0 && (
        <EmptyState emoji="👶" title="등록된 아이가 없어요" desc="설정에서 아이를 추가하거나 아래 버튼으로 바로 추가해요" actionLabel="아이 추가하기" onAction={() => setShowAddChild(true)} />
      )}
      {filtered.length === 0 && children.length > 0 && (
        <EmptyState emoji="🔍" title="검색 결과가 없어요" desc="다른 이름으로 검색해보세요" />
      )}
      </div>

      {/* 아이 편집 모달 */}
      {editingChild && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,20,50,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:999, backdropFilter:'blur(4px)' }}
          onClick={e => e.target===e.currentTarget && setEditingChild(null)}>
          <div style={{ width:'100%', maxWidth:520, background:'white', borderRadius:'24px 24px 0 0', padding:'20px 20px 32px', boxShadow:'0 -8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
              <div style={{ width:36, height:4, borderRadius:99, background:'var(--gray-200)' }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:900 }}>{editingChild.name} 정보 편집</div>
              <button onClick={() => setEditingChild(null)} style={{ width:30, height:30, borderRadius:'50%', background:'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={15} /></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>이름</div>
                <input value={editingChild.name} onChange={e => setEditingChild(c=>({...c,name:e.target.value}))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit' }} />
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>생년월일</div>
                <input type="date" value={editingChild.birthdate||''} onChange={e => setEditingChild(c=>({...c,birthdate:e.target.value}))}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:13, fontFamily:'inherit' }} />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--accent)', marginBottom:5 }}>알레르기/주의사항</div>
              <input value={editingChild.allergies||''} onChange={e => setEditingChild(c=>({...c,allergies:e.target.value}))} placeholder="예: 땅콩 알레르기, 아토피"
                style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:13, fontFamily:'inherit' }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>메모</div>
              <textarea value={editingChild.notes||''} onChange={e => setEditingChild(c=>({...c,notes:e.target.value}))} placeholder="특이사항, 성격 등 자유롭게" rows={2}
                style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:13, lineHeight:1.6, fontFamily:'inherit', resize:'none' }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:8 }}>특이사항 태그</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                {PREDEFINED_TAGS.map(tag => {
                  const isSelected = (editingChild.tags || []).includes(tag);
                  return (
                    <button key={tag} onClick={() => setEditingChild(c => {
                      const tags = c.tags || [];
                      return { ...c, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] };
                    })} style={{
                      padding:'5px 12px', borderRadius:100, fontSize:12, fontWeight:700,
                      background: isSelected ? 'var(--primary)' : 'var(--gray-100)',
                      color: isSelected ? 'white' : 'var(--text-secondary)',
                    }}>{tag}</button>
                  );
                })}
              </div>
              <TagCustomInput tags={editingChild.tags || []} onAdd={tag => setEditingChild(c => ({ ...c, tags: [...(c.tags||[]), tag] }))} onRemove={tag => setEditingChild(c => ({ ...c, tags: (c.tags||[]).filter(t => t !== tag) }))} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <button onClick={handleSaveEdit} style={{ padding:'13px', borderRadius:12, background:'var(--primary)', color:'white', fontWeight:800, fontSize:14 }}>저장</button>
              <button onClick={() => { if(window.confirm(`${editingChild.name}을(를) 삭제할까요? 기록은 유지돼요.`)) handleDeleteChild(editingChild.id); }}
                style={{ padding:'13px', borderRadius:12, background:'var(--accent-light)', color:'var(--accent)', fontWeight:800, fontSize:14 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
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
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
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
  const showToast = useToast();
  if (!text) return null;

  const textStr = Array.isArray(text) ? text.join('\n') : text;
  const handleCopy = () => {
    navigator.clipboard.writeText(textStr);
    showToast('복사했어요! 📋', 'success');
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
          <Copy size={12} /> 복사
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{textStr}</div>
    </div>
  );
}

function RecordCard({ record, classAge, onChange }) {
  const cat = CATEGORIES[record.category] || CATEGORIES.special;
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    rawText: record.rawText || '',
    observation: record.observation || '',
    parent: record.parent || '',
    support: record.support || '',
  });

  const handleSave = async () => {
    if (!draft.rawText.trim()) return alert('기록 원문을 입력해주세요.');
    setSaving(true);
    try {
      const rawChanged = draft.rawText.trim() !== (record.rawText || '').trim();
      let generated = null;
      if (rawChanged) {
        generated = await processRecord({
          childName: record.childName,
          rawText: draft.rawText.trim(),
          classAge,
          recordType: record.recordType,
        });
      }

      const keepManualObservation = draft.observation !== (record.observation || '');
      const keepManualParent = draft.parent !== (record.parent || '');
      const keepManualSupport = draft.support !== (record.support || '');

      const event = updateRecord(record.id, {
        ...draft,
        rawText: draft.rawText.trim(),
        ...(generated ? {
          category: generated.category,
          devAreas: generated.devAreas,
          tags: generated.tags,
          softened: generated.softened,
          normalizedText: generated.normalizedText,
          documentMeta: generated.documentMeta,
          documentReadyText: generated.documentReadyText,
          title: generated.title,
          observation: keepManualObservation ? draft.observation : generated.observation,
          parent: keepManualParent ? draft.parent : generated.parent,
          support: keepManualSupport ? draft.support : generated.support,
        } : {}),
        updatedAt: new Date().toISOString(),
      });
      setEditing(false);
      if (event?.message) showToast(event.message);
      onChange?.();
    } catch (e) {
      alert(e.message || '기록을 다시 정리하는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!window.confirm('이 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없습니다.')) return;
    const event = deleteRecord(record.id);
    if (event?.message) showToast(event.message);
    onChange?.();
  };

  if (editing) {
    return (
      <div style={{ background: 'var(--white)', border: `1.5px solid ${cat.color}`, borderRadius: 15, padding: 15, marginBottom: 9, boxShadow: 'var(--shadow-sm)' }}>
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

        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', marginTop: 4, padding: '12px', borderRadius: 12,
          background: saving ? 'var(--gray-300)' : 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Save size={15} /> {saving ? '재정리 중...' : '수정 저장'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 15, padding: 15, marginBottom: 9, boxShadow: 'var(--shadow-sm)' }}>
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

function TagCustomInput({ tags, onAdd, onRemove }) {
  const [input, setInput] = useState('');
  const predefinedSet = new Set(PREDEFINED_TAGS);
  const customTags = tags.filter(t => !predefinedSet.has(t));

  const handleAdd = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) return;
    onAdd(v);
    setInput('');
  };

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="직접 입력 후 Enter"
          style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:12, fontFamily:'inherit' }}
        />
        <button onClick={handleAdd} style={{ padding:'8px 14px', borderRadius:10, background:'var(--primary)', color:'white', fontSize:12, fontWeight:800 }}>추가</button>
      </div>
      {customTags.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {customTags.map(tag => (
            <span key={tag} style={{ padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:700, background:'var(--primary-light)', color:'var(--primary)', display:'flex', alignItems:'center', gap:4 }}>
              {tag}
              <button onClick={() => onRemove(tag)} style={{ color:'var(--primary)', fontWeight:900, fontSize:13, lineHeight:1 }}>×</button>
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
