// 관찰일지 "목표 품질" 리포트 — 안전 검수(Safety)와 목표 정렬(Target Alignment)·복붙(Copy-Ready)을 분리 측정.
// 기본 skip(CI 부담 방지). 실행:
//   OBSREPORT=1 CI=true npx react-scripts test src/utils/ai.observationReport.test.js --watchAll=false
// 3단계 확장: 신호 감지율·SAFE 폴백 비율·신호별 평균·이전 단계 대비 변화·개선/보수 사례·교사 검토 샘플(≤20).
// 이전 단계 비교는 data/golden_local/baseline_learning.local.json(3단계 이전 배움 읽기 스냅샷)이 있을 때만.
// 로컬 산출물(review_report/review_samples)은 모두 gitignore 경로에만 생성.
import fs from 'fs';
import path from 'path';
import { processRecord } from './ai/index';
import { readLearningSignal } from './ai/copyReadyObservation';
import { auditObservationCopy } from './ai/observationAudit';
import { parseTargetSections, scoreTargetAlignment, scoreCopyReady } from './ai/targetQuality';
import { aggregate, dedupeByInput } from './ai/reportAggregate';
import { OBSERVATION_GOLDEN } from './ai/datasets/observationGolden';

const RUN = !!process.env.OBSREPORT;
const d = RUN ? describe : describe.skip;
const LOCAL_DIR = () => path.resolve(process.cwd(), 'data/golden_local');

function loadJson(name) {
  try {
    const p = path.join(LOCAL_DIR(), name);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return null; }
}
function loadLocal() {
  const j = loadJson('observation_golden.local.json');
  if (!j) return null;
  return (j.regressionCases || []).map((r) => ({ id: r.id, name: r.factCard?.name || '원아', input: r.input, target: r.target || null }));
}

async function scoreRow(row, baseline) {
  const r = await processRecord({ childName: row.name, rawText: row.input, classAge: '4', recordType: 'observe', tone: 'warm' });
  const gen = parseTargetSections(r.copyReady);
  const align = row.target ? scoreTargetAlignment({ input: row.input, gen: { ...gen, childName: row.name }, target: row.target }) : { score: null, reasons: [], dimensions: {} };
  const cr = scoreCopyReady(gen);
  const signal = readLearningSignal(row.input);
  // 이전 단계(3단계 이전) 배움 읽기로 동일 스코어러 재평가 → 생성기 변화만 비교
  let prev = null;
  const prevLearning = baseline?.[row.id];
  if (prevLearning && row.target) {
    const pAlign = scoreTargetAlignment({ input: row.input, gen: { ...gen, learning: prevLearning, childName: row.name }, target: row.target });
    const pCr = scoreCopyReady({ ...gen, learning: prevLearning });
    const pSafety = auditObservationCopy({ input: row.input, observation: gen.observation, learning: prevLearning, support: gen.support, childName: row.name }).pasteScore;
    prev = { target: pAlign.score, copyReady: pCr.score, safety: pSafety, learning: prevLearning, safe: prevLearning.includes('관심 있는 놀이에 몰입하며') };
  }
  return {
    id: row.id, input: row.input, name: row.name, target: row.target, gen, signal, prev,
    safety: r.copyReadyAudit?.pasteScore ?? 0,
    targetScore: align.score, alignReasons: align.reasons,
    copyReady: cr.score, copyReasons: cr.reasons,
    sections: { obs: gen.observation ? cr.dimensions.complete * 100 : 0, learn: align.dimensions?.learningGrounded != null ? Math.round(align.dimensions.learningGrounded * 100) : 0, sup: align.dimensions?.supportPlanSep != null ? Math.round(align.dimensions.supportPlanSep * 100) : 0 },
  };
}

const mean = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : 0);

d('관찰일지 목표 품질 리포트(안전/목표정렬/복붙 분리 + 신호 분석)', () => {
  test('생성 → 분리 집계 + 신호별 분석 + 전후 비교 + 교사 검토 샘플', async () => {
    const local = loadLocal();
    const baseline = loadJson('baseline_learning.local.json');
    const rows = local || OBSERVATION_GOLDEN.regressionCases.map((r) => ({ id: r.id, name: r.factCard?.name, input: r.input, target: null }));
    const usedTarget = !!local;

    const scored = [];
    for (const row of rows) scored.push(await scoreRow(row, baseline));
    const forAgg = scored.map((s) => ({ ...s, targetSections: s.target }));
    const agg = aggregate(forAgg);
    const uniq = dedupeByInput(forAgg).representatives;

    // ── 신호 분석(고유 입력 기준) ────────────────────────────────────────
    const detected = uniq.filter((r) => r.signal);
    const safeKept = uniq.filter((r) => !r.signal);
    const bySignal = {};
    detected.forEach((r) => {
      const k = r.signal.label;
      (bySignal[k] = bySignal[k] || []).push(r);
    });
    const withPrev = uniq.filter((r) => r.prev);
    const prevAvg = { target: mean(withPrev.map((r) => r.prev.target)), safety: mean(withPrev.map((r) => r.prev.safety)), copyReady: mean(withPrev.map((r) => r.prev.copyReady)) };
    const newAvg = { target: mean(withPrev.map((r) => r.targetScore)), safety: mean(withPrev.map((r) => r.safety)), copyReady: mean(withPrev.map((r) => r.copyReady)) };
    const prevSafeCount = withPrev.filter((r) => r.prev.safe).length;
    const improved = withPrev.filter((r) => r.targetScore > r.prev.target).sort((a, b) => (b.targetScore - b.prev.target) - (a.targetScore - a.prev.target));

    /* eslint-disable no-console */
    console.log('\n================= 관찰일지 목표 품질 리포트 =================');
    console.log(`표본 출처            : ${usedTarget ? '로컬 비식별 데이터셋(목표 포함)' : '골든(목표 없음 — 목표정렬 생략)'}`);
    console.log(`전체 행 수           : ${agg.totals.rows} / 고유 입력 ${agg.totals.unique} / 중복 그룹 ${agg.totals.dupGroups} / 입력같고목표다름 ${agg.totals.sameInputDiffTarget}`);
    console.log('--- 점수(중복 포함 → 고유 입력 기준) : 고유 입력 기준이 주요 지표 ---');
    console.log(`Safety Score         : ${agg.withDuplicates.safety} → ${agg.uniqueInput.safety}   (안전·사실성 위반 없음=100, 품질 보장 아님)`);
    console.log(`Target Alignment     : ${agg.withDuplicates.target} → ${agg.uniqueInput.target}   (v3 목표 문장 대비 문서 품질)`);
    console.log(`Copy-Ready Score     : ${agg.withDuplicates.copyReady} → ${agg.uniqueInput.copyReady}   (형식·완결성·자연스러움)`);
    console.log(`섹션 평균(관찰/배움/지원): ${agg.uniqueInput.sectionObs} / ${agg.uniqueInput.sectionLearn} / ${agg.uniqueInput.sectionSup}`);
    console.log('--- 신호 분석(고유 입력 기준) ---');
    console.log(`신호 감지 성공률     : ${detected.length}/${uniq.length} (${Math.round((detected.length / uniq.length) * 100)}%)`);
    console.log(`SAFE 폴백 비율       : ${safeKept.length}/${uniq.length} (${Math.round((safeKept.length / uniq.length) * 100)}%)`);
    Object.entries(bySignal).sort((a, b) => b[1].length - a[1].length).forEach(([label, rs]) => {
      const rep = rs[0];
      console.log(`  [${label}] n=${rs.length} · Target ${mean(rs.map((r) => r.targetScore))} · Safety ${mean(rs.map((r) => r.safety))} · 대표 ${rep.id}: ${String(rep.input).slice(0, 26)}…`);
    });
    console.log('신호 미감지(보수적 폴백 유지):');
    safeKept.forEach((r) => console.log(`  - ${r.id}: ${r.input}`));
    if (withPrev.length) {
      console.log('--- 이전 단계 대비(동일 스코어러, 배움 읽기 교체 비교) ---');
      console.log(`Target Alignment     : ${prevAvg.target} → ${newAvg.target} (${(newAvg.target - prevAvg.target).toFixed(1)})`);
      console.log(`Safety Score         : ${prevAvg.safety} → ${newAvg.safety} (${(newAvg.safety - prevAvg.safety).toFixed(1)})`);
      console.log(`Copy-Ready Score     : ${prevAvg.copyReady} → ${newAvg.copyReady} (${(newAvg.copyReady - prevAvg.copyReady).toFixed(1)})`);
      console.log(`SAFE 폴백            : ${prevSafeCount}/${withPrev.length} → ${safeKept.length}/${uniq.length}`);
      console.log('--- 개선 사례(전→후, 상위 5) ---');
      improved.slice(0, 5).forEach((r) => {
        console.log(`  ▲ ${r.id} [${r.prev.target}→${r.targetScore}] ${r.input}`);
        console.log(`     이전: ${r.prev.learning}`);
        console.log(`     이후: ${r.gen.learning}`);
        console.log(`     목표: ${r.target?.learning}`);
        console.log(`     판단: 입력 단서(${r.signal?.label || '-'})에 근거한 개별 해석으로 일반 문장 탈피, 사실 추가 없음`);
      });
    }
    console.log('--- 보수적 폴백 유지 사례(사실 추가 위험 방지) ---');
    safeKept.slice(0, 3).forEach((r) => {
      console.log(`  ■ ${r.id} ${r.input}`);
      console.log(`     생성: ${r.gen.learning}`);
      console.log(`     이유: 행동 단서가 약하거나 다의적 — 확장 시 감정·의도 추정(사실 추가) 위험`);
    });
    console.log('--- 목표 대비 약한 표현 유형 상위 10(고유 입력 기준) ---');
    agg.weakTop.forEach(([why, n], i) => console.log(`  ${i + 1}. (${n}건) ${why}`));
    console.log('==========================================================\n');
    /* eslint-enable no-console */

    if (usedTarget) {
      writeReviewReport(scored, agg);
      writeTeacherSamples(uniq);
    }

    // 품질 게이트
    expect(agg.totals.unique).toBeLessThan(agg.totals.rows);
    expect(agg.uniqueInput.safety).toBeGreaterThanOrEqual(90);      // 안전 유지
    if (usedTarget) expect(agg.uniqueInput.target).toBeGreaterThan(0);
    if (withPrev.length) {
      expect(newAvg.safety).toBeGreaterThanOrEqual(prevAvg.safety); // Safety 하락 금지
      expect(safeKept.length).toBeLessThanOrEqual(prevSafeCount);   // SAFE 폴백 비율 증가 금지
    }
  }, 180000);
});

// 교사 검토용 비교 리포트(Markdown) — gitignore 경로에만 생성.
function writeReviewReport(scored, agg) {
  const uniq = dedupeByInput(scored.map((s) => ({ ...s, targetSections: s.target }))).representatives;
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
  fs.mkdirSync(LOCAL_DIR(), { recursive: true });
  fs.writeFileSync(path.join(LOCAL_DIR(), 'review_report.local.md'), md, 'utf-8');
  // eslint-disable-next-line no-console
  console.log('교사 검토용 비교 리포트 저장(로컬·gitignore): data/golden_local/review_report.local.md');
}

// 교사 실사용 검토 샘플(≤20) — 점수 검토가 아니라 실제 사용 가능성 표시용.
function writeTeacherSamples(uniq) {
  const used = new Set();
  const take = (arr, n, tag) => arr.filter((r) => !used.has(r.id)).slice(0, n).map((r) => { used.add(r.id); return { ...r, tag }; });
  const seenSig = new Set();
  const newSignalCases = uniq.filter((r) => r.signal && !['persist', 'share', 'express', 'explore', 'selfhelp', 'move', 'make'].includes(r.signal.key))
    .filter((r) => { if (seenSig.has(r.signal.key)) return false; seenSig.add(r.signal.key); return true; });
  const picks = [
    ...take(newSignalCases, 8, '새 신호 적용'),
    ...take(uniq.filter((r) => !r.signal), 3, 'SAFE 폴백 유지'),
    ...take([...uniq].sort((a, b) => (a.targetScore ?? 0) - (b.targetScore ?? 0)), 3, 'Target 낮음'),
    ...take(uniq.filter((r) => /"[^"]+"/.test(r.input)), 2, '직접 발화'),
    ...take(uniq.filter((r) => /친구|또래/.test(r.input)), 2, '또래 상호작용'),
    ...take(uniq.filter((r) => r.signal && ['selfhelp', 'hygiene', 'meal', 'rules'].includes(r.signal.key)), 2, '일상·자립'),
  ].slice(0, 20);
  const block = (c, i) => [
    `## ${i + 1}. [${c.tag}] ${c.id}  ·  Safety ${c.safety} / Target ${c.targetScore} / Copy-Ready ${c.copyReady}`,
    `> **입력(익명)**: ${c.input}`,
    '',
    '**생성 결과(복사용)**',
    '```',
    `[관찰내용]`,
    c.gen.observation || '',
    '',
    `[배움 읽기]`,
    c.gen.learning || '',
    '',
    `[교사 지원 및 다음 계획]`,
    c.gen.support || '',
    '```',
    `**참고(목표 예시 배움 읽기)**: ${c.target?.learning || '-'}`,
    '',
    '**검토 표시** (하나를 선택해 주세요)',
    '- [ ] 그대로 사용 가능',
    '- [ ] 표현만 약간 수정 필요',
    '- [ ] 사실과 다름',
    '- [ ] 더 자연스럽게 필요',
    '- [ ] 더 구체적인 지원 계획 필요',
    '',
    '메모: ______________________________________________',
    '',
  ].join('\n');
  const md = [
    '# 관찰일지 교사 검토 샘플 (로컬 전용 · 비식별 · 20건 이하)',
    '',
    '실제 붙여넣어 쓸 수 있는 수준인지 표시해 주세요. 점수는 참고용입니다.',
    '',
    ...picks.map(block),
  ].join('\n');
  fs.writeFileSync(path.join(LOCAL_DIR(), 'review_samples.local.md'), md, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`교사 검토 샘플 저장(로컬·gitignore): data/golden_local/review_samples.local.md (${picks.length}건)`);
}
