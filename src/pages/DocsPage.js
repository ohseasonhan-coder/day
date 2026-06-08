import React, { useState, useEffect } from 'react';
import { getRecords, getRecordsByDate, getClasses, getChildren, today, formatDateKo, formatDate, CATEGORIES, addDocumentDraft } from '../utils/storage';
import { generateDailyJournal } from '../utils/ai';
import { FileText, Sparkles, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';

const DOC_TYPES = [
  { key: 'daily', label: '보육일지', icon: '📄', desc: '오늘 기록으로 일일 보육일지 초안 생성' },
  { key: 'weekly', label: '주간 놀이평가', icon: '🗓️', desc: '최근 7일 놀이 흐름과 다음 지원계획 정리' },
  { key: 'monthly', label: '월간 놀이평가', icon: '📊', desc: '이번 달 놀이 흐름·평가·확장계획 정리' },
  { key: 'parent', label: '부모상담자료', icon: '💬', desc: '아이별 상담에 바로 쓰는 문장 묶음' },
  { key: 'development', label: '발달평가', icon: '🌱', desc: '발달영역별 관찰 근거와 지원계획' },
  { key: 'safety', label: '안전·행사평가', icon: '🛡️', desc: '안전교육·견학·행사 후 평가 문서' },
  { key: 'teacher', label: '교사교육일지', icon: '👩‍🏫', desc: '교사교육 후 적용계획까지 정리' },
  { key: 'review', label: '원장 검토', icon: '✅', desc: '누락·표현·지원계획 검토용 요약' },
];

export default function DocsPage({ onNavigate, isDesktop }) {
  const [viewDate, setViewDate] = useState(today());
  const [dayRecords, setDayRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('daily');
  const [showRecords, setShowRecords] = useState(false);

  useEffect(() => {
    setDayRecords(getRecordsByDate(viewDate));
    setAllRecords(getRecords());
    setChildren(getChildren());
    setClasses(getClasses());
    setDoc(null);
  }, [viewDate, activeType]);

  const cl = classes[0];
  const current = DOC_TYPES.find(t => t.key === activeType) || DOC_TYPES[0];
  const targetRecords = getTargetRecords(activeType, viewDate, dayRecords, allRecords);
  const isToday = viewDate === today();

  const changeDate = (delta) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const handleGenerate = async () => {
    if (targetRecords.length === 0 && !['teacher', 'safety'].includes(activeType)) {
      alert('문서를 만들 기록이 없어요. 먼저 기록 탭에서 관찰기록을 남겨주세요.');
      return;
    }
    setLoading(true);
    try {
      let generated;
      if (activeType === 'daily') {
        const res = await generateDailyJournal({
          records: targetRecords,
          date: viewDate,
          classAge: cl?.age,
          className: cl?.name,
        });
        generated = {
          title: '보육일지 초안',
          badge: `${formatDateKo(viewDate)} · ${targetRecords.length}건 반영`,
          sections: [
            { title: '놀이 흐름 및 활동', text: res.playFlow },
            { title: '유아 반응', text: res.childResponse },
            { title: '교사 지원', text: res.teacherSupport },
            { title: '오늘 평가', text: res.evaluation },
            { title: '다음 지원계획', text: res.nextPlan, accent: true },
          ],
        };
      } else {
        generated = buildDocument(activeType, targetRecords, viewDate, cl, children);
      }
      const savedDraft = addDocumentDraft({
        ...generated,
        type: activeType,
        date: viewDate,
        classId: cl?.id,
        className: cl?.name,
        sourceRecordIds: targetRecords.map(r => r.id),
      });
      setDoc(savedDraft);
    } catch (e) {
      alert(e.message || '문서 생성 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  const DateNav = (
    <div style={{
      background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button onClick={() => changeDate(-1)} style={{ color: 'var(--text-secondary)', padding: 4 }}>
        <ChevronLeft size={20} />
      </button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{formatDateKo(viewDate)}</div>
        <div style={{ fontSize: 12, color: isToday ? 'var(--primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 700 : 400 }}>
          {isToday ? '오늘' : viewDate}
        </div>
      </div>
      <button onClick={() => changeDate(1)} style={{ color: 'var(--text-secondary)', padding: 4 }} disabled={isToday}>
        <ChevronRight size={20} style={{ opacity: isToday ? 0.3 : 1 }} />
      </button>
    </div>
  );

  const TypeSelector = (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 18 }}>
      {DOC_TYPES.map(t => (
        <button
          key={t.key}
          onClick={() => { setActiveType(t.key); setShowRecords(false); }}
          style={{
            textAlign: 'left', borderRadius: 16, padding: '13px 12px',
            border: `1px solid ${activeType === t.key ? 'var(--primary)' : 'var(--border)'}`,
            background: activeType === t.key ? 'var(--primary-light)' : 'white',
            boxShadow: activeType === t.key ? '0 8px 18px rgba(79,127,255,0.12)' : 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: isDesktop ? 0 : 5 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: activeType === t.key ? 'var(--primary)' : 'var(--text-primary)' }}>{t.label}</span>
          </div>
          {!isDesktop && <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{t.desc}</div>}
        </button>
      ))}
    </div>
  );

  const GeneratePanel = (
    <>
      <div style={{ background: 'linear-gradient(135deg, var(--gray-800), var(--gray-700))', color: 'white', borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4 }}>{current.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{current.icon} {current.label} 초안</div>
            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6, marginTop: 4 }}>{current.desc}</div>
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
          {loading ? <><Spinner dark /> 문서 작성 중...</> : <><FileText size={17} /> {current.label} 생성하기</>}
        </button>
      </div>

      <button
        onClick={() => setShowRecords(v => !v)}
        style={{ width: '100%', marginBottom: 14, padding: '12px 14px', borderRadius: 14, background: 'white', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>반영되는 기록 확인</span>
        <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800 }}>{targetRecords.length}건</span>
      </button>

      {showRecords && <RecordPreview records={targetRecords} onNavigate={onNavigate} />}

      {doc ? (
        <div className="slide-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FileText size={18} color="var(--primary)" />
            <span style={{ fontWeight: 900, fontSize: 17 }}>{doc.title}</span>
            <span style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 9px', borderRadius: 100, fontWeight: 800 }}>
              {doc.badge}
            </span>
          </div>
          {doc.sections.map((s, i) => (
            <DocumentSection key={`${s.title}-${i}`} title={s.title} text={s.text} accent={s.accent} />
          ))}
          <CopyAllButton doc={doc} />
          <button
            onClick={() => { setDoc(null); handleGenerate(); }}
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

  if (isDesktop) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
            <Sparkles size={13} /> 문서 자동화 센터
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.7px' }}>기록을 문서로 바꾸는 곳</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            보육일지부터 부모상담자료, 발달평가, 행사평가, 원장 검토자료까지 한 번에 초안을 만듭니다.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28, alignItems: 'start' }}>
          {/* 왼쪽: 문서 유형 선택 */}
          <div>
            {DateNav}
            {TypeSelector}
          </div>
          {/* 오른쪽: 생성 영역 */}
          <div>{GeneratePanel}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 100, padding: '5px 10px', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
          <Sparkles size={13} /> 문서 자동화 센터
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.7px' }}>기록을 문서로 바꾸는 곳</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          보육일지부터 부모상담자료, 발달평가, 행사평가, 원장 검토자료까지 한 번에 초안을 만듭니다.
        </div>
      </div>
      {DateNav}
      {TypeSelector}
      {GeneratePanel}
    </div>
  );
}

function getTargetRecords(type, viewDate, dayRecords, allRecords) {
  if (type === 'daily') return dayRecords;
  const target = new Date(viewDate);
  if (type === 'weekly') {
    return allRecords.filter(r => daysBetween(target, new Date(r.date)) >= 0 && daysBetween(target, new Date(r.date)) <= 6);
  }
  if (type === 'monthly' || type === 'review') {
    return allRecords.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
    });
  }
  if (type === 'parent' || type === 'development') {
    return allRecords.filter(r => daysBetween(target, new Date(r.date)) >= 0 && daysBetween(target, new Date(r.date)) <= 90);
  }
  return dayRecords.length ? dayRecords : allRecords.slice(0, 8);
}

function daysBetween(later, earlier) {
  return Math.floor((later - earlier) / 86400000);
}

function buildDocument(type, records, date, cl, children) {
  const childNames = [...new Set(records.map(r => r.childName))];
  const categorySummary = summarizeCategories(records);
  const commonBadge = `${formatDateKo(date)} 기준 · ${records.length}건 반영`;

  if (type === 'weekly') {
    return {
      title: '주간 놀이평가 초안',
      badge: commonBadge,
      sections: [
        { title: '주간 놀이 흐름', text: `${cl?.name || '우리 반'} 유아들은 이번 주 ${categorySummary.mainLabels}을 중심으로 놀이를 이어갔다. 기록 속에서 유아들은 관심 있는 자료를 스스로 선택하고, 또래와 상호작용하며 놀이를 확장하는 모습이 나타났다.` },
        { title: '유아 반응 및 배움', text: `${childNames.join(', ') || '유아들'}의 기록을 통해 호기심, 표현, 협력, 자립 시도가 관찰되었다. 특히 ${categorySummary.topLabel} 관련 경험이 반복되며 놀이 주제에 대한 몰입이 높아졌다.` },
        { title: '교사 지원 평가', text: '교사는 유아의 흥미가 이어질 수 있도록 자료와 공간을 조정하고, 갈등 상황에서는 말로 표현하는 모델링을 제공하였다. 개별 유아의 발달 수준에 맞춰 기다림과 격려를 함께 제공한 점이 적절했다.' },
        { title: '다음 주 예상놀이 및 지원계획', text: `다음 주에는 ${categorySummary.topLabel} 경험을 확장할 수 있는 자료를 추가로 제공하고, 기록이 적은 유아도 자연스럽게 참여할 수 있도록 소집단 놀이를 계획한다.`, accent: true },
      ],
    };
  }

  if (type === 'monthly') {
    return {
      title: '월간 놀이평가 초안',
      badge: commonBadge,
      sections: [
        { title: '월간 놀이 흐름', text: `이번 달 ${cl?.name || '우리 반'}의 놀이 기록은 ${categorySummary.mainLabels} 영역을 중심으로 누적되었다. 유아들은 반복 놀이를 통해 익숙함을 느끼고, 새로운 자료가 제공될 때 놀이 방법을 스스로 바꾸어보는 모습을 보였다.` },
        { title: '발달적 의미', text: `기록 전반에서 ${categorySummary.topLabel} 관련 성장 모습이 두드러졌다. 또래관계, 의사소통, 신체 움직임, 탐구 태도 등 여러 발달영역이 놀이 안에서 통합적으로 나타났다.` },
        { title: '보육과정 평가', text: '놀이 중심 보육과정의 방향에 맞게 유아의 흥미가 활동 전개에 반영되었다. 다만 특정 영역이나 특정 유아에게 기록이 집중되지 않도록 다음 달에는 관찰 균형을 더 점검할 필요가 있다.' },
        { title: '다음 달 운영 방향', text: '유아가 주도하는 놀이 흐름을 유지하되, 기록이 부족한 발달영역을 보완할 수 있는 환경을 구성한다. 가정과 공유할 수 있는 놀이 사진과 짧은 배움 문장도 함께 정리한다.', accent: true },
      ],
    };
  }

  if (type === 'parent') {
    return {
      title: '부모상담자료 초안',
      badge: `${childNames.length}명 · ${records.length}건 반영`,
      sections: [
        { title: '상담 시작 인사말', text: `바쁘신 중에도 상담에 함께해 주셔서 감사합니다. 오늘은 ${cl?.name || '우리 반'}에서 관찰된 아이의 생활 모습과 성장 흐름을 중심으로 이야기 나누겠습니다.` },
        { title: '최근 성장 흐름', text: `${childNames.join(', ') || '유아'}의 최근 기록에서는 ${categorySummary.mainLabels} 영역의 경험이 많이 관찰되었습니다. 원에서는 아이가 자신의 관심을 표현하고 또래와 함께 놀이를 이어가는 모습을 세심하게 살피고 있습니다.` },
        { title: '강점 및 긍정적 모습', text: '아이는 자신이 좋아하는 활동에 몰입하며, 교사의 안내를 통해 새로운 경험을 시도하는 모습을 보입니다. 작은 성공 경험을 통해 자신감이 쌓이고 있으며, 일상 속 자립 시도도 점차 늘고 있습니다.' },
        { title: '가정 연계 제안', text: '가정에서도 아이의 이야기를 충분히 들어주시고, 스스로 해볼 수 있는 작은 역할을 맡겨 주세요. 원과 가정이 같은 방향으로 격려하면 아이의 안정감과 표현력이 더 잘 자랄 수 있습니다.', accent: true },
      ],
    };
  }

  if (type === 'development') {
    return {
      title: '발달평가 초안',
      badge: commonBadge,
      sections: [
        { title: '신체운동·건강', text: makeAreaText(records, 'body', '신체 활동에 참여하며 몸을 조절하고 움직임을 즐기는 모습이 관찰된다.') },
        { title: '의사소통', text: makeAreaText(records, 'comm', '자신의 생각과 감정을 말이나 행동으로 표현하려는 모습이 나타난다.') },
        { title: '사회관계', text: makeAreaText(records, 'peer', '또래와 함께 놀이하며 차례, 협력, 감정 조절을 경험하고 있다.') },
        { title: '예술경험', text: makeAreaText(records, 'art', '다양한 재료와 표현 방법에 관심을 보이며 자신만의 방식으로 표현한다.') },
        { title: '자연탐구', text: makeAreaText(records, 'nature', '주변 사물과 자연현상에 관심을 갖고 탐색하는 태도가 보인다.') },
        { title: '종합평가 및 지원계획', text: `전반적으로 ${categorySummary.topLabel} 영역의 경험이 풍부하게 관찰된다. 앞으로는 기록이 적은 영역도 균형 있게 경험할 수 있도록 놀이 환경과 교사 상호작용을 조정한다.`, accent: true },
      ],
    };
  }

  if (type === 'safety') {
    return {
      title: '안전교육·행사평가 초안',
      badge: commonBadge,
      sections: [
        { title: '활동 개요', text: `${formatDateKo(date)} 진행한 안전교육 또는 행사에서 유아들은 교사의 안내를 들으며 활동에 참여하였다. 활동 전 안전 약속을 확인하고, 상황에 맞는 행동을 경험할 수 있도록 지원하였다.` },
        { title: '유아 반응', text: records.length ? `관련 기록 ${records.length}건을 바탕으로 볼 때 유아들은 활동에 관심을 보이며 질문하거나 직접 시도하는 모습을 보였다.` : '유아들은 교사의 시범과 안내를 보며 안전한 행동 방법을 경험하였다.' },
        { title: '평가', text: '활동은 유아의 발달 수준에 맞게 진행되었으며, 반복 안내와 시각적 자료 제공이 안전 이해에 도움이 되었다. 다음 활동에서는 실제 상황과 연결한 짧은 역할놀이를 추가하면 좋겠다.' },
        { title: '추후 지원', text: '가정과도 안전 약속을 공유하고, 원 생활 속에서 반복적으로 실천할 수 있도록 교사가 일상 장면에서 안내한다.', accent: true },
      ],
    };
  }

  if (type === 'teacher') {
    return {
      title: '교사교육일지 초안',
      badge: commonBadge,
      sections: [
        { title: '교육 주제', text: '영유아 관찰기록과 놀이 중심 보육과정 운영의 실제' },
        { title: '교육 내용', text: '유아의 놀이 장면을 짧고 객관적으로 기록하고, 기록을 바탕으로 보육일지·발달평가·부모상담자료로 연결하는 방법을 학습하였다.' },
        { title: '배운 점', text: '관찰기록은 단순한 업무 문서가 아니라 유아의 흥미와 발달을 이해하는 근거가 되며, 교사의 지원 방향을 결정하는 중요한 자료임을 확인하였다.' },
        { title: '현장 적용 계획', text: '매일 짧은 기록을 누적하고, 주간 단위로 놀이 흐름과 지원계획을 점검한다. 기록 누락이 생기지 않도록 아이별·영역별 균형도 함께 확인한다.', accent: true },
      ],
    };
  }

  return {
    title: '원장 검토자료 초안',
    badge: commonBadge,
    sections: [
      { title: '기록 현황', text: `${formatDateKo(date)} 기준 이번 달 누적 기록은 ${records.length}건이며, 기록된 유아는 ${childNames.length}/${children.length || childNames.length}명입니다.` },
      { title: '주요 놀이·발달 흐름', text: `현재 기록은 ${categorySummary.mainLabels} 영역에 집중되어 있습니다. ${categorySummary.topLabel} 관련 놀이와 상호작용이 많이 관찰됩니다.` },
      { title: '검토 필요 사항', text: '기록이 없는 유아, 기록이 적은 발달영역, 부정적 표현의 순화 여부, 다음 지원계획의 구체성을 확인하면 좋습니다.' },
      { title: '원장 검토 메모', text: '보육과정 운영 방향은 적절하며, 기록 누락을 보완하고 가정 연계 문장을 조금 더 구체화하면 기관용 문서 완성도가 높아질 것으로 보입니다.', accent: true },
    ],
  };
}

function summarizeCategories(records) {
  const counts = {};
  records.forEach(r => { counts[r.category || 'play'] = (counts[r.category || 'play'] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.slice(0, 3).map(([k]) => CATEGORIES[k]?.label || '놀이·활동');
  return {
    topLabel: labels[0] || '놀이·활동',
    mainLabels: labels.length ? labels.join(', ') : '놀이·활동',
  };
}

function makeAreaText(records, category, fallback) {
  const samples = records.filter(r => r.category === category);
  if (samples.length === 0) return `${fallback} 아직 해당 영역의 기록이 충분하지 않아, 다음 관찰에서 관련 놀이와 일상 장면을 더 살펴볼 필요가 있다.`;
  const names = [...new Set(samples.map(r => r.childName))].slice(0, 4).join(', ');
  return `${names}의 기록에서 ${fallback} 관련 관찰이 ${samples.length}건 확인되었다. 기록 내용을 바탕으로 볼 때 해당 경험을 반복적으로 제공하면 발달을 더 안정적으로 지원할 수 있다.`;
}

function RecordPreview({ records, onNavigate }) {
  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', background: 'white', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 12 }}>반영할 기록이 없어요</div>
        <button onClick={() => onNavigate('record')} style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontWeight: 800 }}>
          기록하러 가기
        </button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16 }}>
      {records.slice(0, 6).map(r => {
        const cat = CATEGORIES[r.category] || CATEGORIES.special;
        return (
          <div key={r.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{r.childName}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, background: cat.bg, padding: '3px 9px', borderRadius: 100 }}>{cat.emoji} {cat.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(r.date)}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {r.observation || r.rawText}
            </div>
          </div>
        );
      })}
      {records.length > 6 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>외 {records.length - 6}건 더 반영됩니다.</div>}
    </div>
  );
}

function DocumentSection({ title, text, accent }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div style={{
      background: accent ? 'var(--primary-light)' : 'white',
      border: `1px solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 15, padding: 16, marginBottom: 11,
      boxShadow: accent ? '0 8px 18px rgba(79,127,255,0.08)' : 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: accent ? 'var(--primary)' : 'var(--text-secondary)' }}>{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          style={{ fontSize: 12, color: accent ? 'var(--primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
          {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}

function CopyAllButton({ doc }) {
  const [copied, setCopied] = useState(false);
  const handleCopyAll = () => {
    const text = `${doc.title}\n${doc.badge}\n\n` + doc.sections.map(s => `[${s.title}]\n${s.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button onClick={handleCopyAll} style={{
      width: '100%', padding: '14px', borderRadius: 14, background: 'var(--gray-800)', color: 'white',
      fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      marginTop: 4,
    }}>
      {copied ? <><Check size={16} /> 전체 복사 완료</> : <><Copy size={16} /> 전체 복사하기</>}
    </button>
  );
}

function EmptyGuide({ activeType, onNavigate }) {
  const isManagement = ['teacher', 'safety'].includes(activeType);
  return (
    <div style={{ background: 'white', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: 18, textAlign: 'center', color: 'var(--text-secondary)' }}>
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
