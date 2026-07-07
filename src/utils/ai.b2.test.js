import { SYNTHETIC_CASES } from './ai/datasets/syntheticCases';
import { B2_SYNTHETIC_CASES } from './ai/datasets/b2Cases';
import { B2_THEMES } from './ai/b2/themes';
import { buildB2FactCard, judgeB2Themes, buildB2SentencePlan, generateB2, adjustB2 } from './ai/b2/engine';
import { parseTargetSections, scoreCopyReady } from './ai/targetQuality';
import { buildAuditedCopyReady } from './ai/copyReadyObservation';
import { processRecord } from './ai/publicApi';

const ALL = [...SYNTHETIC_CASES, ...B2_SYNTHETIC_CASES];
const generate = (item, mode = 'default') => generateB2({ input: item.input, childName: item.name, observation: item.input, fallbackCopyReady: '', mode });

describe('B2 선언형 테마와 증거 계획', () => {
  test('15개 이상 테마가 필수 계약과 자체 사례를 가진다', () => {
    expect(B2_THEMES.length).toBeGreaterThanOrEqual(15);
    B2_THEMES.forEach((theme) => {
      ['id','priority','trigger','coexistThemes','conflictThemes','allowedClaims','blockedClaims','allowedSupportActions','phraseFamilies','fallbackPolicy','testCases'].forEach((key) => expect(theme[key]).toBeDefined());
      expect(theme.allowedSupportActions.length).toBeGreaterThanOrEqual(2);
      expect(theme.phraseFamilies.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('사실·테마·계획의 모든 의미가 evidence id로 연결된다', () => {
    const card = buildB2FactCard({ input: '해솔이가 탑이 무너지자 다시 쌓으며 친구에게 "잡아 줘"라고 말했다.', childName: '해솔' });
    const judgment = judgeB2Themes(card);
    const plan = buildB2SentencePlan({ card, judgment, observation: card.source });
    const known = new Set(card.facts.map((fact) => fact.id));
    expect(judgment.primary.id).toBe('retry');
    expect(plan.learningPlan.evidenceIds.length).toBeGreaterThan(0);
    expect(plan.learningPlan.evidenceIds.every((id) => known.has(id))).toBe(true);
    expect(plan.supportPlan.evidenceIds.every((id) => known.has(id))).toBe(true);
  });

  test('감정 회복은 감정과 회복 단서가 함께 있을 때만 활성화된다', () => {
    const only = judgeB2Themes(buildB2FactCard({ input: '봄이가 울었다.', childName: '봄' }));
    const recovered = judgeB2Themes(buildB2FactCard({ input: '봄이가 울었지만 곧 진정하고 다시 놀이했다.', childName: '봄' }));
    expect(only.ranked.map((theme) => theme.id)).not.toContain('emotion_recovery');
    expect(recovered.ranked.map((theme) => theme.id)).toContain('emotion_recovery');
  });
});

describe('B2 105건 이상 회귀와 품질 리포트', () => {
  test('사실 보존·결정론·후보 선택·보수 처리를 검증한다', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(100);
    const rows = ALL.map((item) => {
      const result = generate(item);
      const previous = buildAuditedCopyReady({ observation: item.input, support: '', input: item.input, childName: item.name });
      return { item, result, previousScore: scoreCopyReady(parseTargetSections(previous.copyReady)).score };
    });
    let safety = 0; let copy = 0; let linked = 0; let sparseSafe = 0; let detected = 0; let candidateN = 0; let rejectRate = 0; let generic = 0;
    const skeletons = new Set(); const texts = new Set(); let observationQuality = 0; let learningQuality = 0; let supportQuality = 0;
    rows.forEach(({ item, result }) => {
      expect(result.copyReady).toBe(generate(item).copyReady);
      expect(result.audit.severity).not.toBe('major');
      (item.input.match(/"[^"]+"/g) || []).forEach((speech) => expect(result.copyReady).toContain(speech));
      expect(result.trace.candidateCount).toBeGreaterThanOrEqual(result.trace.sparse ? 2 : 5);
      expect(result.trace.candidateCount).toBeLessThanOrEqual(15);
      expect(result.trace.evidenceIds.length).toBeGreaterThan(0);
      expect(result.trace.sectionEvidence.observation.length).toBeGreaterThan(0);
      if (result.sections.learning) expect(result.trace.sectionEvidence.learning.length).toBeGreaterThan(0);
      if (result.sections.support) expect(result.trace.sectionEvidence.support.length).toBeGreaterThan(0);
      const scored = scoreCopyReady(result.sections);
      safety += result.audit.pasteScore;
      copy += scored.score;
      linked += result.trace.evidenceCoverage > 0 ? 1 : 0;
      candidateN += result.trace.candidateCount;
      rejectRate += result.trace.candidateRejectRate;
      if (result.trace.themeIds.length) detected += 1;
      if (result.trace.sparse && !result.sections.learning && result.questions.length) sparseSafe += 1;
      if (!result.trace.themeIds.length) generic += 1;
      if (result.trace.skeletonId) skeletons.add(result.trace.skeletonId);
      texts.add(result.sections.learning.replace(item.name, '○'));
      observationQuality += result.sections.observation ? 1 : 0;
      learningQuality += result.trace.sparse ? (!result.sections.learning ? 1 : 0) : (result.sections.learning ? 1 : 0);
      supportQuality += result.sections.support ? 1 : 0;
    });
    const n = rows.length;
    const duplicateRate = Math.round((1 - texts.size / n) * 100);
    const report = {
      cases: n,
      safetyScore: Math.round((safety / n) * 10) / 10,
      copyReadyScore: Math.round((copy / n) * 10) / 10,
      evidenceLinkRate: Math.round(linked / n * 100),
      genericRate: Math.round(generic / n * 100),
      sparseConservativeRate: Math.round(sparseSafe / rows.filter(({ result }) => result.trace.sparse).length * 100),
      themeDetectionRate: Math.round(detected / n * 100),
      averageCandidateCount: Math.round(candidateN / n * 10) / 10,
      candidateRejectRate: Math.round(rejectRate / n),
      uniqueSkeletons: skeletons.size,
      expressionDuplicateRate: duplicateRate,
      sectionQuality: {
        observation: Math.round(observationQuality / n * 100),
        learning: Math.round(learningQuality / n * 100),
        support: Math.round(supportQuality / n * 100),
      },
      improvedCount: rows.filter(({ result, previousScore }) => scoreCopyReady(result.sections).score > previousScore).length,
      improvedExamples: rows.filter(({ result, previousScore }) => scoreCopyReady(result.sections).score > previousScore).slice(0, 5).map(({ item, result }) => ({ id: item.id, input: item.input, learning: result.sections.learning, support: result.sections.support })),
      saferFallbackExamples: rows.filter(({ result }) => result.trace.sparse).slice(0, 5).map(({ item, result }) => ({ id: item.id, input: item.input, learning: result.sections.learning, support: result.sections.support })),
      ruleHardCases: rows.filter(({ item }) => ['metaphor','long'].includes(item.tag)).slice(0, 5).map(({ item }) => item.id),
    };
    // eslint-disable-next-line no-console
    console.log('\n===== B2 QUALITY REPORT =====\n', JSON.stringify(report, null, 2));
    expect(report.safetyScore).toBeGreaterThanOrEqual(95);
    expect(report.evidenceLinkRate).toBe(100);
    expect(report.sparseConservativeRate).toBe(100);
    expect(report.themeDetectionRate).toBeGreaterThanOrEqual(80);
    expect(report.expressionDuplicateRate).toBeLessThanOrEqual(35);
  });

  test('부정 감정·근거 희박·은유·긴 서사·오타 경계 사례를 보수적으로 처리한다', () => {
    const byTag = (tag) => B2_SYNTHETIC_CASES.filter((item) => item.tag === tag).map(generate);
    byTag('emotionOnly').forEach((result) => expect(result.copyReady).not.toMatch(/안정을 찾|진정|극복/));
    byTag('sparse').forEach((result) => { expect(result.sections.learning).toBe(''); expect(result.questions.length).toBeGreaterThan(0); });
    byTag('metaphor').forEach((result) => expect(result.copyReady).not.toMatch(/관찰력이|상상력이|발달/));
    [...byTag('long'), ...byTag('colloquial')].forEach((result) => expect(result.audit.severity).not.toBe('major'));
  });

  test('빠른 조정은 계획 근거 안에서만 재렌더링한다', () => {
    const item = B2_SYNTHETIC_CASES.find((row) => row.id === 'b2_043');
    const base = generate(item);
    const learningOnly = adjustB2({ input: item.input, childName: item.name, observation: item.input, fallbackCopyReady: base.copyReady, mode: 'learning' });
    const supportOnly = adjustB2({ input: item.input, childName: item.name, observation: item.input, fallbackCopyReady: base.copyReady, mode: 'support' });
    expect(learningOnly.sections.support).toBe(base.sections.support);
    expect(supportOnly.sections.learning).toBe(base.sections.learning);
    const outputs = new Set();
    ['shorter','objective','warm','learning','support','speech','facts_only'].forEach((mode) => {
      const adjusted = adjustB2({ input: item.input, childName: item.name, observation: item.input, fallbackCopyReady: base.copyReady, mode });
      expect(adjusted.trace.evidenceIds.every((id) => /^fact_/.test(id))).toBe(true);
      expect(adjusted.audit.severity).not.toBe('major');
      if (mode === 'facts_only') { expect(adjusted.sections.learning).toBe(''); expect(adjusted.sections.support).toBe(''); }
      outputs.add(adjusted.copyReady);
    });
    expect(outputs.size).toBeGreaterThanOrEqual(4);
  });
});

describe('B2 공개 API 연결', () => {
  test('B2는 일반 사용자 기본 안전 엔진으로 항상 적용된다', async () => {
    const options = { childName: '해솔', rawText: '해솔이가 탑이 무너지자 다시 쌓았다.', classAge: 4, recordType: 'observe' };
    const result = await processRecord(options);
    expect(result.b2.enabled).toBe(true);
    expect(result.b2.trace.themeIds).toContain('retry');
    expect(result.sentenceEngine).toBe('rule-b2');
  });
});
