// ── 발달평가서 자동 생성 ──────────────────────────────────────────────────────
// 한 아이의 누적 기록 + 표준보육과정 매칭 + 체크리스트 달성도를 합쳐
// 학기별 발달평가서 초안(영역별 발달 모습 + 종합 의견)을 만든다.
// 원칙: 교사가 입력한 실제 기록만 사용하고, 기록이 없는 영역은 지어내지 않는다.
import { matchCurriculumBest } from './standardCurriculum';

// 표준보육과정 5개 영역 (평가서 영역 순서)
const REPORT_AREAS = ['신체운동·건강', '의사소통', '사회관계', '예술경험', '자연탐구'];

// 기록 카테고리 → 표준보육과정 영역
const CAT_TO_AREA = {
  body: '신체운동·건강', habit: '신체운동·건강',
  comm: '의사소통', peer: '사회관계',
  art: '예술경험', nature: '자연탐구', play: '자연탐구',
};
// 발달영역(누리 명칭) → 표준보육과정 영역 정규화
const DEVAREA_NORMALIZE = {
  '신체운동·건강': '신체운동·건강', '신체운동': '신체운동·건강', '기본생활습관': '신체운동·건강',
  '의사소통': '의사소통', '사회관계': '사회관계', '예술경험': '예술경험', '자연탐구': '자연탐구',
};

function hasJongseong(name) {
  const last = [...String(name || '').trim()].pop();
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}
// 이름 받침에 맞는 보조사 ('하준은', '서아는')
function topicParticle(name) { return hasJongseong(name) ? '은' : '는'; }
// 주격 조사 ('하준이', '서아가')
function subjectParticle(name) { return hasJongseong(name) ? '이' : '가'; }

function recordArea(r) {
  const dev = (r.devAreas || []).map(a => DEVAREA_NORMALIZE[a]).find(Boolean);
  return dev || CAT_TO_AREA[r.category] || '자연탐구';
}

// 체크리스트(영역별 달성) 집계 — ChecklistPage와 동일 키 사용
const CHECK_AREA_KEY = {
  '신체운동·건강': '신체운동건강', '의사소통': '의사소통', '사회관계': '사회관계',
  '예술경험': '예술경험', '자연탐구': '자연탐구',
};

// records: 해당 아이의 기록 / checksByArea: { 영역키: {done,total} } / ageKey, range
export function buildDevelopmentReport({ records, childName, className, ageKey, range, checksByArea }) {
  const inRange = (records || []).filter(r => r.date && (!range || (r.date >= range.from && r.date <= range.to)));
  const byArea = {};
  REPORT_AREAS.forEach(a => { byArea[a] = []; });
  inRange.forEach(r => { byArea[recordArea(r)].push(r); });

  const sections = [];

  // 기본 정보
  sections.push({
    title: '기본 정보',
    text: [
      `유아명: ${childName}`,
      className && `반: ${className}`,
      range?.label && `평가 기간: ${range.label}`,
      `관찰 기록: ${inRange.length}건`,
    ].filter(Boolean).join('\n'),
  });

  // 영역별 발달 모습
  REPORT_AREAS.forEach(area => {
    const recs = byArea[area].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const check = checksByArea?.[CHECK_AREA_KEY[area]];
    const lines = [];

    if (recs.length === 0) {
      lines.push('해당 기간 관찰 기록이 충분하지 않아, 다음 기간에 더 살펴볼 필요가 있다.');
    } else {
      // 대표 관찰 2건 (실제 기록의 관찰일지 문장 사용)
      const samples = recs.slice(0, 2).map(r => (r.observation || r.rawText || '').trim()).filter(Boolean);
      samples.forEach(s => lines.push(`· ${s}`));
      // 표준보육과정 근거 (저장돼 있으면 사용, 없으면 매칭)
      const basis = recs.map(r => r.curriculumBasis).find(Boolean)
        || matchCurriculumBest(recs.map(r => r.observation || r.rawText).join(' '), ageKey, [area]);
      if (basis) lines.push(`▸ 표준보육과정 연계: 「${basis.item}」`);
    }
    if (check && check.total > 0) {
      lines.push(`▸ 발달 체크: ${check.done}/${check.total}개 항목 달성`);
    }

    sections.push({ title: `[${area}] 발달 모습`, text: lines.join('\n') });
  });

  // 종합 의견
  const richAreas = REPORT_AREAS.filter(a => byArea[a].length >= 2);
  const sparseAreas = REPORT_AREAS.filter(a => byArea[a].length === 0);
  const summary = [];
  if (inRange.length === 0) {
    summary.push('아직 관찰 기록이 충분하지 않아, 앞으로 다양한 일과 속에서 관찰을 이어갈 필요가 있다.');
  } else {
    if (richAreas.length) summary.push(`${richAreas.join(', ')} 영역에서 활발한 참여와 성장이 관찰되었다.`);
    summary.push(`${childName}${topicParticle(childName)} 놀이와 일상생활 속에서 자신의 흥미를 따라 경험을 넓혀가고 있다.`);
    if (sparseAreas.length) summary.push(`${sparseAreas.join(', ')} 영역은 기록이 적어, 다음 기간에 관련 놀이와 관찰을 보완할 계획이다.`);
  }
  sections.push({ title: '종합 의견', text: summary.join(' ') });

  // 가정 연계 제안
  sections.push({
    title: '가정 연계 제안',
    text: '가정에서도 아이의 이야기에 귀 기울이고, 다양한 놀이 경험을 함께 나누어 주시면 발달에 도움이 됩니다. 구체적인 사항은 상담을 통해 안내드리겠습니다.',
  });

  return {
    title: `${childName} 발달평가서`,
    badge: [range?.label, className].filter(Boolean).join(' · '),
    sections,
  };
}

// ── 부모상담자료 자동 묶음 ────────────────────────────────────────────────────
// 아이별 최근 기록의 부모용 문장을 모아 상담에 바로 쓰는 문장 세트를 만든다.
export function buildConsultMaterial({ records, childName, range }) {
  const inRange = (records || [])
    .filter(r => r.date && (!range || (r.date >= range.from && r.date <= range.to)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const particle = topicParticle(childName);

  // 영역별로 부모용 문장을 모아 중복 줄이기
  const byArea = {};
  REPORT_AREAS.forEach(a => { byArea[a] = []; });
  inRange.forEach(r => {
    const txt = (r.parent || '').trim();
    if (txt) byArea[recordArea(r)].push({ date: r.date, txt });
  });

  const sections = [];

  sections.push({
    title: '상담 인사말',
    text: `안녕하세요, ${childName} 부모님. 원에서 ${childName}${subjectParticle(childName)} 보내는 일상과 성장 모습을 함께 나누고자 합니다. 아래는 최근 관찰한 ${childName}의 모습입니다.`,
  });

  // 최근 모습 (대표 부모용 문장 3~4개)
  const recentParent = inRange.map(r => (r.parent || '').trim()).filter(Boolean);
  const seen = new Set();
  const uniqRecent = recentParent.filter(t => { const k = t.slice(0, 16); if (seen.has(k)) return false; seen.add(k); return true; });
  sections.push({
    title: '원에서의 최근 모습',
    text: uniqRecent.length
      ? uniqRecent.slice(0, 4).map(t => `· ${t}`).join('\n')
      : '최근 기록이 충분하지 않아, 상담 전 며칠간의 관찰을 더 모아두면 좋겠습니다.',
  });

  // 영역별 강점
  const strongAreas = REPORT_AREAS.filter(a => byArea[a].length >= 1);
  sections.push({
    title: '강점과 성장 모습',
    text: strongAreas.length
      ? strongAreas.map(a => `· (${a}) ${byArea[a][0].txt}`).join('\n')
      : `${childName}${particle} 자신의 흥미를 따라 다양한 경험을 시도하며 성장하고 있어요.`,
  });

  sections.push({
    title: '가정 연계 제안',
    text: `가정에서도 ${childName}의 이야기에 귀 기울여 주시고, 좋아하는 놀이를 함께 즐겨 주시면 발달에 큰 도움이 됩니다. 작은 시도와 성공도 충분히 격려해 주세요.`,
  });

  sections.push({
    title: '함께 이야기 나눌 점',
    text: '· 가정에서의 ' + childName + ' 모습 (식사·수면·놀이)\n· 부모님께서 궁금하시거나 걱정되는 점\n· 원-가정이 함께 지원할 부분',
  });

  return {
    title: `${childName} 부모상담자료`,
    badge: range?.label || '',
    sections,
  };
}

export { REPORT_AREAS };
