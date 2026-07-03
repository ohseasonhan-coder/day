// 복사용 관찰일지 자동 검수 — qualityScorer(점수)와 별개로, "교사가 그대로 붙여넣어도 되는가"를
// 항목별로 점검하고, 실패 사유를 사람이 읽을 수 있는 형태로 돌려준다.
// 심각도(minor/major)로 나누어 생성 흐름의 폴백 판단에 쓴다. (점수 구조를 바꾸지 않는다.)

const clean = (s) => String(s || '').trim();

// 배움 읽기에서 나오면 안 되는 기계적·비개인화·영역 나열식 표현
const BANNED_LEARNING = [
  ['유아들은', /유아들은/],
  ['활용하여', /활용하여/],
  ['놀이에 참여하였다', /놀이에 참여하였다/],
  ['발달 경험과 연결된다', /발달 경험과 연결된다/],
  ['영역과 연결지어 볼 수 있다', /영역과 연결지어 볼 수 있다/],
];
const NEGATIVE_DIAGNOSTIC = /(부족하다|부족한|못한다|못했다|뒤떨어|뒤처|산만|문제가 있|문제를 보|느리다|미흡|서투르|장애|의심)/;
// support가 "이미 제공된 지원"으로 단정하는 과거형(계획이어야 함)
const SUPPORT_DONE = /(지원하였|지원했|도와주었|도와 주었|제공하였|제공했|격려하였|격려했|마련해 주었|해 주었|이끌어 주었|계획하였|계획했|활용하였|기회를 얻었)/;

const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);
const endsProperly = (s) => /[.!?]["”']?$/.test(clean(s));
const hasPeerWord = (s) => /(친구|또래|함께|같이|서로)/.test(String(s));

const MAJOR = new Set(['speech_lost', 'fact_addition_peer', 'fact_addition_speech', 'negative_or_diagnostic', 'support_asserts_done', 'josa_error']);

function messageFor(code, extra) {
  switch (code) {
    case 'speech_lost': return '발화가 결과에서 누락됨';
    case 'banned_phrase': return `금지 표현: ${(extra || []).map((x) => `'${x}'`).join(', ')}`;
    case 'learning_repeats_observation': return '배움 읽기가 관찰내용을 그대로 반복함';
    case 'negative_or_diagnostic': return '부정적 낙인·진단성 표현 감지';
    case 'fact_addition_peer': return '입력에 없는 또래 상호작용 표현 감지';
    case 'fact_addition_speech': return '입력에 없는 발화(따옴표) 추가 감지';
    case 'support_asserts_done': return '교사 지원이 실제 제공된 것처럼 단정됨';
    case 'josa_error': return '이름·조사 처리 오류';
    case 'low_personalization': return '배움 읽기에 원아 개인화가 약함(이름 미반영)';
    case 'mechanical_repetition': return `기계적 반복 표현: '${extra}'`;
    case 'incomplete_observation': return '관찰내용 문장 완결성 부족(종결부호)';
    case 'incomplete_learning': return '배움 읽기 문장 완결성 부족(종결부호)';
    case 'incomplete_support': return '교사 지원 및 다음 계획 문장 완결성 부족(종결부호)';
    default: return code;
  }
}

// 반환: { ok, severity, warnings:[code], details:[{code,message,severity}], pasteScore, metrics }
export function auditObservationCopy({ input = '', observation = '', learning = '', support = '', childName = '' } = {}) {
  const codes = [];
  const details = [];
  const obs = clean(observation);
  const learn = clean(learning);
  const sup = clean(support);
  const push = (code, extra) => {
    if (codes.includes(code)) return;
    codes.push(code);
    details.push({ code, message: messageFor(code, extra), severity: MAJOR.has(code) ? 'major' : 'minor' });
  };

  // 1) 직접 발화 보존: 입력 따옴표 속 아이 말이 관찰내용에 그대로 있어야 함
  const inQuotes = quotesOf(input);
  if (inQuotes.length && !inQuotes.every((q) => obs.includes(q))) push('speech_lost');

  // 2) 입력에 없는 사실 추가 — 또래/발화
  if (hasPeerWord(learn) && !hasPeerWord(input)) push('fact_addition_peer');
  const learnQuotes = quotesOf(learn).filter((q) => !inQuotes.includes(q));
  if (learnQuotes.length) push('fact_addition_speech');

  // 3) 금지(기계적/비개인화/영역 나열) 표현
  const bannedHits = BANNED_LEARNING.filter(([, re]) => re.test(learn)).map(([label]) => label);
  if (bannedHits.length) push('banned_phrase', bannedHits);

  // 4) 관찰내용과 배움 읽기의 연결성(그대로 반복 금지)
  if (learn && obs && (learn === obs || obs.includes(learn) || learn.includes(obs))) push('learning_repeats_observation');

  // 5) 부정적 낙인·진단
  if (NEGATIVE_DIAGNOSTIC.test(learn) || NEGATIVE_DIAGNOSTIC.test(sup)) push('negative_or_diagnostic');

  // 6) 교사 지원과 다음 계획: 실제 지원처럼 단정(과거형) 금지 — 계획 문체 유지
  if (SUPPORT_DONE.test(sup)) push('support_asserts_done');

  // 7) 개인화 수준: 이름이 있는데 배움 읽기에 반영 안 됨
  const n = clean(childName);
  if (n && n !== '유아' && learn && !learn.includes(n)) push('low_personalization');

  // 8) 이름·조사 오류(받침 없는 이름+'은' / 받침 이름+'는')
  if (n && n !== '유아') {
    const last = n.charCodeAt(n.length - 1);
    const batchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
    const wrong = batchim ? new RegExp(`${n}는(?![가-힣])`) : new RegExp(`${n}은(?![가-힣])`);
    if (wrong.test(learn)) push('josa_error');
  }

  // 9) 기계적 반복(같은 2글자+ 토큰이 한 문장에 3회 이상)
  const rep = detectRepetition(learn);
  if (rep) push('mechanical_repetition', rep);

  // 10) 문장 완결성
  if (obs && !endsProperly(obs)) push('incomplete_observation');
  if (learn && !endsProperly(learn)) push('incomplete_learning');
  if (sup && !endsProperly(sup)) push('incomplete_support');

  const severity = codes.some((c) => MAJOR.has(c)) ? 'major' : (codes.length ? 'minor' : 'none');
  const majorN = details.filter((d) => d.severity === 'major').length;
  const minorN = details.filter((d) => d.severity === 'minor').length;
  const pasteScore = Math.max(0, 100 - majorN * 25 - minorN * 8);

  return {
    ok: codes.length === 0,
    severity,
    warnings: codes,
    details,
    pasteScore,
    metrics: {
      factPreserved: !codes.includes('fact_addition_peer') && !codes.includes('fact_addition_speech') && !codes.includes('speech_lost'),
      speechPreserved: !codes.includes('speech_lost') && !codes.includes('fact_addition_speech'),
      obsLearningLinked: !codes.includes('learning_repeats_observation') && !!learn,
      supportPlanLinked: !codes.includes('support_asserts_done') && !!sup,
      personalized: !codes.includes('low_personalization'),
      noBanned: !codes.includes('banned_phrase'),
      complete: !['incomplete_observation', 'incomplete_learning', 'incomplete_support'].some((c) => codes.includes(c)),
    },
  };
}

function detectRepetition(text) {
  const tokens = String(text).replace(/[^가-힣\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
  const count = {};
  for (const w of tokens) { count[w] = (count[w] || 0) + 1; if (count[w] >= 3) return w; }
  return null;
}

export default auditObservationCopy;
