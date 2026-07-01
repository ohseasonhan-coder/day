// 품질 리포트 집계 — 중복 입력이 평균을 부풀리지 않도록 "고유 입력 기준"을 주요 지표로 산출한다.
// 순수 함수(외부 호출 없음). 리포트 러너와 회귀 테스트가 공유한다.

const clean = (s) => String(s || '').trim();
// 익명 라벨/합성 이름을 제거해 입력·목표를 비교용으로 정규화
const NORM_NAMES = /([A-Z]원아|지우|서연|도윤|하준|수아|민준|예린|시우|하은|주아|연우|지호|서윤|건우|아인|윤서|준서|다은|재윤|소율)(이|가|은|는|을|를|와|과|에게|의|도)?/g;
export function normalizeText(s) {
  return clean(s).replace(NORM_NAMES, '○').replace(/\s+/g, ' ');
}

// rows: [{ input, targetSections:{observation,learning,support}|null, ... }]
// 반환: { groups:[{key, rows, sameTarget}], uniqueCount, dupGroupCount, sameInputDiffTarget, representatives }
export function dedupeByInput(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = normalizeText(r.input);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  const groups = [];
  let dupGroupCount = 0;
  let sameInputDiffTarget = 0;
  map.forEach((rs, key) => {
    const targetSet = new Set(rs.map((r) => normalizeText([r.targetSections?.observation, r.targetSections?.learning, r.targetSections?.support].filter(Boolean).join(' '))));
    const sameTarget = targetSet.size <= 1;
    if (rs.length > 1) dupGroupCount += 1;
    if (rs.length > 1 && !sameTarget) sameInputDiffTarget += 1;
    groups.push({ key, rows: rs, sameTarget });
  });
  return {
    groups,
    uniqueCount: map.size,
    dupGroupCount,
    sameInputDiffTarget,
    representatives: groups.map((g) => g.rows[0]), // 그룹당 1건(고유 입력 기준)
  };
}

const mean = (arr) => (arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : 0);

// scored: [{ id, input, safety, targetScore, copyReady, targetSections, alignReasons:[], sections:{obs,learn,sup} }]
// 각 항목은 이미 점수화된 상태. 중복포함/고유입력 두 기준으로 집계한다.
export function aggregate(scored) {
  const build = (rows) => ({
    n: rows.length,
    safety: mean(rows.map((r) => r.safety)),
    target: mean(rows.map((r) => r.targetScore).filter((x) => x != null)),
    copyReady: mean(rows.map((r) => r.copyReady)),
    sectionObs: mean(rows.map((r) => r.sections?.obs ?? 0)),
    sectionLearn: mean(rows.map((r) => r.sections?.learn ?? 0)),
    sectionSup: mean(rows.map((r) => r.sections?.sup ?? 0)),
  });

  const dd = dedupeByInput(scored);
  const uniqueRows = dd.representatives;

  // 약한 표현 유형 상위 10 — 정렬 사유 빈도(고유 입력 기준)
  const reasonFreq = {};
  uniqueRows.forEach((r) => (r.alignReasons || []).forEach((why) => { reasonFreq[why] = (reasonFreq[why] || 0) + 1; }));
  const weakTop = Object.entries(reasonFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // 좋은 사례 5 / 개선 필요 10 (고유 입력 기준, target 점수 기준)
  const byTarget = [...uniqueRows].sort((a, b) => (b.targetScore ?? 0) - (a.targetScore ?? 0));
  const goodCases = byTarget.slice(0, 5);
  const needImprove = [...uniqueRows].sort((a, b) => (a.targetScore ?? 0) - (b.targetScore ?? 0)).slice(0, 10);

  return {
    withDuplicates: build(scored),
    uniqueInput: build(uniqueRows),
    totals: { rows: scored.length, unique: dd.uniqueCount, dupGroups: dd.dupGroupCount, sameInputDiffTarget: dd.sameInputDiffTarget },
    weakTop,
    goodCases,
    needImprove,
    priorities: weakTop.slice(0, 5).map(([why, n], i) => ({ rank: i + 1, why, count: n })),
  };
}

export default aggregate;
