// 관찰일지 "목표 품질" 리포트 — 안전 검수(Safety)와 목표 정렬(Target Alignment)·복붙(Copy-Ready)을 분리 측정.
// 기본 skip(CI 부담 방지). 실행:
//   OBSREPORT=1 CI=true npx react-scripts test src/utils/ai.observationReport.test.js --watchAll=false
// 로컬 비식별 데이터셋(data/golden_local/observation_golden.local.json, 목표 포함)이 있어야 목표 정렬을 측정.
// 없으면 골든(목표 없음)으로 축소 실행. 교사 검토용 비교 리포트는 gitignore 경로에만 생성.
import fs from 'fs';
import path from 'path';
import { processRecord } from './ai/index';
import { parseTargetSections, scoreTargetAlignment, scoreCopyReady } from './ai/targetQuality';
import { aggregate } from './ai/reportAggregate';
import { OBSERVATION_GOLDEN } from './ai/datasets/observationGolden';

const RUN = !!process.env.OBSREPORT;
const d = RUN ? describe : describe.skip;

function loadLocal() {
  try {
    const p = path.resolve(process.cwd(), 'data/golden_local/observation_golden.local.json');
    if (!fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return (j.regressionCases || []).map((r) => ({ id: r.id, name: r.factCard?.name || '원아', input: r.input, target: r.target || null }));
  } catch { return null; }
}

async function scoreRow(row) {
  const r = await processRecord({ childName: row.name, rawText: row.input, classAge: '4', recordType: 'observe', tone: 'warm' });
  const gen = parseTargetSections(r.copyReady);
  const align = row.target ? scoreTargetAlignment({ input: row.input, gen: { ...gen, childName: row.name }, target: row.target }) : { score: null, reasons: [] };
  const cr = scoreCopyReady(gen);
  return {
    id: row.id, input: row.input, name: row.name, target: row.target, gen,
    safety: r.copyReadyAudit?.pasteScore ?? 0,
    targetScore: align.score, alignReasons: align.reasons,
    copyReady: cr.score, copyReasons: cr.reasons,
    // 집계 헬퍼가 기대하는 형태(중복 정규화는 input 기준)
    sections: { obs: gen.observation ? cr.dimensions.complete * 100 : 0, learn: align.dimensions?.learningGrounded != null ? Math.round(align.dimensions.learningGrounded * 100) : 0, sup: align.dimensions?.supportPlanSep != null ? Math.round(align.dimensions.supportPlanSep * 100) : 0 },
  };
}

d('관찰일지 목표 품질 리포트(안전/목표정렬/복붙 분리)', () => {
  test('생성 → Safety·TargetAlignment·CopyReady 분리 집계 + 교사 검토 리포트 생성', async () => {
    const local = loadLocal();
    const rows = local || OBSERVATION_GOLDEN.regressionCases.map((r) => ({ id: r.id, name: r.factCard?.name, input: r.input, target: null }));
    const usedTarget = !!local;

    const scored = [];
    for (const row of rows) scored.push(await scoreRow(row));

    // aggregate(): 점수는 targetScore, 목표 객체는 targetSections(중복-목표 비교용)로 전달
    const forAgg = scored.map((s) => ({ ...s, targetSections: s.target }));
    const agg = aggregate(forAgg);

    /* eslint-disable no-console */
    console.log('\n================= 관찰일지 목표 품질 리포트 =================');
    console.log(`표본 출처            : ${usedTarget ? '로컬 비식별 데이터셋(목표 포함)' : '골든(목표 없음 — 목표정렬 생략)'}`);
    console.log(`전체 행 수           : ${agg.totals.rows}`);
    console.log(`고유 입력 수         : ${agg.totals.unique}`);
    console.log(`중복 그룹 수         : ${agg.totals.dupGroups}`);
    console.log(`입력 같고 목표 다름  : ${agg.totals.sameInputDiffTarget} 그룹  (별도 분류·경고 대상)`);
    console.log('--- 점수(중복 포함 → 고유 입력 기준) : 고유 입력 기준을 주요 지표로 사용 ---');
    console.log(`Safety Score         : ${agg.withDuplicates.safety} → ${agg.uniqueInput.safety}   (안전·사실성 위반 없음=100, 품질 보장 아님)`);
    console.log(`Target Alignment     : ${agg.withDuplicates.target} → ${agg.uniqueInput.target}   (v3 목표 문장 대비 문서 품질)`);
    console.log(`Copy-Ready Score     : ${agg.withDuplicates.copyReady} → ${agg.uniqueInput.copyReady}   (형식·완결성·자연스러움)`);
    console.log(`섹션 평균(관찰/배움/지원): ${agg.uniqueInput.sectionObs} / ${agg.uniqueInput.sectionLearn} / ${agg.uniqueInput.sectionSup}`);
    console.log('--- 목표 대비 약한 표현 유형 상위 10(고유 입력 기준) ---');
    agg.weakTop.forEach(([why, n], i) => console.log(`  ${i + 1}. (${n}건) ${why}`));
    console.log('--- 개선 우선순위 ---');
    agg.priorities.forEach((p) => console.log(`  ${p.rank}. (${p.count}건) ${p.why}`));
    console.log('--- 목표 대비 좋은 사례 5 ---');
    agg.goodCases.forEach((c) => console.log(`  [${c.targetScore}] ${c.id}: ${String(c.input).slice(0, 28)}`));
    console.log('--- 개선 필요 사례 10 ---');
    agg.needImprove.forEach((c) => console.log(`  [${c.targetScore}] ${c.id}: ${(c.alignReasons || [])[0] || ''}`));
    console.log('==========================================================\n');
    /* eslint-enable no-console */

    if (usedTarget) writeReviewReport(scored, agg);

    // 분리·건전성 가드(품질 회귀 방지)
    expect(agg.totals.unique).toBeLessThan(agg.totals.rows);              // 중복 정규화가 실제로 줄임
    expect(agg.uniqueInput.safety).toBeGreaterThanOrEqual(90);           // 안전은 높게 유지
    if (usedTarget) expect(agg.uniqueInput.target).toBeGreaterThan(0);    // 목표 정렬이 계산됨
  }, 120000);
});

// 교사 검토용 비교 리포트(Markdown) — gitignore 경로에만 생성.
function writeReviewReport(scored, agg) {
  const dd = require('./ai/reportAggregate');
  const uniq = dd.dedupeByInput(scored.map((s) => ({ ...s, targetSections: s.target }))).representatives;
  const worst = [...uniq].sort((a, b) => (a.targetScore ?? 0) - (b.targetScore ?? 0)).slice(0, 25);
  const best = [...uniq].sort((a, b) => (b.targetScore ?? 0) - (a.targetScore ?? 0)).slice(0, 5);
  const block = (c) => [
    `### ${c.id}  ·  Safety ${c.safety} / Target ${c.targetScore} / Copy-Ready ${c.copyReady}`,
    `- **입력(익명)**: ${c.input}`,
    `- **목표 관찰내용**: ${c.target?.observation || ''}`,
    `- **생성 관찰내용**: ${c.gen.observation || ''}`,
    `- **목표 배움 읽기**: ${c.target?.learning || ''}`,
    `- **생성 배움 읽기**: ${c.gen.learning || ''}`,
    `- **목표 교사 지원**: ${c.target?.support || ''}`,
    `- **생성 교사 지원**: ${c.gen.support || ''}`,
    `- **자동 분석 사유**: ${(c.alignReasons || []).join(' · ') || '(약점 없음)'}`,
    `- **개선 우선순위**: ${(c.alignReasons || [])[0] || '유지'}`,
    '',
  ].join('\n');
  const md = [
    '# 관찰일지 교사 검토용 비교 리포트 (로컬 전용 · 비식별)',
    '',
    `- 전체 ${agg.totals.rows}행 / 고유 입력 ${agg.totals.unique} / 중복 그룹 ${agg.totals.dupGroups} / 입력같고목표다름 ${agg.totals.sameInputDiffTarget}`,
    `- 고유 입력 기준 평균 — Safety ${agg.uniqueInput.safety} · Target ${agg.uniqueInput.target} · Copy-Ready ${agg.uniqueInput.copyReady}`,
    '- Safety=안전·사실성(위반 없음=100, 품질 보장 아님) / Target=v3 목표 대비 문서 품질 / Copy-Ready=복붙 형식·완결성.',
    '',
    '## 개선 필요 상위 25 (Target 낮은 순)',
    '',
    ...worst.map(block),
    '## 목표 대비 좋은 사례 5',
    '',
    ...best.map(block),
  ].join('\n');
  const outDir = path.resolve(process.cwd(), 'data/golden_local');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'review_report.local.md'), md, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`교사 검토용 비교 리포트 저장(로컬·gitignore): data/golden_local/review_report.local.md (개선필요 25 + 우수 5)`);
}
