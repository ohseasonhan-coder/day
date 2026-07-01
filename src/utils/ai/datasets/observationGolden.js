// 관찰일지 품질 골든 데이터셋 (완전 비식별 최소 사례 — 커밋 가능).
// 원본 v3(개인정보 가능)에서 옮기지 않는다. 여기 값은 모두 가공한 익명 픽스처(A원아/B원아…)다.
//
// 구조(설계):
//   regressionCases: 입력→출력 회귀 테스트용(원본 입력 존재). 엔진에 넣어 audit로 검증.
//   answerExamples : 정답 "출력 예시" 전용(입력이 없거나 불완전해도 됨). 문체 기준·감사 규칙 확인용.
//
// 각 항목 필드:
//   id, documentType, target(연령/대상),
//   input(원본 관찰 입력 — answerExamples는 생략 가능),
//   factCard: { name, actions[], speeches[], materials[], peers[], teacherSupport|null, forbidden[] },
//   targetObservation, targetLearning, targetSupport, targetCopyReady,
//   banned[](금지 표현), qualityTags[], reviewNote
//
// qualityTags 값: 발화보존 | 또래 | 자립 | 탐색 | 표현 | 정서 | 지원미입력 | 사실추가위험

export const GOLDEN_BANNED = ['유아들은', '활용하여', '놀이에 참여하였다', '발달 경험과 연결된다', '영역과 연결지어 볼 수 있다'];

export const OBSERVATION_GOLDEN = {
  // ── 입력→출력 회귀 테스트용 ──────────────────────────────────────────────
  regressionCases: [
    {
      id: 'obs_reg_persist_01', documentType: 'observation', target: '만4세',
      input: 'A원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.',
      factCard: { name: 'A원아', actions: ['블록으로 탑을 쌓음', '무너지자 다시 쌓음'], speeches: [], materials: ['블록'], peers: [], teacherSupport: null, forbidden: ['성취 단정', '감정 추정'] },
      banned: GOLDEN_BANNED, qualityTags: ['자립'], reviewNote: '끈기(재시도) 흐름을 읽되 성취를 단정하지 않음.',
    },
    {
      id: 'obs_reg_speech_01', documentType: 'observation', target: '만4세',
      input: 'B원아가 "이건 우리 엄마예요"라고 그림을 가리키며 이야기했다.',
      factCard: { name: 'B원아', actions: ['그림을 가리킴', '이야기함'], speeches: ['이건 우리 엄마예요'], materials: ['그림'], peers: [], teacherSupport: null, forbidden: ['발화 변형'] },
      banned: GOLDEN_BANNED, qualityTags: ['발화보존', '표현'], reviewNote: '따옴표 발화는 관찰내용에 그대로 보존.',
    },
    {
      id: 'obs_reg_peer_01', documentType: 'observation', target: '만4세',
      input: 'C원아가 친구에게 크레파스를 빌려주며 함께 그림을 그렸다.',
      factCard: { name: 'C원아', actions: ['크레파스를 빌려줌', '함께 그림'], speeches: [], materials: ['크레파스'], peers: ['친구'], teacherSupport: null, forbidden: [] },
      banned: GOLDEN_BANNED, qualityTags: ['또래'], reviewNote: '실제 또래 언급이 있을 때만 관계로 읽음.',
    },
    {
      id: 'obs_reg_selfhelp_01', documentType: 'observation', target: '만3세',
      input: 'D원아가 낮잠 시간에 스스로 이불을 덮고 누웠다.',
      factCard: { name: 'D원아', actions: ['스스로 이불을 덮음', '누움'], speeches: [], materials: ['이불'], peers: [], teacherSupport: null, forbidden: ['교사 지원 단정'] },
      banned: GOLDEN_BANNED, qualityTags: ['자립', '지원미입력'], reviewNote: '지원 미입력 — 지원을 했다고 단정하지 않고 계획 문체 유지.',
    },
    {
      id: 'obs_reg_explore_01', documentType: 'observation', target: '만5세',
      input: 'E원아가 돋보기로 개미가 줄지어 가는 모습을 살펴보았다.',
      factCard: { name: 'E원아', actions: ['돋보기로 살펴봄'], speeches: [], materials: ['돋보기', '개미'], peers: [], teacherSupport: null, forbidden: [] },
      banned: GOLDEN_BANNED, qualityTags: ['탐색'], reviewNote: '탐색 흐름을 읽되 결론(발견 성과)을 단정하지 않음.',
    },
    {
      id: 'obs_reg_nofact_01', documentType: 'observation', target: '만4세',
      input: 'F원아가 색종이를 접어 비행기를 만들었다.',
      factCard: { name: 'F원아', actions: ['색종이를 접음', '비행기를 만듦'], speeches: [], materials: ['색종이'], peers: [], teacherSupport: null, forbidden: ['또래 추가', '발화 추가', '감정 추가'] },
      banned: GOLDEN_BANNED, qualityTags: ['사실추가위험', '표현'], reviewNote: '또래·발화·감정이 입력에 없으므로 추가 금지.',
    },
  ],

  // ── 정답 "출력 예시" 전용(문체·감사 기준 확인용) ─────────────────────────
  answerExamples: [
    {
      id: 'obs_ex_persist_01', documentType: 'observation', target: '만4세',
      input: 'A원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.',
      targetObservation: 'A원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.',
      targetLearning: 'A원아는 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.',
      targetSupport: '다양한 크기의 블록을 제공하고, 무너지고 다시 세우는 과정을 함께 말로 짚어 준다.',
      targetCopyReady: '[관찰내용]\nA원아가 블록으로 높은 탑을 쌓다가 무너지자 다시 차근차근 쌓았다.\n\n[배움 읽기]\nA원아는 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.\n\n[교사 지원 및 다음 계획]\n다양한 크기의 블록을 제공하고, 무너지고 다시 세우는 과정을 함께 말로 짚어 준다.',
      banned: GOLDEN_BANNED, qualityTags: ['자립'], reviewNote: '복붙 완성 문서 예시.',
    },
  ],
};

// 골든 항목 최소 유효성 검사(개인정보·구조 점검용)
export function validateGoldenItem(item, kind = 'regression') {
  const errors = [];
  if (!item.id) errors.push('id 없음');
  if (!item.documentType) errors.push('documentType 없음');
  if (kind === 'regression' && !item.input) errors.push('회귀용은 input 필수');
  if (kind === 'answer' && !item.targetCopyReady) errors.push('정답 예시는 targetCopyReady 필수');
  if (!Array.isArray(item.qualityTags)) errors.push('qualityTags 배열 아님');
  // 익명 식별자 규칙(실명 방지 최소 점검)
  if (item.factCard?.name && !/원아|아동|유아|[A-Z]\b/.test(item.factCard.name)) errors.push('익명 식별자 규칙 위반 의심');
  return { ok: errors.length === 0, errors };
}

export default OBSERVATION_GOLDEN;
