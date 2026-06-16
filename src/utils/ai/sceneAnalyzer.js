const SCENE_RULES = [
  {
    id: 'peer_conflict',
    label: '또래 갈등',
    category: '사회관계',
    keywords: ['빼앗', '다툼', '울', '미안', '갈등', '양보', '기다'],
  },
  {
    id: 'cooperative_play',
    label: '협력 놀이',
    category: '놀이',
    keywords: ['함께', '같이', '협력', '블록', '쌓', '역할', '놀이'],
  },
  {
    id: 'health_care',
    label: '건강 관찰',
    category: '신체운동·건강',
    keywords: ['체온', '투약', '약', '아프', '기침', '콧물', '컨디션'],
  },
  {
    id: 'safety_incident',
    label: '안전 상황',
    category: '안전',
    keywords: ['넘어', '떨어', '상처', '다치', '미끄럼', '사고', '안전'],
  },
  {
    id: 'self_help',
    label: '생활 습관',
    category: '기본생활습관',
    keywords: ['식사', '양치', '정리', '낮잠', '화장실', '손씻'],
  },
  {
    id: 'expression',
    label: '표현 활동',
    category: '예술경험',
    keywords: ['그림', '색', '물감', '노래', '춤', '만들', '붙이'],
  },
  {
    id: 'inquiry',
    label: '탐색 관찰',
    category: '자연탐구',
    keywords: ['관찰', '탐색', '궁금', '비교', '곤충', '식물', '물', '모래'],
  },
];

const scoreScene = (text, rule) =>
  rule.keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);

export function analyzeScene(parsedInput = {}) {
  const text = parsedInput.normalizedText || parsedInput.rawText || '';
  const scored = SCENE_RULES
    .map((rule) => ({ ...rule, score: scoreScene(text, rule) }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);

  const primary = scored[0] || {
    id: 'general_observation',
    label: '일상 관찰',
    category: '놀이',
    score: 0,
    keywords: [],
  };

  return {
    primary,
    candidates: scored,
  };
}

export { SCENE_RULES };
