import { makeWarmNoticeText } from '../qualityGuard';

const summarizeRecords = (records = []) =>
  records
    .map((record) => record.parent || record.observation || record.rawText || '')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');

export function createConsultDraft({ childName, records = [], analysis } = {}) {
  const name = childName || analysis?.parsedInput?.childName || '유아';
  const areas = analysis?.devAreas?.length ? analysis.devAreas.join(', ') : '일상생활과 놀이';
  const sample = summarizeRecords(records);
  const text = `${name}의 최근 기록을 보면 ${areas}에서 관찰된 모습이 있습니다. ${sample} 상담에서는 가정에서의 모습과 원에서의 지원 방향을 함께 나누면 좋겠습니다.`;
  return makeWarmNoticeText(text, { sourceText: sample });
}

