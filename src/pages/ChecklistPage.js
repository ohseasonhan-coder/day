import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { getChildren, getClasses, today } from '../utils/storage';
import { generateSentences } from '../utils/sentenceLibrary';
import { getStandardChecklist, ageKeyForClassAge } from '../utils/standardCurriculum';

// ── 누리과정 5개 영역 체크리스트 (연령별) ─────────────────────────────────────
// PortfolioPage에서도 체크 현황 요약에 사용
export const NURI = {
  2: {
    신체운동건강: [
      { id: 'b2_1', text: '걷기·달리기·뛰기 등 기본 운동 참여', devArea: '신체', category: 'body' },
      { id: 'b2_2', text: '소근육 활동(끼우기, 쌓기, 잡기)에 참여', devArea: '신체', category: 'body' },
      { id: 'b2_3', text: '스스로 먹기 시도', devArea: '건강', category: 'habit' },
      { id: 'b2_4', text: '배변 의사 표현', devArea: '건강', category: 'habit' },
      { id: 'b2_5', text: '손 씻기 과정 참여', devArea: '건강', category: 'habit' },
      { id: 'b2_6', text: '안전 약속 듣고 따르기', devArea: '안전', category: 'special' },
    ],
    의사소통: [
      { id: 'b2_7',  text: '단어·짧은 문장으로 의사 표현', devArea: '언어', category: 'comm' },
      { id: 'b2_8',  text: '간단한 지시 이해·따르기', devArea: '언어', category: 'comm' },
      { id: 'b2_9',  text: '그림책에 관심 보이기', devArea: '언어', category: 'comm' },
      { id: 'b2_10', text: '새로운 단어 따라 말하기', devArea: '언어', category: 'comm' },
    ],
    사회관계: [
      { id: 'b2_11', text: '교사·또래와 눈 맞추고 상호작용', devArea: '사회', category: 'peer' },
      { id: 'b2_12', text: '병행놀이 참여 (옆에서 비슷하게)', devArea: '사회', category: 'peer' },
      { id: 'b2_13', text: '자신의 물건 구별 인식', devArea: '사회', category: 'peer' },
    ],
    예술경험: [
      { id: 'b2_14', text: '미술 재료 탐색 및 낙서 표현', devArea: '예술', category: 'art' },
      { id: 'b2_15', text: '음악·리듬에 반응하고 따라 움직이기', devArea: '예술', category: 'art' },
    ],
    자연탐구: [
      { id: 'b2_16', text: '주변 사물과 자연물 만지며 탐색', devArea: '탐구', category: 'nature' },
      { id: 'b2_17', text: '반복 행동을 통한 인과 탐색', devArea: '탐구', category: 'play' },
    ],
  },
  3: {
    신체운동건강: [
      { id: '3_1', text: '달리기·멈추기·방향 바꾸기 등 기본 운동', devArea: '신체', category: 'body' },
      { id: '3_2', text: '균형 잡기·한 발 서기 시도', devArea: '신체', category: 'body' },
      { id: '3_3', text: '가위·크레용 등 도구 사용', devArea: '신체', category: 'body' },
      { id: '3_4', text: '식사 도구 사용하여 스스로 식사', devArea: '건강', category: 'habit' },
      { id: '3_5', text: '손 씻기·양치질 순서 따르기', devArea: '건강', category: 'habit' },
      { id: '3_6', text: '옷 입고 벗기 시도', devArea: '건강', category: 'habit' },
      { id: '3_7', text: '교통 안전 기본 규칙 알기', devArea: '안전', category: 'special' },
    ],
    의사소통: [
      { id: '3_8',  text: '3~4어절 문장으로 생각 표현', devArea: '언어', category: 'comm' },
      { id: '3_9',  text: '"왜?" "어떻게?" 질문 활용', devArea: '언어', category: 'comm' },
      { id: '3_10', text: '그림책 내용 간단히 이야기', devArea: '언어', category: 'comm' },
      { id: '3_11', text: '글자에 관심 보이기', devArea: '언어', category: 'comm' },
      { id: '3_12', text: '상황 맞는 인사말 사용', devArea: '언어', category: 'comm' },
    ],
    사회관계: [
      { id: '3_13', text: '친구에게 먼저 말 걸기', devArea: '사회', category: 'peer' },
      { id: '3_14', text: '차례와 규칙 이해하여 참여', devArea: '사회', category: 'peer' },
      { id: '3_15', text: '감정 말로 표현하기 (기쁨·슬픔·화)', devArea: '사회', category: 'peer' },
      { id: '3_16', text: '규칙 있는 놀이에 참여', devArea: '사회', category: 'peer' },
    ],
    예술경험: [
      { id: '3_17', text: '의도적 형태 그리기 (사람·집·꽃 등)', devArea: '예술', category: 'art' },
      { id: '3_18', text: '다양한 색 사용하여 표현', devArea: '예술', category: 'art' },
      { id: '3_19', text: '간단한 노래·율동 따라 하기', devArea: '예술', category: 'art' },
      { id: '3_20', text: '역할놀이에 참여하기', devArea: '예술', category: 'play' },
    ],
    자연탐구: [
      { id: '3_21', text: '크기·색 비교하기', devArea: '탐구', category: 'play' },
      { id: '3_22', text: '간단한 인과관계 이해', devArea: '탐구', category: 'nature' },
      { id: '3_23', text: '숫자 1~5 세기', devArea: '탐구', category: 'play' },
      { id: '3_24', text: '씨앗·식물 관찰에 관심', devArea: '탐구', category: 'nature' },
    ],
  },
  4: {
    신체운동건강: [
      { id: '4_1', text: '줄넘기·공 던지기 등 협응 운동', devArea: '신체', category: 'body' },
      { id: '4_2', text: '정확한 가위질·글씨 쓰기 준비', devArea: '신체', category: 'body' },
      { id: '4_3', text: '요리·만들기 등 다양한 소근육 활동', devArea: '신체', category: 'body' },
      { id: '4_4', text: '건강 식품과 영양 기초 개념 알기', devArea: '건강', category: 'habit' },
      { id: '4_5', text: '세면·목욕 등 위생 독립 실천', devArea: '건강', category: 'habit' },
      { id: '4_6', text: '안전 약속 실천 및 타인에게 알리기', devArea: '안전', category: 'special' },
    ],
    의사소통: [
      { id: '4_7',  text: '경험 시간 순서대로 말하기', devArea: '언어', category: 'comm' },
      { id: '4_8',  text: '새로운 어휘 문맥 속 사용', devArea: '언어', category: 'comm' },
      { id: '4_9',  text: '이야기 듣고 내용 설명하기', devArea: '언어', category: 'comm' },
      { id: '4_10', text: '자기 이름·주소 등 기초 문자 인식', devArea: '언어', category: 'comm' },
      { id: '4_11', text: '발표 시 목소리·속도 조절', devArea: '언어', category: 'comm' },
    ],
    사회관계: [
      { id: '4_12', text: '공동 규칙 만들고 지키기', devArea: '사회', category: 'peer' },
      { id: '4_13', text: '갈등 시 대화로 해결 시도', devArea: '사회', category: 'peer' },
      { id: '4_14', text: '친구 감정 인식하고 위로', devArea: '사회', category: 'peer' },
      { id: '4_15', text: '가족·지역사회 역할 이해', devArea: '사회', category: 'special' },
      { id: '4_16', text: '다양성 존중하는 태도', devArea: '사회', category: 'peer' },
    ],
    예술경험: [
      { id: '4_17', text: '세부 표현 있는 그림 완성', devArea: '예술', category: 'art' },
      { id: '4_18', text: '재료 선택하여 창의적 표현', devArea: '예술', category: 'art' },
      { id: '4_19', text: '음악 요소(빠르기·셈여림) 인식', devArea: '예술', category: 'art' },
      { id: '4_20', text: '극놀이 역할 맡아 이야기 표현', devArea: '예술', category: 'play' },
    ],
    자연탐구: [
      { id: '4_21', text: '측정·분류·규칙 패턴 활동', devArea: '탐구', category: 'play' },
      { id: '4_22', text: '숫자 개념 10까지 이해', devArea: '탐구', category: 'play' },
      { id: '4_23', text: '계절 변화와 환경 연결 이해', devArea: '탐구', category: 'nature' },
      { id: '4_24', text: '간단한 실험·탐구 과정 참여', devArea: '탐구', category: 'play' },
    ],
  },
  5: {
    신체운동건강: [
      { id: '5_1', text: '복잡한 협응 운동(축구·줄넘기) 참여', devArea: '신체', category: 'body' },
      { id: '5_2', text: '꼼꼼한 소근육 작업(바느질·종이접기)', devArea: '신체', category: 'body' },
      { id: '5_3', text: '팀 스포츠 규칙 이해 및 참여', devArea: '신체', category: 'body' },
      { id: '5_4', text: '균형 식단 이해 및 실천', devArea: '건강', category: 'habit' },
      { id: '5_5', text: '건강 문제 스스로 교사에게 알리기', devArea: '건강', category: 'habit' },
      { id: '5_6', text: '위험 상황 판단 및 대처 능력', devArea: '안전', category: 'special' },
    ],
    의사소통: [
      { id: '5_7',  text: '논리적 순서로 이야기 구성', devArea: '언어', category: 'comm' },
      { id: '5_8',  text: '토론에서 근거 들어 의견 주장', devArea: '언어', category: 'comm' },
      { id: '5_9',  text: '비유·유머 이해 및 사용', devArea: '언어', category: 'comm' },
      { id: '5_10', text: '다양한 글자·책 읽기 시도', devArea: '언어', category: 'comm' },
      { id: '5_11', text: '경청 후 요약·정리 표현', devArea: '언어', category: 'comm' },
    ],
    사회관계: [
      { id: '5_12', text: '복잡한 협동 놀이 주도', devArea: '사회', category: 'peer' },
      { id: '5_13', text: '갈등 자체 중재 시도', devArea: '사회', category: 'peer' },
      { id: '5_14', text: '소외된 친구 배려·포함', devArea: '사회', category: 'peer' },
      { id: '5_15', text: '사회적 규칙·약속 스스로 내면화', devArea: '사회', category: 'peer' },
      { id: '5_16', text: '다양한 문화·배경 존중', devArea: '사회', category: 'special' },
    ],
    예술경험: [
      { id: '5_17', text: '원근감·비율 고려한 표현', devArea: '예술', category: 'art' },
      { id: '5_18', text: '다양한 기법 융합 창작', devArea: '예술', category: 'art' },
      { id: '5_19', text: '음악 작곡·즉흥 연주 시도', devArea: '예술', category: 'art' },
      { id: '5_20', text: '공연·전시를 감상하고 의견 표현', devArea: '예술', category: 'art' },
    ],
    자연탐구: [
      { id: '5_21', text: '가설 세우고 검증 실험', devArea: '탐구', category: 'play' },
      { id: '5_22', text: '숫자·연산 기초 이해', devArea: '탐구', category: 'play' },
      { id: '5_23', text: '복잡한 생태 관계 이해 시도', devArea: '탐구', category: 'nature' },
      { id: '5_24', text: '탐구 결과 기록·공유', devArea: '탐구', category: 'play' },
    ],
  },
};

export const AREA_COLORS = {
  신체운동건강: { bg: '#e8f5e9', color: '#2e7d32', emoji: '🏃' },
  의사소통:     { bg: '#e3f2fd', color: '#1565c0', emoji: '💬' },
  사회관계:     { bg: '#fce4ec', color: '#c62828', emoji: '🤝' },
  예술경험:     { bg: '#f3e5f5', color: '#6a1b9a', emoji: '🎨' },
  자연탐구:     { bg: '#fff3e0', color: '#e65100', emoji: '🔍' },
};

const STORAGE_KEY = (uid, childId, ym) => `sw_${uid}_checklist_${childId}_${ym}`;
// storage.js와 동일한 키/필드 사용 (sw_session.userId)
function getUid() {
  try { return JSON.parse(localStorage.getItem('sw_session') || '{}').userId || 'default'; } catch { return 'default'; }
}
export function loadChecks(childId, ym) {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(getUid(), childId, ym)) || '{}'); } catch { return {}; }
}
function saveChecks(childId, ym, data) {
  localStorage.setItem(STORAGE_KEY(getUid(), childId, ym), JSON.stringify(data));
}

export default function ChecklistPage() {
  const { showToast } = useToast();
  const [children, setChildren]     = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [classes,  setClasses]      = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [ym, setYm]                 = useState(() => today().slice(0, 7));
  const [checks, setChecks]         = useState({});
  const [planModal, setPlanModal]   = useState(null); // {item, sentences}
  const [activeArea, setActiveArea] = useState(null);
  const [showPlan, setShowPlan]     = useState(false);

  useEffect(() => {
    const cls = getClasses();
    const chs = getChildren();
    setClasses(cls);
    setChildren(chs);
    if (chs.length) setSelectedChild(chs[0]);
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    setChecks(loadChecks(selectedChild.id, ym));
  }, [selectedChild, ym]);

  const toggle = useCallback((itemId) => {
    if (!selectedChild) return;
    setChecks(prev => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      saveChecks(selectedChild.id, ym, next);
      return next;
    });
  }, [selectedChild, ym]);

  const child = selectedChild;
  const age   = child ? (child.age || 4) : 4;
  // 0~2세는 2024 개정 표준보육과정 기반 체크리스트, 3세 이상은 누리과정 체크리스트
  const ageKey = ageKeyForClassAge(age);
  const isInfant = ageKey === 'age01' || ageKey === 'age2';
  const nuriAge = Math.min(5, Math.max(2, parseInt(age, 10)));
  const areas = isInfant ? getStandardChecklist(ageKey) : (NURI[nuriAge] || NURI[4]);

  const totalItems = Object.values(areas).flat().length;
  const doneItems  = Object.values(areas).flat().filter(i => checks[i.id]).length;
  const percent    = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  // 미달성 항목 지원계획 생성
  const generatePlan = useCallback(() => {
    if (!child) return;
    const missed = Object.values(areas).flat().filter(i => !checks[i.id]);
    if (!missed.length) { showToast('모든 항목을 달성했어요! 🎉', 'success'); return; }
    const sentences = missed.slice(0, 6).map(item => {
      const s = generateSentences({ category: item.category, situation: 'growing', age: nuriAge, childName: child.name, count: 1 });
      return { item, sentence: s[0] || '' };
    });
    setPlanModal({ child, missed: missed.length, sentences, ym });
    setShowPlan(true);
  }, [child, areas, checks, nuriAge, showToast, ym]);

  const copyPlan = useCallback(() => {
    if (!planModal) return;
    const text = planModal.sentences.map(({ item, sentence }) =>
      `▶ ${item.text}\n  → ${sentence}`
    ).join('\n\n');
    navigator.clipboard.writeText(text).then(() => showToast('지원계획 복사됨', 'success'));
  }, [planModal, showToast]);

  // 월 이동
  const moveMonth = (dir) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (!children.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', marginTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👶</div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>등록된 원아가 없어요</div>
        <div style={{ fontSize: 13 }}>원아 관리 메뉴에서 먼저 원아를 추가해 주세요.</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', marginBottom: 4 }}>
          {isInfant ? '표준보육과정 발달 체크리스트' : '누리과정 발달 체크리스트'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          {isInfant
            ? `${ageKey === 'age01' ? '0~1세' : '2세'} 표준보육과정(2024 개정) 5개 영역 · 월별 달성 현황`
            : '연령별 5개 영역 · 월별 달성 현황 관리'}
        </div>
      </div>

      {/* 아이 선택 */}
      <div className="avatar-scroll" style={{ padding: '14px 20px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {children.map(c => (
          <button key={c.id} onClick={() => setSelectedChild(c)} style={{
            padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 700,
            background: selectedChild?.id === c.id ? 'var(--primary)' : 'var(--white)',
            color: selectedChild?.id === c.id ? 'white' : 'var(--text-secondary)',
            border: `1.5px solid ${selectedChild?.id === c.id ? 'var(--primary)' : 'var(--border)'}`,
            whiteSpace: 'nowrap',
          }}>{c.name} ({c.age || 4}세)</button>
        ))}
      </div>

      {/* 월 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '14px 20px 0', background: 'var(--white)', borderRadius: 14, padding: '10px 16px', border: '1px solid var(--border)' }}>
        <button onClick={() => moveMonth(-1)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}>‹</button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{ym.replace('-', '년 ')}월</div>
        <button onClick={() => moveMonth(1)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}>›</button>
      </div>

      {/* 진행률 */}
      {child && (
        <div style={{ margin: '14px 20px 0', background: 'var(--white)', borderRadius: 16, padding: '14px 16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {child.name} · 만{nuriAge}세 달성률
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: percent >= 80 ? 'var(--cat-play)' : percent >= 50 ? 'var(--primary)' : 'var(--accent)' }}>
              {doneItems}/{totalItems} ({percent}%)
            </div>
          </div>
          <div style={{ background: 'var(--gray-100)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 100, width: `${percent}%`, background: percent >= 80 ? 'var(--cat-play)' : 'var(--primary)', transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* 영역별 체크리스트 */}
      <div style={{ padding: '14px 20px 0' }}>
        {Object.entries(areas).map(([areaName, items]) => {
          const areaColor = AREA_COLORS[areaName] || AREA_COLORS['사회관계'];
          const areaDone  = items.filter(i => checks[i.id]).length;
          const isOpen    = activeArea === areaName;
          return (
            <div key={areaName} style={{ marginBottom: 12, background: 'var(--white)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <button
                onClick={() => setActiveArea(isOpen ? null : areaName)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: areaColor.bg, color: areaColor.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {areaColor.emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', textAlign: 'left' }}>{areaName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{areaDone}/{items.length} 달성</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 100, background: areaColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: areaColor.color }}>{Math.round(areaDone / items.length * 100)}%</span>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                  {items.map(item => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--gray-50)', cursor: 'pointer' }}>
                      <div
                        onClick={() => toggle(item.id)}
                        style={{
                          width: 22, height: 22, borderRadius: 6, border: `2px solid ${checks[item.id] ? areaColor.color : 'var(--border)'}`,
                          background: checks[item.id] ? areaColor.color : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {checks[item.id] && <span style={{ color: 'white', fontSize: 13, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div onClick={() => toggle(item.id)} style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: checks[item.id] ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: checks[item.id] ? 'line-through' : 'none', lineHeight: 1.5 }}>
                          {item.text}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {item.devArea}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 지원계획 생성 버튼 */}
      {child && (
        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={generatePlan}
            style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', boxShadow: '0 6px 20px rgba(79,127,255,0.3)' }}
          >
            📋 미달성 항목 → 다음 달 지원계획 생성
          </button>
        </div>
      )}

      {/* 지원계획 모달 */}
      {showPlan && planModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowPlan(false)}>
          <div style={{ background: 'var(--white)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>
              📋 다음 달 지원계획
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              {planModal.child.name} · 미달성 {planModal.missed}개 항목 기반
            </div>
            {planModal.sentences.map(({ item, sentence }, idx) => (
              <div key={item.id} style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 12, borderLeft: '3px solid var(--primary)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>
                  {idx + 1}. {item.text}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {sentence}
                </div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowPlan(false)} style={{ padding: '14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--white)', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>닫기</button>
              <button onClick={copyPlan} style={{ padding: '14px', borderRadius: 12, border: 'none', background: 'var(--primary)', fontWeight: 800, fontSize: 14, color: 'white' }}>복사하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
