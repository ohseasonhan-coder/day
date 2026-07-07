// 의미 테마 사전(6단계) — 규칙 엔진의 단일 진실 공급원.
// 각 테마: 감지 조건(trigger/required/excluded/needPeer), 우선순위(배열 순서), 공존(coexist),
//          허용/금지 주장, 배움 읽기 변형(learningVariants), 보조 문장(secondary), 지원 계획 변형(supportVariants).
// 원칙: 입력 단서가 실제로 있을 때만 활성. 변형은 결정론적으로 선택(무작위 금지).
//        모든 변형은 시그니처 토큰을 포함해 채점기·기존 테스트와 호환된다.
// 새 테마 추가 = 이 파일에 항목 추가 + testCases 채우기(코드 수정 불필요).

// (t)=이름+조사("지우는"), (src)=원문 — 변형 함수는 새 사실을 추가하면 안 된다.
export const THEMES = [
  {
    id: 'persist', category: '재시도·끈기', label: '재시도·끈기',
    trigger: /(다시|재시도|반복|여러 번|계속|포기하지|끝까지)/, // 무너짐·넘어짐 단독은 재시도 근거 아님
    // 갈등·화해 맥락의 "다시(놀이 재개)"는 재시도가 아님 — conflict 테마에 양보(충돌 규칙)
    required: null, excluded: /(미안|사과|화해|다툰|다투|싸운|토라)/, needPeer: false,
    coexist: ['share', 'express'], risk: '성취·자신감 단정 금지',
    allowedClaims: ['다시 시도함', '스스로 방법을 찾음'], blockedClaims: ['자신감 향상', '성취감', '완성도'],
    learningVariants: [
      (t) => `${t} 뜻대로 되지 않는 순간에도 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.`,
      (t) => `${t} 잘 되지 않는 순간에도 포기하지 않고 시도를 이어 가며 자신만의 해결 방법을 찾아갔다.`,
    ],
    secondary: () => '무너진 자리에서 다시 시작하는 끈기도 이어졌다.',
    supportVariants: [
      '무너져도 다시 세울 수 있는 넓은 받침 재료를 곁들여 시도가 이어지게 돕는다.',
      '다시 세우고 고쳐 보는 과정을 말로 짚어 주어 스스로의 방법이 자리 잡도록 지원한다.',
    ],
    testCases: ['블록 탑이 무너지자 다시 차근차근 쌓았다'],
  },
  {
    id: 'challenge', category: '정서·도전', label: '정서·도전',
    trigger: /(처음 해 보|처음 하는|망설이|망설였|낯설어|어려워하)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['express'], risk: '자신감·불안 해소 단정 금지, 격려 언급은 입력에 있을 때만',
    allowedClaims: ['자신의 속도로 시도함'], blockedClaims: ['자신감이 생김', '불안 해소', '정서 발달'],
    learningVariants: [
      (t, src) => {
        const opening = /망설/.test(src) ? '잠시 망설였지만' : /어려워하/.test(src) ? '어려움을 느끼면서도' : '낯선 경험 앞에서도';
        const helped = /(격려|도움을 받아|응원)/.test(src) ? ' 격려 속에서' : '';
        return `${t} ${opening}${helped} 자신의 속도로 시도해 보며 경험의 폭을 넓혀 갔다.`;
      },
      (t, src) => {
        const opening = /망설/.test(src) ? '잠시 망설였지만' : /어려워하/.test(src) ? '어려움을 느끼면서도' : '낯선 경험 앞에서도';
        const helped = /(격려|도움을 받아|응원)/.test(src) ? ' 격려 속에서' : '';
        return `${t} ${opening}${helped} 한 걸음씩 다가가 새로운 경험을 자신의 것으로 만들어 갔다.`;
      },
    ],
    secondary: null,
    supportVariants: [
      '충분히 살펴볼 시간을 주고, 스스로 고를 수 있는 작은 선택지를 마련해 준다.',
      '시도한 과정 자체를 알아봐 주는 말로 반응하며 다음 도전이 편안해지게 돕는다.',
    ],
    testCases: ['처음 해 보는 활동을 망설이다 시도했다'],
  },
  {
    id: 'recover', category: '감정 표현과 회복', label: '정서·안정',
    trigger: /(놀랐|놀라|속상|엄마를 찾|아빠를 찾|눈물|울)/,
    required: /(안정을 찾|안정감|진정|(곧|이내|다시)[^.]{0,10}집중)/, // 회복 단서 없으면 활성화 금지
    excluded: null, needPeer: false,
    coexist: [], risk: '회복 단서 없이 "안정을 찾았다" 창작 금지(required가 강제)',
    allowedClaims: ['마음을 추스름(입력의 회복 단서 재진술)'], blockedClaims: ['불안 해소', '정서 조절 능력'],
    learningVariants: [
      (t, src) => (/(안정을 찾|안정감|진정)/.test(src)
        ? `${t} 놀라거나 흔들린 마음을 추스르고 다시 안정을 찾아가는 모습을 보였다.`
        : `${t} 자신의 마음을 표현한 뒤 놀이에 집중하며 스스로 안정을 찾아갔다.`),
      (t, src) => (/(안정을 찾|안정감|진정)/.test(src)
        ? `${t} 놀란 마음을 가만히 추스르며 스스로 안정을 찾아가는 힘을 보여 주었다.`
        : `${t} 마음을 표현한 뒤 놀이에 집중하며 차분함을 되찾아 갔다.`),
    ],
    secondary: null,
    supportVariants: [
      '마음이 흔들릴 때 기댈 수 있는 익숙한 놀잇감과 자리를 가까이에 마련해 둔다.',
      '아이의 마음을 짧게 말로 읽어 주고, 편안해질 때까지 곁의 속도를 맞춘다.',
    ],
    testCases: ['큰 소리에 놀랐지만 곧 안정을 찾았다'],
  },
  {
    id: 'conflict', category: '갈등·사과·관계 조정', label: '갈등·화해',
    trigger: /(미안|사과|화해|다툰|다투|싸운 뒤|토라졌)/,
    required: null, excluded: null, needPeer: true,
    coexist: [], risk: '갈등 해결·배려심 단정 금지, 관찰된 말과 행동만',
    allowedClaims: ['마음을 말로 전함', '놀이를 다시 이어 감'], blockedClaims: ['갈등이 해결됨', '배려심', '사회성'],
    learningVariants: [
      (t) => `${t} 갈등의 순간에 자신의 마음을 말로 전하며 관계를 다시 이어 가려는 모습을 보였다.`,
      (t) => `${t} 다툼 뒤에도 먼저 마음을 표현하며 친구와의 놀이를 다시 이어 갔다.`,
    ],
    secondary: null,
    supportVariants: [
      '갈등 전후의 마음을 말로 정리해 보도록 돕고, 놀이를 다시 시작할 수 있는 자리를 만들어 준다.',
      '서로의 말을 들어 볼 수 있는 짧은 대화 자리를 마련해 관계 회복의 경험이 쌓이게 한다.',
    ],
    testCases: ['장난감을 두고 다툰 뒤 친구에게 먼저 "미안해"라고 말했다'],
  },
  {
    id: 'share', category: '또래 협력·나눔', label: '또래·나눔',
    trigger: /(빌려주|나눠|나누어 주|양보|함께|같이|도와|번갈아|서로|건네주|건넸)/,
    required: null, excluded: null, needPeer: true,
    coexist: ['express'], risk: '입력에 없는 또래 반응 창작 금지',
    allowedClaims: ['나눔·함께하는 행동'], blockedClaims: ['사회성 향상', '배려심이 뛰어남'],
    learningVariants: [
      (t) => `${t} 친구와 마음을 나누고 함께하는 방법을 찾아가며 또래 관계를 넓혀 갔다.`,
      (t) => `${t} 친구에게 마음을 건네며 나누는 즐거움을 함께 만들어 가는 모습을 보였다.`,
    ],
    secondary: () => '친구와 함께하려는 마음도 행동으로 자연스럽게 이어졌다.',
    supportVariants: [
      '역할을 나누거나 순서를 정해 볼 수 있는 놀이 상황을 이어서 마련해 준다.',
      '나누고 주고받는 장면을 짧게 말로 비춰 주어 함께 노는 즐거움이 커지게 돕는다.',
    ],
    testCases: ['크레파스를 친구에게 빌려주었다'],
  },
  {
    id: 'question', category: '질문·설명·이야기 구성', label: '질문·탐문',
    trigger: /(물어보|물으며|물었다|질문하|왜냐고|이유를 묻)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['explore'], risk: '지적 능력 단정 금지',
    allowedClaims: ['궁금한 것을 물음'], blockedClaims: ['호기심이 왕성', '탐구력이 뛰어남'],
    learningVariants: [
      (t) => `${t} 궁금한 것을 말로 물으며 알고 싶은 마음을 적극적으로 드러냈다.`,
      (t) => `${t} 질문을 던지고 답을 살피며 자신의 생각을 넓혀 가는 모습을 보였다.`,
    ],
    secondary: null,
    supportVariants: [
      '아이의 질문을 되받아 함께 답을 찾아보고, 관련 자료를 곁에 놓아 탐색이 이어지게 한다.',
      '질문을 기록해 두었다가 놀이 자료로 되돌려 주어 궁금함이 놀이로 이어지게 돕는다.',
    ],
    testCases: ['개미는 어디로 가냐고 물어보았다'],
  },
  {
    id: 'express', category: '언어·표현·상상', label: '표현·발화',
    trigger: /("[^"]+"|말하|이야기|설명|물어|불렀|노래|표현)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['make', 'craft'], risk: '발화는 글자 그대로 보존(관찰내용), 의도 확대 해석 금지',
    allowedClaims: ['생각·느낌을 표현함'], blockedClaims: ['표현력 향상', '언어 발달'],
    learningVariants: [
      (t) => `${t} 자신의 생각과 느낌을 말과 행동으로 표현하며 놀이를 이끌어 가는 힘을 키워 갔다.`,
      (t) => `${t} 마음속 생각을 말로 풀어내며 놀이에 자신의 의미를 담아 가는 모습을 보였다.`,
    ],
    secondary: () => '자신의 생각을 말로 표현하는 모습도 눈에 띄었다.',
    supportVariants: [
      '아이의 말을 짧게 되돌려 주고 이어지는 생각을 물어 표현이 확장되게 돕는다.',
      '표현한 내용을 놀이 기록이나 그림으로 남겨 다음 이야기로 이어지게 한다.',
    ],
    testCases: ['"이건 우리 엄마예요"라고 말하며 그림을 가리켰다'],
  },
  {
    id: 'roleplay', category: '역할·상상', label: '역할·상상',
    trigger: /(역할을 맡|역할놀이|의사 역할|엄마 역할|아빠 역할|요리사 역할|가게 놀이|인 척|병원놀이)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['express'], risk: '또래 언급은 입력에 있을 때만',
    allowedClaims: ['역할이 되어 상상함'], blockedClaims: ['상상력이 풍부', '리더십'],
    learningVariants: [
      (t, src) => (/(친구|또래)/.test(src)
        ? `${t} 맡은 역할이 되어 친구와 상황을 주고받으며 상상놀이를 풍부하게 이어 갔다.`
        : `${t} 맡은 역할이 되어 상황을 상상하고 표현하며 놀이에 의미를 더해 갔다.`),
      (t, src) => (/(친구|또래)/.test(src)
        ? `${t} 역할 속 인물이 되어 친구와 말을 주고받으며 상상의 이야기를 함께 펼쳐 갔다.`
        : `${t} 역할 속 인물이 되어 상황을 그려 내며 상상놀이의 흐름을 스스로 만들어 갔다.`),
    ],
    secondary: null,
    supportVariants: [
      '역할을 넓힐 수 있는 소품을 한두 가지 더해 상상의 장면이 이어지게 한다.',
      '놀이 속 역할에 짧게 손님으로 참여해 이야기가 확장될 틈을 만들어 준다.',
    ],
    testCases: ['의사 역할을 맡아 친구를 진료해 주었다'],
  },
  {
    id: 'rules', category: '차례·규칙·순서', label: '차례·규칙',
    trigger: /(차례(를)?\s*기다|순서를 지키|규칙을 지키|줄을 서서|새치기 안)/,
    required: null, excluded: null, needPeer: false,
    coexist: [], risk: '사회성 향상 단정 금지',
    allowedClaims: ['순서와 규칙을 지킴'], blockedClaims: ['사회성', '준법성'],
    learningVariants: [
      (t) => `${t} 놀이에 필요한 순서와 규칙을 이해하고 스스로 지켜 보려는 모습을 보였다.`,
      (t) => `${t} 자신의 차례를 기다리며 놀이의 순서와 규칙을 몸으로 익혀 갔다.`,
    ],
    secondary: null,
    supportVariants: [
      '차례와 규칙을 자연스럽게 경험할 수 있는 순환 놀이를 이어서 준비한다.',
      '기다리는 동안 할 수 있는 말과 몸짓을 함께 정해 기다림이 놀이가 되게 한다.',
    ],
    testCases: ['차례를 기다렸다가 미끄럼틀을 탔다'],
  },
  {
    id: 'sort', category: '선택·분류·비교·배열', label: '분류·배열',
    trigger: /(크기 순|순서대로 늘어놓|순서대로 놓|나란히 늘어놓|분류하|짝을 맞추|나누어 보|골라내)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['explore'], risk: '지능·수학 능력 단정 금지',
    allowedClaims: ['기준을 세워 배열함'], blockedClaims: ['수 개념 발달', '논리력'],
    learningVariants: [
      (t) => `${t} 나름의 기준을 세워 순서대로 배열해 보며 탐구하는 즐거움을 경험하였다.`,
      (t) => `${t} 늘어놓고 견주어 보며 자신만의 기준으로 배열하는 탐구의 재미를 느껴 갔다.`,
    ],
    secondary: null,
    supportVariants: [
      '크기·모양이 다른 자료를 더해 비교와 배열이 이어질 수 있게 한다.',
      '아이가 세운 기준을 말로 물어보고 다른 기준도 시도해 볼 자료를 곁들인다.',
    ],
    testCases: ['낙엽을 크기 순서대로 늘어놓았다'],
  },
  {
    id: 'change', category: '탐색·변화 관찰', label: '변화·탐구',
    trigger: /(색을 섞|섞어 새로운|섞었더니|변하는 것|달라지는 것|새로운 색|녹아|녹는|얼어)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['question'], risk: '과학 개념 이해 단정 금지',
    allowedClaims: ['변화를 확인함'], blockedClaims: ['과학적 사고력', '원리를 이해함'],
    learningVariants: [
      (t) => `${t} 눈앞에서 일어나는 변화에 관심을 보이며 그 과정을 직접 확인하는 탐구를 즐겼다.`,
      (t) => `${t} 달라지는 순간을 놓치지 않고 들여다보며 변화를 확인하는 탐구의 즐거움을 누렸다.`,
    ],
    secondary: null,
    supportVariants: [
      '변화를 다시 만들어 볼 수 있는 재료를 준비해 확인 놀이가 이어지게 한다.',
      '변화 전후를 나란히 비교해 볼 수 있게 자료를 남겨 두어 탐구가 깊어지게 돕는다.',
    ],
    testCases: ['색을 섞어 새로운 색이 되는 것을 보았다'],
  },
  {
    id: 'explore', category: '탐색·관찰', label: '탐색',
    trigger: /(관찰|탐색|비교|살펴|살피|궁금|실험|발견|돋보기|씨앗|달팽이|나뭇잎|들여다보|지켜보)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['question'], risk: '발견 성과 단정 금지',
    allowedClaims: ['자세히 살핌'], blockedClaims: ['관찰력이 뛰어남'],
    learningVariants: [
      (t) => `${t} 주변을 자세히 살피고 궁금한 점을 탐색하며 알아 가는 즐거움을 경험하였다.`,
      (t) => `${t} 궁금한 대상을 찬찬히 들여다보며 스스로 답을 찾아가는 탐구의 즐거움을 누렸다.`,
    ],
    secondary: null,
    supportVariants: [
      '관찰을 이어 갈 도구와 자료를 눈에 띄는 곳에 두어 탐색이 계속되게 한다.',
      '살펴본 것을 그림이나 말로 남겨 보게 하여 탐색의 흐름이 기록으로 이어지게 돕는다.',
    ],
    testCases: ['돋보기로 개미 행렬을 들여다보았다'],
  },
  {
    id: 'selfhelp', category: '일상생활·자립', label: '자립',
    trigger: /(스스로|혼자|정리|치우|덮고|이불|신발|양치|손\s*씻|손씻|가방|컵|옷|지퍼)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['express'], risk: '자립심 완성·습관 확립 단정 금지, 하지 않은 지원 언급 금지',
    allowedClaims: ['스스로 해 봄'], blockedClaims: ['자립심 완성', '생활습관 확립'],
    learningVariants: [
      (t) => `${t} 일과의 흐름을 이해하고 필요한 일을 스스로 해 보려는 자립의 태도를 보였다.`,
      (t) => `${t} 자신의 일과를 스스로 챙겨 보며 하루의 흐름을 자신의 힘으로 이어 갔다.`,
    ],
    secondary: null,
    supportVariants: [
      '스스로 해 보는 시간을 넉넉히 기다려 주고, 필요한 순간에만 한 단계씩 돕는다.',
      '스스로 해낸 부분을 구체적으로 짚어 주어 다음 시도가 자연스럽게 이어지게 한다.',
    ],
    testCases: ['낮잠 이불을 스스로 덮고 누웠다'],
  },
  {
    id: 'hygiene', category: '위생·자조', label: '위생·자조',
    trigger: /(손을 씻|비누|거품을 내|양치질|세수)/,
    required: null, excluded: null, needPeer: false,
    coexist: [], risk: '습관 확립 단정 금지',
    allowedClaims: ['위생을 스스로 실천'], blockedClaims: ['습관이 확립됨'],
    learningVariants: [
      (t) => `${t} 몸을 깨끗이 하는 방법을 알고 스스로 실천하는 모습을 보였다.`,
      (t) => `${t} 깨끗이 하는 차례를 기억하며 스스로 실천해 가는 모습이 이어졌다.`,
    ],
    secondary: null,
    supportVariants: [
      '스스로 해 보는 시간을 기다려 주고, 잘된 부분을 짧게 짚어 실천이 이어지게 한다.',
      '순서 그림을 눈높이에 두어 스스로 확인하며 실천할 수 있게 돕는다.',
    ],
    testCases: ['손을 씻을 때 비누 거품을 충분히 내어 씻었다'],
  },
  {
    id: 'meal', category: '식습관', label: '식습관',
    trigger: /(골고루|채소도|편식하지|한 입 먹|한 입 맛|먹으려고|남기지 않고)/,
    required: null, excluded: null, needPeer: false,
    coexist: [], risk: '식습관 형성 단정 금지',
    allowedClaims: ['스스로 시도해 먹음'], blockedClaims: ['편식이 고쳐짐'],
    learningVariants: [
      (t, src) => (/(골고루|채소)/.test(src)
        ? `${t} 골고루 먹어 보려는 마음으로 음식을 스스로 시도하며 건강한 식습관을 경험해 갔다.`
        : `${t} 음식을 스스로 챙겨 먹으며 건강한 식생활을 경험해 갔다.`),
      (t, src) => (/(골고루|채소)/.test(src)
        ? `${t} 낯선 반찬에도 스스로 한 입 시도해 보며 건강한 식습관을 만들어 가는 중이다.`
        : `${t} 자기 몫의 식사를 스스로 챙기며 건강한 식생활의 흐름을 이어 갔다.`),
    ],
    secondary: null,
    supportVariants: [
      '부담 없는 양부터 스스로 골라 담아 볼 수 있게 하여 시도가 이어지게 한다.',
      '스스로 맛본 시도를 구체적인 말로 알아봐 주어 다음 식사로 이어지게 돕는다.',
    ],
    testCases: ['골고루 먹으려고 채소도 한 입 먹었다'],
  },
  {
    id: 'move', category: '신체 조절·움직임', label: '신체',
    trigger: /(뛰|달리|점프|폴짝|계단|평균대|균형|굴리|던지|공을|훌라후프|구르|기어|그네|한 발|버티|버텼)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['persist'], risk: '운동 능력 단정 금지',
    allowedClaims: ['몸을 조절하며 움직임'], blockedClaims: ['운동 신경이 좋음', '대근육 발달'],
    learningVariants: [
      (t) => `${t} 몸을 다양하게 움직이며 균형과 힘을 조절하는 즐거움을 경험하였다.`,
      (t) => `${t} 움직임의 속도와 방향을 스스로 조절해 보며 몸 쓰는 즐거움을 키워 갔다.`,
    ],
    secondary: null,
    supportVariants: [
      '난이도가 조금씩 다른 움직임 놀이를 이어서 준비해 몸 조절 경험을 넓힌다.',
      '안전한 범위에서 스스로 속도를 정해 볼 수 있게 하여 움직임의 재미가 이어지게 한다.',
    ],
    testCases: ['평균대 위에서 팔을 벌려 균형을 잡고 걸었다'],
  },
  {
    id: 'aim', category: '조준·조절', label: '조준·조절',
    trigger: /(던져 넣|던지며|던져서|던져|과녁|맞히|골대에)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['persist'], risk: '협응력 발달 단정 금지',
    allowedClaims: ['힘과 방향을 가늠함'], blockedClaims: ['협응력 발달'],
    learningVariants: [
      (t) => `${t} 목표한 곳을 향해 힘과 방향을 가늠하며 몸의 움직임을 조절해 보았다.`,
      (t) => `${t} 힘과 방향을 조금씩 바꿔 가며 목표에 다가가는 몸의 조절을 경험하였다.`,
    ],
    secondary: null,
    supportVariants: [
      '거리와 크기가 다른 목표물을 두어 힘 조절 놀이가 이어지게 한다.',
      '성공과 실패를 함께 세어 보는 놀이로 만들어 조절 경험이 쌓이게 돕는다.',
    ],
    testCases: ['콩주머니를 바구니에 던져 넣었다'],
  },
  {
    id: 'make', category: '만들기·구성·표상', label: '만들기',
    trigger: /(그리|그렸|그려|색칠|만들|점토|블록|쌓|접|악기|율동|춤|꾸미|모양)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['express'], risk: '창의성·완성도 단정 금지',
    allowedClaims: ['자기 방식으로 만듦'], blockedClaims: ['창의력이 뛰어남', '완성도가 높음'],
    learningVariants: [
      (t) => `${t} 재료를 자기만의 방식으로 다루며 만들고 표현하는 과정을 즐겼다.`,
      (t) => `${t} 손끝으로 재료를 매만지며 떠올린 것을 형태로 만들어 가는 과정에 몰입하였다.`,
    ],
    secondary: null,
    supportVariants: [
      '재료의 종류를 한두 가지 넓혀 자기 방식의 만들기가 이어지게 한다.',
      '만든 것에 담긴 이야기를 물어보고 작품을 놀이 공간에 남겨 두어 표현이 이어지게 돕는다.',
    ],
    testCases: ['색종이를 접어 비행기를 만들었다'],
  },
  {
    id: 'craft', category: '구성·표상(재료 탐색)', label: '구성·표상',
    trigger: /(찢어|찢으며|콜라주|오려|물감|찍어|스티커|꾸몄)/,
    required: null, excluded: null, needPeer: false,
    coexist: ['express'], risk: '예술적 감각 단정 금지',
    allowedClaims: ['색·재료를 살펴 구성함'], blockedClaims: ['예술적 감각', '미적 감수성'],
    learningVariants: [
      (t) => `${t} 색과 재료의 느낌을 살피며 자신만의 방식으로 구성해 가는 즐거움을 보였다.`,
      (t) => `${t} 재료를 다루는 자신만의 방식으로 생각과 느낌을 나타내는 표현을 즐겼다.`,
    ],
    secondary: null,
    supportVariants: [
      '질감이 다른 재료를 곁들여 고르고 비교하는 구성 놀이가 이어지게 한다.',
      '작품에 담긴 생각을 짧게 물어보고 전시 공간에 남겨 표현의 만족이 이어지게 돕는다.',
    ],
    testCases: ['한지를 찢어 붙이며 콜라주를 했다'],
  },
];

// SAFE 폴백(신호 미감지) — 일반론·발달 영역 창작 없이 몰입 사실만.
export const SAFE_LEARNING_VARIANTS = [
  (t) => `${t} 관심 있는 놀이에 몰입하며 자신의 방식으로 경험을 넓혀 갔다.`,
  (t) => `${t} 놀이의 흐름을 자신의 방식으로 이어 가며 경험을 쌓아 갔다.`,
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((th) => [th.id, th]));
export default THEMES;
