export const DEVELOPMENT_AREAS = [
  '신체운동·건강',
  '의사소통',
  '사회관계',
  '예술경험',
  '자연탐구',
  '기본생활습관',
  '안전',
  '놀이',
];

const RULES = [
  { area: '신체운동·건강', keywords: ['걷', '뛰', '달리', '균형', '공', '몸', '손', '발', '건강', '체온', '약', '투약', '아프'] },
  { area: '의사소통', keywords: ['말', '이야기', '질문', '표현', '대답', '읽', '책', '소리', '설명'] },
  { area: '사회관계', keywords: ['친구', '또래', '함께', '같이', '양보', '기다', '나누', '갈등', '미안'] },
  { area: '예술경험', keywords: ['그림', '색', '물감', '노래', '춤', '만들', '붙이', '악기'] },
  { area: '자연탐구', keywords: ['관찰', '곤충', '식물', '물', '모래', '비교', '탐색', '궁금', '숫자'] },
  { area: '기본생활습관', keywords: ['식사', '밥', '간식', '양치', '정리', '낮잠', '화장실', '손씻'] },
  { area: '안전', keywords: ['안전', '위험', '다치', '넘어', '떨어', '사고', '상처', '미끄럼'] },
  { area: '놀이', keywords: ['놀이', '블록', '역할', '장난감', '쌓', '완성', '구성', '놀이감'] },
];

export function classifyCategories(parsedInput = {}) {
  const text = parsedInput.normalizedText || parsedInput.rawText || '';
  const matches = RULES
    .filter((rule) => rule.keywords.some((keyword) => text.includes(keyword)))
    .map((rule) => rule.area);
  return [...new Set(matches.length ? matches : ['놀이'])];
}

export function getPrimaryCategory(parsedInput = {}) {
  const categories = classifyCategories(parsedInput);
  if (parsedInput.healthAndSafety?.length) {
    return categories.includes('안전') ? '안전' : '신체운동·건강';
  }
  if (parsedInput.peerInteraction?.length) return '사회관계';
  if (parsedInput.playFlow?.length && categories.includes('놀이')) return '놀이';
  return categories[0] || '놀이';
}

const CATEGORY_TO_DEV_AREA = {
  '신체운동·건강': ['신체운동·건강'],
  '의사소통': ['의사소통'],
  '사회관계': ['사회관계'],
  '예술경험': ['예술경험'],
  '자연탐구': ['자연탐구'],
  '기본생활습관': ['신체운동·건강'],
  '안전': ['신체운동·건강'],
  '놀이': ['사회관계', '의사소통'],
};

export function detectDevelopmentAreas(parsedInput = {}, categories = classifyCategories(parsedInput)) {
  const text = parsedInput.normalizedText || parsedInput.rawText || '';
  const areas = new Set();

  categories.forEach((category) => {
    (CATEGORY_TO_DEV_AREA[category] || []).forEach((area) => areas.add(area));
  });

  if (parsedInput.actualSpeech?.length || /말|이야기|질문|대답|표현/.test(text)) areas.add('의사소통');
  if (parsedInput.peerInteraction?.length) areas.add('사회관계');
  if (/그림|색|물감|노래|춤|만들|붙이/.test(text)) areas.add('예술경험');
  if (/관찰|곤충|식물|물|모래|비교|탐색|궁금|숫자/.test(text)) areas.add('자연탐구');
  if (parsedInput.healthAndSafety?.length || /식사|양치|정리|낮잠|화장실|체온|투약|상처/.test(text)) areas.add('신체운동·건강');

  return [...areas];
}

export function getDocumentUses(parsedInput = {}, categories = classifyCategories(parsedInput)) {
  const uses = new Set(['observation', 'dailyReport']);
  if (parsedInput.peerInteraction?.length || categories.includes('사회관계')) uses.add('parentMessage');
  if (parsedInput.healthAndSafety?.length || categories.includes('안전')) uses.add('supportPlan');
  if (parsedInput.playFlow?.length || categories.includes('놀이')) uses.add('playEvaluation');
  if (detectDevelopmentAreas(parsedInput, categories).length) uses.add('evaluation');
  return [...uses];
}
