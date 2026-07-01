// 복사용 관찰일지 자동 검수 — qualityScorer(점수)와 별개로, "교사가 그대로 붙여넣어도 되는가"를
// 항목별로 점검한다. 실패 원인을 코드로 돌려주어 재생성/폴백 판단에 쓸 수 있게 한다.
// (점수 구조를 바꾸지 않는다. 사실 보존을 최우선으로 본다.)

const clean = (s) => String(s || '').trim();

// 배움 읽기에서 나오면 안 되는 기계적·비개인화·영역 나열식 표현
const BANNED_LEARNING = [
  /유아들은/,
  /활용하여\s*놀이에 참여하였다/,
  /발달 경험과 연결된다/,
  /영역과 연결지어 볼 수 있다$/,
];
// 부정적 낙인·진단성 표현(관찰일지에 부적절)
const NEGATIVE_DIAGNOSTIC = /(부족하다|부족한|못한다|못했다|뒤떨어|뒤처|산만|문제가 있|문제를 보|느리다|미흡|서투르|장애|의심)/;

function quotesOf(s) {
  return Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}
function endsProperly(s) {
  return /[.!?]["”']?$/.test(clean(s));
}

// 반환: { ok, warnings } — warnings 코드 목록(없으면 통과)
export function auditObservationCopy({ input = '', observation = '', learning = '', support = '', childName = '' } = {}) {
  const warnings = [];
  const obs = clean(observation);
  const learn = clean(learning);
  const sup = clean(support);

  // 1) 직접 발화 보존: 입력 따옴표 속 아이 말이 관찰내용에 그대로 있어야 함
  const quotes = quotesOf(input);
  if (quotes.length && !quotes.every((q) => obs.includes(q))) warnings.push('speech_lost');

  // 2) 기계적/비개인화/영역 나열식 표현
  if (BANNED_LEARNING.some((re) => re.test(learn))) warnings.push('banned_phrase');

  // 3) 배움 읽기가 관찰내용을 그대로 반복
  if (learn && obs && (learn === obs || obs.includes(learn) || learn.includes(obs))) warnings.push('learning_repeats_observation');

  // 4) 부정적 낙인·진단성 표현
  if (NEGATIVE_DIAGNOSTIC.test(learn) || NEGATIVE_DIAGNOSTIC.test(sup)) warnings.push('negative_or_diagnostic');

  // 5) 문장 완결성(복붙 문서로서 종결부호)
  [['observation', obs], ['learning', learn], ['support', sup]].forEach(([k, v]) => {
    if (v && !endsProperly(v)) warnings.push(`incomplete_${k}`);
  });

  // 6) 이름 사용 시 조사 오류 흔한 형태(예: 받침 없는 이름 + '은'/받침 이름 + '는')
  const n = clean(childName);
  if (n && n !== '유아') {
    const last = n.charCodeAt(n.length - 1);
    const batchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
    const wrong = batchim ? new RegExp(`${n}는(?![가-힣])`) : new RegExp(`${n}은(?![가-힣])`);
    if (wrong.test(learn)) warnings.push('josa_error');
  }

  return { ok: warnings.length === 0, warnings: [...new Set(warnings)] };
}

export default auditObservationCopy;
