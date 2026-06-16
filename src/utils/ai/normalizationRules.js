export const INPUT_NORMALIZE_RULES = [
  [/\b샘\b/g, '교사'],
  [/선생님/g, '교사'],
  [/애가/g, '유아가'],
  [/얘가/g, '유아가'],
  [/안잠/g, '잠들지 않음'],
  [/먹음/g, '먹었음'],
  [/했음/g, '하였음'],
  [/뒤척임/g, '뒤척였음'],
  [/울었어요/g, '속상한 마음을 표현했어요'],
  [/떼를 썼어요/g, '속상한 마음을 표현했어요'],
];

export const SOFTEN_REPLACEMENTS = [
  [/문제행동/g, '지원이 필요한 모습'],
  [/고집을 부렸/g, '자신의 생각을 강하게 표현하였'],
  [/못한다/g, '아직 도움이 필요하다'],
  [/발달이 늦/g, '지속적인 관찰과 지원이 필요'],
  [/산만/g, '관심이 여러 방향으로 이동'],
  [/떼를 썼/g, '속상한 마음을 표현하였'],
  [/공격적/g, '강한 감정을 표현하는'],
  [/말을 안 듣/g, '안내를 받아들이는 데 시간이 필요한'],
];

export const POSITIVE_REPHRASE_RULES = [
  [/실패했다/g, '다시 시도하는 과정이 있었다'],
  [/하지 못했다/g, '도움이 필요한 모습이 있었다'],
  [/거부했다/g, '참여가 아직 편안하지 않은 모습이 있었다'],
  [/울기만 했다/g, '속상한 마음을 울음으로 표현했다'],
];

export const UNSUPPORTED_CLAIM_PATTERNS = [
  /항상/g,
  /전혀/g,
  /매우 뛰어난/g,
  /완벽하게/g,
  /확실히/g,
];

export const applyOutsideQuotes = (text, replacer) => {
  const source = String(text || '');
  const parts = source.split(/("[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’)/g);
  return parts
    .map((part) => (/^["'“‘]/.test(part) ? part : replacer(part)))
    .join('');
};

export function applyRuleList(text, rules) {
  return rules.reduce((output, [pattern, replacement]) => output.replace(pattern, replacement), String(text || ''));
}

export function normalizeRecordText(text) {
  return applyOutsideQuotes(String(text || ''), (part) => applyRuleList(part.replace(/\s+/g, ' ').trim(), INPUT_NORMALIZE_RULES))
    .replace(/\s+/g, ' ')
    .trim();
}

export function softenRecordText(text) {
  return applyOutsideQuotes(String(text || ''), (part) => applyRuleList(part, SOFTEN_REPLACEMENTS));
}

export function applyPositiveRephrase(text) {
  return applyOutsideQuotes(String(text || ''), (part) => applyRuleList(part, POSITIVE_REPHRASE_RULES));
}

export function removeUnsupportedClaims(text) {
  return UNSUPPORTED_CLAIM_PATTERNS.reduce((output, pattern) => output.replace(pattern, ''), String(text || ''));
}
