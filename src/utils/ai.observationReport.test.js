// 관찰일지 품질 리포트 — 상시 회귀와 분리된 "측정용" 러너.
// 기본은 skip(CI 부담 방지). 실행:  OBSREPORT=1 CI=true npx react-scripts test src/utils/ai.observationReport.test.js --watchAll=false
// 표본 크기 조절:  OBSREPORT=1 OBS_N=1000 ...
// 로컬 비식별 데이터셋(data/golden_local/…)이 있으면 자동 포함(없으면 골든+합성 표본).
import { processRecord } from './ai/index';
import { OBSERVATION_GOLDEN } from './ai/datasets/observationGolden';
import { BULK_SAMPLE_RECORDS } from './ai/datasets/bulkSamples';

const RUN = !!process.env.OBSREPORT;
const N = Number(process.env.OBS_N || 200);
const d = RUN ? describe : describe.skip;

function loadLocal() {
  // 로컬 비식별 데이터셋(있을 때만). 번들에 포함시키지 않으려고 동적 require + try.
  try {
    // eslint-disable-next-line global-require
    const fs = require('fs');
    // eslint-disable-next-line global-require
    const path = require('path');
    const p = path.resolve(process.cwd(), 'data/golden_local/observation_golden.local.json');
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return (j.regressionCases || []).map((r) => ({ id: r.id, name: r.factCard?.name || '원아', text: r.input }));
  } catch { return []; }
}

function buildCorpus() {
  const golden = OBSERVATION_GOLDEN.regressionCases.map((r) => ({ id: r.id, name: r.factCard?.name, text: r.input }));
  const local = loadLocal();
  const bulk = BULK_SAMPLE_RECORDS.slice(0, N).map((r, i) => ({ id: `bulk_${i + 1}`, name: r.name, text: r.text }));
  const src = local.length ? local : bulk;
  return { corpus: [...golden, ...src], usedLocal: local.length > 0 };
}

d('관찰일지 품질 리포트', () => {
  test('전 표본 생성 → 검수 집계 → 리포트 출력', async () => {
    const { corpus, usedLocal } = buildCorpus();
    const rows = [];
    for (const c of corpus) {
      const r = await processRecord({ childName: c.name, rawText: c.text, classAge: '4', recordType: 'observe', tone: 'warm' });
      rows.push({ id: c.id, audit: r.copyReadyAudit, pasteScore: r.copyReadyAudit?.pasteScore ?? 0 });
    }
    const total = rows.length;
    const isMajor = (a) => a?.severity === 'major';
    const isMinor = (a) => a?.severity === 'minor';
    const codeFreq = {};
    let factFail = 0, speechFail = 0, banned = 0, repeat = 0, fallback = 0, pass = 0, warn = 0;
    const failures = [];
    rows.forEach(({ id, audit }) => {
      const m = audit?.metrics || {};
      if (m.factPreserved === false) factFail += 1;
      if (m.speechPreserved === false) speechFail += 1;
      if (m.noBanned === false) banned += 1;
      (audit?.warnings || []).forEach((w) => { codeFreq[w] = (codeFreq[w] || 0) + 1; if (w === 'mechanical_repetition') repeat += 1; });
      if (audit?.fallbackApplied) fallback += 1;
      if (isMajor(audit)) failures.push({ id, sev: 'major', msgs: (audit.details || []).map((x) => x.message) });
      else if (isMinor(audit)) { warn += 1; if (failures.length < 20) failures.push({ id, sev: 'minor', msgs: (audit.details || []).map((x) => x.message) }); }
      else pass += 1;
    });
    const avgPaste = Math.round((rows.reduce((s, x) => s + x.pasteScore, 0) / total) * 10) / 10;
    const priorities = Object.entries(codeFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

    /* eslint-disable no-console */
    console.log('\n================ 관찰일지 품질 리포트 ================');
    console.log(`표본 출처       : ${usedLocal ? '로컬 비식별 데이터셋(data/golden_local)' : `골든 + 합성표본 ${N}건`}`);
    console.log(`전체 사례 수    : ${total}`);
    console.log(`통과 / 경고     : ${pass} / ${warn}   (경고=경미 표현 문제, 사실 훼손 아님)`);
    console.log(`사실 보존 폴백  : ${fallback}   (발화손실·사실추가 감지 → 사실 보존본으로 교체)`);
    console.log(`사실 보존 실패  : ${factFail}`);
    console.log(`발화 보존 실패  : ${speechFail}`);
    console.log(`금지 표현 발생  : ${banned}`);
    console.log(`문장 반복 발생  : ${repeat}`);
    console.log(`복붙 적합성 평균: ${avgPaste} / 100`);
    console.log('대표 실패/경고(최대 5건):');
    failures.slice(0, 5).forEach((f) => console.log(`  - [${f.sev}] ${f.id}: ${f.msgs.join(' · ')}`));
    console.log('개선 우선순위(빈도순):');
    priorities.forEach(([code, n], i) => console.log(`  ${i + 1}. ${code} × ${n}`));
    console.log('=====================================================\n');
    /* eslint-enable no-console */

    // 품질 회귀 가드: 최종 산출물에는 사실 훼손이 남지 않아야 한다.
    expect(factFail).toBe(0);
    expect(speechFail).toBe(0);
    expect(banned).toBe(0);
    expect(avgPaste).toBeGreaterThanOrEqual(90);
  }, 60000);
});
