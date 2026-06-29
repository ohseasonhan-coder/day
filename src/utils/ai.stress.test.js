import os from 'os';
import fs from 'fs';
import path from 'path';
import { processRecord } from './ai/index';
import { scoreText } from './ai/qualityScorer';
import { makeSamples } from './ai/datasets/bulkSamples';

// 대량 스트레스/안정성 점검. 상시 CI에서는 시간이 오래 걸려 스킵하고,
// 필요할 때만 STRESS=1 환경변수로 실행한다. (예: STRESS=1 STRESS_N=100000 npm test)
const RUN = process.env.STRESS === '1';
const N = Number(process.env.STRESS_N || 100000);
const runner = RUN ? test : test.skip;
const STRESS_PATH = path.join(os.tmpdir(), 'saemwork_stress_results.json');

function nameFromInput(input) {
  const re = /([가-힣]{2,3})(?:이가|이는|이와|이에게|가|는)/g;
  let m; while ((m = re.exec(String(input)))) return m[1]; return '유아';
}
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);

runner(`${N}건 대량 생성 스트레스/품질 점검`, async () => {
  const samples = makeSamples(N);
  const t0 = Date.now();

  let sum = 0, min = 100, max = 0, errors = 0, empty = 0;
  let quoted = 0, speechKept = 0;
  const byCat = {};
  const buckets = { '<80': 0, '80-84': 0, '85-89': 0, '90-94': 0, '95-100': 0 };
  const lowest = []; // {score, text}

  for (let i = 0; i < samples.length; i++) {
    const { text: memo, category } = samples[i];
    let observation = '', parent = '';
    try {
      const r = await processRecord({ childName: nameFromInput(memo), rawText: memo, classAge: '4', recordType: 'observe', tone: 'warm' });
      observation = r?.observation || '';
      parent = r?.parent || '';
    } catch { errors++; }
    if (!observation.trim()) { empty++; continue; }

    const s = scoreText(observation, { input: memo, documentType: 'observation' }).totalScore;
    sum += s; if (s < min) min = s; if (s > max) max = s;
    (byCat[category] ||= { sum: 0, n: 0 }); byCat[category].sum += s; byCat[category].n++;
    if (s < 80) buckets['<80']++; else if (s < 85) buckets['80-84']++; else if (s < 90) buckets['85-89']++; else if (s < 95) buckets['90-94']++; else buckets['95-100']++;

    const qs = quotesOf(memo);
    if (qs.length) { quoted++; if (qs.every((q) => (observation + parent).includes(q))) speechKept++; }

    if (lowest.length < 15) lowest.push({ score: s, text: observation });
    else if (s < lowest[lowest.length - 1].score) { lowest[lowest.length - 1] = { score: s, text: observation }; lowest.sort((a, b) => a.score - b.score); }
  }

  const elapsedMs = Date.now() - t0;
  const n = samples.length - empty - errors;
  const avg = Math.round((sum / Math.max(1, n)) * 100) / 100;
  const catAvg = Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, Math.round((v.sum / v.n) * 10) / 10]));
  const summary = {
    n: samples.length, scored: n, errors, empty,
    obsAvg: avg, obsMin: min, obsMax: max,
    speechKept, quoted, buckets, catAvg,
    elapsedMs, perRecordMs: Math.round((elapsedMs / samples.length) * 1000) / 1000,
    generatedAt: new Date().toISOString(),
  };
  try { fs.writeFileSync(STRESS_PATH, JSON.stringify({ summary, lowest: lowest.sort((a, b) => a.score - b.score) }, null, 0)); } catch {}

  // eslint-disable-next-line no-console
  console.log([
    '', `===== ${N}건 스트레스 결과 =====`,
    `처리: ${samples.length}건 · 오류 ${errors} · 빈결과 ${empty} · 소요 ${(elapsedMs / 1000).toFixed(1)}s (건당 ${summary.perRecordMs}ms)`,
    `관찰일지 평균 ${avg} (최저 ${min}, 최고 ${max})`,
    `점수 분포: ${Object.entries(buckets).map(([k, v]) => `${k}:${v}`).join(' · ')}`,
    `발화 보존 ${speechKept}/${quoted}`,
    `영역별: ${Object.entries(catAvg).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    `JSON: ${STRESS_PATH}`,
  ].join('\n'));

  expect(errors).toBe(0);
  expect(empty).toBe(0);
  expect(avg).toBeGreaterThanOrEqual(80);
  expect(quoted === 0 || speechKept === quoted).toBe(true);
}, 60 * 60 * 1000);
