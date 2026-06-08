/**
 * 규칙 기반 AI 대체 모듈
 * API 키 없이 키워드 분류 + 표현 순화 + 템플릿 문서 생성
 */

// ─── 카테고리 키워드 분류표 ───────────────────────────────────────
const CATEGORY_RULES = [
  {
    id: 'peer',
    label: '또래관계',
    keywords: ['친구', '함께', '같이', '싸움', '싸웠', '때렸', '때리', '빼앗', '양보', '나눠', '도와', '도움',
      '차례', '기다', '갈등', '협력', '협동', '무리', '어울', '혼자', '혼자서', '소외', '거부', '거절',
      '화해', '사이좋게', '배려', '방해', '귓속말', '비밀', '놀아줘', '놀자'],
  },
  {
    id: 'habit',
    label: '생활습관',
    keywords: ['밥', '식사', '먹', '편식', '잘 안 먹', '안 먹', '국', '반찬', '숟가락', '젓가락',
      '낮잠', '잠', '자다', '못 자', '안 자', '배변', '화장실', '소변', '대변', '응가', '쉬',
      '씻', '손', '세수', '양치', '정리', '치우', '가방', '신발', '옷', '스스로', '혼자서 입'],
  },
  {
    id: 'comm',
    label: '의사소통',
    keywords: ['말', '말했', '얘기', '이야기', '물어봤', '질문', '대답', '표현', '설명', '"', "'",
      '말하', '소리', '울면서', '소리쳤', '목소리', '속삭', '발표', '읽', '글자', '책',
      '단어', '문장', '이름', '불렀'],
  },
  {
    id: 'nature',
    label: '자연탐구',
    keywords: ['벌레', '곤충', '개미', '나비', '장수풍뎅이', '달팽이', '꽃', '나무', '풀', '씨앗',
      '관찰', '돋보기', '날씨', '비', '눈', '바람', '하늘', '구름', '흙', '돌', '모래',
      '물', '색깔 변', '숫자', '세', '크기', '비교', '왜', '어떻게', '궁금'],
  },
  {
    id: 'art',
    label: '예술경험',
    keywords: ['그림', '색', '색깔', '칠하', '붙이', '오리', '만들', '찰흙', '클레이', '노래', '음악',
      '춤', '리듬', '박수', '악기', '피아노', '북', '마라카스', '무대', '공연', '역할놀이',
      '표현', '꾸미', '디자인'],
  },
  {
    id: 'body',
    label: '신체운동',
    keywords: ['달리', '뛰', '점프', '던지', '잡', '기어', '올라', '내려', '균형', '바깥놀이',
      '미끄럼틀', '그네', '철봉', '줄넘기', '공', '자전거', '가위', '풀', '젓가락', '소근육',
      '대근육', '힘'],
  },
  {
    id: 'play',
    label: '놀이·활동',
    keywords: ['블록', '레고', '퍼즐', '보드게임', '카드', '역할', '소꿉', '인형', '자동차', '기차',
      '캠핑', '병원', '마트', '요리', '쌓', '무너', '구성', '탐색', '실험', '조작'],
  },
  {
    id: 'special',
    label: '특이사항',
    keywords: ['열', '아프', '다쳤', '넘어', '긁', '물렸', '투약', '약', '병원', '부모님', '연락',
      '울음', '분리불안', '낯선', '적응', '안전', '위험', '사고', '갑자기', '특이', '오늘따라'],
  },
];

const DEV_AREA_RULES = [
  { id: '신체운동·건강', keywords: ['뛰', '달리', '점프', '운동', '몸', '건강', '힘', '균형', '바깥', '소근육', '대근육', '손', '가위', '젓가락'] },
  { id: '의사소통', keywords: ['말', '얘기', '이야기', '표현', '질문', '대답', '"', "'", '읽', '글자', '단어', '발표', '설명'] },
  { id: '사회관계', keywords: ['친구', '함께', '같이', '갈등', '협력', '양보', '배려', '차례', '어울', '도와', '나눠', '화해'] },
  { id: '예술경험', keywords: ['그림', '색', '노래', '음악', '춤', '만들', '꾸미', '표현', '역할', '붙이', '오리'] },
  { id: '자연탐구', keywords: ['관찰', '탐색', '궁금', '왜', '비교', '크기', '수', '숫자', '자연', '곤충', '식물', '날씨', '실험'] },
  { id: '기본생활습관', keywords: ['밥', '식사', '잠', '낮잠', '화장실', '씻', '정리', '치우', '스스로', '혼자', '옷', '가방'] },
];

// ─── 부정 표현 순화 사전 ───────────────────────────────────────────
const SOFTEN_MAP = [
  { pattern: /산만하다|산만해|집중을 못|집중하지 못|집중 안/g, replace: '관심이 다양한 곳으로 이동하는 모습이 있다' },
  { pattern: /말을 안 듣는다|말을 안 들어|말을 듣지 않|지시를 따르지 않/g, replace: '교사의 안내를 반복적으로 경험하고 있다' },
  { pattern: /친구를 때렸다|친구를 때렸|때리는 행동|손으로 쳤/g, replace: '갈등 상황에서 손으로 표현하는 모습이 있었다' },
  { pattern: /고집이 세다|고집이 강|고집을 부려|억지를 쓴/g, replace: '자신의 생각과 요구를 분명하게 표현한다' },
  { pattern: /자꾸 운다|많이 운다|울면서 소리쳤|울며 떼를 썼|떼를 쓴/g, replace: '속상한 마음을 울음으로 표현하는 모습이 있다' },
  { pattern: /밥을 안 먹는다|밥을 안 먹어|음식을 거부|편식이 심|잘 안 먹어/g, replace: '식사에 대한 관심이 낮아 다양한 음식 경험이 필요하다' },
  { pattern: /친구를 방해|방해를 해|방해했/g, replace: '친구의 놀이에 관심을 보이며 참여하고 싶어 하는 모습이 있다' },
  { pattern: /혼자 논다|혼자서만 놀|친구와 안 어울|어울리지 않/g, replace: '독립적으로 놀이를 즐기며 자신만의 놀이 방식을 탐색하는 모습이 있다' },
  { pattern: /공격적|공격 행동|공격을 해/g, replace: '감정을 몸으로 표현하는 모습이 관찰되어 교사의 지원이 필요하다' },
  { pattern: /소리를 지른다|소리를 질렀|소리 질러/g, replace: '큰 목소리로 자신의 감정을 표현하는 모습이 있다' },
  { pattern: /말이 느리다|말이 늦다|언어가 느린|발음이 안 좋|발음이 부정확/g, replace: '언어 표현이 발달하는 과정에 있으며 교사의 지원이 이루어지고 있다' },
  { pattern: /못 한다|할 줄 모른다|어려워한다/g, replace: '아직 경험이 적어 교사의 도움을 받아 익히고 있다' },
];

function softenText(text) {
  let result = text;
  for (const { pattern, replace } of SOFTEN_MAP) {
    result = result.replace(pattern, replace);
  }
  return result;
}

// ─── 키워드 기반 분류 ─────────────────────────────────────────────
function detectCategory(text) {
  const scores = CATEGORY_RULES.map(cat => ({
    id: cat.id,
    label: cat.label,
    score: cat.keywords.filter(k => text.includes(k)).length,
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].id : 'play';
}

function detectDevAreas(text) {
  const matched = DEV_AREA_RULES
    .map(area => ({ id: area.id, score: area.keywords.filter(k => text.includes(k)).length }))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matched.length === 0) return ['사회관계'];
  return matched.slice(0, 3).map(a => a.id);
}

function extractTags(text, categoryId) {
  const TAG_POOL = {
    peer: ['또래관계', '갈등상황', '차례기다리기', '감정표현', '협력', '양보', '친구와 놀이'],
    habit: ['생활습관', '식습관', '수면', '배변', '위생', '자립', '정리정돈'],
    comm: ['의사소통', '언어표현', '질문하기', '대화', '감정표현', '발표'],
    nature: ['자연탐구', '곤충관찰', '식물관찰', '날씨', '비교', '호기심'],
    art: ['예술표현', '미술활동', '음악활동', '창의표현', '역할놀이'],
    body: ['신체활동', '대근육', '소근육', '바깥놀이', '운동발달'],
    play: ['놀이활동', '구성놀이', '탐색활동', '창의놀이', '집중력'],
    special: ['특이사항', '건강', '안전', '정서지원', '적응'],
  };

  const base = TAG_POOL[categoryId] || TAG_POOL.play;
  const extra = [];
  if (text.includes('울') || text.includes('속상')) extra.push('감정조절');
  if (text.includes('스스로') || text.includes('혼자')) extra.push('자립심');
  if (text.includes('왜') || text.includes('어떻게') || text.includes('궁금')) extra.push('호기심');
  if (text.includes('도와') || text.includes('배려')) extra.push('배려심');

  return [...new Set([...base.slice(0, 3), ...extra])].slice(0, 5);
}

// ─── 문장 생성 템플릿 ─────────────────────────────────────────────
const OBSERVATION_TEMPLATES = {
  peer: (name, text) =>
    `${name}이/가 또래와의 놀이 상황에서 ${softSummary(text)} 교사의 지원을 통해 상황을 경험하는 모습이 관찰되었다.`,
  habit: (name, text) =>
    `${name}이/가 일상생활 중 ${softSummary(text)} 교사의 안내를 통해 생활습관을 익혀가고 있다.`,
  comm: (name, text) =>
    `${name}이/가 ${softSummary(text)} 자신의 생각이나 감정을 표현하려는 모습이 관찰되었다.`,
  nature: (name, text) =>
    `${name}이/가 자연물에 관심을 보이며 ${softSummary(text)} 탐구하는 모습이 관찰되었다.`,
  art: (name, text) =>
    `${name}이/가 예술 활동에 참여하며 ${softSummary(text)} 자신만의 방식으로 표현하는 모습이 보였다.`,
  body: (name, text) =>
    `${name}이/가 신체 활동 중 ${softSummary(text)} 적극적으로 참여하는 모습이 관찰되었다.`,
  play: (name, text) =>
    `${name}이/가 놀이 활동에 참여하며 ${softSummary(text)} 집중하여 탐색하는 모습이 보였다.`,
  special: (name, text) =>
    `${name}이/가 ${softSummary(text)} 교사가 세심히 살피며 지원하였다.`,
};

const PARENT_TEMPLATES = {
  peer: (name) =>
    `${name}이/가 요즘 친구들과 어울리는 상황에서 다양한 감정을 경험하고 있습니다. 아직 조율이 어려운 순간도 있지만, 교사의 도움을 받아 말로 표현하고 차례를 기다리는 경험을 하고 있어요.`,
  habit: (name) =>
    `${name}이/가 일상생활의 규칙과 습관을 익혀가는 중입니다. 가정에서도 스스로 해볼 수 있는 기회를 많이 주시면 큰 도움이 됩니다.`,
  comm: (name) =>
    `${name}이/가 자신의 생각과 감정을 말로 표현하려는 모습이 늘고 있습니다. 가정에서도 아이의 이야기를 천천히 들어주시면 언어 발달에 도움이 됩니다.`,
  nature: (name) =>
    `${name}이/가 자연에 대한 호기심이 많아 주변 사물을 관심 있게 살피고 있습니다. 가정에서 산책이나 자연 탐색 기회를 주시면 더욱 좋을 것 같아요.`,
  art: (name) =>
    `${name}이/가 예술 활동에 즐겁게 참여하며 창의적으로 표현하는 모습을 보이고 있습니다. 가정에서도 자유롭게 그리고 만들 수 있는 환경을 만들어 주세요.`,
  body: (name) =>
    `${name}이/가 신체 활동을 즐기며 활발하게 움직이고 있습니다. 충분한 바깥 활동과 안전한 신체 놀이 환경을 제공해 주시면 좋겠습니다.`,
  play: (name) =>
    `${name}이/가 다양한 놀이 활동에 집중하며 탐색하는 모습을 보이고 있습니다. 아이가 관심 갖는 놀이를 가정에서도 함께 즐겨 보세요.`,
  special: (name) =>
    `${name}이/가 오늘 특별한 상황을 경험하였습니다. 가정에서도 아이의 컨디션과 감정 상태를 세심히 살펴봐 주시면 감사하겠습니다.`,
};

const SUPPORT_TEMPLATES = {
  peer: '또래와의 놀이 상황에서 차례 기다리기와 감정 조절을 반복적으로 경험할 수 있도록 지원하며, 말로 표현하는 모델링을 제공한다.',
  habit: '일상생활 장면에서 스스로 시도해볼 수 있는 기회를 제공하고, 성공 경험을 통해 자립심이 높아지도록 지원한다.',
  comm: '다양한 상황에서 짧은 문장으로 표현해볼 수 있도록 교사가 모델링을 제공하고, 표현하려는 시도를 충분히 격려한다.',
  nature: '자연물을 직접 탐색할 수 있는 기회를 제공하고, 관찰한 것을 말이나 그림으로 표현해볼 수 있도록 지원한다.',
  art: '다양한 재료를 자유롭게 탐색하고 표현할 수 있는 환경을 제공하며, 결과보다 과정에 집중할 수 있도록 격려한다.',
  body: '대·소근육 발달을 지원하는 활동을 계획하고, 신체 활동 중 안전한 환경을 유지하며 적극적인 참여를 격려한다.',
  play: '아이의 관심사를 반영한 놀이 환경을 구성하고, 놀이가 확장될 수 있도록 적절한 시기에 지원과 개입을 제공한다.',
  special: '아이의 상태를 지속적으로 관찰하며 가정과 긴밀히 소통하고, 필요한 경우 즉각적인 지원을 제공한다.',
};

function softSummary(text) {
  const softened = softenText(text);
  const trimmed = softened.length > 40 ? softened.slice(0, 40) + '…' : softened;
  return trimmed + ' ';
}

function makeTitle(text, categoryId) {
  const CAT_LABELS = { peer: '또래관계', habit: '생활습관', comm: '의사소통', nature: '자연탐구', art: '예술표현', body: '신체활동', play: '놀이활동', special: '특이사항' };
  const label = CAT_LABELS[categoryId] || '관찰기록';
  const keywords = ['친구', '식사', '말', '곤충', '그림', '운동', '블록', '건강'];
  const found = keywords.find(k => text.includes(k));
  return found ? `${label} - ${found}` : label;
}

// ─── 공개 함수 ────────────────────────────────────────────────────

export async function processRecord({ childName, rawText, classAge }) {
  const name = childName || '아동';
  const category = detectCategory(rawText);
  const devAreas = detectDevAreas(rawText);
  const tags = extractTags(rawText, category);
  const softened = softenText(rawText);

  const observeFn = OBSERVATION_TEMPLATES[category] || OBSERVATION_TEMPLATES.play;
  const parentFn = PARENT_TEMPLATES[category] || PARENT_TEMPLATES.play;

  return {
    category,
    devAreas,
    tags,
    softened,
    observation: observeFn(name, rawText),
    parent: parentFn(name),
    support: SUPPORT_TEMPLATES[category] || SUPPORT_TEMPLATES.play,
    title: makeTitle(rawText, category),
  };
}

export async function generateDailyJournal({ records, date, classAge, className }) {
  const categories = records.map(r => r.category || detectCategory(r.rawText || ''));
  const hasPeer = categories.includes('peer');
  const hasNature = categories.includes('nature');
  const hasArt = categories.includes('art');
  const hasBody = categories.includes('body');

  const activityParts = [];
  if (hasNature) activityParts.push('자연탐구 활동');
  if (hasArt) activityParts.push('예술 표현 활동');
  if (hasBody) activityParts.push('신체 활동');
  if (hasPeer) activityParts.push('또래 상호작용');
  if (activityParts.length === 0) activityParts.push('다양한 놀이 활동');

  const childCount = records.length;

  return {
    playFlow: `오늘 유아들은 ${activityParts.join(', ')}에 참여하며 즐거운 하루를 보냈다. 실내외 놀이 환경에서 자신이 관심 있는 놀이를 선택하여 집중하는 모습을 보였으며, 활동 간 자연스러운 연계가 이루어졌다.`,
    childResponse: `${childCount}명의 유아가 오늘 활동에 참여하였으며, 대부분 적극적인 모습을 보였다. ${hasPeer ? '또래와 함께 놀이하는 과정에서 다양한 감정을 경험하였고, ' : ''}교사의 지원을 통해 놀이를 이어가거나 문제를 해결하는 경험을 하였다.`,
    teacherSupport: `교사는 유아들이 자유롭게 탐색할 수 있는 환경을 제공하고, 필요한 순간에 적절히 개입하였다. ${hasPeer ? '또래 갈등 상황에서 감정을 말로 표현할 수 있도록 모델링하였으며, ' : ''}개별 유아의 관심과 요구에 맞는 지원을 이어갔다.`,
    evaluation: `오늘 보육 활동은 유아의 흥미와 발달 수준에 적합하게 이루어졌다. ${activityParts[0]}을 중심으로 놀이가 확장되었으며, 유아들이 주도적으로 놀이를 이끌어가는 모습이 관찰되었다.`,
    nextPlan: `다음 활동에서는 오늘의 놀이 경험을 바탕으로 심화 탐색 기회를 제공하고, 개별 유아의 발달 수준에 맞는 지원을 이어갈 계획이다.`,
  };
}

export async function generateGrowthSummary({ childName, records, period, childAge }) {
  const name = childName || '아동';
  const count = records.length;

  const catCounts = {};
  records.forEach(r => {
    const cat = r.category || 'play';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'play';
  const CAT_LABELS = { peer: '또래관계', habit: '생활습관', comm: '의사소통', nature: '자연탐구', art: '예술표현', body: '신체활동', play: '놀이활동', special: '특이사항' };
  const topLabel = CAT_LABELS[topCat] || '놀이활동';

  return {
    overall: `${name}이/가 ${period} 동안 ${count}건의 관찰 기록이 누적되었습니다. 전반적으로 ${topLabel} 영역에서 활발한 모습을 보이며 성장하고 있습니다. 교사와의 관계에서도 안정감을 보이며 일상생활에 적응하고 있습니다.`,
    strengths: `${name}이/가 ${topLabel} 상황에서 자신의 관심을 적극적으로 표현하는 모습이 돋보입니다. 새로운 활동에 흥미를 보이며 탐색하려는 의지가 강하고, 교사의 지원을 통해 경험을 확장해나가고 있습니다.`,
    support: `또래와의 상호작용 과정에서 감정 조절과 의사소통 표현 기회를 더 많이 제공하면 좋겠습니다. 다양한 발달 영역의 균형 있는 경험을 위해 지속적인 관찰과 지원이 이루어질 예정입니다.`,
    parentMessage: `${name}이/가 원에서 ${topLabel} 활동을 즐겁게 경험하며 성장하고 있습니다. 가정에서도 아이가 관심 갖는 것들을 함께 탐색해 주시고, 일상 속 작은 성공 경험을 충분히 격려해 주세요. 앞으로도 아이의 성장을 함께 지원하겠습니다.`,
    nextSteps: `개별 발달 특성을 고려한 맞춤형 지원을 지속하고, 부족한 영역의 경험이 균형 있게 이루어지도록 환경과 활동을 계획할 예정입니다.`,
  };
}

export async function generateConsultDoc({ childName, records, childAge }) {
  const name = childName || '아동';
  const count = records.length;

  const catCounts = {};
  records.forEach(r => {
    const cat = r.category || 'play';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'play';
  const CAT_LABELS = { peer: '또래관계', habit: '생활습관', comm: '의사소통', nature: '자연탐구', art: '예술표현', body: '신체활동', play: '놀이활동', special: '특이사항' };

  return {
    recentGrowth: `최근 ${name}이/가 ${CAT_LABELS[topCat] || '놀이'} 영역에서 활발한 모습을 보이고 있습니다. 총 ${count}건의 관찰 기록을 통해 꾸준한 성장이 확인되었습니다.`,
    strengths: `자신이 좋아하는 활동에 집중하여 탐색하는 능력이 뛰어납니다. 교사의 지원을 받아 새로운 경험에 도전하려는 의지를 보이고 있으며, 일상 루틴에 잘 적응하고 있습니다.`,
    supportNeeded: `또래와의 상호작용 과정에서 감정을 말로 표현하는 연습이 지속적으로 필요합니다. 가정과 원이 함께 일관된 방향으로 지원해 주시면 더욱 빠른 성장이 기대됩니다.`,
    homeLinks: [
      '일상 속에서 아이의 이야기를 충분히 들어주고 감정에 공감해 주세요.',
      '스스로 해결할 수 있는 작은 일을 맡겨 자립심을 키울 수 있게 도와주세요.',
      '바깥 활동과 자연 탐색의 기회를 자주 제공해 주시면 좋겠습니다.',
    ].join(' / '),
    teacherSupport: `원에서는 ${name}이/가 안정감을 느낄 수 있도록 일관된 지지를 제공하고 있으며, 개별 특성을 반영한 활동 지원을 이어가고 있습니다.`,
    openingMessage: `오늘 상담에 시간 내주셔서 감사합니다. ${name}이/가 원에서 즐겁게 지내고 있어 함께 나눌 이야기가 많습니다.`,
  };
}
