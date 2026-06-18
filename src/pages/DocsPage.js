import React, { useState, useEffect, useCallback } from 'react';
import PrintPreviewModal from '../components/PrintPreviewModal';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import {
  getRecords, getClasses, getChildren,
  today, formatDateKo, formatDate, CATEGORIES, addDocumentDraft,
  getDocumentHistory, getFormTemplates, updateDocumentDraft, deleteDocumentDraftToTrash, getAutomationState,
} from '../utils/storage';
import { generateDailyJournal } from '../utils/ai';
import { exportDocx } from '../utils/docxExport';
import { FileText, Sparkles, Copy, Check, ChevronLeft, ChevronRight, Printer, Users, Share2, X, LayoutTemplate, Star, Download, History, RotateCcw } from 'lucide-react';

const DOC_TYPES = [
  { key: 'daily',       label: '보육일지',      icon: '📄', desc: '오늘 기록으로 일일 보육일지 초안 생성' },
  { key: 'weekly',      label: '주간 놀이평가',  icon: '🗓️', desc: '최근 7일 놀이 흐름과 다음 지원계획 정리' },
  { key: 'monthly',     label: '월간 놀이평가',  icon: '📊', desc: '이번 달 놀이 흐름·평가·확장계획 정리' },
  { key: 'parent',      label: '부모상담자료',   icon: '💬', desc: '아이별 상담에 바로 쓰는 문장 묶음' },
  { key: 'development', label: '발달평가',       icon: '🌱', desc: '발달영역별 관찰 근거와 지원계획' },
  { key: 'safety',      label: '안전·행사평가',  icon: '🛡️', desc: '안전교육·견학·행사 후 평가 문서' },
  { key: 'teacher',     label: '교사교육일지',   icon: '👩‍🏫', desc: '교사교육 후 적용계획까지 정리' },
  { key: 'review',      label: '원장 검토',      icon: '✅', desc: '누락·표현·지원계획 검토용 요약' },
  { key: 'weekplan',   label: '주간 계획안',   icon: '📅', desc: '다음 주 놀이·활동 계획 초안 작성' },
  { key: 'monthplan',  label: '월간 계획안',   icon: '🗒️', desc: '다음 달 보육과정 운영 계획 수립' },
];

const PERIOD_OPTIONS = [
  { key: '1week',   label: '최근 7일' },
  { key: 'date',    label: '선택 날짜' },
  { key: '1month',  label: '1개월' },
  { key: '3months', label: '3개월' },
  { key: '6months', label: '6개월' },
  { key: '1year',   label: '1년' },
];
const PERIOD_DAYS = { date: 0, '1week': 7, '1month': 30, '3months': 90, '6months': 180, '1year': 365 };

const AVATAR_COLORS = [
  '#4F7FFF','#6C63FF','#FF8C42','#00B4D8',
  '#4CAF50','#E91E9A','#FF5722','#607D8B',
];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function DocsPage({ onNavigate, isDesktop, context, initialTab }) {
  const [mainTab, setMainTab]       = useState(initialTab || 'new'); // 'new' | 'history'
  const [viewDate, setViewDate]     = useState(today());
  const [allRecords, setAllRecords] = useState([]);
  const [children, setChildren]     = useState([]);
  const [classes, setClasses]       = useState([]);
  const [doc, setDoc]               = useState(null);
  const [loading, setLoading]       = useState(false);
  const [activeType, setActiveType] = useState('daily');
  const [showRecords, setShowRecords] = useState(false);
  const [historyDocs, setHistoryDocs] = useState([]);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historyChildFilter, setHistoryChildFilter] = useState('all');
  const [editingHistory, setEditingHistory] = useState(false);
  const [historyDraft, setHistoryDraft] = useState(null);
  // 양식 적용
  const [formApplied, setFormApplied] = useState(false);
  const [matchedForm, setMatchedForm] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [automation, setAutomation] = useState(() => getAutomationState());

  // 아이 선택 (null = 전체 반)
  const [selectedChildId, setSelectedChildId] = useState(null);
  // 기간 선택
  const [period, setPeriod] = useState('date');

  useEffect(() => {
    if (!context) return;
    if (context.docType) setActiveType(context.docType);
    if (context.period) setPeriod(context.period);
    if (context.date) setViewDate(context.date);
    if (context.childId) setSelectedChildId(context.childId);
    setMainTab('new');
    setDoc(null);
  }, [context]);

  useEffect(() => {
    setAllRecords(getRecords());
    setChildren(getChildren());
    setClasses(getClasses());
    setAutomation(getAutomationState());
    setDoc(null);
  }, [viewDate, activeType, selectedChildId, period]);

  useEffect(() => {
    if (mainTab === 'history') setHistoryDocs(getDocumentHistory());
  }, [mainTab]);

  const cl        = classes[0];
  const isToday   = viewDate === today();
  const current   = DOC_TYPES.find(t => t.key === activeType) || DOC_TYPES[0];
  const selChild  = children.find(c => c.id === selectedChildId) || null;
  const autoDocs = automation?.documents || {};
  const autoChecklist = automation?.checklist || {};
  const draftCandidates = automation?.draftCandidates || {};
  const docReadyItems = [
    { key: 'daily', title: '보육일지', count: autoDocs.daily?.count || 0, desc: autoDocs.daily?.label || '오늘 기록을 기다리는 중입니다.', navType: 'daily', periodKey: 'date' },
    { key: 'weekly', title: '주간평가', count: autoDocs.weekly?.count || 0, desc: autoDocs.weekly?.label || '최근 7일 기록을 기다리는 중입니다.', navType: 'weekly', periodKey: '1week' },
    { key: 'monthly', title: '월간평가', count: autoDocs.monthly?.count || 0, desc: autoDocs.monthly?.label || '최근 30일 기록을 기다리는 중입니다.', navType: 'monthly', periodKey: '1month' },
    { key: 'parent', title: '부모상담자료', count: autoDocs.parent?.count || 0, desc: autoDocs.parent?.label || '상담용 기록을 기다리는 중입니다.', navType: 'parent', periodKey: '1month' },
    { key: 'development', title: '발달평가', count: autoDocs.development?.count || 0, desc: autoDocs.development?.label || '발달영역 기록을 기다리는 중입니다.', navType: 'development', periodKey: '1month' },
  ];

  const AutomationReadyPanel = (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>문서 준비 상태</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>기록 저장 시 자동으로 반영 가능한 문서가 갱신됩니다.</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800, background: 'var(--gray-100)', borderRadius: 100, padding: '6px 10px', flexShrink: 0 }}>
          총 {automation?.totalRecords || 0}건
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(5, 1fr)' : '1fr', gap: 9 }}>
        {docReadyItems.map(item => (
          <button key={item.key} onClick={() => { setActiveType(item.navType); setPeriod(item.periodKey); setDoc(null); }} style={{
            textAlign: 'left',
            borderRadius: 14,
            padding: 13,
            border: `1px solid ${item.count > 0 ? 'rgba(79,127,255,0.28)' : 'var(--border)'}`,
            background: item.count > 0 ? 'var(--primary-light)' : 'var(--gray-50)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: item.count > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>{item.title}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: item.count > 0 ? 'var(--primary)' : 'var(--text-tertiary)' }}>{item.count}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{item.desc}</div>
          </button>
        ))}
      </div>
      {(autoChecklist.missingCategoryKeys?.length || 0) > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 12, padding: '10px 12px', fontWeight: 800 }}>
          평가제 점검: 아직 부족한 기록 영역이 {autoChecklist.missingCategoryKeys.length}개 있습니다.
        </div>
      )}
    </div>
  );

  const DraftCandidatePanel = (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>자동 초안 후보</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>문서 이력과 분리해서 최신 기록 기준 후보만 준비합니다.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr', gap: 9 }}>
        {[
          { key: 'daily', label: '오늘 보육일지', docType: 'daily', periodKey: 'date' },
          { key: 'weekly', label: '주간평가', docType: 'weekly', periodKey: '1week' },
          { key: 'monthly', label: '월간평가', docType: 'monthly', periodKey: '1month' },
          { key: 'parent', label: '부모상담자료', docType: 'parent', periodKey: '1month' },
          { key: 'development', label: '발달평가', docType: 'development', periodKey: '1month' },
          { key: 'safety', label: '안전·행사평가', docType: 'safety', periodKey: '1month' },
          { key: 'teacher', label: '교사교육일지', docType: 'teacher', periodKey: 'date' },
          { key: 'review', label: '원장 검토자료', docType: 'review', periodKey: '1month' },
          { key: 'weekplan', label: '주간 계획안', docType: 'weekplan', periodKey: '1week' },
          { key: 'monthplan', label: '월간 계획안', docType: 'monthplan', periodKey: '1month' },
        ].map(meta => {
          const item = draftCandidates[meta.key] || {};
          return (
            <button key={meta.key} onClick={() => { setActiveType(meta.docType); setPeriod(meta.periodKey); setDoc(null); }} style={{
              textAlign: 'left',
              borderRadius: 14,
              padding: 13,
              border: `1px solid ${item.ready ? 'rgba(76,175,80,0.28)' : 'var(--border)'}`,
              background: item.ready ? 'rgba(76,175,80,0.08)' : 'var(--gray-50)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>{meta.label}</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: item.ready ? 'var(--cat-play)' : 'var(--text-tertiary)' }}>{item.count || 0}건</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 8 }}>{item.preview || '반영할 기록이 생기면 자동 후보가 준비됩니다.'}</div>
              <span style={{
                display: 'inline-flex',
                fontSize: 11,
                fontWeight: 900,
                color: item.ready ? 'white' : 'var(--text-tertiary)',
                background: item.ready ? 'var(--cat-play)' : 'var(--gray-200)',
                borderRadius: 100,
                padding: '4px 8px',
              }}>
                {item.ready ? '문서 만들기' : '대기 중'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── 대상 기록 계산 ──────────────────────────────────────────────────────────
  const targetRecords = (() => {
    const base = period === 'date'
      ? allRecords.filter(r => r.date === viewDate)
      : (() => {
          const days = PERIOD_DAYS[period];
          const now  = new Date();
          return allRecords.filter(r => (now - new Date(r.date)) / 86400000 <= days);
        })();

    // 특정 아이 필터
    return selectedChildId ? base.filter(r => r.childId === selectedChildId) : base;
  })();

  const changeDate = (delta) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const handleSelectChild = (childId) => {
    setSelectedChildId(childId);
    setDoc(null);
    // 아이 선택 시 기간 옵션 보임 — 기본 '1month'로
    if (childId !== null && period === 'date') setPeriod('1month');
    // 전체 선택 시 기간 리셋
    if (childId === null) setPeriod('date');
  };

  const handleGenerate = async () => {
    if (targetRecords.length === 0 && !['teacher', 'safety'].includes(activeType)) {
      alert('문서를 만들 기록이 없어요. 먼저 기록 탭에서 관찰기록을 남겨주세요.');
      return;
    }
    setLoading(true);
    try {
      let generated;
      if (activeType === 'daily' && !selChild) {
        const res = await generateDailyJournal({
          records: targetRecords, date: viewDate,
          classAge: cl?.age, className: cl?.name,
        });
        generated = {
          title: '보육일지 초안',
          badge: `${formatDateKo(viewDate)} · ${targetRecords.length}건 반영`,
          sections: [
            { title: '놀이 흐름 및 활동', text: res.playFlow },
            { title: '유아 반응',         text: res.childResponse },
            { title: '교사 지원',         text: res.teacherSupport },
            { title: '오늘 평가',         text: res.evaluation },
            { title: '다음 지원계획',     text: res.nextPlan, accent: true },
          ],
        };
      } else {
        generated = buildDocument(activeType, targetRecords, viewDate, cl, children, selChild, period);
      }
      const savedDraft = addDocumentDraft({
        ...generated, type: activeType, date: viewDate,
        classId: cl?.id, className: cl?.name,
        childId: selChild?.id, childName: selChild?.name,
        period,
        sourceRecordIds: targetRecords.map(r => r.id),
        source: 'autoCandidate',
        sourceLabel: '자동 초안 후보에서 저장',
      });
      setDoc(savedDraft);
      // 매칭 양식 자동 탐색
      const forms = getFormTemplates();
      const found = forms.find(f => f.docType === activeType);
      setMatchedForm(found || null);
      setFormApplied(false);
    } catch (e) {
      alert(e.message || '문서 생성 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  // ── 공통 UI 블록 ─────────────────────────────────────────────────────────────

  const DateNav = (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '12px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button onClick={() => changeDate(-1)} style={{ color: 'var(--text-secondary)', padding: 4 }}><ChevronLeft size={20} /></button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{formatDateKo(viewDate)}</div>
        <div style={{ fontSize: 12, color: isToday ? 'var(--primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 700 : 400 }}>
          {isToday ? '오늘' : viewDate}
        </div>
      </div>
      <button onClick={() => changeDate(1)} disabled={isToday} style={{ color: 'var(--text-secondary)', padding: 4 }}>
        <ChevronRight size={20} style={{ opacity: isToday ? 0.3 : 1 }} />
      </button>
    </div>
  );

  // 아이 선택 스크롤
  const ChildSelector = (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={14} /> 대상 선택
      </div>
      <div className="avatar-scroll" style={{ marginLeft: isDesktop ? 0 : -20, marginRight: isDesktop ? 0 : -20, paddingLeft: isDesktop ? 0 : 20, paddingRight: isDesktop ? 0 : 20, paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 10, width: 'max-content' }}>
          {/* 전체 반 */}
          <button
            onClick={() => handleSelectChild(null)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '4px 2px', minWidth: 52,
            }}
          >
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: selectedChildId === null ? 'var(--primary)' : 'var(--gray-100)',
              border: `3px solid ${selectedChildId === null ? 'var(--primary)' : 'transparent'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, boxShadow: selectedChildId === null ? '0 6px 18px rgba(79,127,255,0.4)' : 'none',
              transition: 'all 0.18s',
            }}>
              👥
            </div>
            <span style={{ fontSize: 11, fontWeight: selectedChildId === null ? 800 : 500, color: selectedChildId === null ? 'var(--primary)' : 'var(--text-secondary)' }}>
              전체 반
            </span>
          </button>

          {children.map(child => {
            const color    = getAvatarColor(child.name);
            const isActive = selectedChildId === child.id;
            return (
              <button
                key={child.id}
                onClick={() => handleSelectChild(child.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 2px', minWidth: 52 }}
              >
                <div style={{
                  width: 50, height: 50, borderRadius: '50%',
                  background: isActive ? color : `${color}18`,
                  border: `3px solid ${isActive ? color : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 900,
                  color: isActive ? 'white' : color,
                  boxShadow: isActive ? `0 6px 18px ${color}44` : 'none',
                  transition: 'all 0.18s',
                }}>
                  {child.name[0]}
                </div>
                <span style={{ fontSize: 11, fontWeight: isActive ? 800 : 500, color: isActive ? color : 'var(--text-secondary)', maxWidth: 52, textAlign: 'center', lineHeight: 1.3 }}>
                  {child.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // 기간 선택 (아이 선택 시 표시)
  const PeriodSelector = (selectedChildId || activeType !== 'daily') ? (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>기간 선택</div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {PERIOD_OPTIONS.map(p => (
          <button key={p.key} onClick={() => { setPeriod(p.key); setDoc(null); }} style={{
            padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
            background: period === p.key ? 'var(--primary)' : 'var(--gray-100)',
            color:      period === p.key ? 'white' : 'var(--text-secondary)',
          }}>
            {p.label}
          </button>
        ))}
      </div>
      {/* 기간 선택 요약 */}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', padding: '7px 12px', borderRadius: 9, display: 'inline-block' }}>
        {selChild?.name} · {PERIOD_OPTIONS.find(p => p.key === period)?.label} · {targetRecords.length}건 기록
      </div>
    </div>
  ) : null;

  // 문서 유형 선택 그리드
  const TypeSelector = (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 16 }}>
      {DOC_TYPES.map(t => (
        <button
          key={t.key}
          onClick={() => { setActiveType(t.key); setDoc(null); setShowRecords(false); }}
          style={{
            textAlign: 'left', borderRadius: 14, padding: isDesktop ? '11px 12px' : '13px 12px',
            border: `1px solid ${activeType === t.key ? 'var(--primary)' : 'var(--border)'}`,
            background: activeType === t.key ? 'var(--primary-light)' : 'var(--white)',
            boxShadow: activeType === t.key ? '0 6px 16px rgba(79,127,255,0.12)' : 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: isDesktop ? 0 : 5 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: activeType === t.key ? 'var(--primary)' : 'var(--text-primary)' }}>{t.label}</span>
          </div>
          {!isDesktop && <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{t.desc}</div>}
        </button>
      ))}
    </div>
  );

  // 생성 패널 + 결과
  const GeneratePanel = (
    <>
      {/* 생성 카드 */}
      <div style={{ background: 'linear-gradient(135deg, var(--gray-800), var(--gray-700))', color: 'white', borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            {selChild && (
              <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 100, padding: '4px 10px', display: 'inline-block', marginBottom: 6 }}>
                👤 {selChild.name} · {PERIOD_OPTIONS.find(p => p.key === period)?.label}
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 3 }}>{current.icon} {current.label} 초안</div>
            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>{current.desc}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{targetRecords.length}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>반영 기록</div>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: loading ? 'rgba(255,255,255,0.25)' : 'white',
            color: loading ? 'white' : 'var(--gray-800)', fontSize: 15, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading
            ? <><Spinner dark /> 문서 작성 중...</>
            : <><FileText size={17} /> {current.label} 생성하기</>
          }
        </button>
      </div>

      {/* 기록 확인 토글 */}
      <button
        onClick={() => setShowRecords(v => !v)}
        style={{
          width: '100%', marginBottom: 14, padding: '11px 14px', borderRadius: 14,
          background: 'var(--white)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>
          반영되는 기록 확인
        </span>
        <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800 }}>{targetRecords.length}건</span>
      </button>
      {showRecords && <RecordPreview records={targetRecords} onNavigate={onNavigate} />}

      {/* 결과 */}
      {doc ? (
        <div className="slide-up">
          {/* 결과 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <FileText size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 900, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
              <span style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 9px', borderRadius: 100, fontWeight: 800, flexShrink: 0 }}>
                {doc.badge}
              </span>
            </div>
            {/* 공유 / 인쇄 버튼 — 이미지 양식 적용 중이면 인쇄 버튼 숨김 (ImageOverlayView 내부 버튼 사용) */}
            <div style={{ display:'flex', gap:7, flexShrink:0 }}>
              <ShareButton doc={formApplied && matchedForm ? applyFormToDoc(doc, matchedForm, { selChild, cl, period }) : doc} />
              <WordButton doc={formApplied && matchedForm ? applyFormToDoc(doc, matchedForm, { selChild, cl, period }) : doc} />
              <DownloadButton doc={formApplied && matchedForm ? applyFormToDoc(doc, matchedForm, { selChild, cl, period }) : doc} />
              {!(formApplied && matchedForm?.imageData) && (
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="no-print"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10,
                    border: '1.5px solid var(--border)', background: 'var(--white)',
                    fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)',
                  }}
                >
                  <Printer size={14} color="var(--primary)" /> 인쇄
                </button>
              )}
            </div>
          </div>

          {/* 양식 적용 배너 */}
          {matchedForm && (
            <div style={{
              background: formApplied ? 'var(--primary-light)' : 'var(--gray-100)',
              border: `1px solid ${formApplied ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 14, padding: '12px 16px', marginBottom: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <LayoutTemplate size={16} color={formApplied ? 'var(--primary)' : 'var(--text-secondary)'} />
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color: formApplied ? 'var(--primary)' : 'var(--text-primary)' }}>
                    {matchedForm.name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:1 }}>
                    {formApplied ? '원 양식 구조로 표시 중' : '원 양식에 맞게 변환할 수 있어요'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setFormApplied(v => !v)}
                style={{
                  padding:'8px 14px', borderRadius:10, fontSize:13, fontWeight:800, flexShrink:0,
                  background: formApplied ? 'var(--primary)' : 'var(--white)',
                  color: formApplied ? 'white' : 'var(--primary)',
                  border: `1.5px solid var(--primary)`,
                }}
              >
                {formApplied ? '✓ 적용 중' : '양식 적용'}
              </button>
            </div>
          )}

          {/* 인쇄용 숨김 헤더 */}
          <div className="print-header" style={{ display: 'none' }}>
            <div>
              <div style={{ fontSize: '16pt', fontWeight: 900 }}>{doc.title}</div>
              {selChild && <div style={{ fontSize: '11pt' }}>대상: {selChild.name}</div>}
              <div style={{ fontSize: '11pt', color: '#666' }}>{cl ? `${cl.name} · ${cl.age}세반` : ''}</div>
            </div>
            <div style={{ fontSize: '11pt', color: '#444' }}>{doc.badge}</div>
          </div>

          {/* 섹션들 — 양식 적용 여부에 따라 렌더링 분기 */}
          <div className="print-area">
            {formApplied && matchedForm
              ? <FormAppliedView doc={doc} form={matchedForm} selChild={selChild} cl={cl} period={period} />
              : doc.sections.map((s, i) => (
                  <DocumentSection
                    key={`${s.title}-${i}`}
                    title={s.title} text={s.text} accent={s.accent}
                    onUpdate={(newText) => {
                      const updated = { ...doc, sections: doc.sections.map((sec, idx) => idx === i ? { ...sec, text: newText } : sec) };
                      setDoc(updated);
                      if (updated.id) updateDocumentDraft(updated.id, { sections: updated.sections });
                    }}
                  />
                ))
            }
          </div>

          <CopyAllButton doc={formApplied && matchedForm ? applyFormToDoc(doc, matchedForm, { selChild, cl, period }) : doc} />
          <button
            onClick={() => { setDoc(null); setMatchedForm(null); setFormApplied(false); handleGenerate(); }}
            style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 800 }}
          >
            다시 생성하기
          </button>
        </div>
      ) : (
        <EmptyGuide activeType={activeType} onNavigate={onNavigate} />
      )}
    </>
  );

  // ── 메인 탭 UI ────────────────────────────────────────────────────────────────
  const MainTabs = (
    <div style={{ display:'flex', gap:4, background:'var(--gray-100)', borderRadius:14, padding:4, marginBottom:20 }}>
      {[{ id:'new', label:'📄 새 문서 만들기' }, { id:'history', label:'🕐 문서 이력' }].map(t => (
        <button key={t.id} onClick={() => setMainTab(t.id)} style={{
          flex:1, padding:'10px 0', borderRadius:11, fontSize:14, fontWeight:mainTab===t.id?900:600,
          background: mainTab===t.id ? 'var(--white)' : 'transparent',
          color: mainTab===t.id ? 'var(--primary)' : 'var(--text-secondary)',
          boxShadow: mainTab===t.id ? 'var(--shadow-sm)' : 'none',
          transition:'all 0.15s',
        }}>{t.label}</button>
      ))}
    </div>
  );

  // ── 문서 이력 탭 ──────────────────────────────────────────────────────────────
  const handleTogglePin = (id, e) => {
    e.stopPropagation();
    const doc = historyDocs.find(d => d.id === id);
    if (!doc) return;
    updateDocumentDraft(id, { pinned: !doc.pinned });
    setHistoryDocs(getDocumentHistory());
  };

  const openHistoryPreview = (document) => {
    setHistoryPreview(document);
    setHistoryDraft(JSON.parse(JSON.stringify(document)));
    setEditingHistory(false);
  };

  const handleSaveHistoryEdit = () => {
    if (!historyDraft) return;
    updateDocumentDraft(historyDraft.id, {
      title: historyDraft.title,
      badge: historyDraft.badge,
      sections: historyDraft.sections || [],
    });
    const refreshed = getDocumentHistory();
    setHistoryDocs(refreshed);
    const updated = refreshed.find(d => d.id === historyDraft.id) || historyDraft;
    setHistoryPreview(updated);
    setHistoryDraft(JSON.parse(JSON.stringify(updated)));
    setEditingHistory(false);
  };

  const handleDeleteHistoryDoc = () => {
    if (!historyPreview) return;
    if (!window.confirm('이 문서를 휴지통으로 보낼까요? 설정 > 백업/복구 > 휴지통에서 30일 안에 복원할 수 있어요.')) return;
    deleteDocumentDraftToTrash(historyPreview.id);
    setHistoryDocs(getDocumentHistory());
    setHistoryPreview(null);
    setHistoryDraft(null);
    setEditingHistory(false);
  };

  const sortedHistoryDocs = [...historyDocs].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const displayedHistoryDocs = sortedHistoryDocs.filter(d => {
    if (showPinnedOnly && !d.pinned) return false;
    if (historyTypeFilter !== 'all' && d.type !== historyTypeFilter) return false;
    if (historyChildFilter !== 'all' && d.childId !== historyChildFilter) return false;
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = [d.title, d.badge, d.childName, d.className, d.sourceLabel, ...(d.sections || []).flatMap(s => [s.title, s.text])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const HistoryTab = (
    <div>
      {/* 문서 이력 필터 */}
      {historyDocs.length > 0 && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: 'var(--shadow-sm)' }}>
          <input
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            placeholder="문서 제목, 내용, 아이 이름으로 검색"
            style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr auto' : '1fr', gap: 8 }}>
            <select value={historyTypeFilter} onChange={e => setHistoryTypeFilter(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--white)' }}>
              <option value="all">전체 문서 유형</option>
              {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>
            <select value={historyChildFilter} onChange={e => setHistoryChildFilter(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--white)' }}>
              <option value="all">전체 아이/반</option>
              {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
            </select>
            <button onClick={() => setShowPinnedOnly(v => !v)} style={{
              padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 800,
              background: showPinnedOnly ? '#FFF8E1' : 'var(--gray-100)',
              color: showPinnedOnly ? '#E65100' : 'var(--text-secondary)',
              border: `1.5px solid ${showPinnedOnly ? '#F5A623' : 'transparent'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Star size={13} fill={showPinnedOnly ? '#F5A623' : 'none'} color={showPinnedOnly ? '#F5A623' : 'var(--text-secondary)'} />
              즐겨찾기
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 9 }}>
            검색 결과 {displayedHistoryDocs.length}건 / 전체 {historyDocs.length}건
          </div>
        </div>
      )}
      {historyDocs.length === 0 ? (
        <EmptyState emoji="📂" title="아직 저장된 문서가 없어요" desc="오늘기록에서 문장을 생성하고 저장해보세요." actionLabel="새 문서 만들기" onAction={() => setMainTab('new')} />
      ) : displayedHistoryDocs.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px 20px', color:'var(--text-secondary)', fontSize:14 }}>즐겨찾기한 문서가 없어요.</div>
      ) : (
        displayedHistoryDocs.map(d => {
          const docType = DOC_TYPES.find(t => t.key === d.type) || { icon:'📄', label:'문서' };
          return (
            <div key={d.id}
              onClick={() => openHistoryPreview(d)}
              style={{ background:'var(--white)', border: d.pinned ? '1.5px solid #F5A623' : '1px solid var(--border)', borderRadius:14, padding:'14px 16px', marginBottom:10, cursor:'pointer', boxShadow:'var(--shadow-sm)', display:'flex', alignItems:'center', gap:12 }}
            >
              <div style={{ fontSize:28, flexShrink:0 }}>{docType.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:14, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                  {d.pinned && <Star size={13} fill="#F5A623" color="#F5A623" style={{ flexShrink:0 }} />}
                  {d.title}
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  {d.badge} · {d.createdAt ? new Date(d.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}
                </div>
                {d.sourceLabel && (
                  <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4, fontWeight: 800 }}>{d.sourceLabel}</div>
                )}
              </div>
              <button onClick={(e) => handleTogglePin(d.id, e)} style={{ padding: 6, borderRadius: 8, background: d.pinned ? '#FFF8E1' : 'var(--gray-100)', flexShrink:0 }}>
                <Star size={16} fill={d.pinned ? '#F5A623' : 'none'} color={d.pinned ? '#F5A623' : 'var(--text-tertiary)'} />
              </button>
            </div>
          );
        })
      )}

      {/* 이력 미리보기 모달 */}
      {historyPreview && (
        <div onClick={() => setHistoryPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:900, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--white)', borderRadius:'24px 24px 0 0', padding:24, width:'100%', maxWidth:640, maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              {editingHistory ? (
                <input
                  value={historyDraft?.title || ''}
                  onChange={e => setHistoryDraft(d => ({ ...d, title: e.target.value }))}
                  style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, fontWeight: 900 }}
                />
              ) : (
                <div style={{ fontWeight:900, fontSize:17 }}>{historyPreview.title}</div>
              )}
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <ShareButton doc={historyPreview} />
                <WordButton doc={historyPreview} />
                <DownloadButton doc={historyPreview} />
                <button onClick={() => setEditingHistory(v => !v)} style={{ padding:'8px 10px', borderRadius:8, background:'var(--primary-light)', color:'var(--primary)', fontSize:12, fontWeight:900 }}>
                  {editingHistory ? '취소' : '수정'}
                </button>
                <button onClick={handleDeleteHistoryDoc} style={{ padding:'8px 10px', borderRadius:8, background:'var(--accent-light)', color:'var(--accent)', fontSize:12, fontWeight:900 }}>
                  삭제
                </button>
                <button onClick={() => setHistoryPreview(null)} style={{ padding:6, borderRadius:8, background:'var(--gray-100)', color:'var(--text-secondary)' }}><X size={18}/></button>
              </div>
            </div>
            {editingHistory ? (
              <div>
                <input
                  value={historyDraft?.badge || ''}
                  onChange={e => setHistoryDraft(d => ({ ...d, badge: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
                />
                {(historyDraft?.sections || []).map((section, index) => (
                  <div key={index} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                    <input
                      value={section.title || ''}
                      onChange={e => setHistoryDraft(d => ({ ...d, sections: d.sections.map((s, i) => i === index ? { ...s, title: e.target.value } : s) }))}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13, fontWeight: 800, marginBottom: 8, boxSizing: 'border-box' }}
                    />
                    <textarea
                      value={section.text || ''}
                      onChange={e => setHistoryDraft(d => ({ ...d, sections: d.sections.map((s, i) => i === index ? { ...s, text: e.target.value } : s) }))}
                      rows={4}
                      style={{ width: '100%', padding: '10px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <button
                      onClick={() => setHistoryDraft(d => ({ ...d, sections: d.sections.filter((_, i) => i !== index) }))}
                      style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 8, padding: '7px 10px' }}
                    >
                      섹션 삭제
                    </button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => setHistoryDraft(d => ({ ...d, sections: [...(d.sections || []), { title: '새 섹션', text: '' }] }))}
                    style={{ padding: '12px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontWeight: 900 }}
                  >
                    섹션 추가
                  </button>
                  <button onClick={handleSaveHistoryEdit} style={{ padding: '12px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontWeight: 900 }}>
                    수정본 저장
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, color:'var(--primary)', background:'var(--primary-light)', padding:'5px 12px', borderRadius:100, display:'inline-block', marginBottom:14, fontWeight:700 }}>
                  {historyPreview.badge}
                </div>
                {(historyPreview.sections||[]).map((s,i) => (
                  <DocumentSection key={i} title={s.title} text={s.text} accent={s.accent} />
                ))}
                <CopyAllButton doc={historyPreview} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── 데스크톱 레이아웃 ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
            <Sparkles size={13} /> 문서 자동화 센터
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.7px' }}>기록을 문서로 바꾸는 곳</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            보육일지부터 발달평가, 부모상담자료까지. 아이 선택 + 기간 조합으로 맞춤 문서를 만들어보세요.
          </div>
        </div>

        {MainTabs}
        {mainTab === 'new' && AutomationReadyPanel}
        {mainTab === 'new' && DraftCandidatePanel}

        {mainTab === 'history' ? HistoryTab : (
          <>
            {/* 아이 선택 + 기간 */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
              {ChildSelector}
              {PeriodSelector}
              {!selectedChildId && DateNav}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 28, alignItems: 'start' }}>
              <div>{TypeSelector}</div>
              <div>{GeneratePanel}</div>
            </div>
          </>
        )}
        {showPrintModal && doc && (
          <PrintPreviewModal
            title={doc.title || '문서'}
            sections={(doc.sections || []).map(s => ({ title: s.title, content: s.text || '' }))}
            meta={{ date: doc.date || '', childName: doc.childName, className: doc.className }}
            onClose={() => setShowPrintModal(false)}
          />
        )}
      </div>
    );
  }

  // ── 모바일 레이아웃 ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
          <Sparkles size={13} /> 문서 자동화 센터
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.7px' }}>기록을 문서로 바꾸는 곳</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          아이를 선택하거나 전체 반 단위로 문서를 만들어보세요.
        </div>
      </div>

      {MainTabs}
      {mainTab === 'new' && AutomationReadyPanel}
      {mainTab === 'new' && DraftCandidatePanel}

      {mainTab === 'history' ? HistoryTab : (
        <>
          {ChildSelector}
          {PeriodSelector}
          {!selectedChildId && DateNav}
          {TypeSelector}
          {GeneratePanel}
        </>
      )}
      {showPrintModal && doc && (
        <PrintPreviewModal
          title={doc.title || '문서'}
          sections={(doc.sections || []).map(s => ({ title: s.title, content: s.text || '' }))}
          meta={{ date: doc.date || '', childName: doc.childName, className: doc.className }}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}



// ── 문서 빌더 ─────────────────────────────────────────────────────────────────
function buildCompleteDocument(type, records, date, cl, selChild, period) {
  const categorySummary = summarizeCategories(records);
  const periodLabel = selChild ? (PERIOD_OPTIONS.find(p => p.key === period)?.label || '선택 기간') : formatDateKo(date);
  const subjectLabel = selChild ? selChild.name : (cl?.name || '우리 반');
  const childNames = selChild ? [selChild.name] : [...new Set(records.map(r => r.childName).filter(Boolean))];
  const commonBadge = selChild
    ? `${subjectLabel} · ${periodLabel} · ${records.length}건 반영`
    : `${formatDateKo(date)} 기준 · ${records.length}건 반영`;
  const samples = records.map(r => r.observation || r.parent || r.rawText).filter(Boolean);
  const sampleText = samples.slice(0, 3).join(' ');
  const supportText = records.map(r => r.support).filter(Boolean).slice(0, 3).join(' ');
  const categoryText = categorySummary.mainLabels || '놀이·생활 기록';

  const fallback = samples.length
    ? sampleText
    : '아직 반영할 기록이 충분하지 않습니다. 기록을 추가하면 문서 내용이 더 구체화됩니다.';

  if (type === 'daily') {
    return {
      title: selChild ? `${selChild.name} 보육일지 초안` : '보육일지 초안',
      badge: commonBadge,
      sections: [
        { title: '놀이 흐름 및 활동', text: `${subjectLabel}은(는) ${periodLabel} 동안 ${categoryText}을(를) 중심으로 놀이와 일과에 참여하였다. ${fallback}` },
        { title: '유아 반응', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : `${childNames.join(', ') || '유아들'}은(는) 놀이 과정에서 자신의 생각을 표현하고 또래와 상호작용하는 모습을 보였다.` },
        { title: '교사 지원', text: supportText || '교사는 유아의 흥미와 반응을 관찰하며 필요한 언어적 안내와 환경적 지원을 제공하였다.' },
        { title: '평가 및 다음 지원', text: '오늘의 기록을 바탕으로 유아의 흥미가 이어질 수 있도록 자료와 공간을 조정하고, 부족한 발달영역 기록을 보완한다.', accent: true },
      ],
    };
  }

  if (type === 'weekly') {
    return {
      title: selChild ? `${selChild.name} 주간 놀이평가 초안` : '주간 놀이평가 초안',
      badge: commonBadge,
      sections: [
        { title: '주간 놀이 흐름', text: `${subjectLabel}은(는) 최근 일주일 동안 ${categoryText} 관련 경험을 중심으로 놀이를 이어갔다. ${fallback}` },
        { title: '유아 반응과 배움', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : '유아들은 놀이 과정에서 탐색, 표현, 협력, 문제 해결을 경험하였다.' },
        { title: '교사 지원 평가', text: supportText || '교사는 유아의 놀이 의도를 존중하며 자료 제공, 질문, 기다림, 갈등 중재를 통해 놀이 확장을 도왔다.' },
        { title: '다음 주 예상놀이 및 지원계획', text: `${categorySummary.topLabel} 경험이 이어질 수 있도록 관련 자료를 추가하고, 또래와 함께 구성하는 놀이 기회를 제공한다.`, accent: true },
      ],
    };
  }

  if (type === 'monthly') {
    return {
      title: selChild ? `${selChild.name} 월간 놀이평가 초안` : '월간 놀이평가 초안',
      badge: commonBadge,
      sections: [
        { title: '월간 놀이 흐름', text: `${subjectLabel}은(는) 이번 기간 ${categoryText} 영역의 경험을 주로 보였다. ${fallback}` },
        { title: '발달 및 성장 흐름', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : `기록 전반에서 ${categorySummary.topLabel} 관련 흥미와 참여가 관찰되었다.` },
        { title: '보육과정 평가', text: '유아의 흥미와 실제 놀이 흐름을 반영하여 보육과정이 운영되었으며, 기록을 통해 다음 지원 방향을 확인할 수 있었다.' },
        { title: '다음 달 운영 방향', text: '놀이가 자연스럽게 확장될 수 있도록 자료를 보완하고, 기록이 부족한 영역은 일과 속에서 의도적으로 관찰한다.', accent: true },
      ],
    };
  }

  if (type === 'parent') {
    return {
      title: selChild ? `${selChild.name} 부모상담자료 초안` : '부모상담자료 초안',
      badge: commonBadge,
      sections: [
        { title: '최근 성장 흐름', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : `${childNames.join(', ') || '유아'}의 최근 기록을 바탕으로 상담자료를 정리하였다.` },
        { title: '강점과 긍정적 모습', text: `${subjectLabel}은(는) 관심 있는 활동에 참여하며 자신의 생각과 감정을 표현하려는 모습을 보이고 있다.` },
        { title: '지원이 필요한 부분', text: supportText || '상황에 따라 교사의 안내를 받아 말로 표현하기, 차례 기다리기, 스스로 시도하기를 반복 경험하면 좋다.' },
        { title: '가정 연계 문장', text: '가정에서도 아이의 이야기를 충분히 들어주시고, 기다리기와 말로 표현하기를 자연스럽게 연습할 수 있도록 격려해 주세요.', accent: true },
      ],
    };
  }

  if (type === 'development') {
    return {
      title: selChild ? `${selChild.name} 발달평가 초안` : '발달평가 초안',
      badge: commonBadge,
      sections: [
        { title: '신체운동·건강', text: makeAreaText(records, 'body', `${subjectLabel}은(는) 일과와 놀이 속에서 신체를 조절하고 건강한 생활 경험을 쌓고 있다.`) },
        { title: '의사소통', text: makeAreaText(records, 'comm', `${subjectLabel}은(는) 자신의 생각과 감정을 말, 표정, 행동으로 표현하려는 모습을 보인다.`) },
        { title: '사회관계', text: makeAreaText(records, 'peer', `${subjectLabel}은(는) 또래와 함께 놀이하며 관계 맺기, 기다리기, 협력하기를 경험하고 있다.`) },
        { title: '예술경험', text: makeAreaText(records, 'art', `${subjectLabel}은(는) 다양한 재료와 표현 방식을 탐색하며 자신의 느낌을 나타낸다.`) },
        { title: '자연탐구', text: makeAreaText(records, 'nature', `${subjectLabel}은(는) 주변 사물과 자연현상에 관심을 가지고 관찰하고 탐색한다.`) },
        { title: '종합평가 및 지원계획', text: `${categorySummary.topLabel} 영역의 기록이 두드러지며, 앞으로 기록이 부족한 영역도 균형 있게 경험하도록 지원한다.`, accent: true },
      ],
    };
  }

  if (type === 'safety') {
    return {
      title: '안전교육·행사평가 초안',
      badge: commonBadge,
      sections: [
        { title: '활동 개요', text: `${formatDateKo(date)} 진행한 안전교육 또는 행사에서 유아들은 교사의 안내에 따라 활동에 참여하였다.` },
        { title: '유아 반응', text: samples.length ? fallback : '유아들은 새로운 경험에 관심을 보이며 교사의 설명을 듣고 활동에 참여하였다.' },
        { title: '교사 지원', text: '교사는 이동, 대기, 활동 참여 과정에서 안전 약속을 반복 안내하고 유아가 안정적으로 참여할 수 있도록 도왔다.' },
        { title: '평가 및 추후 지원', text: '활동은 유아의 발달 수준에 맞게 진행되었으며, 가정과도 안전 약속을 공유하고 일상 속에서 반복 경험하도록 지원한다.', accent: true },
      ],
    };
  }

  if (type === 'teacher') {
    return {
      title: '교사교육일지 초안',
      badge: commonBadge,
      sections: [
        { title: '교육명', text: '영유아 관찰기록과 놀이 중심 보육과정 운영의 실제' },
        { title: '교육 내용', text: '영유아의 놀이 장면을 객관적으로 기록하고, 기록을 보육일지·부모상담자료·발달평가·지원계획으로 연결하는 방법을 학습하였다.' },
        { title: '느낀 점', text: '관찰기록은 단순한 서류가 아니라 유아의 흥미와 발달을 이해하고 다음 지원을 계획하는 중요한 근거임을 확인하였다.' },
        { title: '현장 적용 계획', text: '매일 짧은 기록을 누적하고, 주간 단위로 놀이 흐름과 지원계획을 점검하여 문서 업무와 보육과정 운영을 함께 개선한다.', accent: true },
      ],
    };
  }

  if (type === 'weekplan') {
    return {
      title: '주간 계획안 초안',
      badge: commonBadge,
      sections: [
        { title: '목표 및 방향', text: `이번 주는 ${categorySummary.topLabel} 영역을 중심으로 유아의 자발적 놀이 흐름을 지원한다.` },
        { title: '놀이 주제', text: `${categoryText} 관련 놀이를 중심으로 유아의 흥미와 이전 기록을 반영하여 활동을 계획한다.` },
        { title: '요일별 활동', text: '월: 주제 소개 및 자료 탐색\n화: 소그룹 놀이 확장\n수: 바깥놀이 및 자유선택\n목: 표현 활동\n금: 한 주 놀이 되돌아보기' },
        { title: '환경 구성 및 가정연계', text: '관련 자료를 영역별로 배치하고, 가정에서도 주제와 연결된 대화를 나눌 수 있도록 안내한다.', accent: true },
      ],
    };
  }

  if (type === 'monthplan') {
    return {
      title: '월간 계획안 초안',
      badge: commonBadge,
      sections: [
        { title: '이달의 목표', text: `유아가 주도하는 놀이 흐름 속에서 ${categoryText} 영역의 경험을 확장한다.` },
        { title: '놀이 흐름 계획', text: '1주: 주제 도입 및 탐색\n2주: 또래와 협력하는 놀이 확장\n3주: 표현 및 심화 활동\n4주: 한 달 놀이 되돌아보기와 다음 달 준비' },
        { title: '발달영역별 지원 계획', text: '신체, 의사소통, 사회관계, 예술경험, 자연탐구, 기본생활습관이 일과 속에서 균형 있게 나타나도록 지원한다.' },
        { title: '행사·가정연계', text: '예정된 행사, 견학, 안전교육을 월간 흐름에 반영하고 가정 연계 안내를 준비한다.', accent: true },
      ],
    };
  }

  return {
    title: selChild ? `${selChild.name} 원장 검토자료 초안` : '원장 검토자료 초안',
    badge: commonBadge,
    sections: [
      { title: '기록 현황', text: `${subjectLabel}의 반영 기록은 ${records.length}건입니다.` },
      { title: '주요 흐름', text: `현재 기록은 ${categoryText} 영역에 집중되어 있습니다.` },
      { title: '검토 필요 사항', text: '기록이 적은 유아, 부족한 발달영역, 부정적 표현 순화 여부, 지원계획 포함 여부를 확인합니다.' },
      { title: '원장 검토 메모', text: '기록 누락을 보완하고 문서별 표현을 다듬으면 기관용 문서 완성도를 높일 수 있습니다.', accent: true },
    ],
  };
}

function buildDocument(type, records, date, cl, children, selChild, period) {
  const completeDoc = buildCompleteDocument(type, records, date, cl, selChild, period);
  if (completeDoc) return completeDoc;

  const childNames      = selChild
    ? [selChild.name]
    : [...new Set(records.map(r => r.childName))];
  const categorySummary = summarizeCategories(records);
  const periodLabel     = selChild
    ? (PERIOD_OPTIONS.find(p => p.key === period)?.label || '')
    : '';
  const subjectLabel    = selChild ? selChild.name : (cl?.name || '우리 반');
  const commonBadge     = selChild
    ? `${subjectLabel} · ${periodLabel} · ${records.length}건 반영`
    : `${formatDateKo(date)} 기준 · ${records.length}건 반영`;

  if (type === 'daily' && selChild) {
    return {
      title: `${selChild.name} 보육일지 초안`,
      badge: commonBadge,
      sections: [
        { title: '놀이 흐름 및 활동', text: records.length ? `${selChild.name}은(는) ${periodLabel} 동안 ${categorySummary.mainLabels}을(를) 중심으로 놀이를 이어갔다.` : `${selChild.name}의 해당 기간 기록이 없습니다.` },
        { title: '관찰된 발달 모습', text: makeChildSummaryText(selChild.name, records, categorySummary) },
        { title: '교사 지원 방향', text: `${selChild.name}의 흥미와 발달 수준을 고려하여 개별 상호작용 기회를 늘리고, 기록을 바탕으로 다음 지원계획을 구체화한다.`, accent: true },
      ],
    };
  }

  if (type === 'weekly') {
    return {
      title: selChild ? `${selChild.name} 주간 놀이평가 초안` : '주간 놀이평가 초안',
      badge: commonBadge,
      sections: [
        { title: '주간 놀이 흐름', text: `${subjectLabel}은(는) 이번 주 ${categorySummary.mainLabels}을 중심으로 놀이를 이어갔다. 기록 속에서 유아들은 관심 있는 자료를 스스로 선택하고, 또래와 상호작용하며 놀이를 확장하는 모습이 나타났다.` },
        { title: '유아 반응 및 배움', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : `${childNames.join(', ') || '유아들'}의 기록을 통해 호기심, 표현, 협력, 자립 시도가 관찰되었다.` },
        { title: '교사 지원 평가', text: '교사는 유아의 흥미가 이어질 수 있도록 자료와 공간을 조정하고, 갈등 상황에서는 말로 표현하는 모델링을 제공하였다.' },
        { title: '다음 주 예상놀이 및 지원계획', text: `다음 주에는 ${categorySummary.topLabel} 경험을 확장할 수 있는 자료를 추가로 제공한다.`, accent: true },
      ],
    };
  }

  if (type === 'monthly') {
    return {
      title: selChild ? `${selChild.name} 월간 놀이평가 초안` : '월간 놀이평가 초안',
      badge: commonBadge,
      sections: [
        { title: '월간 놀이 흐름', text: `${selChild ? `${selChild.name}은(는)` : `${cl?.name || '우리 반'} 유아들은`} 이번 달 ${categorySummary.mainLabels} 영역을 중심으로 놀이 기록이 누적되었다.` },
        { title: '발달적 의미', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : `기록 전반에서 ${categorySummary.topLabel} 관련 성장 모습이 두드러졌다.` },
        { title: '보육과정 평가', text: '놀이 중심 보육과정의 방향에 맞게 유아의 흥미가 활동 전개에 반영되었다.' },
        { title: '다음 달 운영 방향', text: '유아가 주도하는 놀이 흐름을 유지하되, 기록이 부족한 발달영역을 보완할 수 있는 환경을 구성한다.', accent: true },
      ],
    };
  }

  if (type === 'parent') {
    return {
      title: selChild ? `${selChild.name} 부모상담자료 초안` : '부모상담자료 초안',
      badge: commonBadge,
      sections: [
        { title: '상담 시작 인사말', text: `바쁘신 중에도 상담에 함께해 주셔서 감사합니다. 오늘은 ${selChild ? selChild.name : cl?.name || '우리 반 아이'}의 생활 모습과 성장 흐름을 중심으로 이야기 나누겠습니다.` },
        { title: '최근 성장 흐름', text: selChild ? makeChildSummaryText(selChild.name, records, categorySummary) : `${childNames.join(', ') || '유아'}의 최근 기록에서는 ${categorySummary.mainLabels} 영역의 경험이 많이 관찰되었습니다.` },
        { title: '강점 및 긍정적 모습', text: `${selChild ? selChild.name + '은(는)' : '아이들은'} 자신이 좋아하는 활동에 몰입하며 교사의 안내를 통해 새로운 경험을 시도하는 모습을 보입니다.` },
        { title: '가정 연계 제안', text: '가정에서도 아이의 이야기를 충분히 들어주시고, 스스로 해볼 수 있는 작은 역할을 맡겨 주세요.', accent: true },
      ],
    };
  }

  if (type === 'development') {
    return {
      title: selChild ? `${selChild.name} 발달평가 초안` : '발달평가 초안',
      badge: commonBadge,
      sections: [
        { title: '신체운동·건강', text: makeAreaText(records, 'body', `${selChild ? selChild.name + '은(는) ' : ''}신체 활동에 참여하며 몸을 조절하고 움직임을 즐기는 모습이 관찰된다.`) },
        { title: '의사소통',     text: makeAreaText(records, 'comm', `${selChild ? selChild.name + '은(는) ' : ''}자신의 생각과 감정을 말이나 행동으로 표현하려는 모습이 나타난다.`) },
        { title: '사회관계',     text: makeAreaText(records, 'peer', `${selChild ? selChild.name + '은(는) ' : ''}또래와 함께 놀이하며 차례, 협력, 감정 조절을 경험하고 있다.`) },
        { title: '예술경험',     text: makeAreaText(records, 'art',  `${selChild ? selChild.name + '은(는) ' : ''}다양한 재료와 표현 방법에 관심을 보이며 자신만의 방식으로 표현한다.`) },
        { title: '자연탐구',     text: makeAreaText(records, 'nature', `${selChild ? selChild.name + '은(는) ' : ''}주변 사물과 자연현상에 관심을 갖고 탐색하는 태도가 보인다.`) },
        { title: '종합평가 및 지원계획', text: `${selChild ? selChild.name + '의 ' : ''}전반적으로 ${categorySummary.topLabel} 영역의 경험이 풍부하게 관찰된다. 기록이 적은 영역도 균형 있게 경험할 수 있도록 환경을 조정한다.`, accent: true },
      ],
    };
  }

  if (type === 'safety') {
    return {
      title: '안전교육·행사평가 초안', badge: commonBadge,
      sections: [
        { title: '활동 개요', text: `${formatDateKo(date)} 진행한 안전교육 또는 행사에서 유아들은 교사의 안내를 들으며 활동에 참여하였다.` },
        { title: '유아 반응', text: records.length ? `관련 기록 ${records.length}건을 바탕으로 볼 때 유아들은 활동에 관심을 보이며 질문하거나 직접 시도하는 모습을 보였다.` : '유아들은 교사의 시범과 안내를 보며 안전한 행동 방법을 경험하였다.' },
        { title: '평가', text: '활동은 유아의 발달 수준에 맞게 진행되었으며, 반복 안내와 시각적 자료 제공이 안전 이해에 도움이 되었다.' },
        { title: '추후 지원', text: '가정과도 안전 약속을 공유하고, 원 생활 속에서 반복적으로 실천할 수 있도록 교사가 일상 장면에서 안내한다.', accent: true },
      ],
    };
  }

  if (type === 'teacher') {
    return {
      title: '교사교육일지 초안', badge: commonBadge,
      sections: [
        { title: '교육 주제', text: '영유아 관찰기록과 놀이 중심 보육과정 운영의 실제' },
        { title: '교육 내용', text: '유아의 놀이 장면을 짧고 객관적으로 기록하고, 기록을 바탕으로 보육일지·발달평가·부모상담자료로 연결하는 방법을 학습하였다.' },
        { title: '배운 점', text: '관찰기록은 단순한 업무 문서가 아니라 유아의 흥미와 발달을 이해하는 근거가 됨을 확인하였다.' },
        { title: '현장 적용 계획', text: '매일 짧은 기록을 누적하고, 주간 단위로 놀이 흐름과 지원계획을 점검한다.', accent: true },
      ],
    };
  }

  if (type === 'weekplan') {
    const cs = summarizeCategories(records);
    return {
      title: '주간 계획안 초안', badge: commonBadge,
      sections: [
        { title: '목표 및 방향', text: '이번 주는 ' + cs.topLabel + ' 영역을 중심으로 유아의 자발적 놀이 흐름을 지원하며, 또래 상호작용과 탐구심 확장을 도모한다.' },
        { title: '놀이 주제', text: cs.mainLabels + ' 관련 놀이 주제를 중심으로 이번 주 활동을 계획한다. 유아의 흥미와 지난 주 놀이 흐름을 반영하여 확장한다.' },
        { title: '월요일~금요일 활동', text: '월: 주제 소개 및 재료 탐색\n화: 소그룹 탐구 활동\n수: 바깥놀이 및 자유선택\n목: 창의 표현 활동\n금: 한 주 놀이 되돌아보기 및 정리' },
        { title: '환경 구성 계획', text: cs.topLabel + ' 영역을 지원하기 위해 관련 그림책, 자연물, 재료를 영역별로 배치한다. 유아가 스스로 선택하고 탐색할 수 있도록 접근성을 높인다.' },
        { title: '가정연계 내용', text: '가정에서도 이번 주 주제와 연계한 놀이를 함께할 수 있도록 안내장을 발송한다.', accent: true },
      ],
    };
  }

  if (type === 'monthplan') {
    const cs = summarizeCategories(records);
    return {
      title: '월간 계획안 초안', badge: commonBadge,
      sections: [
        { title: '이달의 목표', text: '유아가 주도하는 놀이 흐름 속에서 ' + cs.mainLabels + ' 영역의 경험을 확장한다. 또래와의 협력과 자립심을 기르는 일상을 지원한다.' },
        { title: '보육 주제', text: '이달의 중심 주제는 유아의 흥미와 계절적 특성을 반영하여 선정한다. 주제는 고정되지 않으며 유아의 놀이 흐름에 따라 유연하게 변화할 수 있다.' },
        { title: '놀이 흐름 계획', text: '1주: 이달 주제 도입 및 탐색\n2주: 또래와 협력하는 놀이 확장\n3주: 표현 및 심화 활동\n4주: 한 달 놀이 되돌아보기 및 다음 달 준비' },
        { title: '발달영역별 지원 계획', text: '신체: 대근육 활동 기회 확대\n의사소통: 그림책 읽기, 이야기 나누기\n사회관계: 소그룹 협력놀이\n예술: 다양한 매체 표현 경험\n자연탐구: 계절 자연물 탐색' },
        { title: '특별 행사·체험', text: '이달 예정된 행사, 견학, 안전교육 등을 기록하고 사전 안내를 준비한다.' },
        { title: '가정연계 및 안내', text: '월간 안내장 발송, 부모 상담 일정 안내, 가정 연계 놀이 제안을 포함한다.', accent: true },
      ],
    };
  }

  // review
  return {
    title: selChild ? `${selChild.name} 원장 검토자료 초안` : '원장 검토자료 초안',
    badge: commonBadge,
    sections: [
      { title: '기록 현황', text: `${selChild ? selChild.name + '의 ' : ''}${periodLabel} 누적 기록은 ${records.length}건입니다.` },
      { title: '주요 놀이·발달 흐름', text: `현재 기록은 ${categorySummary.mainLabels} 영역에 집중되어 있습니다.` },
      { title: '검토 필요 사항', text: '기록이 없는 유아, 기록이 적은 발달영역, 부정적 표현의 순화 여부를 확인하면 좋습니다.' },
      { title: '원장 검토 메모', text: '보육과정 운영 방향은 적절하며, 기록 누락을 보완하면 기관용 문서 완성도가 높아질 것으로 보입니다.', accent: true },
    ],
  };
}

// 아이별 요약 텍스트
function makeChildSummaryText(name, records, categorySummary) {
  if (records.length === 0)
    return `${name}의 해당 기간 기록이 충분하지 않아 상세 내용을 작성하기 어렵습니다. 추가 관찰기록 후 재생성해 주세요.`;
  const obs = records.map(r => r.observation || r.rawText).filter(Boolean);
  const sample = obs.slice(0, 2).join(' / ');
  return `${name}은(는) 해당 기간 동안 ${categorySummary.mainLabels}을(를) 중심으로 활동하였다. 관찰 내용: "${sample}"${obs.length > 2 ? ' 외 ' + (obs.length - 2) + '건' : ''}.`;
}

function summarizeCategories(records) {
  const counts = {};
  records.forEach(r => { counts[r.category || 'play'] = (counts[r.category || 'play'] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.slice(0, 3).map(([k]) => CATEGORIES[k]?.label || '놀이·활동');
  return {
    topLabel:   labels[0] || '놀이·활동',
    mainLabels: labels.length ? labels.join(', ') : '놀이·활동',
  };
}

function makeAreaText(records, category, fallback) {
  const samples = records.filter(r => r.category === category);
  if (samples.length === 0)
    return `${fallback} 아직 해당 영역의 기록이 충분하지 않아, 다음 관찰에서 더 살펴볼 필요가 있다.`;
  const names = [...new Set(samples.map(r => r.childName))].slice(0, 3).join(', ');
  return `${names}의 기록에서 ${fallback} 관련 관찰이 ${samples.length}건 확인되었다.`;
}

// ── 양식 적용 헬퍼 ────────────────────────────────────────────────────────────
const PERIOD_LABELS_KO = { date:'선택 날짜', '1month':'1개월', '3months':'3개월', '6months':'6개월', '1year':'1년' };

function resolveAutoField(key, { selChild, cl, period, doc }) {
  if (key === '__date__')      return doc?.badge?.split(' · ')[0] || '';
  if (key === '__childName__') return selChild?.name || '';
  if (key === '__className__') return cl ? `${cl.name} ${cl.age}세반` : '';
  if (key === '__period__')    return PERIOD_LABELS_KO[period] || '';
  return null;
}

// 양식 기반으로 doc을 재구성 → ShareButton / CopyAllButton에 전달
function applyFormToDoc(doc, form, ctx) {
  const newSections = (form.fields || []).map(field => {
    const auto = resolveAutoField(field.mappedTo, { ...ctx, doc });
    if (auto !== null) return { title: field.label, text: auto };
    const matched = (doc.sections || []).find(s => s.title === field.mappedTo);
    let text = matched ? matched.text : '';
    if (field.charLimit && text.length > field.charLimit) text = text.slice(0, field.charLimit) + '…';
    return { title: field.label, text };
  });
  return { ...doc, title: `${form.name} — ${doc.title}`, sections: newSections };
}

// ── 서브 컴포넌트 ────────────────────────────────────────────────────────────

// 양식 뷰 렌더러 — 이미지 있으면 오버레이, 없으면 텍스트 목록
function FormAppliedView({ doc, form, selChild, cl, period }) {
  if (form.imageData) {
    return <ImageOverlayView doc={doc} form={form} selChild={selChild} cl={cl} period={period} />;
  }
  const PERIOD_OPTIONS_MAP = { date:'선택 날짜', '1month':'1개월', '3months':'3개월', '6months':'6개월', '1year':'1년' };
  return (
    <div>
      {/* 양식 제목 헤더 */}
      <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary)', borderRadius:14, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:900, color:'var(--primary)', marginBottom:4 }}>📋 {form.name}</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {selChild && <span style={{ fontSize:11, background:'var(--white)', color:'var(--text-secondary)', padding:'3px 8px', borderRadius:6, fontWeight:700 }}>👤 {selChild.name}</span>}
          {cl && <span style={{ fontSize:11, background:'var(--white)', color:'var(--text-secondary)', padding:'3px 8px', borderRadius:6, fontWeight:700 }}>🏫 {cl.name}</span>}
          {period && <span style={{ fontSize:11, background:'var(--white)', color:'var(--text-secondary)', padding:'3px 8px', borderRadius:6, fontWeight:700 }}>📆 {PERIOD_OPTIONS_MAP[period]}</span>}
        </div>
      </div>
      {(form.fields || []).map((field, i) => {
        const auto = resolveAutoField(field.mappedTo, { selChild, cl, period, doc });
        let text = auto !== null ? auto : '';
        if (!text) { const m = (doc.sections||[]).find(s => s.title===field.mappedTo); text = m?.text || ''; }
        const isOver = field.charLimit && text.length > field.charLimit;
        const display = isOver ? text.slice(0, field.charLimit) + '…' : text;
        return <FormFieldView key={field.id||i} label={field.label} text={display} charLimit={field.charLimit} charCount={text.length} isOver={isOver} mappedTo={field.mappedTo}/>;
      })}
    </div>
  );
}

// 이미지 오버레이 뷰 — 텍스트가 직접 빈칸에 표시됨
function ImageOverlayView({ doc, form, selChild, cl, period }) {

  // 각 필드의 채워진 텍스트 계산
  const filledFields = (form.fields || []).map(field => {
    const auto = resolveAutoField(field.mappedTo, { selChild, cl, period, doc });
    let text = auto !== null ? auto : '';
    if (!text) { const m = (doc.sections || []).find(s => s.title === field.mappedTo); text = m?.text || ''; }
    const display = field.charLimit && text.length > field.charLimit ? text.slice(0, field.charLimit) + '…' : text;
    return { ...field, filledText: display };
  });

  // 새 창 인쇄 함수
  const handleFormPrint = () => {
    const pw = window.open('', '_blank', 'width=900,height=1200');
    const textItems = filledFields
      .filter(f => f.x != null && f.filledText?.trim())
      .map(f => `<div style="position:absolute;left:${f.x}%;top:${f.y}%;width:${f.fieldWidth||30}%;transform:translateY(-50%);font-size:10.5pt;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#000;line-height:1.5;word-break:keep-all;white-space:pre-wrap;">${f.filledText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</div>`).join('');
    pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{margin:0;}body{margin:0;padding:0;}.wrap{position:relative;width:100%;}img{width:100%;display:block;}</style></head><body><div class="wrap"><img src="${form.imageData}"/>${textItems}</div><script>window.onload=function(){setTimeout(function(){window.print();},300);}</script></body></html>`);
    pw.document.close();
  };

  return (
    <div>
      {/* 안내 + 인쇄 버튼 */}
      <div className="no-print" style={{ background:'var(--primary-light)', border:'1px solid var(--primary)', borderRadius:12, padding:'10px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ fontSize:12, color:'var(--primary)', fontWeight:700, lineHeight:1.7 }}>
          📌 빈칸 위치에 내용이 바로 표시됩니다.<br/>
          <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>인쇄 버튼을 누르면 채워진 양식만 출력돼요.</span>
        </div>
        <button
          onClick={handleFormPrint}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:11, background:'var(--primary)', color:'white', fontSize:13, fontWeight:900, flexShrink:0 }}
        >
          <Printer size={14}/> 양식 인쇄
        </button>
      </div>

      {/* 이미지 + 텍스트 오버레이 */}
      <div style={{ position:'relative', width:'100%' }}>
        <img
          src={form.imageData} alt="양식"
          style={{ width:'100%', display:'block', borderRadius:12, border:'1.5px solid var(--border)', boxShadow:'var(--shadow-md)' }}
        />
        {filledFields.map((field, i) => {
          if (field.x == null || field.y == null) return null;
          const isEmpty = !field.filledText?.trim();
          const w = field.fieldWidth || 30;
          return (
            <div
              key={field.id || i}
              style={{
                position: 'absolute',
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${w}%`,
                transform: 'translateY(-50%)',
                zIndex: 5,
              }}
            >
              {/* 화면용: 번호 뱃지 */}
              <div className="no-print" style={{
                position: 'absolute', top: -10, left: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: isEmpty ? 'var(--gray-400)' : 'var(--primary)',
                color: 'white', fontSize: 9, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid white', zIndex: 1,
              }}>{i + 1}</div>
              {/* 텍스트 — 화면 + 인쇄 공통 */}
              <div style={{
                fontSize: 11,
                fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif",
                lineHeight: 1.55,
                color: isEmpty ? 'transparent' : '#111',
                background: isEmpty ? 'transparent' : 'rgba(255,255,255,0.88)',
                padding: isEmpty ? 0 : '2px 4px',
                borderRadius: 2,
                wordBreak: 'keep-all',
                whiteSpace: 'pre-wrap',
                minHeight: 14,
              }}>
                {field.filledText || ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* 텍스트 목록 (접기) */}
      <details className="no-print" style={{ marginTop:12 }}>
        <summary style={{ fontSize:13, fontWeight:800, color:'var(--text-secondary)', cursor:'pointer', padding:'10px 0', userSelect:'none' }}>
          📄 채워진 내용 전체 보기 ({filledFields.filter(f=>f.filledText?.trim()).length}/{filledFields.length}칸)
        </summary>
        <div style={{ marginTop:8 }}>
          {filledFields.map((field, i) => {
            const isOver = field.charLimit && field.filledText?.length > field.charLimit;
            return <FormFieldView key={field.id||i} label={field.label} text={field.filledText} charLimit={field.charLimit} charCount={field.filledText?.length||0} isOver={isOver} mappedTo={field.mappedTo}/>;
          })}
        </div>
      </details>
    </div>
  );
}

function FormFieldView({ label, text, charLimit, charCount, isOver, mappedTo }) {
  const [copied, setCopied] = useState(false);
  const isEmpty = !text?.trim();
  const isAuto  = mappedTo?.startsWith('__');
  const display = isOver ? text.slice(0, charLimit) + '…' : text;
  return (
    <div style={{
      background: isEmpty ? 'var(--gray-50)' : 'var(--white)',
      border: `1px solid ${isOver ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius:14, padding:'14px 16px', marginBottom:10,
      boxShadow: isEmpty ? 'none' : 'var(--shadow-sm)',
    }}>
      {/* 칸 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:13, fontWeight:900, color: isEmpty ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{label}</span>
          {isAuto && <span style={{ fontSize:10, background:'var(--primary-light)', color:'var(--primary)', padding:'2px 6px', borderRadius:5, fontWeight:800 }}>자동</span>}
          {!mappedTo && <span style={{ fontSize:10, background:'var(--gray-100)', color:'var(--text-tertiary)', padding:'2px 6px', borderRadius:5, fontWeight:700 }}>미연결</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {charLimit && (
            <span style={{ fontSize:11, fontWeight:700, color: isOver ? 'var(--accent)' : 'var(--text-tertiary)' }}>
              {charCount}/{charLimit}자 {isOver && '⚠️ 초과'}
            </span>
          )}
          {!isEmpty && (
            <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),1500); }}
              style={{ minWidth:64, minHeight:34, padding:'7px 12px', borderRadius:10, background:'var(--gray-100)', fontSize:13, color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontWeight:900 }}>
              {copied ? <><Check size={14}/> 복사됨</> : <><Copy size={14}/> 복사</>}
            </button>
          )}
        </div>
      </div>
      {/* 내용 */}
      {isEmpty ? (
        <div style={{ fontSize:13, color:'var(--text-tertiary)', fontStyle:'italic' }}>
          {mappedTo ? '내용이 없어요' : '앱 섹션이 연결되지 않았어요 (설정 > 원 양식에서 수정)'}
        </div>
      ) : (
        <div style={{ fontSize:14, lineHeight:1.85, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>{display}</div>
      )}
    </div>
  );
}

function RecordPreview({ records, onNavigate }) {
  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--white)', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 14 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 10 }}>반영할 기록이 없어요</div>
        <button onClick={() => onNavigate('record')} style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontWeight: 800 }}>
          기록하러 가기
        </button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {records.slice(0, 5).map(r => {
        const cat = CATEGORIES[r.category] || CATEGORIES.special;
        return (
          <div key={r.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{r.childName}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, background: cat.bg, padding: '2px 8px', borderRadius: 100 }}>{cat.emoji} {cat.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(r.date)}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {r.observation || r.rawText}
            </div>
          </div>
        );
      })}
      {records.length > 5 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>외 {records.length - 5}건 더 반영됩니다.</div>}
    </div>
  );
}

function DocumentSection({ title, text, accent, onUpdate }) {
  const { showToast } = useToast();
  const [editing, setEditing]     = useState(false);
  const [editVal, setEditVal]     = useState(text || '');
  const [baseline, setBaseline]   = useState(text || ''); // 편집 시작 시점의 text
  const [history, setHistory]     = useState([]);
  const [showHist, setShowHist]   = useState(false);

  // 편집 중이 아닐 때만 외부 text 변경을 반영 (편집 중 외부 재생성이 편집값을 덮어쓰지 않도록)
  useEffect(() => {
    if (!editing) {
      setEditVal(text || '');
      setBaseline(text || '');
    }
  }, [text, editing]);

  const startEdit = useCallback(() => {
    setBaseline(text || ''); // 편집 시작 시점 스냅샷
    setEditVal(text || '');
    setEditing(true);
  }, [text]);

  const saveEdit = useCallback(() => {
    if (editVal !== baseline) {
      setHistory(prev => [baseline, ...prev].slice(0, 10));
      onUpdate?.(editVal);
    }
    setEditing(false);
  }, [editVal, baseline, onUpdate]);

  const restore = useCallback((old) => {
    setHistory(prev => [text, ...prev.filter(h => h !== old)].slice(0, 10));
    onUpdate?.(old);
    setShowHist(false);
    setEditing(false); // 편집 모드 닫기
    showToast('이전 버전으로 복원했어요', 'success');
  }, [text, onUpdate, showToast]);

  if (!text) return null;
  return (
    <div className="print-section" style={{
      background: accent ? 'var(--primary-light)' : 'var(--white)',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 15, padding: 16, marginBottom: 11,
      boxShadow: accent ? '0 8px 18px rgba(79,127,255,0.08)' : 'var(--shadow-sm)',
    }}>
      <div className="print-section-title no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {history.length > 0 && (
            <button
              onClick={() => setShowHist(p => !p)}
              style={{ minHeight: 34, padding: '7px 10px', borderRadius: 10, background: 'var(--gray-100)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
            >
              <History size={13} /> {history.length}
            </button>
          )}
          <button
            onClick={() => { editing ? setEditing(false) : startEdit(); }}
            style={{ minHeight: 34, padding: '7px 10px', borderRadius: 10, background: editing ? 'var(--primary)' : 'var(--gray-100)', fontSize: 11, color: editing ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
          >
            ✏️ {editing ? '취소' : '수정'}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(text); showToast('복사했어요! 📋', 'success'); }}
            style={{ minWidth: 60, minHeight: 34, padding: '7px 10px', borderRadius: 10, background: accent ? 'var(--white)' : 'var(--gray-100)', fontSize: 13, color: accent ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontWeight: 900 }}
          >
            <Copy size={14} /> 복사
          </button>
        </div>
      </div>

      {/* 히스토리 드롭다운 */}
      {showHist && history.length > 0 && (
        <div style={{ marginBottom: 10, background: 'var(--gray-50)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 6 }}>이전 버전 ({history.length}개)</div>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{h}</div>
              <button onClick={() => restore(h)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 100, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                <RotateCcw size={11} /> 복원
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 편집 모드 */}
      {editing ? (
        <div>
          <textarea
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            style={{ width: '100%', minHeight: 140, padding: 12, borderRadius: 10, border: '1.5px solid var(--primary)', fontSize: 14, lineHeight: 1.8, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={saveEdit} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer' }}>저장</button>
            <button onClick={() => setEditing(false)} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      ) : (
        <>
          {/* 인쇄용 제목 */}
          <div className="print-section-title" style={{ display: 'none' }}>{title}</div>
          <div className="print-section-body" style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{text}</div>
        </>
      )}
    </div>
  );
}

function ShareButton({ doc }) {
  const showToast = useToast();
  if (!doc) return null;
  const getText = () =>
    `${doc.title}\n${doc.badge}\n\n` + (doc.sections||[]).map(s => `[${s.title}]\n${s.text}`).join('\n\n') + '\n\n— 쌤워크로 작성';
  const handleShare = async () => {
    const text = getText();
    if (navigator.share) {
      try { await navigator.share({ title: doc.title, text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    showToast('복사했어요! 📋', 'success');
  };
  return (
    <button onClick={handleShare} className="no-print" style={{
      display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
      background:'var(--primary)', color:'white', fontSize:13, fontWeight:800,
    }}>
      <Share2 size={14}/> 공유
    </button>
  );
}

function safeFileName(value) {
  return String(value || '문서').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DownloadButton({ doc }) {
  const showToast = useToast();
  if (!doc) return null;
  const handleDownload = () => {
    const text = formatDocumentForCopy(doc, 'detail');
    downloadTextFile(`${safeFileName(doc.title)}.txt`, text);
    showToast('TXT 파일로 저장했어요.', 'success');
  };
  return (
    <button onClick={handleDownload} className="no-print" style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
      background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 900,
    }}>
      <Download size={14}/> TXT
    </button>
  );
}

function WordButton({ doc }) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  if (!doc) return null;
  const handleExport = async () => {
    setBusy(true);
    try {
      await exportDocx(doc);
      showToast('Word(.docx) 파일로 저장했어요. 한글에서도 열려요!', 'success');
    } catch {
      showToast('Word 파일 생성 중 오류가 발생했어요.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={handleExport} disabled={busy} className="no-print" style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
      background: '#2B579A', color: 'white', fontSize: 13, fontWeight: 900, opacity: busy ? 0.6 : 1,
    }}>
      <FileText size={14}/> {busy ? '생성 중…' : 'Word'}
    </button>
  );
}

function formatDocumentForCopy(doc, mode) {
  const sections = doc.sections || [];
  if (mode === 'short') {
    return `${doc.title}\n${doc.badge}\n\n` + sections.map(s => `${s.title}: ${(s.text || '').split(/[.!?]\s/)[0] || s.text}`).join('\n');
  }
  if (mode === 'table') {
    return `문서명\t${doc.title}\n정보\t${doc.badge}\n\n항목\t내용\n` + sections.map(s => `${s.title}\t${String(s.text || '').replace(/\n/g, ' ')}`).join('\n');
  }
  if (mode === 'detail') {
    return `${doc.title}\n${doc.badge}\n\n` + sections.map((s, i) => `${i + 1}. ${s.title}\n${s.text}`).join('\n\n') + '\n\n검토 메모:\n- 표현은 기관 상황에 맞게 최종 확인해 주세요.\n- 진단 표현 대신 관찰 사실과 지원 방향 중심으로 사용해 주세요.';
  }
  return `${doc.title}\n${doc.badge}\n\n` + sections.map(s => `[${s.title}]\n${s.text}`).join('\n\n');
}

function CopyAllButton({ doc }) {
  const showToast = useToast();
  const [copyMode, setCopyMode] = useState('paragraph');
  const handleCopyAll = () => {
    const text = formatDocumentForCopy(doc, copyMode);
    navigator.clipboard.writeText(text);
    showToast('전체 복사했어요! 📋', 'success');
  };
  const modes = [
    ['paragraph', '문단형'],
    ['table', '표형'],
    ['short', '짧은형'],
    ['detail', '자세한형'],
  ];
  return (
    <div className="no-print" style={{ marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
        {modes.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCopyMode(key)}
            style={{
              padding: '8px 6px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 900,
              background: copyMode === key ? 'var(--primary-light)' : 'var(--gray-100)',
              color: copyMode === key ? 'var(--primary)' : 'var(--text-secondary)',
              border: `1.5px solid ${copyMode === key ? 'var(--primary)' : 'transparent'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <button onClick={handleCopyAll} style={{
        width: '100%', padding: '14px', borderRadius: 14, background: 'var(--gray-800)', color: 'white',
        fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        <Copy size={16} /> {modes.find(([key]) => key === copyMode)?.[1]} 전체 복사
      </button>
    </div>
  );
}

function EmptyGuide({ activeType, onNavigate }) {
  const isManagement = ['teacher', 'safety'].includes(activeType);
  return (
    <div style={{ background: 'var(--white)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{isManagement ? '🧩' : '✨'}</div>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>생성 버튼을 누르면 초안이 만들어져요</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>짧은 기록이 많을수록 문서가 더 개인화됩니다.</div>
      <button onClick={() => onNavigate('record')} style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800 }}>
        기록 추가하기
      </button>
    </div>
  );
}

function Spinner({ dark }) {
  return <div style={{ width: 16, height: 16, border: `2px solid ${dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)'}`, borderTopColor: dark ? 'white' : 'var(--gray-800)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}
