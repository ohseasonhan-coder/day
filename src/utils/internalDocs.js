// ── 원내문서 자동완성 ────────────────────────────────────────────────────────
// 교사가 원내에서 작성하는 행정 문서를 입력값 기반으로 초안 생성한다.
// 생성은 규칙 기반(로컬). 나중에 실제 AI API로 교체하기 쉽도록 generate 함수를 분리.
// 핵심 원칙: 교사가 입력한 사실만으로 초안을 정리한다 (없는 내용 지어내지 않음).

// 입력 필드 정의: { key, label, type('text'|'textarea'|'date'), placeholder, optional }
export const INTERNAL_DOC_TYPES = [
  {
    key: 'staffEdu',
    label: '교직원 교육일지',
    icon: '👩‍🏫',
    desc: '교육명·내용을 입력하면 목적·요약·평가·적용계획까지 정리',
    fields: [
      { key: 'title',     label: '교육명',        type: 'text',     placeholder: '예: 아동학대 예방 교육' },
      { key: 'date',      label: '교육일자',      type: 'date' },
      { key: 'place',     label: '교육장소',      type: 'text',     placeholder: '예: 어린이집 2층 교사실' },
      { key: 'method',    label: '교육방법',      type: 'text',     placeholder: '예: 외부강사 강의, 동영상 시청' },
      { key: 'attendees', label: '참석자',        type: 'text',     placeholder: '예: 원장, 교사 5명' },
      { key: 'content',   label: '교육내용',      type: 'textarea', placeholder: '교육에서 다룬 주요 내용을 적어주세요' },
      { key: 'apply',     label: '느낀 점 / 적용할 점', type: 'textarea', placeholder: '현장에 어떻게 적용할지 적어주세요', optional: true },
    ],
  },
  {
    key: 'meeting',
    label: '교사회의록',
    icon: '📝',
    desc: '회의 안건·논의 내용으로 회의록 초안 작성',
    fields: [
      { key: 'title',     label: '회의명',     type: 'text',     placeholder: '예: 3월 정기 교사회의' },
      { key: 'date',      label: '회의일자',   type: 'date' },
      { key: 'place',     label: '장소',       type: 'text',     placeholder: '예: 교사실', optional: true },
      { key: 'attendees', label: '참석자',     type: 'text',     placeholder: '예: 원장, 교사 5명' },
      { key: 'agenda',    label: '안건',       type: 'textarea', placeholder: '논의할 안건을 적어주세요 (줄바꿈으로 구분)' },
      { key: 'discuss',   label: '논의 내용',  type: 'textarea', placeholder: '안건별 논의·결정 사항을 적어주세요' },
    ],
  },
  {
    key: 'safetyEdu',
    label: '안전교육 평가',
    icon: '🛡️',
    desc: '안전교육 실시 내용으로 평가서 초안 작성',
    fields: [
      { key: 'title',   label: '안전교육명', type: 'text',     placeholder: '예: 화재 대피 훈련' },
      { key: 'date',    label: '실시일자',   type: 'date' },
      { key: 'target',  label: '대상',       type: 'text',     placeholder: '예: 만 3~5세 유아 전체' },
      { key: 'method',  label: '교육방법',   type: 'text',     placeholder: '예: 시청각 자료, 대피 실습', optional: true },
      { key: 'content', label: '교육내용',   type: 'textarea', placeholder: '안전교육에서 다룬 내용을 적어주세요' },
      { key: 'reaction',label: '유아 반응',  type: 'textarea', placeholder: '유아들의 참여·반응을 적어주세요', optional: true },
    ],
  },
  {
    key: 'eventEval',
    label: '행사평가서',
    icon: '🎉',
    desc: '행사 진행 내용으로 평가서 초안 작성',
    fields: [
      { key: 'title',   label: '행사명',     type: 'text',     placeholder: '예: 가족 운동회' },
      { key: 'date',    label: '행사일자',   type: 'date' },
      { key: 'target',  label: '대상',       type: 'text',     placeholder: '예: 전체 원아 및 가족', optional: true },
      { key: 'content', label: '행사내용',   type: 'textarea', placeholder: '행사 진행 내용을 적어주세요' },
      { key: 'good',    label: '잘된 점',    type: 'textarea', placeholder: '좋았던 점을 적어주세요', optional: true },
      { key: 'improve', label: '개선할 점',  type: 'textarea', placeholder: '다음에 보완할 점을 적어주세요', optional: true },
    ],
  },
  {
    key: 'community',
    label: '지역사회연계활동 기록',
    icon: '🤝',
    desc: '지역사회 연계 활동 내용으로 기록 초안 작성',
    fields: [
      { key: 'title',   label: '활동명',     type: 'text',     placeholder: '예: 우리 동네 도서관 방문' },
      { key: 'date',    label: '활동일자',   type: 'date' },
      { key: 'partner', label: '연계기관',   type: 'text',     placeholder: '예: ○○구립도서관' },
      { key: 'target',  label: '대상',       type: 'text',     placeholder: '예: 만 4세반', optional: true },
      { key: 'content', label: '활동내용',   type: 'textarea', placeholder: '활동 내용을 적어주세요' },
      { key: 'effect',  label: '교육적 효과', type: 'textarea', placeholder: '아이들이 경험한 점을 적어주세요', optional: true },
    ],
  },
  {
    key: 'openDaycare',
    label: '열린어린이집 활동 기록',
    icon: '🏡',
    desc: '부모 참여 등 열린어린이집 활동 기록 초안 작성',
    fields: [
      { key: 'title',   label: '활동명',     type: 'text',     placeholder: '예: 부모 참여 수업' },
      { key: 'date',    label: '활동일자',   type: 'date' },
      { key: 'partList',label: '참여 대상',  type: 'text',     placeholder: '예: 만 3세반 학부모 10명' },
      { key: 'content', label: '활동내용',   type: 'textarea', placeholder: '활동 내용을 적어주세요' },
      { key: 'feedback',label: '참여자 반응', type: 'textarea', placeholder: '학부모·아이들의 반응을 적어주세요', optional: true },
    ],
  },
];

export function getInternalDocType(key) {
  return INTERNAL_DOC_TYPES.find(t => t.key === key) || null;
}

// 줄바꿈/쉼표로 구분된 항목을 불릿 목록으로
function toBullets(text) {
  return String(text || '')
    .split(/\n|·|,|，/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => `· ${s}`)
    .join('\n');
}

const has = (v) => !!String(v || '').trim();

// 입력값 → 문서 섹션 배열 { title, text }. 교사가 입력한 사실만 사용.
export function generateInternalDoc(typeKey, values) {
  const v = values || {};
  const dateStr = v.date || '';
  switch (typeKey) {
    case 'staffEdu':
      return {
        title: v.title || '교직원 교육일지',
        badge: [dateStr, v.place].filter(Boolean).join(' · '),
        sections: [
          { title: '교육 개요', text: [
            v.title && `교육명: ${v.title}`,
            dateStr && `일자: ${dateStr}`,
            v.place && `장소: ${v.place}`,
            v.method && `방법: ${v.method}`,
            v.attendees && `참석자: ${v.attendees}`,
          ].filter(Boolean).join('\n') },
          { title: '교육 목적', text: v.title
            ? `본 교육은 「${v.title}」을 주제로, 교직원의 전문성을 높이고 보육 현장의 질을 향상하기 위해 실시하였다.`
            : '교직원의 전문성 향상과 보육의 질 제고를 위해 실시하였다.' },
          { title: '교육 내용 요약', text: has(v.content) ? toBullets(v.content) : '(교육 내용을 입력해 주세요)' },
          { title: '교육 평가', text: '교직원이 적극적으로 참여하였으며, 교육 내용에 대한 이해도가 높았다. 보육 실무에 도움이 되는 유익한 시간이었다.' },
          { title: '현장 적용 계획', text: has(v.apply)
            ? toBullets(v.apply)
            : '교육에서 배운 내용을 일과 운영과 영유아 지도에 반영하여 실천한다.' },
          { title: '비고', text: '본 교육일지는 입력된 내용을 바탕으로 작성된 초안이며, 기관 상황에 맞게 검토 후 사용한다.' },
        ],
      };
    case 'meeting':
      return {
        title: v.title || '교사회의록',
        badge: [dateStr, v.place].filter(Boolean).join(' · '),
        sections: [
          { title: '회의 개요', text: [
            v.title && `회의명: ${v.title}`,
            dateStr && `일자: ${dateStr}`,
            v.place && `장소: ${v.place}`,
            v.attendees && `참석자: ${v.attendees}`,
          ].filter(Boolean).join('\n') },
          { title: '안건', text: has(v.agenda) ? toBullets(v.agenda) : '(안건을 입력해 주세요)' },
          { title: '논의 및 결정 사항', text: has(v.discuss) ? toBullets(v.discuss) : '(논의 내용을 입력해 주세요)' },
          { title: '향후 계획', text: '논의된 사항을 바탕으로 각 반에서 실천하며, 다음 회의에서 진행 상황을 점검한다.' },
        ],
      };
    case 'safetyEdu':
      return {
        title: v.title ? `${v.title} 평가` : '안전교육 평가',
        badge: [dateStr, v.target].filter(Boolean).join(' · '),
        sections: [
          { title: '교육 개요', text: [
            v.title && `교육명: ${v.title}`,
            dateStr && `일자: ${dateStr}`,
            v.target && `대상: ${v.target}`,
            v.method && `방법: ${v.method}`,
          ].filter(Boolean).join('\n') },
          { title: '교육 내용', text: has(v.content) ? toBullets(v.content) : '(교육 내용을 입력해 주세요)' },
          { title: '유아 반응', text: has(v.reaction) ? v.reaction : '유아들이 안전교육에 관심을 가지고 참여하였으며, 안전 약속을 따라 해 보았다.' },
          { title: '평가 및 추후 지도', text: '안전에 대한 인식을 높이는 계기가 되었다. 일상에서 반복적으로 안내하여 안전 습관이 형성되도록 지도한다.' },
        ],
      };
    case 'eventEval':
      return {
        title: v.title ? `${v.title} 평가서` : '행사평가서',
        badge: [dateStr, v.target].filter(Boolean).join(' · '),
        sections: [
          { title: '행사 개요', text: [
            v.title && `행사명: ${v.title}`,
            dateStr && `일자: ${dateStr}`,
            v.target && `대상: ${v.target}`,
          ].filter(Boolean).join('\n') },
          { title: '행사 내용', text: has(v.content) ? toBullets(v.content) : '(행사 내용을 입력해 주세요)' },
          { title: '잘된 점', text: has(v.good) ? toBullets(v.good) : '계획대로 원활하게 진행되었으며 영유아와 가족이 즐겁게 참여하였다.' },
          { title: '개선할 점', text: has(v.improve) ? toBullets(v.improve) : '다음 행사에서는 진행 동선과 시간 배분을 보완한다.' },
          { title: '종합 평가', text: '전반적으로 의미 있는 행사였으며, 평가 내용을 다음 행사 계획에 반영한다.' },
        ],
      };
    case 'community':
      return {
        title: v.title || '지역사회연계활동 기록',
        badge: [dateStr, v.partner].filter(Boolean).join(' · '),
        sections: [
          { title: '활동 개요', text: [
            v.title && `활동명: ${v.title}`,
            dateStr && `일자: ${dateStr}`,
            v.partner && `연계기관: ${v.partner}`,
            v.target && `대상: ${v.target}`,
          ].filter(Boolean).join('\n') },
          { title: '활동 내용', text: has(v.content) ? toBullets(v.content) : '(활동 내용을 입력해 주세요)' },
          { title: '교육적 효과', text: has(v.effect) ? v.effect : '지역사회 자원을 직접 경험하며 사회관계와 자연탐구 등 다양한 영역의 배움이 이루어졌다.' },
          { title: '추후 계획', text: '지역사회와의 지속적인 연계를 통해 영유아의 경험을 넓혀간다.' },
        ],
      };
    case 'openDaycare':
      return {
        title: v.title || '열린어린이집 활동 기록',
        badge: [dateStr, v.partList].filter(Boolean).join(' · '),
        sections: [
          { title: '활동 개요', text: [
            v.title && `활동명: ${v.title}`,
            dateStr && `일자: ${dateStr}`,
            v.partList && `참여 대상: ${v.partList}`,
          ].filter(Boolean).join('\n') },
          { title: '활동 내용', text: has(v.content) ? toBullets(v.content) : '(활동 내용을 입력해 주세요)' },
          { title: '참여자 반응', text: has(v.feedback) ? v.feedback : '학부모가 보육 활동에 직접 참여하며 어린이집 운영에 대한 이해와 신뢰가 높아졌다.' },
          { title: '평가', text: '가정과 어린이집이 소통하는 열린 보육의 좋은 기회가 되었으며, 앞으로도 정기적으로 운영한다.' },
        ],
      };
    default:
      return { title: '원내문서', badge: dateStr, sections: [] };
  }
}
