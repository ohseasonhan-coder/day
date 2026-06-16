import { makeReportStyleText } from '../qualityGuard';

const summarizeRecords = (records = []) =>
  records
    .map((record) => record.observation || record.rawText || record.parent || '')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');

export function createGrowthSummaryDraft({ childName, records = [], period, analysis } = {}) {
  const name = childName || analysis?.parsedInput?.childName || '유아';
  const recordCount = records.length;
  const areas = analysis?.devAreas?.length ? analysis.devAreas.join(', ') : '놀이와 일상 경험';
  const sample = summarizeRecords(records);
  const text = `${name}는 ${period || '관찰 기간'} 동안 ${recordCount}건의 기록에서 ${areas}과 관련된 경험을 보였다. ${sample} 교사는 기록된 장면을 바탕으로 강점과 지원이 필요한 지점을 지속적으로 관찰한다.`;
  return makeReportStyleText(text, { sourceText: sample });
}

