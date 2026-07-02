// (진단 도구) 현재 배움 읽기 스냅샷 + 신호 미감지(폴백) 고유 입력 목록. OBSDIAG=1로만 실행.
// baseline_learning.local.json은 "이전 단계" 비교 기준이므로 이미 있으면 덮어쓰지 않는다.
import fs from 'fs';
import path from 'path';
import { buildLearningReading, readLearningSignal } from './ai/copyReadyObservation';

const RUN = !!process.env.OBSDIAG;
const d = RUN ? describe : describe.skip;

d('신호 진단', () => {
  test('스냅샷 저장(최초 1회) + 신호 미감지 목록', () => {
    const p = path.resolve(process.cwd(), 'data/golden_local/observation_golden.local.json');
    if (!fs.existsSync(p)) { console.log('로컬 데이터셋 없음 — scripts/analyze_v3.py 먼저 실행'); return; } // eslint-disable-line no-console
    const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const seen = new Set();
    const base = {};
    const safe = [];
    for (const r of j.regressionCases) {
      const l = buildLearningReading({ input: r.input, childName: r.factCard?.name });
      base[r.id] = l;
      const key = r.input.replace(/[A-Z]원아|○○/g, '○');
      if (seen.has(key)) continue;
      seen.add(key);
      if (!readLearningSignal(r.input)) safe.push({ id: r.id, input: r.input, tgt: r.target?.learning });
    }
    const basePath = path.resolve(process.cwd(), 'data/golden_local/baseline_learning.local.json');
    if (!fs.existsSync(basePath)) fs.writeFileSync(basePath, JSON.stringify(base, null, 1), 'utf-8'); // 이전 단계 기준 보존
    /* eslint-disable no-console */
    console.log(`\n고유 입력 ${seen.size} · 신호 미감지(폴백) ${safe.length}건`);
    safe.forEach((s) => console.log(`  ${s.id} | ${s.input}\n      └목표배움: ${s.tgt}`));
    /* eslint-enable no-console */
    expect(seen.size).toBeGreaterThan(0);
  });
});
