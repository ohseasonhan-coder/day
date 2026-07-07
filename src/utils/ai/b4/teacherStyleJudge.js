const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

const REPORT_STYLE = /(통해|경험하며|발달|능력|향상|성장|우수|뛰어남|함양|증진|극복)/;
const TOO_GENERIC_SUPPORT = /^(지속적으로\s*)?(격려한다|질문한다|도와준다|지원한다|다양한 경험을 제공한다|표현할 수 있도록 지원한다)\.?$/;
const ABSTRACT_SUPPORT = /(다양한 경험|충분한 기회|적절한 지원|긍정적인 상호작용|지속적인 격려)/;
const ACTIONABLE_SUPPORT = /(마련|둔다|확보|기다리|되짚|확인|정해|연결|제안|놓아|조정|살펴|나누|보여|기록|준비|제공)/;
const RESOURCE_LINK = /(재료|공간|친구|차례|순서|선택|말|표현|자리|자료|소품|사진|그림|역할|도구|카드|시간|속도)/;
const TEACHER_ENDING = /(했다|보았다|갔다|나타났다|관찰되었다|이어 갔다|해 보았다|본다|둔다|마련한다|확보한다|돕는다|연결한다)\.$/;
const THEME_WORDS = /(재료|친구|차례|역할|감정|마음|탐색|질문|비교|분류|신체|일상|갈등|사과|지원|놀이)/g;

const DUPLICATE_QUOTE = /"([^"]+)".*"\1"/;

function tokenList(text = '') {
  return unique(String(text || '').replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/)
    .map((word) => word.replace(/(은|는|이|가|을|를|으로|에서|에게|하며|하고|했다|하였다|한다|본다|보았다|이어|간다|갔다|도록)$/, ''))
    .filter((word) => word.length >= 2));
}

export function tokenOverlap(a = '', b = '') {
  const left = tokenList(a);
  const right = new Set(tokenList(b));
  return left.length ? left.filter((word) => right.has(word) || [...right].some((item) => item.includes(word) || word.includes(item))).length / left.length : 0;
}

function lengthBucket(text = '') {
  const n = clean(text).length;
  if (n <= 36) return 'short';
  if (n <= 76) return 'medium';
  if (n <= 120) return 'long';
  return 'overlong';
}

function firstTokenType(text = '') {
  const value = clean(text);
  if (/^"/.test(value)) return 'quote';
  if (/^(다음에는|이후에는|다음 놀이|같은 놀이)/.test(value)) return 'future_plan';
  if (/^(이 장면|해당 장면|관찰된 장면)/.test(value)) return 'scene_frame';
  if (/^(현재|같은|아이의)/.test(value)) return 'context_link';
  if (/^[가-힣]{1,5}(은|는|이|가)\s/.test(value)) return 'child_subject';
  return 'other';
}

function connectorType(text = '') {
  const value = clean(text);
  if (/수 있도록/.test(value)) return 'purpose';
  if (/이 과정에서|과정에서/.test(value)) return 'process';
  if (/뒤|이후|그 뒤/.test(value)) return 'sequence';
  if (/하며|보며|가며/.test(value)) return 'simultaneous';
  if (/연결해|이어/.test(value)) return 'flow';
  return 'plain';
}

function verbType(text = '') {
  const value = clean(text);
  if (/다시|시도|바꾸/.test(value)) return 'retry';
  if (/만들|구성|붙이|쌓/.test(value)) return 'make';
  if (/말|묻|설명|표현/.test(value)) return 'language';
  if (/기다리|차례|순서/.test(value)) return 'turn';
  if (/친구|함께|나누|건네/.test(value)) return 'peer';
  if (/살펴|관찰|비교|나누어/.test(value)) return 'explore';
  if (/마음|울|속상|돌아왔/.test(value)) return 'emotion';
  if (/마련|둔다|확보|돕|연결/.test(value)) return 'support';
  return 'general';
}

function endingType(text = '') {
  const value = clean(text);
  if (/본다\.$/.test(value)) return 'plan_try';
  if (/둔다\.$/.test(value)) return 'plan_place';
  if (/한다\.$/.test(value)) return 'plan_action';
  if (/했다\.$/.test(value)) return 'record_past';
  if (/보았다\.$/.test(value)) return 'record_try';
  if (/갔다\.$/.test(value)) return 'record_flow';
  if (/되었다\.$/.test(value)) return 'record_observed';
  return value.split(/\s+/).slice(-1)[0] || 'none';
}

function sentenceCount(text = '') {
  return clean(text).split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

export function analyzeSentenceRhythm(text = '', { styleProfile = 'objective' } = {}) {
  const value = clean(text);
  const rhythm = {
    lengthBucket: lengthBucket(value),
    firstTokenType: firstTokenType(value),
    connectorType: connectorType(value),
    verbType: verbType(value),
    endingType: endingType(value),
    sentenceCount: sentenceCount(value),
    hasSpeech: /"[^"]+"/.test(value),
    styleProfile,
  };
  rhythm.signature = [
    rhythm.lengthBucket,
    rhythm.firstTokenType,
    rhythm.connectorType,
    rhythm.verbType,
    rhythm.endingType,
    rhythm.sentenceCount > 1 ? 'two_sentence' : 'one_sentence',
    rhythm.hasSpeech ? 'speech' : 'no_speech',
    rhythm.styleProfile,
  ].join('|');
  return rhythm;
}

function rhythmPenalty(rhythm, context = {}) {
  const recent = context.recentPatterns || [];
  const primary = context.plan?.primaryTheme || context.plan?.learningFocus?.[0] || '';
  const relation = context.plan?.relation || '';
  const repeated = recent.filter((entry) =>
    entry.primaryTheme === primary
    && entry.discourseRelation === relation
    && entry.rhythmSignature === rhythm.signature);
  return Math.min(16, repeated.length * 4);
}

export function scoreSupportPlanQuality(text = '', context = {}) {
  const value = clean(text);
  const reasons = [];
  let score = 70;
  if (TOO_GENERIC_SUPPORT.test(value)) { score -= 35; reasons.push('generic_support_only'); }
  if (ABSTRACT_SUPPORT.test(value)) { score -= 18; reasons.push('abstract_support'); }
  if (!ACTIONABLE_SUPPORT.test(value)) { score -= 16; reasons.push('missing_actionable_teacher_action'); }
  if (!RESOURCE_LINK.test(value)) { score -= 12; reasons.push('missing_material_space_peer_sequence_choice_language_link'); }
  if (/(제공하였다|지원하였다|도와주었다|마련해 주었다|안내하였다)\.?$/.test(value)) { score -= 30; reasons.push('completed_support_ending'); }
  if (/현재|같은|관찰된|다음|이후|놀이|장면|흐름/.test(value)) { score += 8; reasons.push('connected_to_observed_flow'); }
  if (context.focusText && tokenOverlap(value, context.focusText) > 0.12) { score += 8; reasons.push('focus_event_linked'); }
  if (context.supportFocus && value.includes(String(context.supportFocus).split('_')[0])) score += 2;
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function judgeTeacherStyle(candidate = {}, context = {}) {
  const text = clean(candidate.text);
  const reasons = [];
  const blockedReasons = [];
  let score = 72;

  if (REPORT_STYLE.test(text)) { score -= 24; blockedReasons.push('report_like_or_development_claim'); }
  if ((text.match(/모습을 보였다|경험하며|을 통해/g) || []).length >= 1) { score -= 10; reasons.push('overused_record_phrase'); }
  if (text.length > 118 && sentenceCount(text) <= 1) { score -= 14; blockedReasons.push('too_much_meaning_one_sentence'); }
  if ((text.match(THEME_WORDS) || []).length >= 4) { score -= 12; blockedReasons.push('too_many_theme_terms'); }
  if (DUPLICATE_QUOTE.test(text)) { score -= 18; blockedReasons.push('duplicate_direct_speech'); }
  if (/수 있도록.{0,30}수 있도록/.test(text)) { score -= 24; blockedReasons.push('repeated_purpose_connector'); }
  if (/다양한 경험|충분한 기회|적절한 지원|긍정적인 상호작용/.test(text)) { score -= 18; blockedReasons.push('abstract_general_support'); }
  if (/하였다|이루어졌다|나타내었다|확인할 수 있었다/.test(text)) { score -= 5; reasons.push('stiff_written_style'); }
  if (TEACHER_ENDING.test(text)) { score += 8; reasons.push('teacher_like_ending'); }
  if (context.focusText && tokenOverlap(text, context.focusText) > 0.12) { score += 8; reasons.push('connected_to_real_action'); }
  if (sentenceCount(text) <= 2 && text.length >= 24 && text.length <= 105) { score += 8; reasons.push('one_core_meaning'); }
  if (candidate.section === 'support') {
    const support = scoreSupportPlanQuality(text, context);
    score += Math.round((support.score - 70) / 3);
    reasons.push(...support.reasons);
  }
  if (candidate.section === 'learning' && context.observation && tokenOverlap(text, context.observation) > 0.62) {
    score -= 16;
    blockedReasons.push('repeats_observation');
  }
  if (candidate.section === 'support' && context.learning && tokenOverlap(text, context.learning) > 0.56) {
    score -= 10;
    blockedReasons.push('repeats_learning');
  }

  const rhythm = analyzeSentenceRhythm(text, { styleProfile: context.styleProfile });
  const rhythmRepeatPenalty = rhythmPenalty(rhythm, context);
  if (rhythmRepeatPenalty) {
    score -= rhythmRepeatPenalty;
    blockedReasons.push('recent_rhythm_repeated');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: unique(reasons),
    blockedReasons: unique(blockedReasons),
    rhythm,
    rhythmPenalty: rhythmRepeatPenalty,
    supportQuality: candidate.section === 'support' ? scoreSupportPlanQuality(text, context) : null,
  };
}

export default judgeTeacherStyle;
