export const SENTENCE_BANK = [
  {
    id: 'observation.teacher-support.basic',
    category: '놀이',
    status: 'supported',
    documentType: 'observation',
    tone: 'objective',
    text: '교사는 놀이 흐름을 지켜보며 필요한 순간에 언어적 지원을 제공하였다.',
  },
  {
    id: 'observation.peer.objective',
    category: '사회관계',
    status: 'peer',
    documentType: 'observation',
    tone: 'objective',
    text: '또래와의 상호작용 과정에서 보인 말과 행동을 중심으로 관찰하였다.',
  },
  {
    id: 'observation.health.objective',
    category: '신체운동·건강',
    status: 'health',
    documentType: 'observation',
    tone: 'objective',
    text: '건강 상태와 일과 중 변화를 사실 중심으로 확인하였다.',
  },
  {
    id: 'observation.safety.objective',
    category: '안전',
    status: 'safety',
    documentType: 'observation',
    tone: 'objective',
    text: '안전과 관련된 상황을 확인하고 필요한 보호와 안내를 제공하였다.',
  },
  {
    id: 'notice.soft-progress.basic',
    category: '놀이',
    status: 'progress',
    documentType: 'notice',
    tone: 'warm',
    text: '오늘의 경험을 통해 스스로 시도해 보는 모습이 이어졌습니다.',
  },
  {
    id: 'notice.peer.warm',
    category: '사회관계',
    status: 'peer',
    documentType: 'notice',
    tone: 'warm',
    text: '친구와 함께하는 과정에서 마음을 표현하고 조율해 보는 경험이 있었습니다.',
  },
  {
    id: 'notice.health.warm',
    category: '신체운동·건강',
    status: 'health',
    documentType: 'notice',
    tone: 'warm',
    text: '컨디션을 살피며 편안하게 지낼 수 있도록 곁에서 도왔습니다.',
  },
  {
    id: 'daily.flow.basic',
    category: '놀이',
    status: 'flow',
    documentType: 'dailyReport',
    tone: 'report',
    text: '놀이 흐름 속에서 유아의 관심과 반응을 관찰하고 필요한 지원을 제공하였다.',
  },
  {
    id: 'daily.peer.report',
    category: '사회관계',
    status: 'peer',
    documentType: 'dailyReport',
    tone: 'report',
    text: '또래와의 상호작용을 통해 감정 표현과 관계 조율 경험이 나타났다.',
  },
  {
    id: 'daily.inquiry.report',
    category: '자연탐구',
    status: 'flow',
    documentType: 'dailyReport',
    tone: 'report',
    text: '탐색 과정에서 유아의 질문과 비교, 관찰 행동을 지원하였다.',
  },
];

export function selectSentence({ category = '놀이', status, documentType, tone, excludeIds = [] } = {}) {
  const candidates = SENTENCE_BANK.filter((sentence) =>
    (!category || sentence.category === category) &&
    (!status || sentence.status === status) &&
    (!documentType || sentence.documentType === documentType) &&
    (!tone || sentence.tone === tone) &&
    !excludeIds.includes(sentence.id)
  );
  return candidates[0] || SENTENCE_BANK.find((sentence) => !excludeIds.includes(sentence.id)) || SENTENCE_BANK[0];
}

export function selectDraftSentences({ primaryCategory = '놀이', excludeIds = [] } = {}) {
  return {
    observation: selectSentence({
      category: primaryCategory,
      documentType: 'observation',
      excludeIds,
    }),
    notice: selectSentence({
      category: primaryCategory,
      documentType: 'notice',
      excludeIds,
    }),
    dailyReport: selectSentence({
      category: primaryCategory,
      documentType: 'dailyReport',
      excludeIds,
    }),
  };
}
