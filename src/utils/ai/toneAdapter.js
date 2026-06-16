import { makeObjectiveText, makeReportStyleText, makeWarmNoticeText } from './qualityGuard';

const TONE_LABELS = {
  warm: '따뜻한 안내문체',
  professional: '전문적인 기록문체',
  formal: '공식 문서체',
  concise: '간결한 요약문체',
  report: '평가 기록체',
};

const trimSentences = (text, count) => {
  const parts = String(text || '').split(/(?<=[.!?。]|다\.|요\.)\s+/).filter(Boolean);
  return (parts.length ? parts.slice(0, count).join(' ') : String(text || '')).trim();
};

export function applyToneToDraft(text, { tone = 'warm', documentType = 'notice', sourceText = '' } = {}) {
  if (tone === 'concise') {
    return trimSentences(makeObjectiveText(text, { sourceText }), 1);
  }
  if (tone === 'report' || documentType === 'dailyReport' || documentType === 'evaluation') {
    return makeReportStyleText(text, { sourceText });
  }
  if (tone === 'professional' || tone === 'formal' || documentType === 'observation' || documentType === 'supportPlan') {
    return makeObjectiveText(text, { sourceText });
  }
  return makeWarmNoticeText(text, { sourceText });
}

export function getToneLabel(tone) {
  return TONE_LABELS[tone] || TONE_LABELS.warm;
}

