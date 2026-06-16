import { extractActualSpeech } from './inputParser';
import { applyPositiveRephrase, removeUnsupportedClaims, softenRecordText } from './normalizationRules';

const OBJECTIVE_REPLACEMENTS = [
  [/잘했다/g, '참여하는 모습을 보였다'],
  [/훌륭했다/g, '관심을 보였다'],
  [/문제가 있었다/g, '지원이 필요한 상황이 관찰되었다'],
];

const WARM_NOTICE_REPLACEMENTS = [
  [/지원이 필요한 상황이 관찰되었다/g, '교사의 도움을 받으며 조절해 보는 시간이 있었습니다'],
  [/거부하였다/g, '아직 참여가 편안하지 않은 모습이 있었습니다'],
  [/울었다/g, '속상한 마음을 표현했습니다'],
];

const REPORT_STYLE_REPLACEMENTS = [
  [/했습니다/g, '하였다'],
  [/있었습니다/g, '있었다'],
  [/보였습니다/g, '보였다'],
  [/도왔습니다/g, '지원하였다'],
];

function restoreSpeech(text, sourceText) {
  let output = text;
  extractActualSpeech(sourceText).forEach((speech) => {
    if (!speech) return;
    const quoted = `"${speech}"`;
    if (!output.includes(quoted) && !output.includes(speech)) {
      output += ` ${quoted}라고 말한 내용은 원문 그대로 보존하였다.`;
    }
  });
  return output;
}

export function guardText(text, { sourceText = '' } = {}) {
  let output = softenRecordText(text);
  output = applyPositiveRephrase(output);
  output = removeUnsupportedClaims(output);
  return restoreSpeech(output, sourceText)
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeObjectiveText(text, options = {}) {
  let output = guardText(text, options);
  OBJECTIVE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

export function makeWarmNoticeText(text, options = {}) {
  let output = guardText(text, options);
  WARM_NOTICE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

export function makeReportStyleText(text, options = {}) {
  let output = guardText(text, options);
  REPORT_STYLE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

export function guardRecordResult(result, { sourceText = '' } = {}) {
  if (!result || typeof result !== 'object') return result;
  const guarded = { ...result };
  ['observation', 'evaluation', 'parent', 'support'].forEach((key) => {
    if (typeof guarded[key] === 'string') guarded[key] = guardText(guarded[key], { sourceText });
  });
  return guarded;
}
