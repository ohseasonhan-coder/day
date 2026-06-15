// ── 사전 계획·일괄 문서 자동 생성 ─────────────────────────────────────────────
// 주간 보육계획안(다음 주 놀이 추천) + 오늘 알림장 일괄 생성.
// 외부 API 없이, 최근 기록 흐름 + 계절 + 표준보육과정으로 초안을 만든다.
import { getCurrentSeason } from './sentenceLibrary';

const CAT_TO_AREA = {
  body: '신체운동·건강', habit: '신체운동·건강', comm: '의사소통',
  peer: '사회관계', art: '예술경험', nature: '자연탐구', play: '자연탐구',
};
const AREA_LABEL = ['신체운동·건강', '의사소통', '사회관계', '예술경험', '자연탐구'];

const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
// 계절별 놀이 소재 (다음 주 놀이 제안 보조)
const SEASON_THEME = {
  spring: ['새싹·꽃 관찰', '봄 산책과 바깥놀이', '씨앗 심기', '나비·곤충 탐색'],
  summer: ['물·모래 놀이', '그림자 놀이', '여름 곤충 관찰', '시원한 감각 탐색'],
  autumn: ['낙엽·열매 모으기', '단풍 색 탐색', '가을 자연물 꾸미기', '수확 놀이'],
  winter: ['눈·얼음 탐색', '따뜻한 실내 놀이', '겨울 옷 입기', '빛과 그림자 놀이'],
};
// 영역별 다음 주 활동 아이디어
const AREA_ACTIVITY = {
  '신체운동·건강': ['대근육 활동(공놀이·균형잡기)', '바깥놀이와 신체 게임', '스스로 정리·위생 습관 놀이'],
  '의사소통': ['그림책 읽고 이야기 나누기', '말놀이·끝말잇기', '오늘의 경험 말하기'],
  '사회관계': ['협동 구성놀이', '역할놀이(가게·병원)', '차례 지키는 규칙 게임'],
  '예술경험': ['자유 미술 표현', '노래와 율동', '자연물로 꾸미기'],
  '자연탐구': ['관찰·탐색 활동', '수·모양 놀이', '간단한 실험(섞기·녹이기)'],
};

// 최근 기록에서 영역별 빈도 집계 → 부족 영역 파악
function areaCounts(records) {
  const counts = {}; AREA_LABEL.forEach(a => { counts[a] = 0; });
  (records || []).forEach(r => {
    const dev = (r.devAreas || [])[0];
    const area = AREA_LABEL.includes(dev) ? dev : (CAT_TO_AREA[r.category] || null);
    if (area && counts[area] != null) counts[area] += 1;
  });
  return counts;
}

// 주간 보육계획안 — 다음 주 놀이 흐름·활동·예상 놀이 자동 제안
export function buildWeeklyPlan({ recentRecords, className, classAge, weekLabel }) {
  const season = getCurrentSeason();
  const counts = areaCounts(recentRecords);
  const sorted = [...AREA_LABEL].sort((a, b) => counts[a] - counts[b]); // 적은 순
  const focusAreas = sorted.slice(0, 2);   // 다음 주 보완할 부족 영역 2개
  const richArea = [...AREA_LABEL].sort((a, b) => counts[b] - counts[a])[0]; // 최근 활발 영역
  const themes = SEASON_THEME[season];

  const sections = [
    { title: '주제 및 배경', text:
      `최근 ${richArea} 영역의 놀이가 활발하게 나타났다. 이를 이어가면서, 상대적으로 경험이 적었던 ${focusAreas.join(', ')} 영역의 놀이를 균형 있게 제공하고자 한다. ${SEASON_KO[season]} 계절의 흐름을 반영하여 자연과 일상에서 놀이를 확장한다.` },
    { title: '예상되는 놀이', text:
      themes.map(t => `· ${t}`).join('\n') + `\n· ${richArea} 관련 놀이 이어가기` },
    { title: '영역별 활동 계획', text:
      AREA_LABEL.map(a => {
        const ideas = AREA_ACTIVITY[a] || [];
        const mark = focusAreas.includes(a) ? ' (이번 주 집중)' : '';
        return `· [${a}]${mark} ${ideas[0]}`;
      }).join('\n') },
    { title: '교사 지원 계획', text:
      `유아의 흥미를 따라 놀이가 자발적으로 일어나도록 환경을 구성하고, ${focusAreas.join(', ')} 영역의 자료를 추가로 제공한다. 놀이 과정을 관찰·기록하여 다음 계획에 반영한다.` },
    { title: '가정 연계', text:
      `${SEASON_KO[season]} 자연을 함께 산책하거나, 가정에서 ${focusAreas[0]} 관련 경험(이야기 나누기·놀이)을 나누어 주시면 좋겠습니다.` },
  ];

  return {
    title: `${className || '우리 반'} 주간 보육계획안`,
    badge: [weekLabel, `${SEASON_KO[season]}`].filter(Boolean).join(' · '),
    sections,
    meta: { focusAreas, richArea, season },
  };
}

// 오늘 알림장 일괄 — 오늘 기록한 아이별 알림장 문구를 한 번에 생성
// records: 오늘 날짜 기록들 (각 record에 childName, parent, observation 포함)
export function buildBatchNotices({ records, date }) {
  const byChild = {};
  (records || []).forEach(r => {
    const name = r.childName || '아동';
    if (!byChild[name]) byChild[name] = [];
    byChild[name].push(r);
  });

  const notices = Object.entries(byChild).map(([name, recs]) => {
    // 부모용 문장 우선, 없으면 관찰 문장
    const lines = recs
      .map(r => (r.parent || r.observation || '').trim())
      .filter(Boolean);
    const seen = new Set();
    const uniq = lines.filter(t => { const k = t.slice(0, 14); if (seen.has(k)) return false; seen.add(k); return true; });
    const body = uniq.length
      ? uniq.join(' ')
      : `${name} 오늘도 원에서 즐겁게 지냈어요.`;
    return { name, text: body };
  });

  return { date, notices };
}

// 보육일지(generateDailyJournal 결과) → 문서 구조로 변환
export function dailyJournalToDoc(journal, { className, date }) {
  return {
    title: `${className || '우리 반'} 보육일지`,
    badge: date || '',
    docType: 'daily',
    sections: [
      { title: '놀이 흐름 및 활동', text: journal.playFlow },
      { title: '유아 반응', text: journal.childResponse },
      { title: '교사 지원', text: journal.teacherSupport },
      { title: '오늘 평가', text: journal.evaluation },
      { title: '다음 지원계획', text: journal.nextPlan },
    ],
  };
}

// 알림장 일괄 → 한 문서로 묶기 (아이별 섹션)
export function batchNoticesToDoc(batch, { className }) {
  return {
    title: `${className || '우리 반'} 알림장 (${batch.date})`,
    badge: batch.date || '',
    docType: 'parent',
    sections: batch.notices.map(n => ({ title: n.name, text: n.text })),
  };
}

// 월간 놀이평가 — 이달 기록 흐름으로 초안
export function buildMonthlyEvaluation({ monthRecords, className, monthLabel }) {
  const counts = areaCounts(monthRecords);
  const total = (monthRecords || []).length;
  const topArea = [...AREA_LABEL].sort((a, b) => counts[b] - counts[a])[0];
  const low = [...AREA_LABEL].sort((a, b) => counts[a] - counts[b]).slice(0, 2);
  const season = getCurrentSeason();
  return {
    title: `${className || '우리 반'} 월간 놀이평가`,
    badge: monthLabel || '',
    docType: 'monthly',
    sections: [
      { title: '월간 놀이 흐름', text:
        `이달에는 총 ${total}건의 놀이·활동 관찰이 이루어졌다. ${SEASON_KO[season]} 계절을 반영한 놀이가 전개되었으며, 특히 ${topArea} 영역의 놀이가 활발하게 나타났다.` },
      { title: '발달적 의미', text:
        `유아들은 자신의 흥미를 따라 놀이를 선택하고 몰입하며 ${topArea}을 중심으로 다양한 경험을 확장하였다. 또래·교사와의 상호작용 속에서 자발성과 문제해결력이 함께 자라났다.` },
      { title: '보육과정 평가', text:
        `5개 영역의 놀이가 통합적으로 이루어졌으나, ${low.join(', ')} 영역의 경험은 상대적으로 적었다. 다음 달에는 해당 영역의 놀이 자료와 환경을 보완할 계획이다.` },
      { title: '다음 달 운영 방향', text:
        `이달의 놀이 흐름을 이어가면서 ${low.join(', ')} 영역의 경험을 균형 있게 제공하고, 유아의 관심을 따라 놀이가 심화·확장되도록 지원한다.` },
    ],
  };
}

// 아이별 월간 요약 — 한 문서에 아이별 섹션
export function buildChildrenMonthlyDigest({ records, children, range, monthLabel, className }) {
  const inRange = (records || []).filter(r => r.date && (!range || (r.date >= range.from && r.date <= range.to)));
  const byChild = {};
  inRange.forEach(r => {
    const name = r.childName || '아동';
    if (!byChild[name]) byChild[name] = [];
    byChild[name].push(r);
  });
  const names = (children || []).map(c => c.name);
  const ordered = names.length ? names.filter(n => byChild[n]) : Object.keys(byChild);

  const sections = ordered.map(name => {
    const recs = byChild[name].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const lines = recs.map(r => (r.parent || r.observation || '').trim()).filter(Boolean);
    const seen = new Set();
    const uniq = lines.filter(t => { const k = t.slice(0, 14); if (seen.has(k)) return false; seen.add(k); return true; });
    return { title: `${name} (${recs.length}건)`, text: uniq.slice(0, 3).map(t => `· ${t}`).join('\n') || '· 이달 기록이 적어요.' };
  });

  return {
    title: `${className || '우리 반'} 아이별 월간 요약`,
    badge: monthLabel || '',
    docType: 'parent',
    sections: sections.length ? sections : [{ title: '안내', text: '이달 기록이 아직 없어요.' }],
  };
}

// 이달의 가정통신문 자동완성 — 계절·월에 맞춘 따뜻한 통신문 초안
const MONTH_GREETING = {
  spring: '따뜻한 봄기운이 가득한', summer: '햇살이 무르익는', autumn: '선선한 바람이 부는', winter: '포근함이 필요한',
};
const MONTH_HEALTH = {
  spring: '일교차가 큰 시기이니 가벼운 겉옷을 챙겨 주시고, 미세먼지가 많은 날에는 실내 활동으로 대체합니다.',
  summer: '더운 날씨에 수분 섭취가 중요합니다. 여벌 옷과 물병을 준비해 주시고, 식중독 예방에 함께 신경 써 주세요.',
  autumn: '환절기 감기에 유의해 주세요. 손 씻기와 충분한 휴식으로 건강한 하루를 보낼 수 있도록 지도하겠습니다.',
  winter: '추운 날씨에 따뜻한 옷차림을 부탁드리며, 실내 환기와 손 씻기로 감염병을 예방하겠습니다.',
};

export function buildMonthlyNewsletter({ className }) {
  const season = getCurrentSeason();
  const month = new Date().getMonth() + 1;
  const themes = SEASON_THEME[season];
  const cls = className ? `${className} ` : '';
  return `안녕하세요, 학부모님. ${MONTH_GREETING[season]} ${month}월입니다. 한 달 동안 ${cls}아이들이 건강하고 즐겁게 자랄 수 있도록 함께하겠습니다.

【이달의 보육】
${SEASON_KO[season]}을 주제로 ${themes.slice(0, 3).join(', ')} 등 다양한 놀이를 경험할 예정입니다. 아이들이 자신의 흥미를 따라 놀이에 몰입하며 5개 영역의 배움을 고루 경험하도록 지원하겠습니다.

【가정 협조 사항】
- 등원 시간을 지켜 주시면 하루 일과가 안정적으로 시작됩니다.
- 여벌 옷과 개인 물품에 이름을 적어 보내 주세요.
- 결석·조퇴 시 미리 연락 부탁드립니다.

【건강·안전 안내】
${MONTH_HEALTH[season]}

아이들의 작은 성장도 가정과 함께 나누겠습니다. 늘 관심과 사랑으로 함께해 주셔서 감사합니다.`;
}

// 주간 요약 + 영역 균형 코칭 — 이번 주 우리 반 기록 현황과 보완 제안
export function buildWeeklySummary({ weekRecords, children }) {
  const counts = areaCounts(weekRecords);
  const total = (weekRecords || []).length;
  const childIds = new Set((weekRecords || []).map(r => r.childId).filter(Boolean));
  const childCount = (children || []).length;
  const recordedChildren = childIds.size;

  const sorted = [...AREA_LABEL].sort((a, b) => counts[a] - counts[b]);
  const lowAreas = sorted.filter(a => counts[a] === 0).length > 0
    ? sorted.filter(a => counts[a] === 0)
    : sorted.slice(0, 2);
  const topArea = [...AREA_LABEL].sort((a, b) => counts[b] - counts[a])[0];

  const tips = lowAreas.map(a => {
    const idea = (AREA_ACTIVITY[a] || ['관련 놀이'])[0];
    return `· ${a}: 기록이 적어요 → ‘${idea}’ 같은 놀이를 제안해보세요`;
  });

  return {
    total,
    recordedChildren,
    childCount,
    topArea,
    lowAreas,
    areaCounts: counts,
    tips,
    headline: total === 0
      ? '이번 주 기록이 아직 없어요. 짧게라도 관찰을 남겨보세요.'
      : `이번 주 기록 ${total}건 · 아이 ${recordedChildren}/${childCount}명 · 가장 활발한 영역은 ${topArea}예요.`,
  };
}
