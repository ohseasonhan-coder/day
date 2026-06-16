// 문장 데이터셋: 태그 기반 보육 문서 문장 조각 모음.
// 전부 로컬 데이터(외부 API/서버 없음). 아직 UI에 연결하지 않는다.
//
// 구조:
// {
//   id, type, situation[], category[], status, ageGroup[], documentType[], tone, riskLevel, text
// }
//   type        : situation | behavior | support | evaluation | parent | counseling | development | homeLink | closing | softening
//   tone        : objective | warm | evaluative
//   riskLevel   : safe (부정 라벨/단정 없음) — 모든 문장은 safe를 기본으로 한다.
//
// {childName}, {활동} 등 중괄호 토큰은 문장 조립 시 치환할 수 있는 자리표시자다.

const BASE_SENTENCES = [
  // ─────────────────────────────────────────────────────────────
  // 1) 상황 설명 문장 (situation)
  // ─────────────────────────────────────────────────────────────
  { id: 'situation_001', type: 'situation', situation: ['자유놀이'], category: ['사회관계'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation', 'dailyReport'], tone: 'objective', riskLevel: 'safe', text: '자유놀이 시간에 {childName}가 {활동}에 참여하였다.' },
  { id: 'situation_002', type: 'situation', situation: ['쌓기놀이'], category: ['자연탐구', '사회관계'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '쌓기놀이 영역에서 {childName}가 블록으로 {구성물}을 만들었다.' },
  { id: 'situation_003', type: 'situation', situation: ['바깥놀이'], category: ['신체운동·건강'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '바깥놀이 시간에 {childName}가 {신체활동}을 하였다.' },
  { id: 'situation_004', type: 'situation', situation: ['미술'], category: ['예술경험'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '미술 영역에서 {childName}가 {재료}로 표현 활동을 하였다.' },
  { id: 'situation_005', type: 'situation', situation: ['역할놀이'], category: ['예술경험', '사회관계'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '역할놀이 영역에서 {childName}가 {역할}이 되어 놀이를 시작하였다.' },
  { id: 'situation_006', type: 'situation', situation: ['점심', '간식'], category: ['신체운동·건강'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '점심시간에 {childName}가 식사 자리에 앉아 식사를 시작하였다.' },
  { id: 'situation_007', type: 'situation', situation: ['낮잠'], category: ['신체운동·건강'], status: '관찰', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '낮잠 시간에 {childName}가 이부자리에 누워 휴식을 취하였다.' },
  { id: 'situation_008', type: 'situation', situation: ['등원'], category: ['사회관계'], status: '관찰', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '등원 시간에 {childName}가 보호자와 인사를 나누고 교실에 들어왔다.' },
  { id: 'situation_009', type: 'situation', situation: ['정리'], category: ['사회관계'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '놀이가 끝난 뒤 정리 시간에 {childName}가 놀잇감을 정리하기 시작하였다.' },
  { id: 'situation_010', type: 'situation', situation: ['책읽기'], category: ['의사소통'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '책 읽기 시간에 {childName}가 그림책을 펼쳐 보았다.' },
  { id: 'situation_011', type: 'situation', situation: ['자연탐구'], category: ['자연탐구'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '바깥놀이 중 {childName}가 {자연물}을 발견하고 가까이 다가갔다.' },
  { id: 'situation_012', type: 'situation', situation: ['음률'], category: ['예술경험'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '음률 활동 시간에 {childName}가 노래와 악기에 관심을 보였다.' },
  { id: 'situation_013', type: 'situation', situation: ['안전교육'], category: ['신체운동·건강'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{안전활동} 시간에 교사의 안내에 따라 {childName}가 활동에 참여하였다.' },
  { id: 'situation_014', type: 'situation', situation: ['모래놀이', '물놀이'], category: ['자연탐구'], status: '관찰', ageGroup: ['만2세', '만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '모래놀이터에서 {childName}가 모래와 물을 이용해 놀이하였다.' },
  { id: 'situation_015', type: 'situation', situation: ['게임'], category: ['사회관계'], status: '관찰', ageGroup: ['만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '규칙이 있는 게임 활동에서 {childName}가 차례를 정해 놀이에 참여하였다.' },
  { id: 'situation_016', type: 'situation', situation: ['실내자유놀이'], category: ['사회관계'], status: '관찰', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '실내자유놀이 시간에 {childName}가 관심 있는 놀이 영역으로 이동하였다.' },

  // ─────────────────────────────────────────────────────────────
  // 2) 행동 관찰 문장 (behavior)
  // ─────────────────────────────────────────────────────────────
  { id: 'behavior_001', type: 'behavior', situation: ['협력놀이'], category: ['사회관계'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation', 'dailyReport'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 친구와 역할을 나누어 함께 놀이하였다.' },
  { id: 'behavior_002', type: 'behavior', situation: ['의사표현'], category: ['의사소통'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 자신의 생각을 또래에게 말로 표현하였다.' },
  { id: 'behavior_003', type: 'behavior', situation: ['신체놀이'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 두 팔을 벌려 균형을 잡으며 몸을 조절하였다.' },
  { id: 'behavior_004', type: 'behavior', situation: ['소근육'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 손가락으로 작은 물건을 집어 옮기며 소근육을 사용하였다.' },
  { id: 'behavior_005', type: 'behavior', situation: ['관찰', '탐구'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 돋보기로 {대상}을 가까이 들여다보며 관찰하였다.' },
  { id: 'behavior_006', type: 'behavior', situation: ['미술', '몰입'], category: ['예술경험'], status: '몰입', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 색을 섞어 나타난 변화를 살펴보며 한참 동안 표현하였다.' },
  { id: 'behavior_007', type: 'behavior', situation: ['정리'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 사용한 놀잇감을 제자리에 정리하고 친구의 놀잇감도 함께 정리하였다.' },
  { id: 'behavior_008', type: 'behavior', situation: ['질문'], category: ['의사소통', '자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 궁금한 점을 교사에게 질문하며 호기심을 표현하였다.' },
  { id: 'behavior_009', type: 'behavior', situation: ['차례', '규칙'], category: ['사회관계'], status: '성장중', ageGroup: ['만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 자신의 차례를 기다리고 친구에게 차례를 알려 주었다.' },
  { id: 'behavior_010', type: 'behavior', situation: ['배려'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 어려움을 겪는 친구에게 다가가 도움을 주려 하였다.' },
  { id: 'behavior_011', type: 'behavior', situation: ['도전', '재시도'], category: ['신체운동·건강', '자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 실패한 뒤에도 방법을 바꾸어 다시 시도하였다.' },
  { id: 'behavior_012', type: 'behavior', situation: ['감정표현'], category: ['사회관계'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 속상한 마음을 울음과 표정으로 드러냈다.' },
  { id: 'behavior_013', type: 'behavior', situation: ['수개념'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 사물을 하나씩 짚으며 수를 세어 보았다.' },
  { id: 'behavior_014', type: 'behavior', situation: ['음률'], category: ['예술경험'], status: '안정적', ageGroup: ['만2세', '만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 노래에 맞추어 손뼉을 치고 몸을 움직였다.' },
  { id: 'behavior_015', type: 'behavior', situation: ['소극적참여'], category: ['사회관계'], status: '지원필요', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 또래의 놀이를 멀리서 지켜본 뒤 천천히 다가갔다.' },
  { id: 'behavior_016', type: 'behavior', situation: ['자립'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '{childName}는 스스로 옷과 신발을 정리하려고 여러 번 시도하였다.' },

  // ─────────────────────────────────────────────────────────────
  // 3) 교사 지원 문장 (support)
  // ─────────────────────────────────────────────────────────────
  { id: 'support_001', type: 'support', situation: ['갈등조정'], category: ['사회관계'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation', 'dailyReport'], tone: 'objective', riskLevel: 'safe', text: '교사가 두 유아의 마음을 차례로 들어 주고 번갈아 사용하는 방법을 안내하였다.' },
  { id: 'support_002', type: 'support', situation: ['표현지원'], category: ['의사소통'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 친절하게 말해 보자고 제안하며 부탁하는 표현을 함께 연습하였다.' },
  { id: 'support_003', type: 'support', situation: ['정서지원'], category: ['사회관계'], status: '지원', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 "속상했구나"라고 마음을 읽어 주며 곁에서 안정을 도왔다.' },
  { id: 'support_004', type: 'support', situation: ['신체지원'], category: ['신체운동·건강'], status: '지원', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 손을 잡아 주며 동작을 천천히 따라 할 수 있도록 도왔다.' },
  { id: 'support_005', type: 'support', situation: ['참여지원'], category: ['사회관계'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 함께 가 보자며 손을 내밀어 놀이에 다가갈 수 있도록 지원하였다.' },
  { id: 'support_006', type: 'support', situation: ['생활지도'], category: ['신체운동·건강'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 손 씻기 순서를 안내하며 스스로 실천할 수 있도록 도왔다.' },
  { id: 'support_007', type: 'support', situation: ['안전지도'], category: ['신체운동·건강'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 위험할 수 있음을 알려 주고 안전하게 행동하는 방법을 안내하였다.' },
  { id: 'support_008', type: 'support', situation: ['탐구지원'], category: ['자연탐구'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 돋보기와 관찰 도구를 제공하여 탐구를 이어 갈 수 있도록 지원하였다.' },
  { id: 'support_009', type: 'support', situation: ['도전지원'], category: ['신체운동·건강'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 다시 해 볼 수 있도록 격려하며 성공의 경험을 함께 기뻐하였다.' },
  { id: 'support_010', type: 'support', situation: ['수면지원'], category: ['신체운동·건강'], status: '지원', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 곁에서 등을 토닥여 주며 편안하게 잠들 수 있도록 도왔다.' },
  { id: 'support_011', type: 'support', situation: ['식습관지원'], category: ['신체운동·건강'], status: '지원', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 강요하지 않고 한 입 권하며 새로운 음식을 시도하도록 도왔다.' },
  { id: 'support_012', type: 'support', situation: ['적응지원'], category: ['사회관계'], status: '지원', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 안아 주고 좋아하는 그림책을 보여 주며 안정을 도왔다.' },
  { id: 'support_013', type: 'support', situation: ['언어지원'], category: ['의사소통'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 질문에 답하며 이야기를 확장할 수 있도록 대화를 이어 갔다.' },
  { id: 'support_014', type: 'support', situation: ['정리지원'], category: ['사회관계'], status: '지원', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 정리할 자리를 함께 짚어 주며 스스로 정리하도록 격려하였다.' },
  { id: 'support_015', type: 'support', situation: ['감정명명'], category: ['사회관계', '의사소통'], status: '지원', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 아이의 감정을 말로 읽어 주며 표현 방법을 함께 찾아보았다.' },
  { id: 'support_016', type: 'support', situation: ['또래중재'], category: ['사회관계'], status: '지원', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['observation'], tone: 'objective', riskLevel: 'safe', text: '교사가 서로의 입장을 전해 주며 함께 해결 방법을 찾도록 도왔다.' },

  // ─────────────────────────────────────────────────────────────
  // 4) 평가 문장 (evaluation)
  // ─────────────────────────────────────────────────────────────
  { id: 'evaluation_001', type: 'evaluation', situation: ['또래놀이', '의사표현'], category: ['사회관계', '의사소통'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport', 'counseling', 'development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 또래와의 놀이에서 자신의 생각을 말로 표현하는 경험을 하였다. 상대가 편안하게 느낄 수 있는 표현을 지속적으로 지원할 필요가 있다.' },
  { id: 'evaluation_002', type: 'evaluation', situation: ['협력놀이'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 친구와 역할을 나누어 공동의 목표를 이루는 협력 놀이를 경험하였다. 협동의 즐거움을 더 경험할 수 있도록 지원할 필요가 있다.' },
  { id: 'evaluation_003', type: 'evaluation', situation: ['신체놀이', '도전'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 몸의 균형을 잡으며 신체를 조절하는 경험을 하였다. 다양한 신체 활동으로 도전을 확장할 수 있도록 지원할 필요가 있다.' },
  { id: 'evaluation_004', type: 'evaluation', situation: ['미술', '몰입'], category: ['예술경험'], status: '몰입', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 색의 변화를 발견하고 표현 활동에 몰입하는 경험을 하였다. 다양한 표현 재료를 경험할 수 있도록 지원할 필요가 있다.' },
  { id: 'evaluation_005', type: 'evaluation', situation: ['자연탐구'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 대상을 자세히 관찰하며 호기심을 표현하는 경험을 하였다. 자연을 탐구할 기회를 지속적으로 지원할 필요가 있다.' },
  { id: 'evaluation_006', type: 'evaluation', situation: ['기본생활습관'], category: ['신체운동·건강'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 교사의 안내와 함께 기본생활습관을 실천하는 경험을 하였다. 습관이 몸에 배도록 꾸준히 지원할 필요가 있다.' },
  { id: 'evaluation_007', type: 'evaluation', situation: ['정리정돈'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사용한 놀잇감을 정리하며 정리정돈 습관을 실천하는 경험을 하였다. 정리 습관을 지속적으로 지원할 필요가 있다.' },
  { id: 'evaluation_008', type: 'evaluation', situation: ['안전교육'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 안전 약속을 익히고 실천하는 경험을 하였다. 안전 규칙을 반복하여 익힐 수 있도록 지원할 필요가 있다.' },
  { id: 'evaluation_009', type: 'evaluation', situation: ['소극적참여'], category: ['사회관계'], status: '지원필요', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 또래의 놀이를 관찰한 뒤 교사의 지원을 받아 참여하는 경험을 하였다. 놀이에 다가갈 기회를 꾸준히 지원할 필요가 있다.' },
  { id: 'evaluation_010', type: 'evaluation', situation: ['감정표현'], category: ['사회관계'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 감정을 행동으로 드러내고 교사의 공감을 통해 안정을 찾는 경험을 하였다. 감정을 말로 표현할 수 있도록 지속적으로 지원할 필요가 있다.' },
  { id: 'evaluation_011', type: 'evaluation', situation: ['갈등조정'], category: ['사회관계'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 갈등 상황에서 교사의 중재를 통해 타협하는 방법을 경험하였다. 자신의 마음을 말로 먼저 전하는 경험을 지원할 필요가 있다.' },
  { id: 'evaluation_012', type: 'evaluation', situation: ['교사지원', '성취'], category: ['신체운동·건강'], status: '성취', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 교사의 지원을 받아 어려운 활동에 도전하고 성취를 경험하였다. 성공 경험을 반복할 수 있도록 지원할 필요가 있다.' },
  { id: 'evaluation_013', type: 'evaluation', situation: ['수개념'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 일상 속에서 수를 세고 양을 비교하는 경험을 하였다. 생활 속 수 경험을 지속적으로 지원할 필요가 있다.' },
  { id: 'evaluation_014', type: 'evaluation', situation: ['책읽기', '공감'], category: ['의사소통'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 이야기에 관심을 가지고 질문하며 인물의 감정에 공감하는 경험을 하였다. 언어 경험을 풍부하게 지원할 필요가 있다.' },
  { id: 'evaluation_015', type: 'evaluation', situation: ['배려'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 또래의 감정에 공감하며 배려를 행동으로 표현하는 경험을 하였다. 배려 경험을 지속적으로 지원할 필요가 있다.' },
  { id: 'evaluation_016', type: 'evaluation', situation: ['자립'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 스스로 해 보려는 시도를 반복하며 자조 능력을 기르는 경험을 하였다. 스스로 할 기회를 충분히 지원할 필요가 있다.' },

  // ─────────────────────────────────────────────────────────────
  // 5) 부모 전달 문장 (parent / notice)
  // ─────────────────────────────────────────────────────────────
  { id: 'parent_001', type: 'parent', situation: ['또래놀이'], category: ['사회관계'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 친구와 함께 놀이하며 자신의 생각을 말로 표현했어요.' },
  { id: 'parent_002', type: 'parent', situation: ['협력놀이'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 친구와 역할을 나누어 협력하는 모습이 대견했습니다.' },
  { id: 'parent_003', type: 'parent', situation: ['신체놀이'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 몸을 균형 있게 움직이며 즐겁게 신체 활동에 참여했어요.' },
  { id: 'parent_004', type: 'parent', situation: ['미술'], category: ['예술경험'], status: '몰입', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 색을 섞어 보며 한참 동안 그림에 몰입하는 모습이 예뻤습니다.' },
  { id: 'parent_005', type: 'parent', situation: ['자연탐구'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 자연물을 발견하고 자세히 관찰하며 신기해하는 모습이 기특했어요.' },
  { id: 'parent_006', type: 'parent', situation: ['기본생활습관'], category: ['신체운동·건강'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 교사와 함께 손 씻기를 해 보았어요. 가정에서도 식사 전 손 씻기를 함께 챙겨 주세요.' },
  { id: 'parent_007', type: 'parent', situation: ['정리정돈'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 놀이 후 놀잇감을 스스로 정리하는 모습이 기특했습니다.' },
  { id: 'parent_008', type: 'parent', situation: ['안전교육'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 안전교육에 참여해 약속을 잘 기억하는 모습을 보여 주었어요.' },
  { id: 'parent_009', type: 'parent', situation: ['소극적참여'], category: ['사회관계'], status: '지원필요', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 친구들의 놀이를 지켜본 뒤 교사와 함께 놀이에 다가갔어요. 새로운 놀이에 편안히 다가가도록 격려해 주세요.' },
  { id: 'parent_010', type: 'parent', situation: ['감정표현'], category: ['사회관계'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 속상한 마음을 느꼈지만 교사의 도움으로 잘 가라앉혔어요. 가정에서도 마음을 말로 읽어 주시면 큰 힘이 됩니다.' },
  { id: 'parent_011', type: 'parent', situation: ['갈등조정'], category: ['사회관계'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 친구와 마음을 나눈 뒤 차례를 정하는 모습이 대견했습니다. 가정에서도 차례 지키기를 함께 연습해 주세요.' },
  { id: 'parent_012', type: 'parent', situation: ['교사지원', '성취'], category: ['신체운동·건강'], status: '성취', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 교사의 도움을 받아 어려운 활동을 끝까지 해내고 기뻐했어요.' },
  { id: 'parent_013', type: 'parent', situation: ['수면'], category: ['신체운동·건강'], status: '지원필요', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 낮잠 시간에 교사의 토닥임을 받으며 편안하게 잠이 들었습니다.' },
  { id: 'parent_014', type: 'parent', situation: ['편식'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 새로운 음식을 만나 냄새를 맡고 한 입 먹어 보는 용기를 냈어요. 가정에서도 새로운 음식을 조금씩 권해 주세요.' },
  { id: 'parent_015', type: 'parent', situation: ['분리불안'], category: ['사회관계'], status: '적응중', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 아침 {childName}가 잠시 눈물을 보였지만 곧 마음을 가라앉히고 즐겁게 놀이를 시작했어요.' },
  { id: 'parent_016', type: 'parent', situation: ['배려'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘 {childName}가 친구를 걱정하며 도와주는 따뜻한 마음을 보여 주었습니다.' },

  // ─────────────────────────────────────────────────────────────
  // 6) 상담자료 문장 (counseling)
  // ─────────────────────────────────────────────────────────────
  { id: 'counseling_001', type: 'counseling', situation: ['의사표현'], category: ['사회관계', '의사소통'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 또래에게 자신의 생각을 표현하는 모습을 보인다. 가정과 기관이 함께 정중한 말하기를 격려하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_002', type: 'counseling', situation: ['협력놀이'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 또래와 협력하며 함께 놀이하는 모습을 보인다. 가정에서도 함께하는 놀이를 격려하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_003', type: 'counseling', situation: ['소극적참여'], category: ['사회관계'], status: '지원필요', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 새로운 놀이 상황을 충분히 지켜본 뒤 참여하는 모습을 보인다. 가정에서도 천천히 다가갈 시간을 기다려 주면 도움이 될 것으로 보인다.' },
  { id: 'counseling_004', type: 'counseling', situation: ['감정표현'], category: ['사회관계'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 감정을 말보다 행동으로 표현하는 모습을 보인다. 가정에서도 아이의 감정을 말로 읽어 주는 대화를 나누면 도움이 될 것으로 보인다.' },
  { id: 'counseling_005', type: 'counseling', situation: ['갈등조정'], category: ['사회관계'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 또래와 부딪힐 때 교사의 중재로 해결하는 모습을 보인다. 가정에서도 순서를 정하는 놀이를 격려하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_006', type: 'counseling', situation: ['기본생활습관'], category: ['신체운동·건강'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 기본생활습관을 교사의 안내에 따라 실천하는 모습을 보인다. 가정에서도 함께 격려하면 습관 형성에 도움이 될 것으로 보인다.' },
  { id: 'counseling_007', type: 'counseling', situation: ['분리불안'], category: ['사회관계'], status: '적응중', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 등원 시 분리 불안을 보이지만 교사의 지원으로 점차 안정되는 모습을 보인다. 가정과 기관이 일관된 인사 방식을 함께 정하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_008', type: 'counseling', situation: ['편식'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 새로운 음식에 낯설어하지만 권유로 시도하는 모습을 보인다. 가정에서도 강요 없이 다양한 음식을 함께 경험하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_009', type: 'counseling', situation: ['자립'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 스스로 해결하려는 모습을 보인다. 가정에서도 스스로 할 기회를 충분히 주면 자립에 도움이 될 것으로 보인다.' },
  { id: 'counseling_010', type: 'counseling', situation: ['배려'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 친구의 어려움을 살피고 먼저 도와주는 모습을 보인다. 가정에서도 다른 사람을 돕는 경험을 격려하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_011', type: 'counseling', situation: ['도전', '끈기'], category: ['신체운동·건강', '자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 어려움이 생겨도 방법을 바꾸어 다시 시도하는 모습을 보인다. 가정에서도 스스로 해결할 시간을 기다려 주면 도움이 될 것으로 보인다.' },
  { id: 'counseling_012', type: 'counseling', situation: ['탐구'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 주변에 관심을 가지고 자세히 관찰하며 질문하는 모습을 보인다. 가정에서도 자연을 함께 살펴보는 경험을 격려하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_013', type: 'counseling', situation: ['수면'], category: ['신체운동·건강'], status: '지원필요', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 낮잠 시간에 잠들기까지 시간이 걸리는 모습을 보인다. 가정에서도 규칙적인 수면 환경을 마련하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_014', type: 'counseling', situation: ['안전'], category: ['신체운동·건강'], status: '지원필요', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 활동적으로 놀이하며 때때로 몸 조절이 필요한 모습을 보인다. 가정과 기관이 함께 안전한 놀이 약속을 일관되게 지원하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_015', type: 'counseling', situation: ['또래관계'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 새로운 친구에게 먼저 다가가 어울리는 모습을 보인다. 가정에서도 또래와 만나는 기회를 격려하면 도움이 될 것으로 보인다.' },
  { id: 'counseling_016', type: 'counseling', situation: ['사실보존'], category: ['사회관계', '의사소통'], status: '지원필요', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 원하지 않는 활동에 대해 분명하게 의사를 표현하는 모습을 보인다. 가정과 기관이 함께 아이의 속도를 존중하면 도움이 될 것으로 보인다.' },

  // ─────────────────────────────────────────────────────────────
  // 7) 발달평가 문장 (development)
  // ─────────────────────────────────────────────────────────────
  { id: 'development_001', type: 'development', situation: ['의사표현'], category: ['사회관계', '의사소통'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사회관계와 의사소통 영역에서 자신의 의사를 표현하고 또래와 조율하는 발달 양상을 보인다. 상대를 배려하는 표현 능력이 점차 자라고 있다.' },
  { id: 'development_002', type: 'development', situation: ['협력놀이'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사회관계 영역에서 또래와 역할을 나누고 협력하는 발달 양상을 보인다. 공동 놀이에 참여하는 능력이 자라고 있다.' },
  { id: 'development_003', type: 'development', situation: ['신체놀이'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 신체운동·건강 영역에서 균형과 조절 능력이 자라는 발달 양상을 보인다. 새로운 동작에 도전하며 운동 능력이 향상되고 있다.' },
  { id: 'development_004', type: 'development', situation: ['소근육'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 신체운동·건강 영역에서 소근육 조절 능력이 자라는 발달 양상을 보인다. 도구를 다루는 능력이 점차 정교해지고 있다.' },
  { id: 'development_005', type: 'development', situation: ['미술'], category: ['예술경험', '자연탐구'], status: '몰입', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 예술경험 영역에서 색과 재료를 탐색하고 표현하는 발달 양상을 보인다. 재료의 특성에 관심을 가지고 몰입하는 능력이 자라고 있다.' },
  { id: 'development_006', type: 'development', situation: ['자연탐구'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 자연탐구 영역에서 대상을 관찰하고 특징을 발견하는 발달 양상을 보인다. 호기심을 가지고 탐색하는 능력이 자라고 있다.' },
  { id: 'development_007', type: 'development', situation: ['수개념'], category: ['자연탐구'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 자연탐구 영역에서 수를 세고 양을 비교하는 발달 양상을 보인다. 일상에서 수에 관심을 가지고 활용하는 능력이 자라고 있다.' },
  { id: 'development_008', type: 'development', situation: ['책읽기', '공감'], category: ['의사소통'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 의사소통 영역에서 궁금한 점을 질문하고 감정을 언어로 표현하는 발달 양상을 보인다. 이야기를 이해하고 공감하는 능력이 자라고 있다.' },
  { id: 'development_009', type: 'development', situation: ['음률'], category: ['예술경험'], status: '안정적', ageGroup: ['만2세', '만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 예술경험 영역에서 리듬을 느끼고 몸으로 표현하는 발달 양상을 보인다. 음악을 즐기며 자유롭게 표현하는 능력이 자라고 있다.' },
  { id: 'development_010', type: 'development', situation: ['기본생활습관'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 신체운동·건강 영역에서 기본생활습관을 익혀 가는 발달 양상을 보인다. 안내를 통해 스스로 실천하는 능력이 자라고 있다.' },
  { id: 'development_011', type: 'development', situation: ['감정조절'], category: ['사회관계'], status: '지원필요', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사회관계 영역에서 자신의 감정을 인식하고 조절해 가는 발달 양상을 보인다. 교사의 지원을 통해 감정을 표현하는 능력이 자라고 있다.' },
  { id: 'development_012', type: 'development', situation: ['갈등조정'], category: ['사회관계'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사회관계 영역에서 갈등을 조정하고 차례를 지키는 발달 양상을 보인다. 또래와 타협하는 능력이 자라고 있다.' },
  { id: 'development_013', type: 'development', situation: ['안전'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 신체운동·건강 영역에서 안전 규칙을 이해하고 실천하는 발달 양상을 보인다. 상황에 맞는 안전 행동을 기억하는 능력이 자라고 있다.' },
  { id: 'development_014', type: 'development', situation: ['배려'], category: ['사회관계'], status: '안정적', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사회관계 영역에서 또래의 감정에 공감하고 배려하는 발달 양상을 보인다. 도움이 필요한 상황을 인식하고 행동하는 능력이 자라고 있다.' },
  { id: 'development_015', type: 'development', situation: ['자립'], category: ['신체운동·건강'], status: '성장중', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 신체운동·건강 영역에서 자조 능력이 자라는 발달 양상을 보인다. 자신의 욕구를 인식하고 스스로 처리하는 능력이 향상되고 있다.' },
  { id: 'development_016', type: 'development', situation: ['적응'], category: ['사회관계'], status: '적응중', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '{childName}는 사회관계 영역에서 새로운 환경에 적응하며 정서적으로 안정해 가는 발달 양상을 보인다. 신뢰를 바탕으로 스스로 안정하는 능력이 자라고 있다.' },

  // ─────────────────────────────────────────────────────────────
  // 8) 가정 연계 문장 (homeLink)
  // ─────────────────────────────────────────────────────────────
  { id: 'homelink_001', type: 'homeLink', situation: ['의사표현'], category: ['의사소통'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 부탁하거나 권유하는 말을 함께 연습해 주세요.' },
  { id: 'homelink_002', type: 'homeLink', situation: ['협력놀이'], category: ['사회관계'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 가족과 함께 만들기 놀이를 즐겨 주세요.' },
  { id: 'homelink_003', type: 'homeLink', situation: ['신체놀이'], category: ['신체운동·건강'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 안전한 환경에서 몸을 움직이는 놀이를 함께 해 주세요.' },
  { id: 'homelink_004', type: 'homeLink', situation: ['자연탐구'], category: ['자연탐구'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 산책하며 자연물을 함께 살펴봐 주세요.' },
  { id: 'homelink_005', type: 'homeLink', situation: ['기본생활습관'], category: ['신체운동·건강'], status: '연계', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 식사 전 손 씻기를 함께 챙겨 주세요.' },
  { id: 'homelink_006', type: 'homeLink', situation: ['정리정돈'], category: ['사회관계'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 놀이 후 정리를 스스로 할 기회를 주세요.' },
  { id: 'homelink_007', type: 'homeLink', situation: ['감정표현'], category: ['사회관계'], status: '연계', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 아이의 마음을 말로 읽어 주시면 큰 힘이 됩니다.' },
  { id: 'homelink_008', type: 'homeLink', situation: ['안전'], category: ['신체운동·건강'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 생활 속 안전 약속을 함께 이야기해 주세요.' },
  { id: 'homelink_009', type: 'homeLink', situation: ['책읽기'], category: ['의사소통'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 그림책을 함께 읽으며 이야기를 나눠 주세요.' },
  { id: 'homelink_010', type: 'homeLink', situation: ['편식'], category: ['신체운동·건강'], status: '연계', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 강요 없이 새로운 음식을 조금씩 권해 주세요.' },
  { id: 'homelink_011', type: 'homeLink', situation: ['수면'], category: ['신체운동·건강'], status: '연계', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 잠들기 전 편안한 분위기를 만들어 주세요.' },
  { id: 'homelink_012', type: 'homeLink', situation: ['분리불안'], category: ['사회관계'], status: '연계', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 헤어질 때 짧고 따뜻한 인사를 나눠 주세요.' },
  { id: 'homelink_013', type: 'homeLink', situation: ['수개념'], category: ['자연탐구'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 물건을 함께 세고 비교하는 놀이를 해 주세요.' },
  { id: 'homelink_014', type: 'homeLink', situation: ['자립'], category: ['신체운동·건강'], status: '연계', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 스스로 해 볼 기회를 충분히 주고 기다려 주세요.' },
  { id: 'homelink_015', type: 'homeLink', situation: ['또래관계'], category: ['사회관계'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 또래와 만나 어울릴 기회를 자주 만들어 주세요.' },
  { id: 'homelink_016', type: 'homeLink', situation: ['감정미술'], category: ['예술경험'], status: '연계', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '가정에서도 그림으로 마음을 표현하는 시간을 가져 주세요.' },

  // ─────────────────────────────────────────────────────────────
  // 9) 마무리 문장 (closing)
  // ─────────────────────────────────────────────────────────────
  { id: 'closing_001', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport', 'development'], tone: 'evaluative', riskLevel: 'safe', text: '앞으로도 {childName}의 속도를 존중하며 꾸준히 지원할 필요가 있다.' },
  { id: 'closing_002', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '비슷한 경험을 반복할 수 있도록 다양한 기회를 제공할 필요가 있다.' },
  { id: 'closing_003', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘도 즐겁게 지낸 {childName}의 하루를 가정에서도 함께 이야기 나눠 주세요.' },
  { id: 'closing_004', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '가정과 기관이 같은 방향으로 지원하면 더 큰 도움이 될 것으로 보인다.' },
  { id: 'closing_005', type: 'closing', situation: ['일반'], category: ['신체운동·건강'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '발달의 흐름을 지속적으로 관찰하며 적절한 경험을 제공할 필요가 있다.' },
  { id: 'closing_006', type: 'closing', situation: ['성취'], category: ['신체운동·건강'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘의 작은 성취를 가정에서도 따뜻하게 칭찬해 주세요.' },
  { id: 'closing_007', type: 'closing', situation: ['지원필요'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport', 'counseling'], tone: 'evaluative', riskLevel: 'safe', text: '편안한 분위기 속에서 스스로 표현할 수 있도록 기다리며 지원할 필요가 있다.' },
  { id: 'closing_008', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['development'], tone: 'evaluative', riskLevel: 'safe', text: '강점을 충분히 인정하며 다음 단계의 경험으로 자연스럽게 이어 갈 필요가 있다.' },
  { id: 'closing_009', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만0세', '만1세', '만2세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '오늘도 건강하게 잘 지낸 {childName}였습니다. 가정에서도 푹 쉴 수 있도록 도와주세요.' },
  { id: 'closing_010', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport'], tone: 'evaluative', riskLevel: 'safe', text: '아이의 흥미를 따라가며 놀이가 깊어질 수 있도록 지원할 필요가 있다.' },
  { id: 'closing_011', type: 'closing', situation: ['일반'], category: ['사회관계'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '지속적인 관심과 일관된 지원이 안정적인 성장에 도움이 될 것으로 보인다.' },
  { id: 'closing_012', type: 'closing', situation: ['일반'], category: ['예술경험'], status: '마무리', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice'], tone: 'warm', riskLevel: 'safe', text: '내일은 또 어떤 즐거운 놀이를 만날지 {childName}와 함께 기대해 봅니다.' },

  // ─────────────────────────────────────────────────────────────
  // 10) 순화 표현 문장 (softening) — 부정 단정 대신 쓰는 안전한 표현
  // ─────────────────────────────────────────────────────────────
  { id: 'softening_001', type: 'softening', situation: ['소극적참여'], category: ['사회관계'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling', 'development'], tone: 'warm', riskLevel: 'safe', text: '아직 참여가 편안하지 않은 모습이 있어 천천히 다가갈 시간이 필요하다.' },
  { id: 'softening_002', type: 'softening', situation: ['감정표현'], category: ['사회관계'], status: '순화', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '속상한 마음을 울음으로 표현하며 도움을 필요로 하였다.' },
  { id: 'softening_003', type: 'softening', situation: ['갈등'], category: ['사회관계'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '자신의 생각을 강하게 표현하며 조율하는 방법을 배워 가고 있다.' },
  { id: 'softening_004', type: 'softening', situation: ['주의집중'], category: ['신체운동·건강'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling', 'development'], tone: 'evaluative', riskLevel: 'safe', text: '관심이 여러 방향으로 옮겨 가 한 가지에 머무르는 연습이 필요하다.' },
  { id: 'softening_005', type: 'softening', situation: ['생활습관'], category: ['신체운동·건강'], status: '순화', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '아직 도움이 필요한 부분이 있어 반복된 안내와 격려가 필요하다.' },
  { id: 'softening_006', type: 'softening', situation: ['거부'], category: ['사회관계', '의사소통'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '원하지 않는 활동에 대해 자신의 의사를 분명하게 표현하였다.' },
  { id: 'softening_007', type: 'softening', situation: ['고집'], category: ['사회관계'], status: '순화', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '자신의 의견을 끝까지 지키려는 모습이 있어 타협하는 경험이 필요하다.' },
  { id: 'softening_008', type: 'softening', situation: ['안전'], category: ['신체운동·건강'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '활동적으로 움직이며 몸을 안전하게 조절하는 연습이 필요하다.' },
  { id: 'softening_009', type: 'softening', situation: ['편식'], category: ['신체운동·건강'], status: '순화', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '낯선 음식에는 시간이 조금 필요하지만 권유에 따라 시도해 보았다.' },
  { id: 'softening_010', type: 'softening', situation: ['분리불안'], category: ['사회관계'], status: '순화', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '헤어짐의 순간에 잠시 눈물을 보였지만 곧 안정을 찾아 갔다.' },
  { id: 'softening_011', type: 'softening', situation: ['좌절'], category: ['신체운동·건강'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['dailyReport', 'counseling'], tone: 'evaluative', riskLevel: 'safe', text: '뜻대로 되지 않아 속상해하였지만 다시 시도하는 과정을 보였다.' },
  { id: 'softening_012', type: 'softening', situation: ['수면'], category: ['신체운동·건강'], status: '순화', ageGroup: ['만0세', '만1세', '만2세', '만3세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '잠드는 데 시간이 조금 걸렸지만 교사의 도움으로 편안하게 휴식하였다.' },
  { id: 'softening_013', type: 'softening', situation: ['또래갈등'], category: ['사회관계'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['notice', 'counseling'], tone: 'warm', riskLevel: 'safe', text: '친구와 마음이 부딪힐 때 교사의 도움을 받아 해결 방법을 찾아보았다.' },
  { id: 'softening_014', type: 'softening', situation: ['언어지연'], category: ['의사소통'], status: '순화', ageGroup: ['만2세', '만3세', '만4세'], documentType: ['counseling', 'development'], tone: 'evaluative', riskLevel: 'safe', text: '표현하고 싶은 마음을 몸짓과 표정으로 나타내며 언어로 확장해 가고 있다.' },
  { id: 'softening_015', type: 'softening', situation: ['규칙'], category: ['사회관계'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling'], tone: 'evaluative', riskLevel: 'safe', text: '약속을 받아들이는 데 시간이 필요해 반복된 안내가 도움이 된다.' },
  { id: 'softening_016', type: 'softening', situation: ['위축'], category: ['사회관계'], status: '순화', ageGroup: ['만3세', '만4세', '만5세'], documentType: ['counseling', 'development'], tone: 'evaluative', riskLevel: 'safe', text: '새로운 상황에서 조심스러운 모습을 보이며 안정감을 바탕으로 점차 참여한다.' },
];

// ─────────────────────────────────────────────────────────────────
// 보육일지 평가(evaluation/dailyReport) 전용 문장 — 12개 유형 × 7문장 = 84개
// (놀이 흐름·교사 지원·발달영역 연결을 담되 라벨/과장/긍정 스핀은 쓰지 않는다)
// ─────────────────────────────────────────────────────────────────
const EVALUATION_GROUPS = [
  {
    key: 'physical', category: ['신체운동·건강'], situation: ['신체놀이'],
    texts: [
      '유아들은 몸을 다양하게 움직이며 균형과 힘을 조절하는 경험을 하였다. 점차 자신 있게 도전할 수 있도록 지원할 필요가 있다.',
      '대근육을 활용한 놀이에서 방향과 속도를 조절하는 경험이 이루어졌으며, 더 큰 움직임으로 확장하도록 지원할 필요가 있다.',
      '유아들은 신체 활동에 참여하며 몸의 움직임을 조절하는 경험을 하였고, 교사는 안전한 환경을 마련해 주는 지원을 제공하였다.',
      '오르고 뛰어내리는 놀이에서 유아들은 신체 조절 능력을 기르는 경험을 하였으며, 반복 도전을 격려할 필요가 있다.',
      '공을 주고받는 놀이에서 눈과 손의 협응을 경험하였고, 또래와 함께하는 신체 놀이로 확장하도록 지원할 필요가 있다.',
      '유아들은 신체운동·건강 영역과 관련하여 몸을 조절하고 도전하는 경험을 하였다.',
      '평균대와 매트 위에서 균형을 잡는 경험을 하였으며, 다양한 신체 도전 기회를 제공할 필요가 있다.',
    ],
  },
  {
    key: 'role', category: ['예술경험', '사회관계'], situation: ['역할놀이'],
    texts: [
      '유아들은 역할을 맡아 상황에 맞는 말과 행동을 표현하는 경험을 하였다. 다양한 역할을 경험하도록 지원할 필요가 있다.',
      '역할놀이에서 또래와 역할을 나누고 이야기를 만들어 가는 경험이 이루어졌으며, 교사는 소품을 제공하는 지원을 하였다.',
      '유아들은 상상한 상황을 역할로 표현하며 또래와 상호작용하는 경험을 하였다.',
      '병원놀이와 가게놀이에서 사회적 역할을 경험하였고, 놀이가 이어지도록 교사가 지원하였다.',
      '유아들은 역할을 정하고 규칙을 만들며 놀이를 조직하는 경험을 하였으며, 협력 경험을 확장하도록 지원할 필요가 있다.',
      '역할에 몰입하여 인물의 마음을 표현하는 경험이 이루어졌으며, 이는 예술경험 영역과 연결된다.',
      '유아들은 역할놀이를 통해 자신의 생각을 말과 몸짓으로 표현하는 경험을 하였다.',
    ],
  },
  {
    key: 'art', category: ['예술경험'], situation: ['미술놀이'],
    texts: [
      '유아들은 다양한 재료를 탐색하며 자신의 방식으로 표현하는 경험을 하였다. 다양한 표현 재료를 제공할 필요가 있다.',
      '색을 섞고 형태를 만들며 변화를 발견하는 경험이 이루어졌고, 교사는 재료를 마련해 주는 지원을 하였다.',
      '유아들은 그리기와 만들기에 몰입하며 자신의 생각을 표현하는 경험을 하였다.',
      '미술 활동에서 손의 움직임을 조절하며 표현하는 경험을 하였으며, 이는 예술경험 영역과 연결된다.',
      '유아들은 재료의 특성을 탐색하고 자유롭게 표현하는 경험을 하였고, 표현 활동을 격려할 필요가 있다.',
      '점토와 종이를 활용한 표현 놀이에서 창의적으로 시도하는 경험이 이루어졌다.',
      '유아들은 자신의 감정과 생각을 색과 형태로 나타내는 경험을 하였다.',
    ],
  },
  {
    key: 'nature', category: ['자연탐구'], situation: ['자연탐구'],
    texts: [
      '유아들은 주변의 자연물을 관찰하며 특징을 발견하는 경험을 하였다. 탐구 기회를 지속적으로 지원할 필요가 있다.',
      '돋보기로 대상을 자세히 살펴보며 호기심을 표현하는 경험이 이루어졌고, 교사는 탐구 도구를 제공하였다.',
      '유아들은 물질의 변화를 탐색하고 원인과 결과에 관심을 가지는 경험을 하였다.',
      '수와 양을 비교하고 세어 보는 경험을 하였으며, 이는 자연탐구 영역과 연결된다.',
      '유아들은 자연물을 분류하고 비교하는 경험을 하였고, 탐색을 확장하도록 지원할 필요가 있다.',
      '곤충과 식물을 관찰하며 생명에 관심을 가지는 경험이 이루어졌다.',
      '유아들은 궁금한 점을 질문하고 직접 탐색하며 답을 찾아가는 경험을 하였다.',
    ],
  },
  {
    key: 'peer', category: ['사회관계'], situation: ['또래관계'],
    texts: [
      '유아들은 또래와 함께 놀이하며 생각을 나누고 조율하는 경험을 하였다. 협력 경험을 확장하도록 지원할 필요가 있다.',
      '친구의 마음을 살피고 배려하는 경험이 이루어졌으며, 교사는 상호작용을 돕는 지원을 하였다.',
      '유아들은 놀잇감을 나누고 차례를 정하며 함께 노는 경험을 하였다.',
      '또래와 역할을 나누고 협력하는 경험을 하였으며, 이는 사회관계 영역과 연결된다.',
      '유아들은 새로운 친구에게 다가가 관계를 맺는 경험을 하였고, 다양한 또래와 어울릴 기회를 지원할 필요가 있다.',
      '친구와 의견이 다를 때 말로 표현하고 조율하는 경험이 이루어졌다.',
      '유아들은 또래와의 놀이 속에서 약속을 지키고 함께하는 경험을 하였다.',
    ],
  },
  {
    key: 'habit', category: ['신체운동·건강'], situation: ['기본생활습관'],
    texts: [
      '유아들은 손 씻기와 정리하기 등 기본생활습관을 실천하는 경험을 하였다. 습관이 몸에 배도록 지원할 필요가 있다.',
      '식사와 휴식 등 일과에 스스로 참여하는 경험이 이루어졌고, 교사는 안내하는 지원을 하였다.',
      '유아들은 스스로 옷을 입고 정리하며 자조 능력을 기르는 경험을 하였다.',
      '규칙적인 생활 속에서 스스로 해 보려는 경험을 하였으며, 이는 신체운동·건강 영역과 연결된다.',
      '유아들은 새로운 음식을 시도하고 식습관을 넓히는 경험을 하였고, 강요 없이 격려할 필요가 있다.',
      '배변과 청결을 스스로 챙기려는 경험이 이루어졌다.',
      '유아들은 정해진 일과를 따르며 생활의 흐름을 익히는 경험을 하였다.',
    ],
  },
  {
    key: 'safety', category: ['신체운동·건강'], situation: ['안전교육'],
    texts: [
      '유아들은 안전 약속을 알아보고 상황에 맞는 행동을 직접 경험하였다. 안전 규칙을 반복하여 익히도록 지원할 필요가 있다.',
      '대피 훈련에 참여하여 질서를 지켜 이동하는 경험이 이루어졌고, 교사는 안내하는 지원을 하였다.',
      '유아들은 횡단보도를 건너는 방법을 알아보고 멈추고 살피는 경험을 하였다.',
      '화재와 지진 상황에 대비한 행동을 경험하였으며, 이는 신체운동·건강 영역과 연결된다.',
      '유아들은 놀이 기구를 안전하게 사용하는 방법을 익히는 경험을 하였고, 생활 속 안전을 함께 이야기할 필요가 있다.',
      '안전한 이동과 멈추기 약속을 실천하는 경험이 이루어졌다.',
      '유아들은 위험할 수 있는 상황을 알아차리고 안전하게 행동하는 경험을 하였다.',
    ],
  },
  {
    key: 'passive', category: ['사회관계'], situation: ['소극적참여'],
    texts: [
      '놀이에 다가가는 데 시간이 필요한 모습이 관찰되었으나, 교사의 지원을 통해 참여를 시도하는 경험이 이루어졌다. 편안하게 참여하도록 지속적으로 지원할 필요가 있다.',
      '유아들은 또래의 놀이를 지켜본 뒤 천천히 다가가 함께해 보는 경험을 하였다.',
      '새로운 활동에 조심스러운 모습이 있었으나, 교사가 곁에서 함께하며 안정감을 주는 지원을 하였다.',
      '유아는 충분히 관찰한 뒤 참여하는 모습을 보였으며, 다가갈 시간을 기다려 줄 필요가 있다.',
      '처음에는 머뭇거렸으나 교사의 격려 속에서 놀이에 참여하는 경험이 이루어졌다.',
      '유아는 익숙해진 뒤 또래와 어울리는 경험을 하였으며, 점진적인 참여를 지원할 필요가 있다.',
      '낯선 상황에서 안정감을 찾은 뒤 참여하는 경험이 이루어졌다.',
    ],
  },
  {
    key: 'conflict', category: ['사회관계'], situation: ['갈등조정'],
    texts: [
      '또래와 의견을 조율하는 데 시간이 필요한 모습이 관찰되었으나, 교사의 중재를 통해 조정해 보는 경험이 이루어졌다. 타협 경험을 지속적으로 지원할 필요가 있다.',
      '유아들은 같은 놀잇감을 두고 부딪힐 때 번갈아 사용하는 방법을 경험하였다.',
      '갈등 상황에서 자신의 마음을 말로 표현하고 상대의 말을 듣는 경험이 이루어졌다.',
      '교사의 지원을 통해 차례를 정하고 약속을 만드는 경험을 하였으며, 이는 사회관계 영역과 연결된다.',
      '유아들은 서로의 입장을 듣고 해결 방법을 찾아보는 경험을 하였고, 조율 경험을 격려할 필요가 있다.',
      '다툼 이후 마음을 회복하고 다시 함께 노는 경험이 이루어졌다.',
      '유아는 화가 난 마음을 말로 표현하고 조절해 보는 경험을 하였다.',
    ],
  },
  {
    key: 'support_change', category: ['사회관계', '신체운동·건강'], situation: ['교사지원변화'],
    texts: [
      '어려워하던 활동도 교사의 도움을 받아 시도하고 성취하는 경험이 이루어졌다. 성공 경험을 반복하도록 지원할 필요가 있다.',
      '유아는 교사의 안내를 받아 스스로 해 보는 경험을 하였으며, 자신감이 점차 자라고 있다.',
      '교사가 곁에서 지지하자 유아는 불편함을 가라앉히고 활동에 참여하는 경험을 하였다.',
      '교사의 제안을 받아들여 표현 방식을 바꾸어 보는 경험이 이루어졌다.',
      '유아는 교사의 격려 속에서 끝까지 해내는 경험을 하였고, 도전을 지속하도록 지원할 필요가 있다.',
      '교사가 자료와 공간을 마련해 주자 놀이가 이어지고 확장되는 경험이 이루어졌다.',
      '유아는 교사의 정서적 지지를 통해 안정을 찾고 다시 시도하는 경험을 하였다.',
    ],
  },
  {
    key: 'expansion', category: ['사회관계', '자연탐구'], situation: ['놀이확장'],
    texts: [
      '유아들은 하나의 놀이에서 새로운 방법을 발견하며 놀이를 확장하는 경험을 하였다. 놀이가 깊어지도록 지원할 필요가 있다.',
      '또래와 관심을 나누며 놀이의 주제가 넓어지는 경험이 이루어졌고, 교사는 자료를 더해 주는 지원을 하였다.',
      '유아들은 놀잇감을 새롭게 연결하며 놀이를 변형하는 경험을 하였다.',
      '놀이가 다른 영역으로 이어지며 통합적으로 경험이 확장되었으며, 교사가 환경을 지원하였다.',
      '유아들은 자신의 아이디어를 더해 놀이를 발전시키는 경험을 하였고, 확장을 격려할 필요가 있다.',
      '반복되던 놀이에 새로운 규칙이 생기며 놀이가 풍부해지는 경험이 이루어졌다.',
      '유아들은 또래와 협력하여 놀이를 더 큰 활동으로 확장하는 경험을 하였다.',
    ],
  },
  {
    key: 'area_link', category: ['사회관계'], situation: ['발달영역연결'],
    texts: [
      '이러한 경험은 신체운동·건강 영역의 발달과 연결된다.',
      '이러한 경험은 의사소통 영역의 발달과 연결된다.',
      '이러한 경험은 사회관계 영역의 발달과 연결된다.',
      '이러한 경험은 예술경험 영역의 발달과 연결된다.',
      '이러한 경험은 자연탐구 영역의 발달과 연결된다.',
      '유아들은 놀이 속 경험을 통해 여러 발달영역이 통합적으로 이루어지는 경험을 하였다.',
      '이번 경험은 표준보육과정과 누리과정의 발달 경험과 연결지어 볼 수 있다.',
    ],
  },
];

const EVALUATION_SENTENCES = EVALUATION_GROUPS.flatMap((group, gi) =>
  group.texts.map((text, i) => ({
    id: `eval_${group.key}_${String(i + 1).padStart(2, '0')}`,
    type: 'evaluation',
    situation: group.situation,
    category: group.category,
    status: '평가',
    ageGroup: ['만3세', '만4세', '만5세'],
    documentType: ['dailyReport', 'development'],
    tone: 'evaluative',
    riskLevel: 'safe',
    text,
  })),
);

// ─────────────────────────────────────────────────────────────────
// 알림장/부모 전달(notice/parentMessage) 전용 문장 — 13개 유형 × 5문장 = 65개
// 부모 친화 존댓말, 부정 사실은 부드럽게, 입력에 없는 긍정 변화는 만들지 않음.
// ─────────────────────────────────────────────────────────────────
const NOTICE_GROUPS = [
  {
    key: 'play_join', type: 'parent', situation: ['긍정놀이참여'], category: ['사회관계'],
    texts: [
      '오늘 {childName}는 놀이에 관심을 보이며 자신의 방식으로 참여하는 모습을 보였어요.',
      '오늘 {childName}는 하고 싶은 놀이를 스스로 선택해 몰입하는 모습이 사랑스러웠습니다.',
      '오늘 {childName}는 새로운 놀이에 호기심을 가지고 다가가 보았어요.',
      '오늘 {childName}는 놀이 속에서 자신의 생각을 표현하며 즐거운 시간을 보냈습니다.',
      '오늘 {childName}는 좋아하는 놀이에 푹 빠져 하루를 보냈어요.',
    ],
  },
  {
    key: 'peer', type: 'parent', situation: ['또래상호작용'], category: ['사회관계'],
    texts: [
      '오늘 {childName}는 친구와 함께 놀이하며 생각을 나누는 모습을 보였어요.',
      '오늘 {childName}는 친구와 놀잇감을 나누며 사이좋게 노는 모습이 예뻤습니다.',
      '오늘 {childName}는 친구의 이야기에 귀 기울이며 함께하는 시간을 보냈어요.',
      '오늘 {childName}는 친구에게 먼저 다가가 함께 놀자고 권하는 모습을 보였습니다.',
      '오늘 {childName}는 친구와 역할을 나누어 협력하는 경험을 했어요.',
    ],
  },
  {
    key: 'support_change', type: 'parent', situation: ['교사지원변화'], category: ['사회관계'],
    texts: [
      '오늘 {childName}는 처음에는 망설였지만 교사의 도움을 받아 새롭게 시도해 보았어요.',
      '오늘 {childName}는 어려워하던 활동도 교사와 함께 끝까지 해내는 모습을 보였습니다.',
      '오늘 {childName}는 교사의 안내를 받아 조금씩 스스로 해 보는 모습을 보였어요.',
      '오늘 {childName}는 교사가 곁에서 도와주자 편안하게 활동에 참여했습니다.',
      '오늘 {childName}는 교사의 격려 속에서 한 걸음 더 도전해 보았어요.',
    ],
  },
  {
    key: 'passive', type: 'parent', situation: ['소극적참여'], category: ['사회관계'],
    texts: [
      '오늘 {childName}는 활동에 바로 참여하기보다 주변을 천천히 살펴보는 모습이 있었어요. 편안해질 수 있도록 곁에서 함께했습니다.',
      '오늘 {childName}는 친구들의 놀이를 관심 있게 지켜본 뒤 천천히 다가가 보았습니다.',
      '오늘 {childName}는 새로운 활동을 충분히 살펴본 뒤 참여하는 모습을 보였어요.',
      '오늘 {childName}는 조심스러워했지만 교사와 함께 한 걸음씩 다가가 보았습니다.',
      '오늘 {childName}는 익숙해진 뒤 편안하게 놀이에 함께하는 모습을 보였어요.',
    ],
  },
  {
    key: 'emotion', type: 'parent', situation: ['감정표현'], category: ['사회관계'],
    texts: [
      '오늘 {childName}는 속상한 마음을 표현하는 모습이 있었고, 교사의 다독임 속에서 안정을 찾았어요.',
      '오늘 {childName}는 자신의 감정을 솔직하게 표현해 보았습니다. 마음을 읽어 주자 편안해졌어요.',
      '오늘 {childName}는 기쁜 마음과 아쉬운 마음을 다양하게 표현하는 하루를 보냈어요.',
      '오늘 {childName}는 감정을 말과 표정으로 나타내 보았고, 교사가 함께 마음을 살폈습니다.',
      '오늘 {childName}는 마음이 불편할 때 교사에게 도움을 청하는 모습을 보였어요.',
    ],
  },
  {
    key: 'conflict', type: 'parent', situation: ['갈등조율'], category: ['사회관계'],
    texts: [
      '오늘 {childName}는 친구와 생각이 다를 때 자신의 마음을 표현해 보았어요. 교사의 도움으로 함께 방법을 찾았습니다.',
      '오늘 {childName}는 같은 놀잇감을 두고 친구와 의견을 조율하는 경험을 했어요.',
      '오늘 {childName}는 교사의 안내를 받아 차례를 정하고 약속을 지켜 보았습니다.',
      '오늘 {childName}는 친구의 마음을 듣고 자신의 행동을 조절해 보는 경험을 했어요.',
      '오늘 {childName}는 다툼 이후 마음을 풀고 다시 친구와 함께 놀이했습니다.',
    ],
  },
  {
    key: 'habit', type: 'parent', situation: ['기본생활습관'], category: ['신체운동·건강'],
    texts: [
      '오늘 {childName}는 식사 전 손 씻기를 교사와 함께 실천해 보았어요.',
      '오늘 {childName}는 놀이 후 놀잇감을 스스로 정리하는 모습이 기특했습니다.',
      '오늘 {childName}는 스스로 옷과 신발을 챙기려는 모습을 보였어요.',
      '오늘 {childName}는 새로운 음식을 한 입 시도해 보는 용기를 냈습니다.',
      '오늘 {childName}는 정해진 일과를 따르며 하루를 안정적으로 보냈어요.',
    ],
  },
  {
    key: 'safety', type: 'parent', situation: ['안전교육'], category: ['신체운동·건강'],
    texts: [
      '오늘 {childName}는 안전 약속을 알아보고 직접 실천해 보았어요.',
      '오늘 {childName}는 대피 훈련에 참여해 질서를 지켜 이동했습니다.',
      '오늘 {childName}는 횡단보도를 건너는 방법을 배우고 멈추고 살펴보았어요.',
      '오늘 {childName}는 놀이 기구를 안전하게 사용하는 방법을 익혔습니다.',
      '오늘 {childName}는 안전하게 행동하는 약속을 잘 기억하는 모습을 보였어요.',
    ],
  },
  {
    key: 'physical', type: 'parent', situation: ['신체놀이'], category: ['신체운동·건강'],
    texts: [
      '오늘 {childName}는 몸을 마음껏 움직이며 균형을 잡아 보았어요.',
      '오늘 {childName}는 달리고 뛰며 신나게 바깥놀이를 즐겼습니다.',
      '오늘 {childName}는 공을 던지고 받으며 몸의 움직임을 조절해 보았어요.',
      '오늘 {childName}는 새로운 동작에 도전하며 끝까지 해내는 모습을 보였습니다.',
      '오늘 {childName}는 친구와 함께 몸을 움직이는 놀이를 즐겼어요.',
    ],
  },
  {
    key: 'art', type: 'parent', situation: ['미술놀이'], category: ['예술경험'],
    texts: [
      '오늘 {childName}는 색을 섞어 보며 그림 그리기에 몰입했어요.',
      '오늘 {childName}는 다양한 재료로 자신만의 작품을 만들어 보았습니다.',
      '오늘 {childName}는 자신의 생각을 그림과 색으로 표현해 보았어요.',
      '오늘 {childName}는 만들기 활동에 집중하며 끝까지 완성해 보았습니다.',
      '오늘 {childName}는 재료의 느낌을 탐색하며 자유롭게 표현했어요.',
    ],
  },
  {
    key: 'nature', type: 'parent', situation: ['자연탐구'], category: ['자연탐구'],
    texts: [
      '오늘 {childName}는 바깥에서 발견한 자연물을 관심 있게 관찰했어요.',
      '오늘 {childName}는 곤충과 식물을 살펴보며 궁금한 점을 물어보았습니다.',
      '오늘 {childName}는 물과 모래의 변화를 탐색하며 놀이했어요.',
      '오늘 {childName}는 수와 모양에 관심을 가지고 세어 보고 비교해 보았습니다.',
      '오늘 {childName}는 자연 속에서 호기심을 가지고 탐색하는 하루를 보냈어요.',
    ],
  },
  {
    key: 'home', type: 'homeLink', situation: ['가정연계'], category: ['사회관계'], documentType: ['notice', 'counseling'],
    texts: [
      '가정에서도 오늘의 놀이 이야기를 함께 나눠 주세요.',
      '가정에서도 아이가 좋아하는 놀이를 함께 즐겨 주세요.',
      '가정에서도 아이의 마음을 따뜻하게 읽어 주세요.',
      '가정에서도 스스로 해 볼 기회를 주고 격려해 주세요.',
      '가정에서도 안전 약속을 함께 이야기해 주세요.',
    ],
  },
  {
    key: 'closing', type: 'closing', situation: ['마무리'], category: ['사회관계'],
    texts: [
      '오늘도 건강하고 즐겁게 지낸 하루였습니다.',
      '내일은 또 어떤 즐거운 놀이를 만날지 함께 기대해 봅니다.',
      '작은 성장의 순간을 가정에서도 따뜻하게 응원해 주세요.',
      '오늘 하루도 사랑스러운 모습 가득한 하루였어요.',
      '언제나 아이의 속도를 존중하며 함께 지켜보겠습니다.',
    ],
  },
];

const NOTICE_SENTENCES = NOTICE_GROUPS.flatMap((group) =>
  group.texts.map((text, i) => ({
    id: `notice_${group.key}_${String(i + 1).padStart(2, '0')}`,
    type: group.type,
    situation: group.situation,
    category: group.category,
    status: '전달',
    ageGroup: ['만3세', '만4세', '만5세'],
    documentType: group.documentType || ['notice'],
    tone: 'warm',
    riskLevel: 'safe',
    text,
  })),
);

export const SENTENCE_DATASET = [...BASE_SENTENCES, ...EVALUATION_SENTENCES, ...NOTICE_SENTENCES];

// ── 보조 인덱스/조회 헬퍼 ────────────────────────────────────────
export const SENTENCE_TYPES = [
  'situation', 'behavior', 'support', 'evaluation', 'parent',
  'counseling', 'development', 'homeLink', 'closing', 'softening',
];

export function getSentencesByType(type) {
  return SENTENCE_DATASET.filter((s) => s.type === type);
}

export function querySentences({ type, category, situation, documentType, status } = {}) {
  return SENTENCE_DATASET.filter((s) => {
    if (type && s.type !== type) return false;
    if (status && s.status !== status) return false;
    if (category && !s.category.includes(category)) return false;
    if (situation && !s.situation.includes(situation)) return false;
    if (documentType && !s.documentType.includes(documentType)) return false;
    return true;
  });
}

// 금지 패턴(라벨/과장/긍정 스핀/진단) — 데이터셋·생성물 점검용
export const BANNED_PATTERNS = [
  { code: 'label', re: /(문제행동|산만|공격적|버릇없|제멋대로)/, message: '주관적 라벨' },
  { code: 'overstatement', re: /(항상|전혀|완벽하게|무조건|매우 뛰어난)/, message: '과장 절대어' },
  { code: 'praise', re: /(잘했다|훌륭|최고예요|대단해)/, message: '주관적 칭찬' },
  { code: 'positive_spin', re: /(적극적으로 참여|즐겁게 참여|신나게 참여|활발하게 참여)/, message: '근거 없는 긍정 스핀' },
  { code: 'diagnosis', re: /(ADHD|자폐|장애|지능|아이큐)/, message: '진단성 표현' },
];

export function listBannedHits(text) {
  const value = String(text || '');
  return BANNED_PATTERNS.filter((p) => p.re.test(value)).map((p) => ({ code: p.code, message: p.message }));
}
