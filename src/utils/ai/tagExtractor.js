const TAG_RULES = [
  { tag: '실제발화', test: ({ parsedInput }) => parsedInput.actualSpeech?.length > 0 },
  { tag: '또래상호작용', test: ({ parsedInput, categories }) => parsedInput.peerInteraction?.length > 0 || categories.includes('사회관계') },
  { tag: '교사지원', test: ({ parsedInput }) => parsedInput.teacherSupport?.length > 0 },
  { tag: '감정표현', test: ({ parsedInput }) => parsedInput.emotions?.length > 0 },
  { tag: '변화관찰', test: ({ parsedInput }) => parsedInput.changes?.length > 0 },
  { tag: '건강안전', test: ({ parsedInput, categories }) => parsedInput.healthAndSafety?.length > 0 || categories.includes('안전') },
  { tag: '놀이흐름', test: ({ parsedInput, categories }) => parsedInput.playFlow?.length > 0 || categories.includes('놀이') },
];

const CATEGORY_TAGS = {
  '신체운동·건강': '신체운동·건강',
  '의사소통': '의사소통',
  '사회관계': '사회관계',
  '예술경험': '예술경험',
  '자연탐구': '자연탐구',
  '기본생활습관': '기본생활습관',
  '안전': '안전',
  '놀이': '놀이',
};

export function extractTags({ parsedInput = {}, categories = [], devAreas = [] } = {}) {
  const tags = new Set();
  categories.forEach((category) => {
    if (CATEGORY_TAGS[category]) tags.add(CATEGORY_TAGS[category]);
  });
  devAreas.forEach((area) => tags.add(area));
  TAG_RULES.forEach((rule) => {
    if (rule.test({ parsedInput, categories, devAreas })) tags.add(rule.tag);
  });
  return [...tags];
}
