// 금지 주장 사전(6단계) — "입력에 근거가 없으면 절대 쓰면 안 되는 주장"을 범주별로 선언한다.
// audit·렌더러·프롬프트가 모두 이 한 곳을 참조한다(중복 정의 금지).
//
// evidence: 입력에 이 정규식이 맞으면 해당 주장 검사를 면제(근거 있음).
// severity: major(사실 왜곡 — B안 fallback) | minor(표현 정리 대상)

export const BLOCKED_CLAIMS = [
  {
    id: 'emotion_fabricated', category: '감정 추정', severity: 'major',
    // 강한 감정 단정만 잡는다. 관용적 '즐거움을 경험/과정을 즐겼다'는 놀이 몰입 서술로 허용.
    pattern: /(뿌듯해하|행복해하|만족스러워하|속상해하|서운해하|기뻐하(며|였)|신이 나(서|며))/,
    evidence: /(웃|기뻐|즐거워|신나|뿌듯|행복|속상|서운|울|눈물|화나|짜증|무서워|놀라)/,
    reason: '입력에 없는 감정을 단정함',
  },
  {
    id: 'intent_speculation', category: '의도·생각 추정', severity: 'major',
    pattern: /(싶어 했다|싶어했다|마음을 먹었|다짐했|생각했다\.|계획을 세웠다|의도했)/,
    evidence: /("[^"]+"|말하|외치|이야기하)/, // 아이가 직접 말한 경우만 의도 서술 허용
    reason: '입력에 없는 의도·생각을 추정함',
  },
  {
    id: 'development_claim', category: '발달 수준 단정', severity: 'major',
    pattern: /(발달하였다|발달했다|발달이 (빠르|우수)|능력이 (자랐|늘었|뛰어나)|수준이 높|성장하였다|향상되었|창의력이|사회성이|표현력이 (좋|뛰어나|향상))/,
    evidence: null, // 어떤 입력에서도 발달 단정은 금지
    reason: '관찰 문서에서 발달 수준을 단정함',
  },
  {
    id: 'achievement_claim', category: '성취·성격 단정', severity: 'minor',
    pattern: /(자신감이 (생겼|높아|넘치)|성취감을 느꼈|완성도가 높|재능이 있|영리하|똑똑하)/,
    evidence: null,
    reason: '성취·성격을 단정함',
  },
  {
    id: 'style_formal', category: '문체 불일치', severity: 'minor',
    pattern: /(습니다|것입니다|기회를 얻었|경험을 얻었다|이해하는 모습을 보였다)/,
    evidence: null,
    reason: '관찰일지 문체(해라체 관찰문)와 어긋남',
  },
];

// 기계적·비개인화 표현(항상 금지 — 근거 무관)
export const BANNED_PHRASES = [
  /유아들은/, /을 활용하여/, /를 활용하여/, /놀이에 참여하였다/, /발달 경험과 연결/,
  /영역과 연결지어/, /영역의 발달/, /향상되었다/, /기회를 얻었/, /이해하는 모습을 보였다/,
  /창의력이 뛰어나/, /사회성이 발달/, /표현력이 향상/,
];

// 일반론 지원 계획(단독으로 쓰이면 안 되는 상투구) — 관찰 상황과 연결된 구체 문장을 우선한다.
export const GENERIC_SUPPORT = /^((아이를 |유아를 )?(격려한다|칭찬한다|지켜본다|관찰한다|질문한다)|다양한 (자료|재료)를 제공한다)\.?$/;

// 텍스트에서 금지 주장 위반을 찾는다. 반환: [{id, severity, reason}]
export function findBlockedClaims(text, input = '') {
  const t = String(text || '');
  const src = String(input || '');
  const hits = [];
  BLOCKED_CLAIMS.forEach((c) => {
    if (!c.pattern.test(t)) return;
    if (c.evidence && c.evidence.test(src)) return; // 입력에 근거 있음 → 허용
    hits.push({ id: c.id, severity: c.severity, reason: c.reason });
  });
  return hits;
}

export function hasBannedPhrase(text) {
  const t = String(text || '');
  return BANNED_PHRASES.some((re) => re.test(t));
}
