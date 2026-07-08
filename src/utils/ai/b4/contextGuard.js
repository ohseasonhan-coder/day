// 문서 맥락 의미 오염 차단 가드(B4 안전 계층) — 원문에 없는 의미·화자 교체·맥락 불일치 차단.
//
// 차단 코드:
//   unsupported_topic                — factCard/eventGraph에 근거 없는 주제(놀이 참여·즐거움·격려·능력 향상 등)
//   actor_role_mismatch              — 화자·행동 주체 교체(교사 질문→원아 발화, 타인 울음→대상 감정 등)
//   unsupported_resolution           — 사과·울음·대답만으로 관계 회복·감정 조절 성공·능력 발달 생성
//   document_context_mismatch        — 상황과 무관한 평가·교육과정 연결(하원 갈등→놀이 참여 등)
//   curriculum_mapping_without_evidence — 원문 근거 없는 누리과정 자동 연결(보류 상태로 전환)
//   target_child_required            — 다인 등장 알림장에서 대상 원아 미지정
//
// trace에는 비식별 코드만 남긴다(원문·이름·발화·생성 전문 저장 금지).
import { getChildren } from '../../storage';
import {
  detectChildcareDomainTerms,
  detectDomainTermMisreads,
  detectEpisodeMixing,
  removeOtherChildNames,
  safeEpisodeTrace,
  segmentChildcareEpisodes,
} from './childcareDomainGuard';

const clean = (s) => String(s || '').trim();

// ── 상황 유형 판정(사례 A/B) ───────────────────────────────────────────────
const SITUATION_PATTERNS = {
  // 사례 A — 전이·갈등
  transition_or_dismissal: /(하원|등원 준비|줄을 서|줄 서|이름을 부르|전이 시간|정리 시간|대기)/,
  peer_conflict: /(다투|다툼|싸우|밀치|빼앗|가로막|막았|뿌리치|던지며 화|토라)/,
  physical_contact: /(입을 (가로)?막|밀치|잡아당기|손을 뿌리치|몸으로 막|부딪)/,
  help_request: /(선생님[!,~ ]*선생님|도와주세요|선생님을 (부르|불렀)|교사를 (부르|불렀))/,
  apology_speech: /(미안(하다|해)|사과(했|를 하))/,
  crying_or_emotion_signal: /(눈물|울음|울면서|울었|훌쩍|흐느)/,
  // 사례 B — 시범·신체 활동 안내
  teacher_question: /(교사|선생님)[^.]{0,60}?(물었|묻자|질문|묻는다|라고 묻)/,
  child_explanation: /(라고 (대답|답)|설명(을|하)|방법을 말)/,
  movement_strategy_statement: /(균형을 잡|한\s?발씩|천천히 걸|건너가|팔을 벌리)/,
  demonstration_request: /(시범을 보여|시범을 보일|나와서.{0,10}보여)/,
  child_agreement: /["“']네["”'](라고|하고|라며)? (대답|답|답한)/,
  child_demonstration: /(시범을 보인|시범을 보였|앞에 나와)/,
  physical_activity_instruction: /(평균대|매트|체육|신체 활동|건너는 방법|안전하게 (걷|이동))/,
};
export function detectSituationTypes(input) {
  const src = clean(input);
  return Object.entries(SITUATION_PATTERNS).filter(([, re]) => re.test(src)).map(([k]) => k);
}
const CONFLICT_SET = ['transition_or_dismissal', 'peer_conflict', 'physical_contact', 'apology_speech', 'crying_or_emotion_signal', 'help_request'];
const DEMO_SET = ['teacher_question', 'demonstration_request', 'child_demonstration', 'physical_activity_instruction', 'movement_strategy_statement', 'child_agreement'];
export const situationClass = (situations) => ({
  conflict: situations.some((s) => CONFLICT_SET.includes(s)) && situations.some((s) => ['peer_conflict', 'physical_contact', 'apology_speech', 'crying_or_emotion_signal'].includes(s)),
  demo: situations.some((s) => DEMO_SET.includes(s)) && situations.includes('teacher_question'),
});

// ── 주제 사전(unsupported_topic) — evidence 정규식이 원문에 있으면 허용 ─────
const TOPICS = [
  ['playParticipation', /(놀이에[^.]{0,8}참여|놀이 참여|활동에[^.]{0,8}참여)/, /(놀이|장난감을 가지고 놀|블록|역할놀이)/],
  ['activityEngagement', /((활동|놀이) 참여가[^.]{0,8}편안|안정적으로 참여|편안하게 참여)/, null],
  ['enjoyment', /(즐거워|즐겁게|즐거움|재미있어|신나)/, /(즐거워|웃|재미있|신나)/],
  ['immersion', /(몰입|집중하며 빠져|푹 빠져)/, /(몰입|집중)/],
  ['selfDirected', /(자기\s?주도|스스로 이끌|주도적으로)/, /(스스로|혼자서)/],
  ['teacherEncouragement', /(교사(가|의) (격려|칭찬)|격려(하였|했|를 받)|칭찬(하였|했))/, /(격려|칭찬)/],
  ['teacherEnvironmentSupport', /((안전한|충분한) (환경|공간)을 (마련|제공|조성)(하였|했|해 주었|하고)|충분히 움직일 수 있는( 놀이)? (환경|공간)|공간을 (마련|제공)(하여|해 주었)|차례를 (지키도록 )?안내하였|안전지도(를)? (하였|했|완료)|마련해 주는 지원|지원을 통해[^.]{0,25}도왔)/, /(마련해 주었|공간을 제공했|환경을 준비했)/],
  ['curriculumConnection', /((누리과정|표준보육과정|교육과정)[^.]{0,40}(연결|연계)|「[^」]{4,40}」[^.]{0,20}(연결|연계|이어))/, null],
  ['diseasePrevention', /(질병(을)? 예방|건강 습관|병을 예방)/, /(씻|병원|감기|아프|약|양치)/],
  ['peerHelping', /(친구를 도와|도움을 주(었|며)|도와주(었|며))/, /(도와주|도움을 주|건네주)/],
  ['peerComforting', /(친구를 위로|위로(하였|했|해 주)|다독여 주)/, /(위로|안아 주|토닥)/],
  ['emotionalRecovery', /(안정을 (찾|되찾)|마음을 가라앉히|진정(하였|했))/, /(안정을 찾|진정|괜찮아졌)/],
  ['relationshipResolved', /(관계(가|를) 회복|화해(하였|했|를 하)|갈등이 해결|사이가 좋아졌)/, /(화해했|화해하고)/],
  ['abilityGrowth', /((대근육|소근육|신체 조절|운동|균형) (능력|감각)[^.]{0,8}(자라|자랐|자랄|향상|발달|늘)|능력이 (자람|자랐|자랄|향상|발달|늘)|발달(하였|했|이 이루어))/, null],
  ['turnTaking', /(차례(를)?\s?(지키|기다리)|차례 지키기|순서(를)?\s?지키)/, /(차례|순서)/],
  ['lookAroundClaim', /(주변을 천천히 살(펴|피)|천천히 살펴보(는|며) 모습)/, /(살펴|살피|둘러보)/],
  ['interestClaim', /(에 관심을 보(이|였)|관심을 보이며)/, /(관심|궁금|다가가|들여다보|살펴)/],
  ['homePlayRequest', /(가정에서도[^.]{0,25}(놀이|몸놀이|활동)[^.]{0,15}(즐겨|함께 해|해 주세요|해주세요))/, null],
  ['generalization', /(유아들은|아이들은 (모두|다같이)|유아들이)/, null],
];
export function detectUnsupportedTopics(text, input) {
  const t = clean(text); const src = clean(input);
  return TOPICS.filter(([, pat, evidence]) => pat.test(t) && !(evidence && evidence.test(src))).map(([id]) => id);
}

// ── unsupported_resolution(확대 해석) ─────────────────────────────────────
const RESOLUTION = [
  [/(관계(가|를) 회복|화해로 이어|갈등이 (해결|마무리)|잘 마무리되었)/, /(화해했|화해하고)/],
  [/(감정 조절(에 성공|을 잘|능력)|스스로 감정을 다스)/, null],
  [/(자신감(이 (생겼|높아|자랐)|을 얻)|자신감 있게)/, null],
  [/((능력|실력)이 (발달|향상|자람|자랐)|성장하였)/, null],
  [/(중재(를)? 완료|중재하여|갈등을 마무리)/, null],
];
export function detectUnsupportedResolution(text, input) {
  const t = clean(text); const src = clean(input);
  return RESOLUTION.some(([pat, evidence]) => pat.test(t) && !(evidence && evidence.test(src)));
}

// ── 화자·행동 주체 보존 ────────────────────────────────────────────────────
// 원문에서 각 발화의 화자(교사/원아)를 추정하고, 생성문에서 화자가 바뀌면 차단.
export function speakerQuoteMap(input) {
  const src = clean(input);
  const map = [];
  const re = /["“']([^"”']+)["”']/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const before = src.slice(Math.max(0, m.index - 30), m.index);
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 20);
    const ctx = before + ' ' + after;
    const teacher = /(교사|선생님)(가|이|께서)?[^가-힣]{0,6}$/.test(before) || /(교사|선생님)/.test(before.slice(-14)) || (/묻자|질문/.test(after) && /(교사|선생님)/.test(before));
    const childM = before.match(/([가-힣]{2,3})(이가|가|이는|는)\s*[^가-힣]*$/);
    map.push({ quote: m[1], speaker: teacher && !(childM && !/교사|선생님/.test(before.slice(-10))) ? 'teacher' : (childM ? childM[1] : (teacher ? 'teacher' : 'unknown')), ctx: ctx.slice(0, 10) });
  }
  return map;
}

export function checkActorRoles(input, text) {
  const t = clean(text);
  if (!t) return [];
  const inputMap = speakerQuoteMap(input);
  const outMap = speakerQuoteMap(t);
  const codes = [];
  outMap.forEach((o) => {
    const src = inputMap.find((i) => i.quote === o.quote || i.quote.includes(o.quote) || o.quote.includes(i.quote));
    if (!src) return;
    const srcIsTeacher = src.speaker === 'teacher';
    const outIsTeacher = o.speaker === 'teacher';
    if (src.speaker === 'unknown' || o.speaker === 'unknown') return;
    if (srcIsTeacher !== outIsTeacher) codes.push('actor_role_mismatch');
    else if (!srcIsTeacher && !outIsTeacher && src.speaker !== o.speaker) codes.push('actor_role_mismatch'); // 원아 간 화자 교체
  });
  return [...new Set(codes)];
}

// 타인의 울음·행동을 대상 원아의 것으로 돌리는 오류(대상 원아 문서용)
export function checkEmotionOwnership(input, text, targetChild) {
  const src = clean(input).replace(/["“'][^"”']*["”']/g, ''); // 발화 제거 후 화자-감정 근접 판정
  const t = clean(text);
  if (!targetChild || !t) return false;
  let crier = null;
  // 울음 토큰 "직전의 마지막" 이름을 화자로 본다(근접 오귀속 방지 — 같은 문장에 여러 이름이 있을 때)
  const cryIdx = src.search(/눈물|울음|울었|운다/);
  if (cryIdx >= 0) {
    const sentenceStart = Math.max(src.lastIndexOf('.', cryIdx), 0);
    const before = src.slice(sentenceStart, cryIdx);
    const names = [...before.matchAll(/([가-힣]{2,3})(이가|이|가)(?=[\s"“',.!?])/g)].map((m) => m[1])
      .filter((n) => !/(교사|선생님|친구들|아이들|유아들)/.test(n));
    if (names.length) crier = names[names.length - 1];
  }
  if (!crier && /(우는|울고 있는) 친구/.test(src)) crier = '친구';
  if (!crier || crier === targetChild) return false;
  // 원문에서 운 사람 ≠ 대상인데, 생성문이 대상 원아에게 울음·눈물·속상을 붙이면 차단
  return new RegExp(`${targetChild}[^.]{0,25}(눈물|울음|울었|속상)`).test(t);
}

// ── 문서 유형·상황 조합 차단(document_context_mismatch) ────────────────────
const CONTEXT_BLOCK = {
  conflict: ['playParticipation', 'activityEngagement', 'enjoyment', 'immersion', 'selfDirected', 'curriculumConnection', 'peerComforting', 'peerHelping', 'relationshipResolved', 'emotionalRecovery', 'teacherEncouragement', 'generalization'],
  demo: ['diseasePrevention', 'enjoyment', 'immersion', 'abilityGrowth', 'teacherEnvironmentSupport', 'teacherEncouragement', 'turnTaking', 'curriculumConnection', 'generalization', 'playParticipation', 'activityEngagement'],
};

// 텍스트 하나를 검사. 반환: { ok, codes[], blockedTopics[] }
export function guardText({ text, input, situations = null, targetChild = '' } = {}) {
  const sits = situations || detectSituationTypes(input);
  const cls = situationClass(sits);
  const codes = [];
  const topics = detectUnsupportedTopics(text, input);
  const domainGuard = detectDomainTermMisreads({ input, text });
  const episodeGuard = detectEpisodeMixing({ input, text, targetChild, knownNames: knownChildNames() });
  const activeBlock = [
    ...(cls.conflict ? CONTEXT_BLOCK.conflict : []),
    ...(cls.demo ? CONTEXT_BLOCK.demo : []),
  ];
  const contextHits = topics.filter((id) => activeBlock.includes(id));
  // 공통 원칙: 아래 주제는 어떤 상황이든 원문 근거(evidence) 없이는 금지(검출은 전역, 문서 치환은 갈등·시범 맥락에서만)
  const genericHits = topics; // detectUnsupportedTopics가 이미 evidence 면제를 반영
  const blockedTopics = [...new Set([...contextHits, ...genericHits])];
  if (contextHits.length) codes.push('document_context_mismatch');
  if (blockedTopics.length) codes.push('unsupported_topic');
  if (detectUnsupportedResolution(text, input)) codes.push('unsupported_resolution');
  codes.push(...checkActorRoles(input, text));
  if (checkEmotionOwnership(input, text, targetChild)) codes.push('actor_role_mismatch');
  if (!domainGuard.ok) {
    codes.push(...domainGuard.codes);
    blockedTopics.push(...domainGuard.blockedTopics);
  }
  if (!episodeGuard.ok) {
    codes.push(...episodeGuard.codes);
    blockedTopics.push(...episodeGuard.blockedTopics);
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)], blockedTopics: [...new Set(blockedTopics)] };
}

// ── 보수적 대체 문장(허용 범위 내) ─────────────────────────────────────────
function topicOfName(name) {
  const n = clean(name); if (!n) return '유아는';
  const last = n.charCodeAt(n.length - 1);
  const batchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return n + (batchim ? '은' : '는');
}
export function conservativeEvaluation({ situations, input, childName }) {
  const cls = situationClass(situations);
  if (cls.conflict) {
    const where = situations.includes('transition_or_dismissal') ? '하원 준비 과정에서' : '함께 지내는 과정에서';
    return `${where} 유아 간 신체 접촉과 감정 표현이 나타났다. 손보다 말로 불편함을 표현하고, 친구의 말을 기다려 듣는 경험을 지원할 필요가 있다.`;
  }
  if (cls.demo) {
    const t = topicOfName(childName);
    return `${t} 평균대를 건너는 방법을 말로 설명하고, 자신이 말한 방법을 시범으로 보여 주었다. 몸의 움직임과 안전한 이동 방법을 연결해 보는 경험이 나타났다.`;
  }
  return '';
}
export function conservativeSupport({ situations }) {
  const cls = situationClass(situations);
  if (cls.conflict) {
    return '손으로 막기보다 "불편했어요", "선생님 도와주세요"처럼 말로 표현할 수 있도록 돕고, 하원 준비·대기 상황에서 친구의 말을 기다려 듣는 경험과 안전한 거리를 함께 안내한다.';
  }
  if (cls.demo) {
    return '평균대 위에서 양팔을 벌리고 한 발씩 천천히 걷는 방법을 다시 시도해 보고, 높이와 폭을 조절한 평균대 놀이로 이어 갈 수 있도록 지원한다.';
  }
  return '';
}
export function conservativeLearning({ situations, childName }) {
  const cls = situationClass(situations);
  const t = topicOfName(childName);
  if (cls.conflict) return `${t} 상황 속에서 자신의 마음과 필요를 말로 표현하였다.`;
  if (cls.demo) return `${t} 자신이 말한 방법을 몸으로 직접 보여 주며 생각과 행동을 연결하였다.`;
  return '';
}

function conservativeParentNotice() {
  return '오늘 관찰된 상황은 원에서 다시 살펴보며, 필요한 지원을 이어 가겠습니다.';
}

// 문장 단위 소독 — 오염 문장만 제거하고 사실 문장은 보존(전체 폴백은 최후 수단)
export function scrubSentences({ text, input, situations, targetChild = '' } = {}) {
  const t = clean(text);
  if (!t) return { text: '', removed: 0, codes: [] };
  const sentences = t.split(/(?<=[.!?다요][.!]?)\s+/).filter(Boolean);
  const kept = [];
  const codes = new Set();
  sentences.forEach((s) => {
    const g = guardText({ text: s, input, situations, targetChild });
    if (g.ok) kept.push(s);
    else g.codes.forEach((c) => codes.add(c));
  });
  return { text: kept.join(' ').trim(), removed: sentences.length - kept.length, codes: [...codes] };
}

// ── 알림장(부모 전달) 개인정보·사실 가드 ───────────────────────────────────
function knownChildNames() {
  try { return getChildren().map((c) => clean(c.name)).filter((n) => n.length >= 2); } catch { return []; }
}
function namesInInput(input) {
  const src = clean(input);
  const known = knownChildNames();
  const found = new Set(known.filter((n) => src.includes(n)));
  // 저장된 원아 외 휴리스틱(XX이가/가 형태) — 교사/선생님 제외
  Array.from(src.matchAll(/([가-힣]{2,3})(이가|가)\s/g)).forEach((m) => {
    if (!/(교사|선생님)/.test(m[1])) found.add(m[1]);
  });
  return [...found];
}

function stripGenericHomeRequest(text = '') {
  return clean(text)
    .split(/(?<=[.!?。])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map(clean)
    .filter((sentence) => sentence && !/(가정에서도|집에서도|부모님께서도|가정과\s*연계|함께\s*연습해\s*주세요|시도해\s*주세요|격려해\s*주세요|媛\?뺤뿉\?쒕룄)/.test(sentence))
    .join(' ')
    .trim();
}
export function guardParentNotice({ input, parent, childName } = {}) {
  const episodeGuard = detectEpisodeMixing({ input, text: parent, targetChild: clean(childName), knownNames: knownChildNames() });
  if (episodeGuard.codes?.includes('target_child_required')) {
    return { status: 'target_child_required', reason: 'multiple_children_detected', text: '', codes: ['target_child_required'] };
  }
  const others = namesInInput(input).filter((n) => n !== clean(childName));
  if (others.length >= 1 && !clean(childName)) {
    return { status: 'target_child_required', reason: 'multiple_children_detected', text: '', codes: ['target_child_required'] };
  }
  let text = removeOtherChildNames(parent, input, clean(childName), knownChildNames());
  // 다른 유아 이름 자동 비식별('친구')
  others.forEach((n) => { text = text.replace(new RegExp(`${n}(이가|가|이는|는|이의|의|이를|를|이|에게)?`, 'g'), (m) => m.replace(n, '친구').replace(/^친구이/, '친구')); });
  const g = guardText({ text, input, targetChild: clean(childName) });
  if (!g.ok && g.codes.includes('generic_home_request_without_source')) {
    const withoutHomeRequest = stripGenericHomeRequest(text);
    if (withoutHomeRequest) {
      const retry = guardText({ text: withoutHomeRequest, input, targetChild: clean(childName) });
      if (retry.ok || retry.codes.every((code) => code === 'generic_home_request_without_source')) {
        return { status: 'ok', text: withoutHomeRequest, codes: [], blockedTopics: [] };
      }
    }
  }
  return { status: g.ok ? 'ok' : 'sanitized', text: g.ok ? text : '', codes: g.codes, blockedTopics: g.blockedTopics };
}

// ── 누리과정 자동 연결 가드 ────────────────────────────────────────────────
const CURRICULUM_EVIDENCE = [
  [/질병|감기|병|건강|씻|양치/, /(질병|건강|씻|양치|아프)/],
];
export function guardCurriculumBasis({ input, curriculumBasis, situations = null } = {}) {
  if (!curriculumBasis) return { basis: null, status: 'ok' };
  const sits = situations || detectSituationTypes(input);
  const cls = situationClass(sits);
  const itemText = `${curriculumBasis.category || ''} ${curriculumBasis.item || ''}`;
  const domainTerms = detectChildcareDomainTerms(input);
  const unsupportedDomainMapping = domainTerms.length > 0 && /(신체|건강|안전|발달|능력|질병|자기\s*조절|누리과정|교육과정|보육과정)/.test(itemText);
  const diseaseLike = /(질병|건강 습관|예방)/.test(itemText);
  const noEvidence = CURRICULUM_EVIDENCE.some(([pat, ev]) => pat.test(itemText) && !ev.test(clean(input)));
  if ((cls.conflict || cls.demo) || (diseaseLike && noEvidence) || unsupportedDomainMapping) {
    return {
      basis: null,
      status: 'curriculum_mapping_required',
      reason: 'insufficient_curriculum_evidence',
      codes: ['curriculum_mapping_without_evidence', ...(unsupportedDomainMapping ? ['unsupported_curriculum_mapping'] : [])],
    };
  }
  return { basis: curriculumBasis, status: 'ok' };
}

// ── 통합 적용: processRecord 결과의 문서 필드 전체 소독 ─────────────────────
// 반환: { result(치환된 사본), trace } — trace에는 비식별 코드만.
export function applyContextGuard({ input = '', childName = '', result = {} } = {}) {
  const situations = detectSituationTypes(input);
  const episodeTrace = safeEpisodeTrace(segmentChildcareEpisodes({ input, targetChild: childName, knownNames: knownChildNames() }));
  const domainTerms = detectChildcareDomainTerms(input);
  const cls = situationClass(situations);
  const trace = { fallback: false, fallbackReason: '', blockedTopics: [], codes: [], situations, domainTermIds: domainTerms.map((term) => term.id), episodeTrace };
  const out = { ...result };
  if (episodeTrace.status === 'target_child_required') {
    out.parent = '';
    out.parentStatus = { status: 'target_child_required', reason: 'multiple_children_detected' };
    trace.codes.push('target_child_required');
    trace.blockedTopics.push('multiple_children_detected');
  }
  if (!cls.conflict && !cls.demo) {
    // 일반 상황: 전역 안전망만(관계 회복·누리과정 근거·화자 교체)
    const g = guardText({ text: `${out.evaluation || ''} ${out.parent || ''}`, input, situations, targetChild: childName });
    const cur = guardCurriculumBasis({ input, curriculumBasis: out.curriculumBasis, situations });
    if (cur.status !== 'ok') { out.curriculumBasis = null; out.curriculumStatus = { status: cur.status, reason: cur.reason }; trace.codes.push(...(cur.codes || [])); }
    if (!g.ok) trace.codes.push(...g.codes);
    trace.blockedTopics = g.blockedTopics || [];
    return { result: out, trace };
  }

  const record = (codes, topics) => { trace.codes.push(...codes); trace.blockedTopics.push(...(topics || [])); };
  // 문장 소독 우선(사실 문장 보존) → 남는 문장이 없으면 보수 대체
  const sanitizeField = (text, fallbackText) => {
    const g = guardText({ text, input, situations, targetChild: childName });
    if (g.ok) return text;
    record(g.codes, g.blockedTopics);
    const scrubbed = scrubSentences({ text, input, situations, targetChild: childName });
    return clean(scrubbed.text).length >= 12 ? scrubbed.text : fallbackText;
  };

  // 1) 보육일지 평가
  out.evaluation = sanitizeField(out.evaluation, conservativeEvaluation({ situations, input, childName }));

  // 2) 교사 지원계획
  out.support = sanitizeField(out.support, conservativeSupport({ situations }));

  // 3) 알림장
  const parentGuard = guardParentNotice({ input, parent: out.parent, childName });
  if (parentGuard.status === 'target_child_required') {
    out.parent = '';
    out.parentStatus = { status: 'target_child_required', reason: 'multiple_children_detected' };
    record(parentGuard.codes, []);
  } else if (parentGuard.status === 'sanitized') {
    record(parentGuard.codes, parentGuard.blockedTopics);
    // 이름 비식별 적용본을 문장 단위로 소독 — 남는 문장이 없으면 교사 확인 보류(일반론 생성 금지)
    let deIdentified = clean(out.parent);
    namesInInput(input).filter((n) => n !== clean(childName)).forEach((n) => {
      deIdentified = deIdentified.replace(new RegExp(n, 'g'), '친구');
    });
    const scrubbed = scrubSentences({ text: deIdentified, input, situations, targetChild: childName });
    if (clean(scrubbed.text).length >= 12) {
      out.parent = scrubbed.text;
    } else {
      out.parent = conservativeParentNotice();
      out.parentStatus = { status: 'needs_teacher_review', reason: 'document_context_mismatch' };
    }
  } else {
    out.parent = parentGuard.text;
  }

  // 4) 누리과정 연결 — 갈등·시범 상황에서는 자동 연결 보류
  const cur = guardCurriculumBasis({ input, curriculumBasis: out.curriculumBasis, situations });
  if (cur.status !== 'ok') {
    out.curriculumBasis = null;
    out.curriculumStatus = { status: cur.status, reason: cur.reason };
    record(cur.codes || [], ['curriculumConnection']);
  }

  // 5) 복사용 3단(copyReady: B2/B3/B4 산출) — 섹션별 검사
  const sec = parseSections(out.copyReady);
  let dirty = false;
  const obsGuard = guardText({ text: sec.observation, input, situations, targetChild: childName });
  if (!obsGuard.ok) { sec.observation = clean(out.observation) || sec.observation; dirty = true; record(obsGuard.codes, obsGuard.blockedTopics); }
  const learnGuard = guardText({ text: sec.learning, input, situations, targetChild: childName });
  if (!learnGuard.ok) { sec.learning = conservativeLearning({ situations, childName }); dirty = true; record(learnGuard.codes, learnGuard.blockedTopics); }
  const csGuard = guardText({ text: sec.support, input, situations, targetChild: childName });
  if (!csGuard.ok) { sec.support = conservativeSupport({ situations }); dirty = true; record(csGuard.codes, csGuard.blockedTopics); }
  if (dirty) out.copyReady = assembleSections(sec);

  trace.codes = [...new Set(trace.codes)];
  trace.blockedTopics = [...new Set(trace.blockedTopics)];
  trace.fallback = trace.codes.length > 0;
  trace.fallbackReason = trace.codes.includes('document_context_mismatch') ? 'document_context_mismatch' : (trace.codes[0] || '');
  return { result: out, trace };
}

function parseSections(copyReady) {
  const t = String(copyReady || '');
  const grab = (label) => {
    const m = t.match(new RegExp(`\\[${label}\\]\\n([\\s\\S]*?)(\\n\\n\\[|$)`));
    return m ? m[1].trim() : '';
  };
  return { observation: grab('관찰내용'), learning: grab('배움 읽기'), support: grab('교사 지원 및 다음 계획') };
}
function assembleSections(sec) {
  return [['관찰내용', sec.observation], ['배움 읽기', sec.learning], ['교사 지원 및 다음 계획', sec.support]]
    .filter(([, v]) => clean(v)).map(([l, v]) => `[${l}]\n${clean(v)}`).join('\n\n');
}

export default applyContextGuard;
