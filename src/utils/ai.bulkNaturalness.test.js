import os from 'os';
import fs from 'fs';
import path from 'path';
import { processRecord } from './ai/index';
import { scoreText } from './ai/qualityScorer';
import { BULK_SAMPLE_RECORDS } from './ai/datasets/bulkSamples';

function nameFromInput(input) {
  const re = /([가-힣]{2,3})(?:이가|이는|이와|이에게|가|는)/g;
  const stop = new Set(['교사', '친구', '엄마', '아빠', '유아', '선생', '우리', '서로', '모두', '동생', '다음']);
  let m;
  while ((m = re.exec(String(input)))) { if (!stop.has(m[1])) return m[1]; }
  return '유아';
}
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);
const nonEmpty = (s) => !!(s && String(s).trim());
export const BULK_RESULT_PATH = path.join(os.tmpdir(), 'saemwork_bulk_results.json');

let results = [];

beforeAll(async () => {
  results = [];
  for (let i = 0; i < BULK_SAMPLE_RECORDS.length; i++) {
    const { text: memo, category } = BULK_SAMPLE_RECORDS[i];
    const childName = nameFromInput(memo);
    let r = null, error = null;
    try {
      r = await processRecord({ childName, rawText: memo, classAge: '4', recordType: 'observe', tone: 'warm' });
    } catch (e) { error = String(e?.message || e); }
    const observation = r?.observation || '';
    const parent = r?.parent || '';
    const quotes = quotesOf(memo);
    const speechKept = quotes.length === 0 ? true : quotes.every((q) => (observation + parent).includes(q));
    results.push({
      idx: i + 1, category, childName, memo, observation, parent, error,
      obsScore: observation ? scoreText(observation, { input: memo, documentType: 'observation' }).totalScore : 0,
      noticeScore: parent ? scoreText(parent, { input: memo, documentType: 'notice' }).totalScore : 0,
      hasSpeech: quotes.length > 0,
      speechKept,
    });
  }

  // 검수 시트 기록용 JSON 내보내기
  const obs = results.map((x) => x.obsScore);
  const notice = results.map((x) => x.noticeScore);
  const avg = (a) => Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10;
  const quoted = results.filter((x) => x.hasSpeech);
  const speechKept = quoted.filter((x) => x.speechKept).length;
  const low = results.filter((x) => x.obsScore < 70);
  // 영역별 평균
  const byCat = {};
  results.forEach((x) => { (byCat[x.category] ||= []).push(x.obsScore); });
  const catAvg = Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, avg(v)]));
  const summary = {
    n: results.length,
    obsAvg: avg(obs), obsMin: Math.min(...obs), obsMax: Math.max(...obs),
    noticeAvg: avg(notice), noticeMin: Math.min(...notice), noticeMax: Math.max(...notice),
    speechKept, quoted: quoted.length, lowCount: low.length, catAvg,
    generatedAt: new Date().toISOString(),
  };
  try { fs.writeFileSync(BULK_RESULT_PATH, JSON.stringify({ summary, rows: results }, null, 0)); } catch {}

  // eslint-disable-next-line no-console
  console.log([
    '', `===== 대량 자연스러움 리포트 (n=${results.length}) =====`,
    `관찰일지 평균 ${summary.obsAvg} (최저 ${summary.obsMin}, 최고 ${summary.obsMax})`,
    `알림장   평균 ${summary.noticeAvg} (최저 ${summary.noticeMin}, 최고 ${summary.noticeMax})`,
    `발화 보존 ${speechKept}/${quoted.length}`,
    `70점 미만 관찰일지: ${low.length}건`,
    `영역별 관찰 평균: ${Object.entries(catAvg).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    `결과 JSON: ${BULK_RESULT_PATH}`,
  ].join('\n'));
});

describe('대량 비식별 샘플 자연스러움/품질 (500건)', () => {
  test('샘플이 500건이다', () => { expect(results.length).toBe(500); });

  test('모든 샘플이 오류 없이, 빈 문장 없이 생성된다', () => {
    const broken = results.filter((x) => x.error || !nonEmpty(x.observation) || !nonEmpty(x.parent));
    expect(broken.map((x) => x.memo)).toEqual([]);
  });

  test('따옴표 속 아이 발화가 결과에 보존된다', () => {
    const lost = results.filter((x) => x.hasSpeech && !x.speechKept);
    expect(lost.map((x) => x.memo)).toEqual([]);
  });

  test('관찰일지 평균 품질이 80점 이상이다', () => {
    expect(results.reduce((s, x) => s + x.obsScore, 0) / results.length).toBeGreaterThanOrEqual(80);
  });

  test('알림장 평균 품질이 80점 이상이다', () => {
    expect(results.reduce((s, x) => s + x.noticeScore, 0) / results.length).toBeGreaterThanOrEqual(80);
  });

  test('관찰일지 70점 미만이 전체의 10% 미만이다', () => {
    const low = results.filter((x) => x.obsScore < 70).length;
    expect(low / results.length).toBeLessThan(0.1);
  });
});
