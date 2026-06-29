import { processRecord, analyzeRecordInput } from './ai/index';
import { scoreText } from './ai/qualityScorer';
import { BULK_SAMPLES } from './ai/datasets/bulkSamples';

// 입력 메모에서 아이 이름(한글 2~3자 + 조사) 추출
function nameFromInput(input) {
  const re = /([가-힣]{2,3})(?:이가|이는|이와|이에게|가|는)/g;
  const stop = new Set(['교사', '친구', '엄마', '아빠', '유아', '선생', '우리', '서로', '모두', '동생', '다음']);
  let m;
  while ((m = re.exec(String(input)))) { if (!stop.has(m[1])) return m[1]; }
  return '유아';
}
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);
const nonEmpty = (s) => !!(s && String(s).trim());

let results = [];

beforeAll(async () => {
  results = [];
  for (const memo of BULK_SAMPLES) {
    const childName = nameFromInput(memo);
    let r = null, error = null;
    try {
      r = await processRecord({ childName, rawText: memo, classAge: '4', recordType: 'observe', tone: 'warm' });
    } catch (e) { error = e; }
    const observation = r?.observation || '';
    const parent = r?.parent || '';
    results.push({
      memo, childName, error,
      observation, parent,
      obsScore: observation ? scoreText(observation, { input: memo, documentType: 'observation' }).totalScore : 0,
      noticeScore: parent ? scoreText(parent, { input: memo, documentType: 'notice' }).totalScore : 0,
    });
  }

  // ── 품질 리포트 출력 ──
  const avg = (a) => a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : 0;
  const obs = results.map((x) => x.obsScore);
  const notice = results.map((x) => x.noticeScore);
  const low = results.filter((x) => x.obsScore < 70);
  const quoted = results.filter((x) => quotesOf(x.memo).length > 0);
  const speechKept = quoted.filter((x) => quotesOf(x.memo).every((q) => (x.observation + x.parent).includes(q)));
  // eslint-disable-next-line no-console
  console.log([
    '',
    `===== 대량 자연스러움 리포트 (n=${results.length}) =====`,
    `관찰일지 평균 ${avg(obs)} (최저 ${Math.min(...obs)}, 최고 ${Math.max(...obs)})`,
    `알림장   평균 ${avg(notice)} (최저 ${Math.min(...notice)}, 최고 ${Math.max(...notice)})`,
    `발화 보존 ${speechKept.length}/${quoted.length} (따옴표 포함 입력)`,
    `70점 미만 관찰일지: ${low.length}건`,
    ...low.slice(0, 5).map((x) => `  · ${x.obsScore}점 | ${x.memo.slice(0, 30)}…`),
  ].join('\n'));
});

describe('대량 비식별 샘플 자연스러움/품질', () => {
  test('모든 샘플이 오류 없이, 빈 문장 없이 생성된다', () => {
    const broken = results.filter((x) => x.error || !nonEmpty(x.observation) || !nonEmpty(x.parent));
    expect(broken.map((x) => x.memo)).toEqual([]);
  });

  test('따옴표 속 아이 발화가 결과에 보존된다(관찰일지/알림장)', () => {
    const quoted = results.filter((x) => quotesOf(x.memo).length > 0);
    const lost = quoted.filter((x) => !quotesOf(x.memo).every((q) => (x.observation + x.parent).includes(q)));
    // 보존 실패가 있으면 어떤 입력인지 드러나게 한다
    expect(lost.map((x) => x.memo)).toEqual([]);
  });

  test('관찰일지 평균 품질이 80점 이상이다', () => {
    const avg = results.reduce((s, x) => s + x.obsScore, 0) / results.length;
    expect(avg).toBeGreaterThanOrEqual(80);
  });

  test('알림장 평균 품질이 80점 이상이다', () => {
    const avg = results.reduce((s, x) => s + x.noticeScore, 0) / results.length;
    expect(avg).toBeGreaterThanOrEqual(80);
  });

  test('관찰일지 70점 미만이 전체의 10% 미만이다', () => {
    const low = results.filter((x) => x.obsScore < 70).length;
    expect(low / results.length).toBeLessThan(0.1);
  });

  test('샘플이 100건 이상이다', () => {
    expect(results.length).toBeGreaterThanOrEqual(100);
  });
});
