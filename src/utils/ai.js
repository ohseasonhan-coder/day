/**
 * 규칙 기반 AI 대체 모듈
 * API 키 없이 키워드 분류 + 표현 순화 + 템플릿 문서 생성
 */

// ─── 카테고리 키워드 분류표 ───────────────────────────────────────
const CATEGORY_RULES = [
  {
    id: 'peer',
    label: '또래관계',
    keywords: ['친구', '함께', '같이', '싸움', '싸웠', '때렸', '때리', '빼앗', '양보', '나눠', '도와', '도움',
      '차례', '기다', '갈등', '협력', '협동', '무리', '어울', '혼자', '혼자서', '소외', '거부', '거절',
      '화해', '사이좋게', '배려', '방해', '귓속말', '비밀', '놀아줘', '놀자'],
  },
  {
    id: 'habit',
    label: '생활습관',
    keywords: ['밥', '식사', '먹', '편식', '잘 안 먹', '안 먹', '국', '반찬', '숟가락', '젓가락',
      '낮잠', '잠', '자다', '못 자', '안 자', '배변', '화장실', '소변', '대변', '응가', '쉬',
      '씻', '손', '세수', '양치', '정리', '치우', '가방', '신발', '옷', '스스로', '혼자서 입'],
  },
  {
    id: 'comm',
    label: '의사소통',
    keywords: ['말', '말했', '얘기', '이야기', '물어봤', '질문', '대답', '표현', '설명', '"', "'",
      '말하', '소리', '울면서', '소리쳤', '목소리', '속삭', '발표', '읽', '글자', '책',
      '단어', '문장', '이름', '불렀'],
  },
  {
    id: 'nature',
    label: '자연탐구',
    keywords: ['벌레', '곤충', '개미', '나비', '장수풍뎅이', '달팽이', '꽃', '나무', '풀', '씨앗',
      '관찰', '돋보기', '날씨', '비', '눈', '바람', '하늘', '구름', '흙', '돌', '모래',
      '물', '색깔 변', '숫자', '세', '크기', '비교', '왜', '어떻게', '궁금'],
  },
  {
    id: 'art',
    label: '예술경험',
    keywords: ['그림', '색', '색깔', '칠하', '붙이', '오리', '만들', '찰흙', '클레이', '노래', '음악',
      '춤', '리듬', '박수', '악기', '피아노', '북', '마라카스', '무대', '공연', '역할놀이',
      '표현', '꾸미', '디자인'],
  },
  {
    id: 'body',
    label: '신체운동',
    keywords: ['달리', '뛰', '점프', '던지', '잡', '기어', '올라', '내려', '균형', '바깥놀이',
      '미끄럼틀', '그네', '철봉', '줄넘기', '공', '자전거', '가위', '풀', '젓가락', '소근육',
      '대근육', '힘'],
  },
  {
    id: 'play',
    label: '놀이·활동',
    keywords: ['블록', '레고', '퍼즐', '보드게임', '카드', '역할', '소꿉', '인형', '자동차', '기차',
      '캠핑', '병원', '마트', '요리', '쌓', '무너', '구성', '탐색', '실험', '조작'],
  },
  {
    id: 'special',
    label: '특이사항',
    keywords: ['열', '아프', '다쳤', '넘어', '긁', '물렸', '투약', '약', '병원', '부모님', '연락',
      '울음', '분리불안', '낯선', '적응', '안전', '위험', '사고', '갑자기', '특이', '오늘따라'],
  },
];

const DEV_AREA_RULES = [
  { id: '신체운동·건강', keywords: ['뛰', '달리', '점프', '운동', '몸', '건강', '힘', '균형', '바깥', '소근육', '대근육', '손', '가위', '젓가락'] },
  { id: '의사소통', keywords: ['말', '얘기', '이야기', '표현', '질문', '대답', '"', "'", '읽', '글자', '단어', '발표', '설명'] },
  { id: '사회관계', keywords: ['친구', '함께', '같이', '갈등', '협력', '양보', '배려', '차례', '어울', '도와', '나눠', '화해'] },
  { id: '예술경험', keywords: ['그림', '색', '노래', '음악', '춤', '만들', '꾸미', '표현', '역할', '붙이', '오리'] },
  { id: '자연탐구', keywords: ['관찰', '탐색', '궁금', '왜', '비교', '크기', '수', '숫자', '자연', '곤충', '식물', '날씨', '실험'] },
  { id: '기본생활습관', keywords: ['밥', '식사', '잠', '낮잠', '화장실', '씻', '정리', '치우', '스스로', '혼자', '옷', '가방'] },
];

const CATEGORY_RULE_EXTENSIONS = {
  peer: [
    '기다렸', '순서', '차례를', '빌려', '빌려줌', '빌려달', '함께하자', '같이하자', '놀이에 끼', '참여하고 싶',
    '속상해', '서운해', '미안', '괜찮아', '도와줌', '도와주', '나눠줌', '번갈아', '양보함', '초대', '놀이 약속',
    '친구가 가지고', '친구 것', '친구와 캠핑', '친구와 블록', '친구와 역할', '친구에게 말', '친구에게 표현',
    '함께 정리', '같이 만들', '의견', '의견을 말', '의견 차이', '기분을 말', '화가 나', '갈등 후', '다시 놀이',
  ],
  habit: [
    '반찬을', '밥을', '국을', '먹어봄', '맛봄', '천천히 먹', '흘렸', '닦았', '손 씻', '비누', '수건', '양말',
    '외투', '지퍼', '단추', '신발 정리', '가방 정리', '물 마', '물병', '이불', '잠자리', '휴식', '컨디션',
    '배변 의사', '화장실 다녀', '기저귀', '팬티', '정리시간', '놀이감 정리', '자리 정돈', '스스로 먹',
  ],
  comm: [
    '나도', '할래', '싫어', '좋아', '하고 싶어', '도와주세요', '왜냐하면', '설명함', '표정', '몸짓', '손짓',
    '눈빛', '요청', '거절', '감정을 말', '생각을 말', '친구에게 말', '교사에게 말', '반복해서 말',
    '이름을 부르', '문장을 사용', '단어로 표현', '문장으로 표현', '질문함', '대답함', '듣고', '이야기를 들',
  ],
  nature: [
    '돋보기', '확대경', '애벌레', '장수풍뎅이', '개구리', '올챙이', '열매', '잎', '씨앗', '흙놀이', '물놀이',
    '얼음', '녹', '떠', '가라앉', '무겁', '가볍', '길이', '높이', '많다', '적다', '분류', '비교함',
    '냄새', '소리', '변화', '움직인다', '자란다', '살아있', '죽었', '계절', '봄', '여름', '가을', '겨울',
  ],
  art: [
    '물감', '크레파스', '색연필', '사인펜', '종이', '가위질', '풀칠', '스티커', '종이접기', '점토', '클레이',
    '리본', '무늬', '선', '동그라미', '소리내', '노래부', '따라 부', '박자', '율동', '상상', '표현놀이',
  ],
  body: [
    '계단', '오르내리', '매달리', '구르기', '걷기', '빠르게', '천천히', '균형잡', '공 던지', '공 받',
    '공 차', '자르', '접', '끼우', '집게', '핀셋', '블록 끼우', '작은 조각', '손가락', '손목', '몸을 움직',
  ],
  play: [
    '캠핑놀이', '텐트', '불멍', '낚시놀이', '가게놀이', '가족놀이', '엄마아빠', '동물놀이', '공룡', '로봇',
    '기찻길', '도로', '주차장', '쌓기놀이', '역할놀이', '상상놀이', '소꿉놀이', '요리놀이', '병원놀이',
    '규칙놀이', '놀이를 이어', '놀이를 확장', '만든 뒤', '구성한 뒤',
  ],
  special: [
    '코피', '기침', '콧물', '열감', '복통', '두통', '피곤', '졸려', '멍', '상처', '부딪', '넘어짐', '미끄러짐',
    '투약의뢰', '귀가', '등원', '하원', '알레르기', '불안해', '낯가림', '평소와 다르게', '부모 요청',
  ],
};

const DEV_AREA_EXTENSIONS = [
  { id: '신체운동·건강', keywords: ['계단', '오르내리', '공 던지', '공 받', '공 차', '가위질', '끼우기', '점토', '손 조작', '컨디션', '투약', '상처', '기침', '콧물'] },
  { id: '의사소통', keywords: ['나도', '할래', '싫어', '좋아', '요청', '거절', '감정을 말', '생각을 말', '문장으로', '단어로', '이야기를 듣', '친구에게 말'] },
  { id: '사회관계', keywords: ['순서', '기다렸', '번갈아', '빌려', '의견', '놀이 약속', '친구 것', '친구와 캠핑', '다시 놀이', '갈등 후', '미안', '괜찮아'] },
  { id: '예술경험', keywords: ['물감', '크레파스', '색연필', '스티커', '종이접기', '점토', '박자', '율동', '상상', '무늬'] },
  { id: '자연탐구', keywords: ['애벌레', '장수풍뎅이', '돋보기', '확대경', '얼음', '녹', '뜨다', '가라앉다', '분류', '변화', '계절'] },
  { id: '기본생활습관', keywords: ['물병', '손 씻', '비누', '수건', '신발 정리', '가방 정리', '이불', '배변 의사', '정리시간'] },
];

const EXTRA_CATEGORY_KEYWORDS = {
  peer: [
    '함께 앉', '옆에 앉', '기다려 줌', '기다려주', '먼저 하라고', '먼저 해', '내 차례', '네 차례',
    '친구를 바라봄', '친구를 기다', '친구 손', '친구 옆', '친구 이름', '같은 놀이', '같은 역할',
    '놀잇감을 건넴', '놀잇감을 나눔', '놀잇감을 함께', '서로', '번갈아 사용', '역할을 나눔',
    '같이 가자', '내가 도와줄게', '괜찮아라고', '미안하다고', '고맙다고', '고마워',
    '웃으며 다가', '친구를 초대', '친구에게 보여', '친구에게 건넴', '함께 웃',
  ],
  habit: [
    '등원 후', '하원 전', '실내화', '양치컵', '수저', '도시락', '간식', '우유', '물통',
    '손을 닦', '입을 닦', '옷을 개', '외투를 걸', '모자를 쓰', '양말을 신', '신발을 신',
    '줄을 섬', '자리에 앉', '바르게 앉', '식판', '밥풀', '흘린 음식', '먹어보고', '한입',
    '잠이 들', '이불을 덮', '토닥', '기상', '휴식을 취', '화장실에 가고 싶', '배가 아프',
  ],
  comm: [
    '말로 요청', '말로 알려', '말로 표현', '울음으로 표현', '표정으로 표현', '몸으로 표현',
    '교사를 불러', '교사에게 알려', '친구를 불러', '친구에게 요청', '다시 말', '큰소리로',
    '작은 목소리', '손을 들고', '자신의 경험', '가정에서', '어제', '오늘', '내일',
    '라고 말', '라고 이야기', '라고 대답', '라고 질문', '하고 말', '라고 표현',
  ],
  nature: [
    '색이 변', '모양이 변', '자석', '그림자', '빛', '소금', '설탕', '녹는다', '섞인다',
    '냄새를 맡', '소리를 듣', '만져보', '따뜻', '차갑', '부드럽', '딱딱', '거칠',
    '몇 개', '더 많', '더 적', '같다', '다르다', '순서대로', '분류하', '나누어',
    '키가 크', '작아졌', '길어졌', '짧아졌', '싹', '뿌리', '잎맥',
  ],
  art: [
    '색을 섞', '선을 긋', '동그라미를 그', '얼굴을 그', '자유롭게 그', '색칠',
    '오려 붙', '찢어 붙', '구겨', '찍기', '문지르', '꾸며', '무대를 만들',
    '음악을 듣', '박자에 맞', '노랫말', '멜로디', '따라 춤', '손유희',
  ],
  body: [
    '두 발', '한 발', '발끝', '무릎', '팔을 뻗', '몸을 굽', '몸을 펴',
    '터널', '매트', '훌라후프', '징검다리', '장애물', '공을 굴', '공을 차',
    '집게로', '구슬', '단추 끼우', '실꿰기', '종이를 접', '선 따라 자',
  ],
  play: [
    '캠핑장', '캠핑 의자', '모닥불', '바비큐', '낚싯대', '계산대', '손님', '의사', '간호사',
    '환자', '약국', '주방', '음식 만들', '상 차림', '블록으로 집', '다리 만들', '성 만들',
    '터널 만들', '길 만들', '놀이 주제', '놀이 방법', '놀이 규칙', '놀이를 제안',
  ],
  special: [
    '등원을 힘들어', '엄마 찾', '아빠 찾', '울며 등원', '분리', '낯설어', '새 친구',
    '새 교실', '새 환경', '넘어져', '부딪혀', '긁혀', '물려', '피가', '통증',
    '약을 먹', '체온', '기분이 좋지', '평소보다 조용', '활동을 어려워', '안전하게',
  ],
};

Object.entries(EXTRA_CATEGORY_KEYWORDS).forEach(([id, keywords]) => {
  CATEGORY_RULE_EXTENSIONS[id].push(...keywords);
});

CATEGORY_RULES.forEach(rule => {
  rule.keywords.push(...(CATEGORY_RULE_EXTENSIONS[rule.id] || []));
});

DEV_AREA_EXTENSIONS.forEach(extra => {
  const target = DEV_AREA_RULES.find(area => area.id === extra.id);
  if (target) target.keywords.push(...extra.keywords);
});

const DEV_AREA_EXTRA_KEYWORDS = {
  '신체운동·건강': [
    '두 발', '한 발', '공을 굴', '공을 차', '터널', '매트', '장애물', '실꿰기', '단추 끼우',
    '체온', '약을 먹', '아프', '통증', '휴식', '손 씻기', '양치',
  ],
  '의사소통': [
    '라고 말', '라고 질문', '라고 대답', '말로 요청', '교사에게 알려', '친구에게 요청',
    '자신의 경험', '울음으로 표현', '표정으로 표현', '몸짓',
  ],
  '사회관계': [
    '서로', '번갈아 사용', '역할을 나눔', '미안하다고', '고맙다고', '친구를 초대',
    '놀잇감을 건넴', '친구 옆', '친구를 기다',
  ],
  '예술경험': [
    '색을 섞', '선을 긋', '오려 붙', '찢어 붙', '찍기', '무대를 만들', '박자에 맞', '손유희',
  ],
  '자연탐구': [
    '자석', '그림자', '빛', '섞인다', '녹는다', '냄새를 맡', '만져보', '몇 개', '분류하', '싹', '뿌리',
  ],
  '기본생활습관': [
    '등원 후', '하원 전', '실내화', '양치컵', '식판', '자리에 앉', '이불을 덮', '화장실에 가고 싶',
  ],
};

Object.entries(DEV_AREA_EXTRA_KEYWORDS).forEach(([id, keywords]) => {
  const target = DEV_AREA_RULES.find(area => area.id === id);
  if (target) target.keywords.push(...keywords);
});

// ─── 부정 표현 순화 사전 ───────────────────────────────────────────
const SOFTEN_MAP = [
  { pattern: /산만하다|산만해|집중을 못|집중하지 못|집중 안/g, replace: '관심이 다양한 곳으로 이동하는 모습이 있다' },
  { pattern: /말을 안 듣는다|말을 안 들어|말을 듣지 않|지시를 따르지 않/g, replace: '교사의 안내를 반복적으로 경험하고 있다' },
  { pattern: /친구를 때렸다|친구를 때렸|때리는 행동|손으로 쳤/g, replace: '갈등 상황에서 손으로 표현하는 모습이 있었다' },
  { pattern: /고집이 세다|고집이 강|고집을 부려|억지를 쓴/g, replace: '자신의 생각과 요구를 분명하게 표현한다' },
  { pattern: /자꾸 운다|많이 운다|울면서 소리쳤|울며 떼를 썼|떼를 쓴/g, replace: '속상한 마음을 울음으로 표현하는 모습이 있다' },
  { pattern: /밥을 안 먹는다|밥을 안 먹어|음식을 거부|편식이 심|잘 안 먹어/g, replace: '식사에 대한 관심이 낮아 다양한 음식 경험이 필요하다' },
  { pattern: /친구를 방해|방해를 해|방해했/g, replace: '친구의 놀이에 관심을 보이며 참여하고 싶어 하는 모습이 있다' },
  { pattern: /혼자 논다|혼자서만 놀|친구와 안 어울|어울리지 않/g, replace: '독립적으로 놀이를 즐기며 자신만의 놀이 방식을 탐색하는 모습이 있다' },
  { pattern: /공격적|공격 행동|공격을 해/g, replace: '감정을 몸으로 표현하는 모습이 관찰되어 교사의 지원이 필요하다' },
  { pattern: /소리를 지른다|소리를 질렀|소리 질러/g, replace: '큰 목소리로 자신의 감정을 표현하는 모습이 있다' },
  { pattern: /말이 느리다|말이 늦다|언어가 느린|발음이 안 좋|발음이 부정확/g, replace: '언어 표현이 발달하는 과정에 있으며 교사의 지원이 이루어지고 있다' },
  { pattern: /못 한다|할 줄 모른다|어려워한다/g, replace: '아직 경험이 적어 교사의 도움을 받아 익히고 있다' },
  { pattern: /빼앗았다|빼앗으려 했다|가져갔다/g, replace: '원하는 놀잇감에 관심을 보이며 사용하고 싶어 하는 모습을 보였다' },
  { pattern: /울고불고|떼썼다|떼를 부렸다/g, replace: '속상한 마음을 울음과 말로 표현하는 모습이 있었다' },
  { pattern: /짜증냈다|짜증을 냈다|화냈다|화를 냈다/g, replace: '불편한 감정을 표정과 말로 표현하는 모습이 있었다' },
  { pattern: /안 하려고 했다|하기 싫어했다|거부했다/g, replace: '활동 참여에 조심스러운 모습을 보이며 시간이 필요하였다' },
  { pattern: /가만히 있지 못했다|계속 돌아다녔다/g, replace: '몸을 움직이며 주변 환경을 탐색하려는 모습이 있었다' },
  { pattern: /말대꾸했다|대들었다/g, replace: '자신의 생각을 강하게 표현하는 모습이 있었다' },
  { pattern: /이기적이다|자기 것만 챙긴다/g, replace: '자신이 원하는 것을 분명히 표현하며 소유 개념을 경험하고 있다' },
  { pattern: /겁이 많다|무서워한다/g, replace: '새로운 상황에서 신중하게 반응하며 안정적인 안내가 필요하다' },
  { pattern: /느리다|꾸물거린다/g, replace: '자신의 속도에 맞추어 천천히 시도하는 모습이 있다' },
  { pattern: /엉망으로|마구|대충/g, replace: '자신의 방식으로 탐색하고 표현하는 모습이 있다' },
  { pattern: /싫다고 했다|싫어했다/g, replace: '자신의 선호와 감정을 말로 표현하였다' },
  { pattern: /잘기다린다|잘 기다린다/g, replace: '차례를 기다리는 모습이 보였다' },
  { pattern: /잘한다/g, replace: '익숙하게 시도하는 모습이 보였다' },
  { pattern: /던졌다|집어던졌다|던져버렸다/g, replace: '불편한 감정을 행동으로 표현하는 모습이 있었다' },
  { pattern: /밀쳤다|밀었다|잡아당겼다/g, replace: '또래와의 거리 조절이 필요한 상황에서 몸으로 표현하는 모습이 있었다' },
  { pattern: /울보|예민하다|예민해/g, replace: '감정과 주변 변화에 민감하게 반응하는 모습이 있다' },
  { pattern: /말이 많다|계속 말한다/g, replace: '자신의 생각을 적극적으로 말로 표현하는 모습이 있다' },
  { pattern: /참견한다|끼어든다/g, replace: '주변 놀이와 대화에 관심을 보이며 참여하고 싶어 하는 모습이 있다' },
  { pattern: /욕심이 많다|양보를 안 한다/g, replace: '원하는 것을 분명하게 표현하며 나누어 사용하는 경험이 필요하다' },
  { pattern: /장난이 심하다|까분다/g, replace: '즐거운 감정을 몸짓과 행동으로 크게 표현하는 모습이 있다' },
  { pattern: /불안해한다|엄마만 찾는다|아빠만 찾는다/g, replace: '익숙한 보호자를 찾으며 안정감을 확인하려는 모습이 있다' },
  { pattern: /정리를 안 한다|치우지 않는다/g, replace: '놀이 후 정리 과정에 교사의 안내가 필요하다' },
  { pattern: /잠을 안 잔다|낮잠을 거부한다/g, replace: '휴식 시간에 몸과 마음을 안정시키는 데 시간이 필요하다' },
  { pattern: /화장실 실수|실수했다/g, replace: '배변 의사를 표현하고 조절하는 경험이 이어지고 있다' },
  { pattern: /위험하게|위험한 행동/g, replace: '안전한 놀이 방법을 익히는 과정에 있다' },
];

const POSITIVE_REPHRASE_MAP = [
  { pattern: /순서를 기다렸|순서를 기다리|차례를 기다렸|차례를 기다리/g, replace: '차례를 기다리며 놀이에 참여하였다' },
  { pattern: /친구와 캠핑놀이를 하며/g, replace: '친구와 캠핑놀이를 함께 구성하며' },
  { pattern: /친구와 함께/g, replace: '또래와 함께' },
  { pattern: /나도 할래/g, replace: '"나도 할래"라고 자신의 의사를 표현하였다' },
  { pattern: /움직인다/g, replace: '"움직인다"라고 말하며 변화를 관찰하였다' },
  { pattern: /스스로/g, replace: '스스로 시도하며' },
  { pattern: /도와줬다|도와주었다/g, replace: '친구를 도와주는 모습을 보였다' },
  { pattern: /양보했다|양보하였다/g, replace: '친구에게 양보하는 모습을 보였다' },
  { pattern: /정리했다|정리하였다/g, replace: '놀이 후 정리에 참여하였다' },
  { pattern: /말했다/g, replace: '말로 표현하였다' },
];

function softenText(text) {
  let result = text;
  for (const { pattern, replace } of SOFTEN_MAP) {
    result = result.replace(pattern, replace);
  }
  return result;
}

function applyPositiveRephrase(text) {
  let result = text;
  for (const { pattern, replace } of POSITIVE_REPHRASE_MAP) {
    result = result.replace(pattern, replace);
  }
  return result;
}

function hasFinalConsonant(value) {
  const last = [...String(value).trim()].pop();
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function subject(name) {
  return `${name}${hasFinalConsonant(name) ? '이' : ''}가`;
}

function cleanObservationInput(text) {
  return applyPositiveRephrase(softenText(text))
    .replace(/^\s*[가-힣A-Za-z0-9]+(?:이\/가|이\s*\/\s*가|이가|가|은|는)\s*/u, '')
    .replace(/\b([가-힣]+)이\/가\b/gu, '$1이가')
    .replace(/하였으며/g, '하고')
    .replace(/하였다/g, '하였다')
    .replace(/\s+/g, ' ')
    .replace(/잘기다린다/g, '차례를 기다리는 모습이 보였다')
    .replace(/잘 기다린다/g, '차례를 기다리는 모습이 보였다')
    .replace(/교사의 지원을 통해 상황을 경험하는 모습이 관찰되었다\.?/g, '')
    .replace(/교사의 지원을 통해 상황을 경험하는 모습이 보였다\.?/g, '')
    .replace(/교사의 안내를 통해 상황을 경험하였다\.?/g, '')
    .trim();
}

function finishSentence(text) {
  const clean = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/[.。]+$/g, '');
  return clean ? `${clean}.` : '';
}

function observationDetail(text, limit = 90) {
  const clean = cleanObservationInput(text);
  if (!clean) return '상황에 참여하며 경험을 이어가는 모습이 관찰되었다';
  const trimmed = clean.length > limit ? clean.slice(0, limit).trim() : clean;
  return trimmed
    .replace(/했다$/u, '하는 모습이 관찰되었다')
    .replace(/하였다$/u, '하는 모습이 관찰되었다')
    .replace(/말했다$/u, '말로 표현하였다')
    .replace(/기다렸다$/u, '기다리는 모습이 관찰되었다');
}

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

const SCENE_RULES = [
  {
    id: 'peerWait',
    keywords: ['순서', '차례', '기다', '번갈아', '내 차례', '네 차례'],
    parent: (s) => `${s} 또래와 함께 놀이하며 차례를 기다리는 경험을 하고 있습니다. 원하는 놀이를 바로 하기 어려운 순간에도 교사의 안내를 받아 기다려보는 모습이 나타나고 있어요.`,
    support: '또래와의 놀이에서 차례를 기다리는 경험을 반복적으로 제공하고, 기다리는 동안 할 수 있는 말과 행동을 교사가 구체적으로 모델링한다.',
  },
  {
    id: 'peerConflict',
    keywords: ['갈등', '빼앗', '가져가', '친구 것', '빌려', '밀', '때리', '방해', '화해', '미안'],
    parent: (s) => `${s} 또래와의 놀이 속에서 자신의 요구를 표현하고 조율하는 경험을 하고 있습니다. 아직 원하는 것이 바로 이루어지지 않을 때 도움이 필요하지만, 교사의 안내를 통해 말로 요청하고 기다리는 방법을 익혀가고 있어요.`,
    support: '놀잇감 사용 순서를 시각적으로 안내하고, “빌려줘”, “다 쓰면 알려줘”, “같이 하자”와 같은 또래 간 요청 표현을 반복적으로 연습한다.',
  },
  {
    id: 'emotion',
    keywords: ['울', '속상', '화', '짜증', '싫어', '서운', '불안', '무서워', '겁'],
    parent: (s) => `${s} 자신의 감정을 표현하는 모습이 나타나고 있습니다. 감정이 커지는 순간에는 울음이나 강한 표현으로 나타나기도 하지만, 교사의 도움을 받아 마음을 말로 표현하는 경험을 하고 있어요.`,
    support: '감정이 커지는 상황에서 아이의 마음을 먼저 읽어주고, “속상했구나”, “기다리고 싶지 않았구나”처럼 감정을 말로 표현하는 모델링을 제공한다.',
  },
  {
    id: 'speech',
    keywords: ['말', '이야기', '질문', '대답', '나도', '할래', '싫어', '좋아', '요청', '거절', '라고'],
    parent: (s) => `${s} 자신의 생각과 요구를 말로 표현하려는 모습이 늘고 있습니다. 원에서는 아이의 말을 충분히 기다려 주며 짧은 문장으로 표현해볼 수 있도록 돕고 있습니다.`,
    support: '아이의 표현을 충분히 기다린 뒤 짧은 문장으로 확장해 들려주고, 또래와 교사에게 자신의 생각을 말해볼 기회를 자주 제공한다.',
  },
  {
    id: 'selfHelp',
    keywords: ['스스로', '혼자', '정리', '입', '신발', '가방', '지퍼', '단추', '외투', '양말'],
    parent: (s) => `${s} 일상 속에서 스스로 해보려는 시도가 보이고 있습니다. 작은 성공 경험을 통해 자신감이 쌓일 수 있도록 원에서도 차근차근 지원하고 있습니다.`,
    support: '스스로 시도할 수 있는 시간을 충분히 제공하고, 과정 중 필요한 부분만 짧게 도와 자립 경험이 이어지도록 지원한다.',
  },
  {
    id: 'meal',
    keywords: ['밥', '식사', '반찬', '국', '간식', '우유', '먹', '맛봄', '한입', '편식'],
    parent: (s) => `${s} 식사 시간에 다양한 음식을 경험하고 있습니다. 아직 선호가 분명한 음식도 있지만, 교사의 격려 속에서 한입 맛보거나 스스로 먹어보는 시도가 나타나고 있어요.`,
    support: '식사 시간에 부담을 주기보다 작은 양을 맛보는 경험부터 제공하고, 스스로 먹어본 시도를 구체적으로 격려한다.',
  },
  {
    id: 'nap',
    keywords: ['낮잠', '잠', '이불', '휴식', '잠자리', '토닥', '졸려', '기상'],
    parent: (s) => `${s} 휴식 시간에 몸과 마음을 안정시키는 경험을 하고 있습니다. 컨디션과 하루의 흐름에 따라 잠드는 데 시간이 걸리기도 하지만, 안정적인 분위기 속에서 휴식 방법을 익혀가고 있어요.`,
    support: '낮잠 전 일정한 루틴과 조용한 환경을 제공하고, 잠들기 어려운 경우 짧은 휴식부터 경험할 수 있도록 개별적으로 지원한다.',
  },
  {
    id: 'toilet',
    keywords: ['화장실', '배변', '소변', '대변', '응가', '쉬', '기저귀', '팬티', '실수'],
    parent: (s) => `${s} 배변과 관련된 신체 신호를 알아가고 있습니다. 원에서는 화장실 이용을 편안하게 경험할 수 있도록 안내하며, 표현하는 시도를 긍정적으로 격려하고 있어요.`,
    support: '배변 신호를 보일 때 편안하게 화장실을 이용할 수 있도록 안내하고, 성공 여부보다 표현하고 시도한 과정을 격려한다.',
  },
  {
    id: 'natureExplore',
    keywords: ['곤충', '애벌레', '장수풍뎅이', '관찰', '돋보기', '왜', '궁금', '움직인다', '변화', '씨앗', '잎'],
    parent: (s) => `${s} 주변 사물과 자연에 호기심을 보이며 관찰하는 모습이 나타나고 있습니다. 궁금한 점을 말로 표현하고 직접 탐색해보는 경험을 즐기고 있어요.`,
    support: '관찰 도구와 관련 자료를 제공하여 탐색을 확장하고, 관찰한 내용을 말이나 그림으로 표현해볼 수 있도록 지원한다.',
  },
  {
    id: 'artExpression',
    keywords: ['그림', '색', '색칠', '만들', '꾸미', '물감', '크레파스', '노래', '춤', '율동', '박자'],
    parent: (s) => `${s} 예술 활동에서 자신의 생각을 자유롭게 표현하고 있습니다. 결과보다는 과정 안에서 즐거움을 느끼며 다양한 재료와 방법을 경험하고 있어요.`,
    support: '다양한 재료를 선택할 수 있게 제공하고, 결과물을 평가하기보다 사용한 색, 움직임, 표현 과정을 구체적으로 말해준다.',
  },
  {
    id: 'grossMotor',
    keywords: ['달리', '뛰', '점프', '계단', '공', '균형', '미끄럼틀', '그네', '바깥놀이', '장애물'],
    parent: (s) => `${s} 신체 활동에 참여하며 몸을 조절하는 경험을 하고 있습니다. 움직임 속에서 균형감과 자신감을 키워가고 있으며, 안전한 방법을 함께 익히고 있어요.`,
    support: '충분히 움직일 수 있는 놀이 환경을 제공하되, 안전한 이동 방법과 차례 지키기를 함께 안내한다.',
  },
  {
    id: 'fineMotor',
    keywords: ['가위', '풀', '집게', '핀셋', '끼우', '단추', '실꿰기', '작은 조각', '손가락', '접'],
    parent: (s) => `${s} 손과 손가락을 사용하는 활동에 관심을 보이며 조작 경험을 쌓고 있습니다. 작은 도구를 사용하는 과정에서 집중하고 시도하는 모습이 나타나고 있어요.`,
    support: '소근육을 사용할 수 있는 자료를 단계적으로 제공하고, 완성보다 조작 과정과 시도 자체를 격려한다.',
  },
  {
    id: 'rolePlay',
    keywords: ['캠핑', '병원', '마트', '가게', '요리', '가족놀이', '역할', '상상놀이', '손님', '의사'],
    parent: (s) => `${s} 역할놀이 속에서 경험한 내용을 놀이로 표현하고 있습니다. 또래와 역할을 나누고 상상한 상황을 말과 행동으로 이어가는 모습이 보여요.`,
    support: '놀이 주제와 관련된 소품과 언어 표현을 제공하고, 또래와 역할을 나누어 놀이가 확장될 수 있도록 지원한다.',
  },
  {
    id: 'constructPlay',
    keywords: ['블록', '레고', '쌓', '무너', '길 만들', '집 만들', '다리 만들', '구성', '끼우기', '터널 만들'],
    parent: (s) => `${s} 구성놀이에서 자신의 생각을 구조물로 표현하고 있습니다. 만들고 무너지는 과정을 반복하며 공간과 균형에 대한 경험을 쌓고 있어요.`,
    support: '구성한 것을 말로 설명해볼 수 있도록 질문하고, 필요한 경우 사진으로 남겨 다음 놀이와 연결한다.',
  },
  {
    id: 'safety',
    keywords: ['위험', '안전', '넘어', '부딪', '다쳤', '상처', '피', '미끄러짐', '물림', '긁힘'],
    parent: (s) => `${s} 안전한 놀이 방법을 익혀가는 과정에 있습니다. 원에서는 상황을 세심히 살피며 안전하게 이동하고 놀이하는 방법을 반복적으로 안내하고 있습니다.`,
    support: '위험 상황을 즉시 짧고 분명하게 안내하고, 안전하게 움직이는 대안 행동을 반복적으로 경험하게 한다.',
  },
  {
    id: 'arrival',
    keywords: ['등원', '하원', '엄마 찾', '아빠 찾', '분리', '낯가림', '새 교실', '새 환경', '적응'],
    parent: (s) => `${s} 등원과 전이 상황에서 안정감을 확인하려는 모습이 있습니다. 익숙한 루틴과 교사의 따뜻한 맞이를 통해 원 생활에 차츰 편안해지고 있어요.`,
    support: '등원 후 짧고 예측 가능한 루틴을 제공하고, 아이가 안정감을 느끼는 놀이와 교사 상호작용으로 자연스럽게 연결한다.',
  },
];

function findSceneRule(text) {
  return SCENE_RULES.find(rule => includesAny(text, rule.keywords));
}

function makeParentMessage(name, category, text) {
  const s = subject(name);
  const sceneRule = findSceneRule(text);
  if (sceneRule) return sceneRule.parent(s);
  if (includesAny(text, ['순서', '차례', '기다'])) {
    return `${s} 또래와 함께 놀이하며 차례를 기다리는 경험을 하고 있습니다. 원하는 놀이를 바로 하기 어려운 순간에도 교사의 안내를 받아 기다려보는 모습이 나타나고 있어요.`;
  }
  if (includesAny(text, ['울', '속상', '화', '짜증', '싫어'])) {
    return `${s} 자신의 감정을 표현하는 모습이 나타나고 있습니다. 아직 감정이 커질 때는 울음이나 강한 표현으로 나타나기도 하지만, 교사의 도움을 받아 감정을 말로 표현하는 경험을 하고 있어요.`;
  }
  if (includesAny(text, ['말', '이야기', '질문', '대답', '나도', '할래'])) {
    return `${s} 자신의 생각과 요구를 말로 표현하려는 모습이 늘고 있습니다. 원에서는 아이의 말을 충분히 기다려 주며 짧은 문장으로 표현해볼 수 있도록 돕고 있습니다.`;
  }
  if (includesAny(text, ['스스로', '혼자', '정리', '입', '신발', '가방'])) {
    return `${s} 일상 속에서 스스로 해보려는 시도가 보이고 있습니다. 작은 성공 경험을 통해 자신감이 쌓일 수 있도록 원에서도 차근차근 지원하고 있습니다.`;
  }
  if (includesAny(text, ['곤충', '애벌레', '장수풍뎅이', '관찰', '돋보기', '왜', '궁금'])) {
    return `${s} 주변 사물과 자연에 호기심을 보이며 관찰하는 모습이 나타나고 있습니다. 궁금한 점을 말로 표현하고 직접 탐색해보는 경험을 즐기고 있어요.`;
  }
  if (includesAny(text, ['그림', '색', '만들', '노래', '춤', '꾸미'])) {
    return `${s} 예술 활동에서 자신의 생각을 자유롭게 표현하고 있습니다. 결과보다는 과정 안에서 즐거움을 느끼며 다양한 재료와 방법을 경험하고 있어요.`;
  }

  return PARENT_TEMPLATES[category]?.(name) || PARENT_TEMPLATES.play(name);
}

function makeSupportPlan(category, text) {
  const sceneRule = findSceneRule(text);
  if (sceneRule) return sceneRule.support;
  if (includesAny(text, ['순서', '차례', '기다'])) {
    return '또래와의 놀이에서 차례를 기다리는 경험을 반복적으로 제공하고, 기다리는 동안 할 수 있는 말과 행동을 교사가 구체적으로 모델링한다.';
  }
  if (includesAny(text, ['울', '속상', '화', '짜증', '싫어'])) {
    return '감정이 커지는 상황에서 아이의 마음을 먼저 읽어주고, “속상했구나”, “기다리고 싶지 않았구나”처럼 감정을 말로 표현하는 모델링을 제공한다.';
  }
  if (includesAny(text, ['빼앗', '가져가', '친구 것', '빌려'])) {
    return '놀잇감 사용 순서를 시각적으로 안내하고, “빌려줘”, “다 쓰면 알려줘”와 같은 또래 간 요청 표현을 반복적으로 연습한다.';
  }
  if (includesAny(text, ['스스로', '혼자', '정리', '입', '신발', '가방'])) {
    return '스스로 시도할 수 있는 시간을 충분히 제공하고, 과정 중 필요한 부분만 짧게 도와 자립 경험이 이어지도록 지원한다.';
  }
  if (includesAny(text, ['말', '질문', '대답', '표현', '나도', '할래'])) {
    return '아이의 표현을 충분히 기다린 뒤 짧은 문장으로 확장해 들려주고, 또래와 교사에게 자신의 생각을 말해볼 기회를 자주 제공한다.';
  }
  if (includesAny(text, ['곤충', '애벌레', '관찰', '돋보기', '궁금', '왜'])) {
    return '관찰 도구와 관련 자료를 제공하여 탐색을 확장하고, 관찰한 내용을 말이나 그림으로 표현해볼 수 있도록 지원한다.';
  }
  return SUPPORT_TEMPLATES[category] || SUPPORT_TEMPLATES.play;
}

// ─── 키워드 기반 분류 ─────────────────────────────────────────────
function detectCategory(text) {
  const scores = CATEGORY_RULES.map(cat => ({
    id: cat.id,
    label: cat.label,
    score: cat.keywords.reduce((sum, keyword) => {
      if (!text.includes(keyword)) return sum;
      return sum + (keyword.length >= 4 ? 2 : 1);
    }, 0),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].id : 'play';
}

function detectDevAreas(text) {
  const matched = DEV_AREA_RULES
    .map(area => ({ id: area.id, score: area.keywords.filter(k => text.includes(k)).length }))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matched.length === 0) return ['사회관계'];
  return matched.slice(0, 3).map(a => a.id);
}

function extractTags(text, categoryId) {
  const TAG_POOL = {
    peer: ['또래관계', '갈등상황', '차례기다리기', '감정표현', '협력', '양보', '친구와 놀이'],
    habit: ['생활습관', '식습관', '수면', '배변', '위생', '자립', '정리정돈'],
    comm: ['의사소통', '언어표현', '질문하기', '대화', '감정표현', '발표'],
    nature: ['자연탐구', '곤충관찰', '식물관찰', '날씨', '비교', '호기심'],
    art: ['예술표현', '미술활동', '음악활동', '창의표현', '역할놀이'],
    body: ['신체활동', '대근육', '소근육', '바깥놀이', '운동발달'],
    play: ['놀이활동', '구성놀이', '탐색활동', '창의놀이', '집중력'],
    special: ['특이사항', '건강', '안전', '정서지원', '적응'],
  };

  const base = TAG_POOL[categoryId] || TAG_POOL.play;
  const extra = [];
  if (text.includes('울') || text.includes('속상')) extra.push('감정조절');
  if (text.includes('스스로') || text.includes('혼자')) extra.push('자립심');
  if (text.includes('왜') || text.includes('어떻게') || text.includes('궁금')) extra.push('호기심');
  if (text.includes('도와') || text.includes('배려')) extra.push('배려심');
  if (text.includes('순서') || text.includes('차례') || text.includes('기다')) extra.push('기다리기');
  if (text.includes('빌려') || text.includes('나눠') || text.includes('양보')) extra.push('나눔경험');
  if (text.includes('캠핑') || text.includes('역할') || text.includes('상상')) extra.push('상상놀이');
  if (text.includes('관찰') || text.includes('돋보기')) extra.push('관찰하기');
  if (text.includes('정리') || text.includes('치우')) extra.push('정리습관');
  if (text.includes('말') || text.includes('표현') || text.includes('나도')) extra.push('언어표현');
  const sceneRule = findSceneRule(text);
  if (sceneRule?.id === 'meal') extra.push('식사경험');
  if (sceneRule?.id === 'nap') extra.push('휴식습관');
  if (sceneRule?.id === 'toilet') extra.push('배변표현');
  if (sceneRule?.id === 'peerConflict') extra.push('갈등조절');
  if (sceneRule?.id === 'grossMotor') extra.push('대근육활동');
  if (sceneRule?.id === 'fineMotor') extra.push('소근육조작');
  if (sceneRule?.id === 'rolePlay') extra.push('역할놀이');
  if (sceneRule?.id === 'constructPlay') extra.push('구성놀이');
  if (sceneRule?.id === 'safety') extra.push('안전지도');
  if (sceneRule?.id === 'arrival') extra.push('등원적응');

  return [...new Set([...base.slice(0, 3), ...extra])].slice(0, 5);
}

// ─── 문장 생성 템플릿 ─────────────────────────────────────────────
const OBSERVATION_TEMPLATES = {
  peer: (name, text) =>
    finishSentence(`${subject(name)} 또래와의 놀이에서 ${observationDetail(text)}`),
  habit: (name, text) =>
    finishSentence(`${subject(name)} 일상생활 중 ${observationDetail(text)}`),
  comm: (name, text) =>
    finishSentence(`${subject(name)} ${observationDetail(text)}`),
  nature: (name, text) =>
    finishSentence(`${subject(name)} 자연물에 관심을 보이며 ${observationDetail(text)}`),
  art: (name, text) =>
    finishSentence(`${subject(name)} 예술 활동에 참여하며 ${observationDetail(text)}`),
  body: (name, text) =>
    finishSentence(`${subject(name)} 신체 활동 중 ${observationDetail(text)}`),
  play: (name, text) =>
    finishSentence(`${subject(name)} 놀이 활동에 참여하며 ${observationDetail(text)}`),
  special: (name, text) =>
    finishSentence(`${subject(name)} ${observationDetail(text)} 교사가 세심히 살피며 지원하였다`),
};

const PARENT_TEMPLATES = {
  peer: (name) =>
    `${subject(name)} 요즘 친구들과 어울리는 상황에서 다양한 감정을 경험하고 있습니다. 아직 조율이 어려운 순간도 있지만, 교사의 도움을 받아 말로 표현하고 차례를 기다리는 경험을 하고 있어요.`,
  habit: (name) =>
    `${subject(name)} 일상생활의 규칙과 습관을 익혀가는 중입니다. 가정에서도 스스로 해볼 수 있는 기회를 많이 주시면 큰 도움이 됩니다.`,
  comm: (name) =>
    `${subject(name)} 자신의 생각과 감정을 말로 표현하려는 모습이 늘고 있습니다. 가정에서도 아이의 이야기를 천천히 들어주시면 언어 발달에 도움이 됩니다.`,
  nature: (name) =>
    `${subject(name)} 자연에 대한 호기심이 많아 주변 사물을 관심 있게 살피고 있습니다. 가정에서 산책이나 자연 탐색 기회를 주시면 더욱 좋을 것 같아요.`,
  art: (name) =>
    `${subject(name)} 예술 활동에 즐겁게 참여하며 창의적으로 표현하는 모습을 보이고 있습니다. 가정에서도 자유롭게 그리고 만들 수 있는 환경을 만들어 주세요.`,
  body: (name) =>
    `${subject(name)} 신체 활동을 즐기며 활발하게 움직이고 있습니다. 충분한 바깥 활동과 안전한 신체 놀이 환경을 제공해 주시면 좋겠습니다.`,
  play: (name) =>
    `${subject(name)} 다양한 놀이 활동에 집중하며 탐색하는 모습을 보이고 있습니다. 아이가 관심 갖는 놀이를 가정에서도 함께 즐겨 보세요.`,
  special: (name) =>
    `${subject(name)} 오늘 특별한 상황을 경험하였습니다. 가정에서도 아이의 컨디션과 감정 상태를 세심히 살펴봐 주시면 감사하겠습니다.`,
};

const SUPPORT_TEMPLATES = {
  peer: '또래와의 놀이 상황에서 차례 기다리기와 감정 조절을 반복적으로 경험할 수 있도록 지원하며, 말로 표현하는 모델링을 제공한다.',
  habit: '일상생활 장면에서 스스로 시도해볼 수 있는 기회를 제공하고, 성공 경험을 통해 자립심이 높아지도록 지원한다.',
  comm: '다양한 상황에서 짧은 문장으로 표현해볼 수 있도록 교사가 모델링을 제공하고, 표현하려는 시도를 충분히 격려한다.',
  nature: '자연물을 직접 탐색할 수 있는 기회를 제공하고, 관찰한 것을 말이나 그림으로 표현해볼 수 있도록 지원한다.',
  art: '다양한 재료를 자유롭게 탐색하고 표현할 수 있는 환경을 제공하며, 결과보다 과정에 집중할 수 있도록 격려한다.',
  body: '대·소근육 발달을 지원하는 활동을 계획하고, 신체 활동 중 안전한 환경을 유지하며 적극적인 참여를 격려한다.',
  play: '아이의 관심사를 반영한 놀이 환경을 구성하고, 놀이가 확장될 수 있도록 적절한 시기에 지원과 개입을 제공한다.',
  special: '아이의 상태를 지속적으로 관찰하며 가정과 긴밀히 소통하고, 필요한 경우 즉각적인 지원을 제공한다.',
};

function makeTitle(text, categoryId) {
  const CAT_LABELS = { peer: '또래관계', habit: '생활습관', comm: '의사소통', nature: '자연탐구', art: '예술표현', body: '신체활동', play: '놀이활동', special: '특이사항' };
  const label = CAT_LABELS[categoryId] || '관찰기록';
  const keywords = ['친구', '식사', '말', '곤충', '그림', '운동', '블록', '건강'];
  const found = keywords.find(k => text.includes(k));
  return found ? `${label} - ${found}` : label;
}

// ─── 공개 함수 ────────────────────────────────────────────────────

export async function processRecord({ childName, rawText, classAge }) {
  const name = childName || '아동';
  const category = detectCategory(rawText);
  const devAreas = detectDevAreas(rawText);
  const tags = extractTags(rawText, category);
  const softened = softenText(rawText);

  const observeFn = OBSERVATION_TEMPLATES[category] || OBSERVATION_TEMPLATES.play;
  const parentFn = PARENT_TEMPLATES[category] || PARENT_TEMPLATES.play;

  return {
    category,
    devAreas,
    tags,
    softened,
    observation: observeFn(name, rawText),
    parent: makeParentMessage(name, category, rawText) || parentFn(name),
    support: makeSupportPlan(category, rawText),
    title: makeTitle(rawText, category),
  };
}

export async function generateDailyJournal({ records, date, classAge, className }) {
  const categories = records.map(r => r.category || detectCategory(r.rawText || ''));
  const hasPeer = categories.includes('peer');
  const hasNature = categories.includes('nature');
  const hasArt = categories.includes('art');
  const hasBody = categories.includes('body');

  const activityParts = [];
  if (hasNature) activityParts.push('자연탐구 활동');
  if (hasArt) activityParts.push('예술 표현 활동');
  if (hasBody) activityParts.push('신체 활동');
  if (hasPeer) activityParts.push('또래 상호작용');
  if (activityParts.length === 0) activityParts.push('다양한 놀이 활동');

  const childCount = records.length;

  return {
    playFlow: `오늘 유아들은 ${activityParts.join(', ')}에 참여하며 즐거운 하루를 보냈다. 실내외 놀이 환경에서 자신이 관심 있는 놀이를 선택하여 집중하는 모습을 보였으며, 활동 간 자연스러운 연계가 이루어졌다.`,
    childResponse: `${childCount}명의 유아가 오늘 활동에 참여하였으며, 대부분 적극적인 모습을 보였다. ${hasPeer ? '또래와 함께 놀이하는 과정에서 다양한 감정을 경험하였고, ' : ''}교사의 지원을 통해 놀이를 이어가거나 문제를 해결하는 경험을 하였다.`,
    teacherSupport: `교사는 유아들이 자유롭게 탐색할 수 있는 환경을 제공하고, 필요한 순간에 적절히 개입하였다. ${hasPeer ? '또래 갈등 상황에서 감정을 말로 표현할 수 있도록 모델링하였으며, ' : ''}개별 유아의 관심과 요구에 맞는 지원을 이어갔다.`,
    evaluation: `오늘 보육 활동은 유아의 흥미와 발달 수준에 적합하게 이루어졌다. ${activityParts[0]}을 중심으로 놀이가 확장되었으며, 유아들이 주도적으로 놀이를 이끌어가는 모습이 관찰되었다.`,
    nextPlan: `다음 활동에서는 오늘의 놀이 경험을 바탕으로 심화 탐색 기회를 제공하고, 개별 유아의 발달 수준에 맞는 지원을 이어갈 계획이다.`,
  };
}

export async function generateGrowthSummary({ childName, records, period, childAge }) {
  const name = childName || '아동';
  const count = records.length;

  const catCounts = {};
  records.forEach(r => {
    const cat = r.category || 'play';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'play';
  const CAT_LABELS = { peer: '또래관계', habit: '생활습관', comm: '의사소통', nature: '자연탐구', art: '예술표현', body: '신체활동', play: '놀이활동', special: '특이사항' };
  const topLabel = CAT_LABELS[topCat] || '놀이활동';

  return {
    overall: `${subject(name)} ${period} 동안 ${count}건의 관찰 기록이 누적되었습니다. 전반적으로 ${topLabel} 영역에서 활발한 모습을 보이며 성장하고 있습니다. 교사와의 관계에서도 안정감을 보이며 일상생활에 적응하고 있습니다.`,
    strengths: `${subject(name)} ${topLabel} 상황에서 자신의 관심을 적극적으로 표현하는 모습이 돋보입니다. 새로운 활동에 흥미를 보이며 탐색하려는 의지가 강하고, 교사의 지원을 통해 경험을 확장해나가고 있습니다.`,
    support: `또래와의 상호작용 과정에서 감정 조절과 의사소통 표현 기회를 더 많이 제공하면 좋겠습니다. 다양한 발달 영역의 균형 있는 경험을 위해 지속적인 관찰과 지원이 이루어질 예정입니다.`,
    parentMessage: `${subject(name)} 원에서 ${topLabel} 활동을 즐겁게 경험하며 성장하고 있습니다. 가정에서도 아이가 관심 갖는 것들을 함께 탐색해 주시고, 일상 속 작은 성공 경험을 충분히 격려해 주세요. 앞으로도 아이의 성장을 함께 지원하겠습니다.`,
    nextSteps: `개별 발달 특성을 고려한 맞춤형 지원을 지속하고, 부족한 영역의 경험이 균형 있게 이루어지도록 환경과 활동을 계획할 예정입니다.`,
  };
}

export async function generateConsultDoc({ childName, records, childAge }) {
  const name = childName || '아동';
  const count = records.length;

  const catCounts = {};
  records.forEach(r => {
    const cat = r.category || 'play';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'play';
  const CAT_LABELS = { peer: '또래관계', habit: '생활습관', comm: '의사소통', nature: '자연탐구', art: '예술표현', body: '신체활동', play: '놀이활동', special: '특이사항' };

  return {
    recentGrowth: `최근 ${subject(name)} ${CAT_LABELS[topCat] || '놀이'} 영역에서 활발한 모습을 보이고 있습니다. 총 ${count}건의 관찰 기록을 통해 꾸준한 성장이 확인되었습니다.`,
    strengths: `자신이 좋아하는 활동에 집중하여 탐색하는 능력이 뛰어납니다. 교사의 지원을 받아 새로운 경험에 도전하려는 의지를 보이고 있으며, 일상 루틴에 잘 적응하고 있습니다.`,
    supportNeeded: `또래와의 상호작용 과정에서 감정을 말로 표현하는 연습이 지속적으로 필요합니다. 가정과 원이 함께 일관된 방향으로 지원해 주시면 더욱 빠른 성장이 기대됩니다.`,
    homeLinks: [
      '일상 속에서 아이의 이야기를 충분히 들어주고 감정에 공감해 주세요.',
      '스스로 해결할 수 있는 작은 일을 맡겨 자립심을 키울 수 있게 도와주세요.',
      '바깥 활동과 자연 탐색의 기회를 자주 제공해 주시면 좋겠습니다.',
    ].join(' / '),
    teacherSupport: `원에서는 ${subject(name)} 안정감을 느낄 수 있도록 일관된 지지를 제공하고 있으며, 개별 특성을 반영한 활동 지원을 이어가고 있습니다.`,
    openingMessage: `오늘 상담에 시간 내주셔서 감사합니다. ${subject(name)} 원에서 즐겁게 지내고 있어 함께 나눌 이야기가 많습니다.`,
  };
}

