// 완전 비식별 합성 회귀 사례(6단계) — v3 합성 장면과 겹치지 않는 자유입력 지향 55건.
// 실원아 정보 아님(가공 픽스처). 짧은 메모·구어체·복합 신호·근거 부족·금지 위험 사례 포함.
// tag: short(짧음)|colloquial(구어체)|speech(발화)|peer(또래)|emotionOnly(감정만)|recovery(회복)|
//      conflict(갈등·사과)|noSupport(지원 미입력)|make|explore|move|daily|multi(복합)|sparse(근거 희박)|
//      riskBanned(금지 위험)|deterministic(결정론 검증)

export const SYNTHETIC_CASES = [
  // ── 짧고 불완전한 메모 ─────────────────────────────────────────────
  { id: 'syn01', tag: 'short', name: '가온', input: '가온이 블록 또 무너짐, 다시 함' },
  { id: 'syn02', tag: 'short', name: '나윤', input: '나윤 오늘 그네 오래 탐' },
  { id: 'syn03', tag: 'short', name: '다온', input: '다온 점심 채소 한 입 먹음' },
  { id: 'syn04', tag: 'short', name: '라임', input: '라임 물감 손바닥 찍기' },
  { id: 'syn05', tag: 'short', name: '마루', input: '마루 신발 혼자 신음' },
  // ── 구어체 입력 ───────────────────────────────────────────────────
  { id: 'syn06', tag: 'colloquial', name: '바다', input: '바다가 오늘 블록으로 엄청 높게 쌓다가 무너졌는데 안 울고 다시 쌓더라' },
  { id: 'syn07', tag: 'colloquial', name: '사랑', input: '사랑이가 색종이 접다가 잘 안 되니까 계속 다시 접어봄' },
  { id: 'syn08', tag: 'colloquial', name: '아름', input: '아름이 오늘 처음 하는 가위질인데 망설이다가 해봄' },
  { id: 'syn09', tag: 'colloquial', name: '자두', input: '자두가 개미 보고 완전 신기해하면서 계속 살펴봄' },
  { id: 'syn10', tag: 'colloquial', name: '차니', input: '차니 정리시간에 자기 자리 스스로 치움' },
  // ── 직접 발화 ─────────────────────────────────────────────────────
  { id: 'syn11', tag: 'speech', name: '하늘', input: '하늘이가 "무지개 케이크 만들 거야"라며 점토를 겹겹이 쌓았다.' },
  { id: 'syn12', tag: 'speech', name: '보라', input: '보라가 "선생님 이것 봐요"라고 말하며 자신이 그린 그림을 들어 보였다.' },
  { id: 'syn13', tag: 'speech', name: '초록', input: '초록이가 "내가 먼저 해 볼래"라고 말하고 평균대에 올라갔다.' },
  { id: 'syn14', tag: 'speech', name: '노을', input: '노을이가 "물이 왜 없어졌어요?"라고 물어보았다.' },
  { id: 'syn15', tag: 'speech', name: '구름', input: '구름이가 노래를 부르며 "반짝반짝"이라고 손을 흔들었다.' },
  // ── 또래 상호작용 ─────────────────────────────────────────────────
  { id: 'syn16', tag: 'peer', name: '산들', input: '산들이가 친구에게 가위를 먼저 쓰라고 건네주었다.' },
  { id: 'syn17', tag: 'peer', name: '이슬', input: '이슬이가 친구와 번갈아 가며 블록을 하나씩 쌓았다.' },
  { id: 'syn18', tag: 'peer', name: '온유', input: '온유가 울고 있는 친구 옆에 앉아 휴지를 건네주었다.' },
  { id: 'syn19', tag: 'peer', name: '두리', input: '두리가 친구에게 "같이 기차 만들자"라고 말했다.' },
  { id: 'syn20', tag: 'peer', name: '누리', input: '누리가 역할놀이에서 친구와 손님과 주인 역할을 나누어 맡았다.' },
  // ── 감정 단서만(회복 없음 — 안정 창작 금지 검증) ───────────────────
  { id: 'syn21', tag: 'emotionOnly', name: '봄이', input: '봄이가 쌓던 탑이 무너지자 울음을 터뜨렸다.' },
  { id: 'syn22', tag: 'emotionOnly', name: '여름', input: '여름이가 바깥놀이가 끝나자 아쉬워하며 창밖을 보았다.' },
  { id: 'syn23', tag: 'emotionOnly', name: '가을', input: '가을이가 천둥소리에 깜짝 놀라 귀를 막았다.' },
  // ── 회복 단서 있음 ────────────────────────────────────────────────
  { id: 'syn24', tag: 'recovery', name: '겨울', input: '겨울이가 넘어져 울었지만 곧 진정하고 다시 뛰어갔다.' },
  { id: 'syn25', tag: 'recovery', name: '노아', input: '노아가 아침에 엄마와 헤어질 때 잠시 울었지만 곧 퍼즐 놀이에 집중했다.' },
  // ── 갈등·사과 ─────────────────────────────────────────────────────
  { id: 'syn26', tag: 'conflict', name: '도담', input: '도담이가 자동차를 두고 친구와 다투었지만 먼저 "미안해"라고 말했다.' },
  { id: 'syn27', tag: 'conflict', name: '로하', input: '로하가 친구와 부딪힌 뒤 화해하고 다시 같이 모래놀이를 했다.' },
  // ── 교사 지원 미입력 ──────────────────────────────────────────────
  { id: 'syn28', tag: 'noSupport', name: '미르', input: '미르가 화분에 물을 주고 잎을 한참 들여다보았다.' },
  { id: 'syn29', tag: 'noSupport', name: '벼리', input: '벼리가 그림책을 넘기며 혼자 조용히 읽었다.' },
  // ── 만들기·탐색·신체·일상 ─────────────────────────────────────────
  { id: 'syn30', tag: 'make', name: '소미', input: '소미가 상자와 병뚜껑으로 로봇을 만들어 팔을 붙였다.' },
  { id: 'syn31', tag: 'make', name: '아라', input: '아라가 점토를 길게 밀어 국수 가락을 만들었다.' },
  { id: 'syn32', tag: 'explore', name: '우주', input: '우주가 얼음이 녹아 물이 되는 것을 지켜보았다.' },
  { id: 'syn33', tag: 'explore', name: '은새', input: '은새가 자석에 붙는 것과 안 붙는 것을 나누어 보았다.' },
  { id: 'syn34', tag: 'move', name: '재이', input: '재이가 한 발로 서서 다섯을 셀 때까지 버텼다.' },
  { id: 'syn35', tag: 'move', name: '하람', input: '하람이가 공을 골대에 여러 번 던져 넣었다.' },
  { id: 'syn36', tag: 'daily', name: '태양', input: '태양이가 급식 후 식판을 스스로 정리대에 가져다 놓았다.' },
  { id: 'syn37', tag: 'daily', name: '푸름', input: '푸름이가 바깥놀이 후 손을 씻으며 비누 거품을 꼼꼼히 냈다.' },
  { id: 'syn38', tag: 'daily', name: '한별', input: '한별이가 낮잠 전에 자기 이불을 펴고 인형을 옆에 두었다.' },
  // ── 복합 신호 ─────────────────────────────────────────────────────
  { id: 'syn39', tag: 'multi', name: '해솔', input: '해솔이가 블록 탑이 무너지자 다시 쌓으며 친구에게 "같이 하자"라고 말했다.' },
  { id: 'syn40', tag: 'multi', name: '결', input: '결이가 나뭇잎을 주워 크기 순서대로 늘어놓고 "이게 제일 커요"라고 말했다.' },
  { id: 'syn41', tag: 'multi', name: '단비', input: '단비가 물감을 섞다가 색이 변하자 "왜 초록색이 됐어요?"라고 물었다.' },
  { id: 'syn42', tag: 'multi', name: '라온', input: '라온이가 처음 타는 자전거를 망설이다가 페달을 밟고 "된다!"라고 외쳤다.' },
  { id: 'syn43', tag: 'multi', name: '모아', input: '모아가 종이를 접다가 잘 안 되자 다시 펴서 천천히 접고 완성한 배를 물에 띄웠다.' },
  // ── 입력 근거가 거의 없는 사례(보수적 폴백 기대) ────────────────────
  { id: 'syn44', tag: 'sparse', name: '난', input: '난이가 오늘 등원했다.' },
  { id: 'syn45', tag: 'sparse', name: '들', input: '들이가 교실에 있었다.' },
  { id: 'syn46', tag: 'sparse', name: '숲', input: '숲이 오전 자유놀이를 했다.' },
  // ── 금지 표현 위험(과장 유도 입력) ─────────────────────────────────
  { id: 'syn47', tag: 'riskBanned', name: '빛나', input: '빛나가 어려운 퍼즐을 혼자 다 맞췄다.' },
  { id: 'syn48', tag: 'riskBanned', name: '슬기', input: '슬기가 새로 온 친구를 도와 사물함 위치를 알려 주었다.' },
  { id: 'syn49', tag: 'riskBanned', name: '지혜', input: '지혜가 그림을 아주 세밀하게 그렸다.' },
  // ── 결정론 검증(같은 입력 반복) ────────────────────────────────────
  { id: 'syn50', tag: 'deterministic', name: '한결', input: '한결이가 블록으로 다리를 만들고 자동차를 지나가게 했다.' },
  { id: 'syn51', tag: 'deterministic', name: '한결', input: '한결이가 블록으로 다리를 만들고 자동차를 지나가게 했다.' },
  // ── 추가 변별 사례 ─────────────────────────────────────────────────
  { id: 'syn52', tag: 'speech', name: '윤슬', input: '윤슬이가 인형에게 "코 자자"라고 말하며 이불을 덮어 주었다.' },
  { id: 'syn53', tag: 'peer', name: '아침', input: '아침이가 간식 시간에 친구 컵을 함께 나눠 주었다.' },
  { id: 'syn54', tag: 'colloquial', name: '보름', input: '보름이 미끄럼틀 차례 기다렸다가 탐, 새치기 안 함' },
  { id: 'syn55', tag: 'multi', name: '새벽', input: '새벽이가 돋보기로 달팽이를 관찰하며 "집을 지고 다녀요"라고 설명했다.' },
];

export default SYNTHETIC_CASES;
