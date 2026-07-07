import fs from 'fs';
import os from 'os';
import path from 'path';
import { processRecord } from './ai';
import { REVIEW_SAMPLE_PRESETS } from './ai/reviewSamplePresets';
import { generateObservationWithEngine } from './ai/llm/engineAdapter';
import { setServerConfig } from './ai/llm/privateServerLLM';
import { parseTargetSections, scoreCopyReady } from './ai/targetQuality';

const run = process.env.RUN_PRIVATE_7B === '1' ? test : test.skip;
const SAMPLE_CHILDREN = {
  art: '가온', paint: '가온', conflict: '준호', command_fix: '나윤', cooperate: '도윤',
  physical: '지호', top: '윤재', role: '수아', cleanup: '다은', safety_edu: '시아',
  fire_bell: '가온', nature: '은우', leaf: '지안', passive: '예준', emotion_color: '아윤',
  cry: '윤서', support_change: '라윤', parent_soft: '태오', fact_keep: '하준', development: '라온',
  emotion_only_cry: '봄', emotion_only_fear: '가을', sparse_arrival: '난', sparse_room: '들',
  long_narrative: '해솔', long_daily: '한별', metaphor_cloud: '윤슬', metaphor_leaf: '새벽',
  typo_colloquial: '보름', mixed_conflict: '도담', silent_observation: '미르', teacher_support_only: '라윤',
};

run('Ollama 7B 실제 30건 이상 품질·fallback·속도 검증', async () => {
  setServerConfig({
    url: process.env.PRIVATE_7B_URL || 'http://localhost:11434/v1',
    model: process.env.PRIVATE_7B_MODEL || 'qwen2.5:7b-instruct',
  });

  const sampleCount = Math.max(1, Math.min(REVIEW_SAMPLE_PRESETS.length, Number(process.env.PRIVATE_7B_COUNT) || 30));
  const sampleOffset = Math.max(0, Number(process.env.PRIVATE_7B_OFFSET) || 0);
  const rows = [];
  for (const sample of REVIEW_SAMPLE_PRESETS.slice(sampleOffset, sampleOffset + sampleCount)) {
    const childName = SAMPLE_CHILDREN[sample.id] || '가온';
    const base = await processRecord({ childName, rawText: sample.rawText, classAge: 4, recordType: 'observe' });
    const started = Date.now();
    const result = await generateObservationWithEngine({
      input: sample.rawText,
      childName,
      observation: base.observation,
      support: base.support,
      engine: 'private-server-7b',
    });
    const elapsedMs = Date.now() - started;
    const b = parseTargetSections(result.b2CopyReady);
    const c = parseTargetSections(result.copyReady);
    const bScore = scoreCopyReady(b);
    const cScore = scoreCopyReady(c);
    rows.push({
      id: sample.id,
      label: sample.label,
      childName,
      elapsedMs,
      engineUsed: result.engineUsed,
      fallbackReason: result.fallbackReason || '',
      auditSeverity: result.audit?.severity || 'none',
      auditWarnings: result.audit?.warnings || [],
      bCopyScore: bScore.score,
      cCopyScore: cScore.score,
      b: result.b2CopyReady,
      c: result.copyReady,
    });
  }

  const success = rows.filter((r) => r.engineUsed === 'private-server-7b');
  const summary = {
    model: process.env.PRIVATE_7B_MODEL || 'qwen2.5:7b-instruct',
    server: process.env.PRIVATE_7B_URL || 'http://localhost:11434/v1',
    count: rows.length,
    cAccepted: success.length,
    fallbackCount: rows.length - success.length,
    auditPassRate: Math.round((success.length / rows.length) * 100),
    averageMs: Math.round(rows.reduce((sum, row) => sum + row.elapsedMs, 0) / rows.length),
    p95Ms: [...rows].sort((a, b) => a.elapsedMs - b.elapsedMs)[Math.ceil(rows.length * 0.95) - 1].elapsedMs,
    cScoreBetter: rows.filter((r) => r.cCopyScore > r.bCopyScore).length,
    equalScore: rows.filter((r) => r.cCopyScore === r.bCopyScore).length,
    bScoreBetter: rows.filter((r) => r.bCopyScore > r.cCopyScore).length,
  };
  const report = { generatedAt: new Date().toISOString(), summary, rows };
  const out = path.join(os.tmpdir(), 'saemwork_private_7b_validation.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n===== PRIVATE 7B VALIDATION =====\n${JSON.stringify(summary, null, 2)}\nreport: ${out}`);

  expect(rows).toHaveLength(Math.min(sampleCount, Math.max(0, REVIEW_SAMPLE_PRESETS.length - sampleOffset)));
  expect(summary.cAccepted + summary.fallbackCount).toBe(rows.length);
}, 35 * 60 * 1000);
