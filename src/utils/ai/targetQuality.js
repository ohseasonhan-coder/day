// 목표 품질 평가기 — "안전 검수(observationAudit)"와 명확히 분리한다.
//
//   Safety Score        : observationAudit.pasteScore — 사실 추가·발화 손실·금지표현·이름 오류·낙인 등
//                         "안전·사실성" 위반이 없으면 100. (품질·자연스러움은 보장하지 않음)
//   Target Alignment    : v3 목표 문장과 비교한 "문서 품질"(개별성·근거성·역할 분리 등). 이 파일.
//   Copy-Ready Score    : 교사가 그대로 붙여넣을 수 있는 형식·완결성·자연스러움. 이 파일.
//
// 완전 문장 일치를 요구하지 않는다. 사실과 역할 구성이 적절하면 문장이 달라도 감점하지 않고,
// 안전하지만 일반적인(개별성 약한) 문장은 목표 대비 낮은 점수를 받도록 설계한다. 외부 호출 없음.

const clean = (s) => String(s || '').trim();

const STOP = new Set(['그리고', '하며', '하고', '에서', '으로', '하는', '있는', '있다', '보였다', '위해', '함께', '통해', '모습', '과정', '자신', '해', '더', '수', '것', '및']);
function tokens(s) {
  return String(s || '').replace(/[^가-힣\s]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/(은|는|이|가|을|를|에|의|와|과|도|로|으로|에서|에게|처럼|만큼|까지|부터|보다)$/, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}
function jaccardRecall(coreToks, textToks) {
  if (!coreToks.length) return 1;
  const set = new Set(textToks);
  const hit = coreToks.filter((t) => set.has(t) || textToks.some((x) => x.includes(t) || t.includes(x)));
  return hit.length / coreToks.length;
}

// 배움 읽기의 "근거 신호" — 목표/생성에서 각각 어떤 의미를 읽었는지 라벨로 분류
// (3단계: 생성기의 신호 확장에 맞춰 정서·도전/차례·규칙 범주 추가, 탐구·신체 어휘 보강)
const SIGNALS = [
  { key: '재시도·문제해결', re: /(다시|무너지|재시도|반복|끝까지|포기하지|해결|시도를 이어)/ },
  { key: '정서·도전', re: /(망설|낯설|낯선|도전|용기|격려|정서적 지지|안정|마음을 (표현|추스|다독))/ },
  { key: '차례·규칙', re: /(차례|순서와 규칙|규칙을)/ },
  { key: '표현·언어', re: /(말|이야기|설명|표현|노래|불렀|생각을|느낌을|소개|상상)/ },
  { key: '또래·관계', re: /(친구|또래|나누|양보|배려|함께하는|주고받|협력)/ },
  { key: '탐색·발견', re: /(탐색|탐구|관찰|살펴|비교|궁금|실험|발견|알아 가|분류|배열|변화)/ },
  { key: '자립·자조', re: /(스스로|자조|자립|정리|준비하는|혼자|해 보려|실천)/ },
  { key: '신체·조절', re: /(균형|힘을 조절|힘과 방향|협응|조절하|조절해|움직이|움직임|뛰|점프|기어|근육|대근육|소근육)/ },
  { key: '구성·표상', re: /(만들|구성|꾸미|모양|구조물|완성|표상|자기만의 방식|자신만의 방식)/ },
];
function signalsIn(text) {
  const t = String(text || '');
  return SIGNALS.filter((s) => s.re.test(t)).map((s) => s.key);
}

// 기계적·비개인화 패턴(자연스러움 감점 + 약한 패턴 집계용). 라벨은 리포트 상위 패턴에 그대로 노출.
const MECHANICAL = [
  ['활용하여', /활용하여/],
  ['발달 경험과 연결', /발달 경험과 연결|경험과 연결된다/],
  ['놀이에 참여하였다', /놀이에 참여하였다/],
  ['유아들은(반 전체)', /유아들은|아이들은 대체로|전반적으로 유아/],
  ['영역과 연결지어', /영역과 연결지어|영역과 연계하여/],
  ['~을 통해 발달', /을 통해 .{0,12}발달(을|시켰|하였)/],
  ['일반 참여 표현', /놀이에 즐겁게 참여|활동에 적극적으로 참여/],
];
function mechanicalHits(text) {
  return MECHANICAL.filter(([, re]) => re.test(String(text || ''))).map(([label]) => label);
}
const CLASSWIDE = /(유아들은|아이들은|또래들은|전반적으로|대체로 유아|여러 영역)/;
const SUPPORT_DONE = /(지원하였다|도와주었다|도와 주었다|제공하였다|격려하였다|마련해 주었다|해 주었다|이끌어 주었다)/;
// 계획 문형 = 현재형 종결(…ㄴ다/…는다/…다)로 끝나고 과거 단정이 아님(제공한다·돕는다·나눈다·기다린다 등)
const PAST_TAIL = /(았다|었다|였다|했다|하였다|보였다|졌다|웠다)["”']?\.?$/;
const DECL_TAIL = /[가-힣]다["”']?\.?$/;

function repeatedToken(text) {
  const t = tokens(text);
  const c = {};
  for (const w of t) { c[w] = (c[w] || 0) + 1; if (c[w] >= 3) return w; }
  return null;
}
function nearDuplicate(a, b) {
  const A = clean(a); const B = clean(b);
  if (!A || !B) return false;
  if (A === B || A.includes(B) || B.includes(A)) return true;
  const ta = tokens(A); const tb = new Set(tokens(B));
  if (!ta.length) return false;
  const inter = ta.filter((x) => tb.has(x)).length;
  return inter / ta.length >= 0.8;
}

// 목표 복사용(col7) 문자열 → 3섹션 분해. "관찰내용:" / "배움 읽기:" / "교사 지원 및 다음 계획:" 및 [대괄호] 형식 모두 처리.
export function parseTargetSections(text) {
  const t = String(text || '').replace(/\r/g, '');
  const grabKo = (labels) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:\\[${escaped}\\]|${escaped}\\s*[:：])\\s*([\\s\\S]*?)(?=(?:\\n?\\s*(?:\\[(?:관찰내용|배움 읽기|교사 지원 및 다음 계획)\\]|(?:관찰내용|배움 읽기|교사 지원 및 다음 계획)\\s*[:：]))|$)`);
      const m = t.match(re);
      if (m) return clean(m[1]);
    }
    return '';
  };
  const ko = {
    observation: grabKo(['관찰내용']),
    learning: grabKo(['배움 읽기', '배움읽기']),
    support: grabKo(['교사 지원 및 다음 계획', '교사 지원', '지원 계획', '다음 계획']),
  };
  if (ko.observation || ko.learning || ko.support) return ko;
  const grab = (labels) => {
    for (const label of labels) {
      const re = new RegExp(`(?:\\[${label}\\]|${label}\\s*[:：])\\s*([\\s\\S]*?)(?=(?:\\n?\\s*(?:\\[(?:관찰내용|배움 읽기|교사 지원[^\\]]*)\\]|(?:관찰내용|배움 읽기|교사 지원[^:：]*)\\s*[:：]))|$)`);
      const m = t.match(re);
      if (m) return clean(m[1]);
    }
    return '';
  };
  return {
    observation: grab(['관찰내용']),
    learning: grab(['배움 읽기', '배움읽기']),
    support: grab(['교사 지원 및 다음 계획', '교사 지원', '지원 및 다음 계획']),
  };
}

// 목표 대비 정렬 점수. 반환: { score, dimensions, reasons }
export function scoreTargetAlignment({ input = '', gen = {}, target = {} } = {}) {
  const inputCore = tokens(input);
  const genObs = clean(gen.observation);
  const genLearn = clean(gen.learning);
  const genSup = clean(gen.support);
  const tgtLearn = clean(target.learning);
  const reasons = [];
  const D = {};

  // 1) 관찰내용: 입력 핵심 사실 유지
  D.factCore = Math.min(1, jaccardRecall(inputCore, tokens(genObs)));
  if (D.factCore < 0.6) reasons.push('관찰내용이 입력의 핵심 행동·상황 일부를 담지 못함');

  // 2) 배움 읽기: 개별 행동에 근거해 해석(목표의 의미 신호와 연결)
  const tgtSig = signalsIn(tgtLearn);
  const genSig = signalsIn(genLearn);
  if (genSig.length && tgtSig.length && genSig.some((s) => tgtSig.includes(s))) D.learningGrounded = 1;
  else if (genSig.length) D.learningGrounded = 0.7;
  else { D.learningGrounded = 0.3; reasons.push(tgtSig.length ? `목표에는 '${tgtSig[0]}' 의미가 있으나 생성 결과는 일반 표현에 그침` : '배움 읽기가 행동 근거 없이 일반적임'); }

  // 3) 배움 읽기: 반 전체 평가/영역 나열로 후퇴하지 않음
  D.notClassWide = CLASSWIDE.test(genLearn) ? 0 : 1;
  if (!D.notClassWide) reasons.push('배움 읽기가 반 전체 평가·영역 나열 문체로 후퇴함');

  // 4) 교사 지원 및 다음 계획: 실제 지원 단정 없이 "계획"(현재형) 역할 유지
  let sp = 1;
  if (SUPPORT_DONE.test(genSup) || PAST_TAIL.test(genSup)) { sp -= 0.6; reasons.push('교사 지원이 이미 제공된 것처럼 과거형으로 단정됨(계획 문체 아님)'); }
  else if (genSup && !DECL_TAIL.test(genSup)) { sp -= 0.3; reasons.push('교사 지원이 문장으로 끝맺지 않음'); }
  D.supportPlanSep = Math.max(0, sp);

  // 5) 문장 반복
  const rep = repeatedToken(`${genLearn} ${genSup}`);
  D.repetition = rep ? 0 : 1;
  if (rep) reasons.push(`같은 표현이 과도하게 반복됨: '${rep}'`);

  // 6) 개인화(원아 중심)
  D.personalization = CLASSWIDE.test(genLearn) ? 0 : (/유아는/.test(genLearn) && !clean(gen.childName) ? 0.6 : 1);
  if (D.personalization < 1) reasons.push('원아 중심 개인화가 약함(일반 주어)');

  // 7) 표현 자연스러움(기계적 패턴)
  const mech = [...mechanicalHits(genLearn), ...mechanicalHits(genSup), ...mechanicalHits(genObs)];
  D.naturalness = mech.length ? Math.max(0, 1 - 0.5 * mech.length) : 1;
  if (mech.length) reasons.push(`기계적 표현 잔존: ${[...new Set(mech)].join(', ')}`);

  // 8) 길이 적절성(복붙 가능 범위) — 목표 총길이 대비
  const genLen = (genObs + genLearn + genSup).length;
  const tgtLen = (clean(target.observation) + tgtLearn + clean(target.support)).length || genLen;
  const ratio = tgtLen ? genLen / tgtLen : 1;
  if (ratio < 0.45) { D.lengthFit = 0.4; reasons.push('생성 결과가 목표보다 지나치게 짧아 사실이 빠질 수 있음'); }
  else if (ratio > 1.9) { D.lengthFit = 0.6; reasons.push('생성 결과가 목표보다 길어 복붙이 번거로움'); }
  else D.lengthFit = 1;

  // 9) 섹션 역할 분리(같은 말 반복 금지)
  const dup = nearDuplicate(genObs, genLearn) || nearDuplicate(genLearn, genSup) || nearDuplicate(genObs, genSup);
  D.sectionRoleSep = dup ? 0 : 1;
  if (dup) reasons.push('관찰내용·배움 읽기·지원 계획이 서로 같은 말을 반복함');

  const W = { factCore: 0.18, learningGrounded: 0.20, notClassWide: 0.12, supportPlanSep: 0.12, repetition: 0.08, personalization: 0.10, naturalness: 0.10, lengthFit: 0.05, sectionRoleSep: 0.05 };
  const score = Math.round(100 * Object.keys(W).reduce((s, k) => s + W[k] * (D[k] ?? 0), 0));
  return { score, dimensions: D, reasons };
}

// 복붙 적합성(형식·완결성·자연스러움). Safety/TargetAlignment와 별도 축.
export function scoreCopyReady({ observation = '', learning = '', support = '' } = {}) {
  const secs = [observation, learning, support].map(clean);
  const reasons = [];
  const present = secs.filter(Boolean).length;
  const format = present / 3;
  if (present < 3) reasons.push('세 섹션(관찰내용/배움 읽기/교사 지원) 중 일부가 비어 있음');
  const complete = secs.filter((s) => s && /[.!?]["”']?$/.test(s)).length / (present || 1);
  if (complete < 1) reasons.push('일부 섹션이 종결부호로 끝나지 않아 문장 완결성이 부족함');
  const mech = secs.flatMap((s) => mechanicalHits(s));
  const natural = mech.length ? Math.max(0, 1 - 0.4 * mech.length) : 1;
  if (mech.length) reasons.push(`기계적 표현으로 다듬기 필요: ${[...new Set(mech)].join(', ')}`);
  const total = secs.join(' ').length;
  const pasteFit = total > 420 ? 0.6 : total < 40 ? 0.4 : 1;
  if (pasteFit < 1) reasons.push(total > 420 ? '전체 길이가 길어 복붙이 번거로움' : '전체 길이가 짧아 내용이 부족함');
  const W = { format: 0.35, complete: 0.25, natural: 0.25, pasteFit: 0.15 };
  const score = Math.round(100 * (W.format * format + W.complete * complete + W.natural * natural + W.pasteFit * pasteFit));
  return { score, dimensions: { format, complete, natural, pasteFit }, reasons };
}

export { signalsIn, mechanicalHits };
export default scoreTargetAlignment;
