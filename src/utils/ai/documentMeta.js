const USE_LABELS = {
  observation: '관찰일지',
  dailyReport: '보육일지',
  dailyJournal: '보육일지',
  parentMessage: '알림장',
  parentNotice: '부모 안내문',
  parentConsult: '부모상담자료',
  supportPlan: '지원계획',
  playEvaluation: '놀이평가',
  weeklyEvaluation: '주간평가',
  monthlyEvaluation: '월간평가',
  developmentEvaluation: '발달평가',
  safetyEvaluation: '안전교육·행사평가',
  eventEvaluation: '행사평가',
  assessmentCheck: '평가제 점검',
  evaluation: '발달평가',
};

export function getDocumentUseLabel(key) {
  return USE_LABELS[key] || key;
}

export function formatDocumentUseLabels(keys = [], { limit } = {}) {
  const labels = keys.map(getDocumentUseLabel);
  return (typeof limit === 'number' ? labels.slice(0, limit) : labels).join(', ');
}

const DOCUMENT_USE_BY_CATEGORY = {
  peer: ['observation', 'dailyJournal', 'parentConsult', 'developmentEvaluation', 'playEvaluation', 'assessmentCheck'],
  habit: ['observation', 'dailyJournal', 'parentConsult', 'developmentEvaluation', 'assessmentCheck'],
  comm: ['observation', 'dailyJournal', 'parentConsult', 'developmentEvaluation', 'playEvaluation', 'assessmentCheck'],
  nature: ['observation', 'dailyJournal', 'developmentEvaluation', 'playEvaluation', 'monthlyEvaluation'],
  art: ['observation', 'dailyJournal', 'developmentEvaluation', 'playEvaluation', 'monthlyEvaluation'],
  body: ['observation', 'dailyJournal', 'developmentEvaluation', 'playEvaluation', 'safetyEvaluation'],
  play: ['observation', 'dailyJournal', 'playEvaluation', 'weeklyEvaluation', 'monthlyEvaluation'],
  special: ['observation', 'dailyJournal', 'parentConsult', 'safetyEvaluation', 'eventEvaluation', 'assessmentCheck'],
  '사회관계': ['observation', 'dailyReport', 'parentMessage', 'evaluation'],
  '의사소통': ['observation', 'dailyReport', 'parentMessage', 'evaluation'],
  '예술경험': ['observation', 'dailyReport', 'playEvaluation', 'evaluation'],
  '자연탐구': ['observation', 'dailyReport', 'playEvaluation', 'evaluation'],
  '신체운동·건강': ['observation', 'dailyReport', 'supportPlan', 'evaluation'],
  '기본생활습관': ['observation', 'dailyReport', 'supportPlan', 'evaluation'],
  '안전': ['observation', 'dailyReport', 'supportPlan', 'evaluation'],
  '놀이': ['observation', 'dailyReport', 'playEvaluation', 'evaluation'],
};

export function getDocumentUsesForCategory(category, recordType) {
  const usableFor = new Set(DOCUMENT_USE_BY_CATEGORY[category] || DOCUMENT_USE_BY_CATEGORY.play);
  if (recordType === 'consult') usableFor.add('parentConsult');
  if (recordType === 'special') {
    usableFor.add('safetyEvaluation');
    usableFor.add('eventEvaluation');
  }
  if (recordType === 'notice') usableFor.add('parentNotice');
  return [...usableFor];
}

export function buildDocumentMeta({ parsedInput, categories = [], devAreas = [], tags = [], documentUses = [], recordType, classAge } = {}) {
  const reviewFlags = [];
  const text = parsedInput?.normalizedText || parsedInput?.rawText || '';

  if (text.length < 12) reviewFlags.push('기록 내용이 짧아 추가 확인이 필요합니다.');
  if (!devAreas.length) reviewFlags.push('발달영역 확인이 필요합니다.');
  if (!tags.length) reviewFlags.push('태그 확인이 필요합니다.');
  if (parsedInput?.actualSpeech?.length && !text.includes(parsedInput.actualSpeech[0])) {
    reviewFlags.push('실제 발화 보존 여부 확인이 필요합니다.');
  }

  return {
    schemaVersion: 2,
    engine: 'local-rule-modular',
    recordType: recordType || 'observe',
    classAge: classAge || '',
    primaryCategory: categories[0] || '놀이',
    categories,
    devAreas,
    tags,
    usableFor: documentUses.length ? documentUses : getDocumentUsesForCategory(categories[0], recordType),
    documentReady: reviewFlags.length === 0,
    reviewFlags,
  };
}

export function makeDocumentReadyText(meta = {}) {
  const uses = formatDocumentUseLabels(meta.usableFor || []);
  const ready = meta.documentReady
    ? '문서 작성에 바로 활용할 수 있는 기록입니다.'
    : '문서 작성 전 간단한 확인이 필요한 기록입니다.';
  const review = meta.reviewFlags?.length ? ` 확인 필요: ${meta.reviewFlags.join(', ')}` : '';
  return `${ready} 활용 가능 문서: ${uses || '관찰일지, 보육일지'}.${review}`;
}
