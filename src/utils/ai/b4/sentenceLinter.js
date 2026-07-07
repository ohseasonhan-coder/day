const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

const CONNECTOR_ENDING = /(하며|하고|보며|두고|확인하며|이어 가며)\.$/;
const CONNECTOR_DUP = /(수 있도록.{0,40}수 있도록|과정에서.{0,24}과정에서|흐름.{0,24}흐름|다음에는.{0,24}다음에는)/;
const PARTICLE_ERROR = /(은|는)\s+(이|가)\s|모습는|장면는|것는|놀이을|자료을|차례을|역할을 경험했다 또한/;
const MECHANICAL = /(활용하여|발달을 경험|경험하였다|기회를 제공한다|자료를 제공한다|격려한다|질문한다|발달이 향상)/;
const SUPPORT_DONE = /(제공하였다|격려하였다|지원하였다|도와주었다|마련해 주었다|안내하였다)\.?$/;
const OBSERVATION_INTERPRETATION = /(생각한 것으로 보인다|의도하였다|이해하였다|발달|능력|자신감|사회성|배려심)/;
const GENERIC_SUPPORT = /^(다음에는\s*)?(자료를 제공한다|기회를 제공한다|질문한다|격려한다|지원한다|돕는다)\.?$/;
const FORBIDDEN_CLAIM = /(자신감|문제 해결 능력|사회성|발달|향상|우수|뛰어남|창의성|정서 조절|극복)/;
const DUPLICATE_QUOTE = /"([^"]+)".*"\1"/;

function tokenList(text = '') {
  return unique(String(text || '').replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/)
    .map((word) => word.replace(/(은|는|이|가|을|를|으로|에서|에게|하며|하고|했다|하였다|한다|본다|보았다|이어|간다|갔다)$/, ''))
    .filter((word) => word.length >= 2));
}

function repeatedStemCount(text = '') {
  const stems = tokenList(text);
  const counts = stems.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
  return Object.values(counts).filter((count) => count > 1).length;
}

function splitLongSentence(text = '') {
  const value = clean(text);
  if (value.length < 118 || value.includes('. ')) return value;
  const splitAt = value.search(/,\s*(이후|이 과정에서|또한|그리고|다음에는)/);
  if (splitAt < 20) return value;
  return `${value.slice(0, splitAt).replace(/[,\s]+$/, '')}. ${value.slice(splitAt).replace(/^,\s*/, '')}`;
}

function futureSupport(text = '') {
  return text
    .replace(/마련해 주었다\.?$/, '마련한다.')
    .replace(/도와주었다\.?$/, '돕는다.')
    .replace(/안내하였다\.?$/, '안내한다.')
    .replace(/제공하였다\.?$/, '마련한다.')
    .replace(/지원하였다\.?$/, '지원한다.');
}

export function polishSurfaceText(text = '', section = 'learning', context = {}) {
  const before = lintSurfaceText(text, section, context);
  let out = clean(text)
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/(은|는)\s+(이|가)\s+/g, '$1 ')
    .replace(/말하였다\s*후/g, '말한 뒤')
    .replace(/말하였다\s*뒤/g, '말한 뒤')
    .replace(/말하였다\s*,\s*이후/g, '말한 뒤')
    .replace(/먹음는/g, '먹는')
    .replace(/봄는/g, '보는')
    .replace(/함는/g, '하는')
    .replace(/무너짐는/g, '무너지는')
    .replace(/쓰러짐는/g, '쓰러지는')
    .replace(/찢어짐는/g, '찢어지는')
    .replace(/끊어짐는/g, '끊어지는')
    .replace(/"([^"]+)"라고\s+는 과정/g, '"$1"라고 말하는 과정')
    .replace(/모습는\s+과정에서/g, '모습을 보이며')
    .replace(/차례를 기다릴 수 있도록.*?줄 앞에서.*?기다릴 수 있도록.*?서 있었다/g, '차례를 기다리며 줄 앞에 서 있었다')
    .replace(/활용하여/g, '사용해')
    .replace(/경험하였다/g, '경험했다')
    .replace(/역할을 경험했다 또한/g, '역할을 경험했으며')
    .replace(/이어 갔다 또한/g, '이어 가며')
    .replace(/해 보며\./g, '해 보았다.')
    .replace(/하며\./g, '하였다.')
    .replace(/하고\./g, '하였다.')
    .replace(/보며\./g, '보았다.')
    .replace(/수 있도록\s+(.{0,40})수 있도록/g, '수 있도록 $1')
    .replace(/과정에서\s+(.{0,20})과정에서/g, '과정에서 $1')
    .replace(/흐름을\s+이어\s+흐름/g, '흐름')
    .replace(/같은 흐름이 이어질 때/g, '같은 놀이가 이어질 때')
    .replace(/현재 놀이 흐름과 연결해/g, '현재 놀이와 연결해')
    .replace(/다음에는\s+(.{0,24})다음에는/g, '다음에는 $1')
    .replace(/\. \./g, '.');

  if (section === 'support') out = futureSupport(out);
  if (section === 'learning') {
    out = out.replace(/발달을 경험했다/g, '관찰된 흐름을 경험했다');
  }
  if (section === 'observation') {
    out = out.replace(/이해하였다|자신감을 보였다|사회성이 나타났다/g, '').replace(/\s+\./g, '.');
  }
  out = splitLongSentence(out);
  if (out && !/[.!?]["”']?$/.test(out)) out = `${out}.`;
  const after = lintSurfaceText(out, section, context);
  return {
    text: out.slice(0, 240),
    beforeIssues: before.issues,
    afterIssues: after.issues,
    editTypes: unique([...before.issues.map((issue) => issue.type), ...after.issues.map((issue) => issue.type)]),
    issueDelta: before.issues.length - after.issues.length,
  };
}

export function lintSurfaceText(text = '', section = 'learning', context = {}) {
  const value = clean(text);
  const issues = [];
  const add = (code, type, weight = 1) => issues.push({ code, type, weight });
  if (!value) add('empty', 'length', 4);
  if (CONNECTOR_ENDING.test(value)) add('connector_ending', 'ending', 5);
  if (CONNECTOR_DUP.test(value)) add('connector_duplicate', 'connector', 5);
  if (PARTICLE_ERROR.test(value)) add('particle_agreement', 'particle', 4);
  if (MECHANICAL.test(value)) add('mechanical_expression', 'generic', 3);
  if (section === 'observation' && OBSERVATION_INTERPRETATION.test(value)) add('observation_interpretation', 'generic', 8);
  if (section === 'support' && GENERIC_SUPPORT.test(value)) add('generic_support', 'support_specificity', 5);
  if (section === 'support' && !context.hasTeacherSupport && SUPPORT_DONE.test(value)) add('support_done_without_evidence', 'ending', 8);
  if (section !== 'observation' && FORBIDDEN_CLAIM.test(value)) add('forbidden_claim', 'generic', 10);
  if (value.length > 170) add('too_long', 'length', 2);
  if (value.length > 118 && !value.includes('. ')) add('needs_sentence_split', 'length', 2);
  if ((value.match(/"/g) || []).length % 2 === 1) add('speech_quote_unbalanced', 'connector', 6);
  if (DUPLICATE_QUOTE.test(value)) add('speech_quote_duplicate', 'repetition', 4);
  if (repeatedStemCount(value) >= 2) add('repeated_stem', 'repetition', 2);
  return {
    text: value,
    issues,
    score: Math.max(0, 100 - issues.reduce((sum, issue) => sum + issue.weight * 7, 0)),
  };
}

export function surfaceIssueSummary(sections = {}, context = {}) {
  const rows = [
    ['observation', sections.observation],
    ['learning', sections.learning],
    ['support', sections.support],
  ].map(([section, text]) => ({ section, ...lintSurfaceText(text, section, context) }));
  const countByType = {};
  rows.forEach((row) => row.issues.forEach((issue) => {
    countByType[issue.type] = (countByType[issue.type] || 0) + 1;
  }));
  return {
    rows,
    countByType,
    totalIssues: rows.reduce((sum, row) => sum + row.issues.length, 0),
  };
}

export function overlapRate(a = '', b = '') {
  const left = tokenList(a);
  const right = new Set(tokenList(b));
  return left.length ? left.filter((word) => right.has(word) || [...right].some((item) => item.includes(word) || word.includes(item))).length / left.length : 0;
}

export default lintSurfaceText;
