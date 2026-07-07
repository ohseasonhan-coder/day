import { lintSurfaceText, overlapRate } from './sentenceLinter';

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

function evidenceForUnits(unitIds = [], meaningUnits = []) {
  const wanted = new Set(unitIds);
  return unique(meaningUnits.filter((unit) => wanted.has(unit.id)).flatMap((unit) => unit.evidenceIds || []));
}

function sentenceParts(text = '') {
  return clean(text).split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
}

function dedupeSentences(text = '') {
  const seen = new Set();
  let deleted = 0;
  const kept = sentenceParts(text).filter((sentence) => {
    const key = sentence.replace(/[^\uAC00-\uD7A3]/g, '');
    if (seen.has(key)) {
      deleted += 1;
      return false;
    }
    seen.add(key);
    return true;
  });
  return { text: kept.join(' '), deleted };
}

function removeGenericOnly(text = '') {
  const genericMarkers = ['다양한 경험', '지속적으로 격려', '긍정적인 상호작용', '?ㅼ뼇??寃쏀뿕', '寃⑸젮?쒕떎', '吏덈Ц?쒕떎'];
  let value = clean(text);
  let deleted = 0;
  genericMarkers.forEach((marker) => {
    if (value.includes(marker)) {
      value = value.replaceAll(marker, '');
      deleted += 1;
    }
  });
  return { text: clean(value).replace(/\s+\./g, '.'), deleted };
}

function limitMeaningUnits(candidate = {}, context = {}) {
  const original = candidate.meaningUnitIds || [];
  if (!original.length) return { ids: original, deleted: 0 };
  let max = 2;
  if (candidate.section === 'observation') max = 3;
  if (candidate.section === 'support') max = 2;
  const claimed = new Set(context.claimLedger?.claimedMeaningUnitIds || []);
  const supportFirst = candidate.section === 'support'
    ? original.filter((id) => /next_support|actual_teacher_support/.test(id))
    : original;
  const ordered = unique([...supportFirst, ...original]).filter((id) => !claimed.has(id) || candidate.section === 'observation');
  const ids = ordered.slice(0, max);
  return { ids: ids.length ? ids : original.slice(0, Math.min(max, original.length)), deleted: Math.max(0, original.length - Math.min(max, original.length)) };
}

export function buildClaimLedger(sections = {}) {
  const rows = ['observation', 'learning', 'support'].map((section) => {
    const candidate = sections[section] || {};
    return {
      section,
      meaningUnitIds: candidate.meaningUnitIds || [],
      evidenceIds: candidate.evidenceIds || [],
      patternId: candidate.patternId || candidate.supportPatternId || '',
    };
  });
  return {
    rows,
    claimedMeaningUnitIds: unique(rows.flatMap((row) => row.meaningUnitIds)),
    claimedEvidenceIds: unique(rows.flatMap((row) => row.evidenceIds)),
    metadataOnly: true,
  };
}

export function meaningOverlapRate(left = [], right = []) {
  const a = new Set(left || []);
  const b = new Set(right || []);
  if (!a.size) return 0;
  return [...a].filter((item) => b.has(item)).length / a.size;
}

export function compressCandidate(candidate = {}, context = {}) {
  const meaningUnits = context.meaningUnits || [];
  const beforeIds = candidate.meaningUnitIds || [];
  const limited = limitMeaningUnits(candidate, context);
  let text = clean(candidate.text);
  let deletedClauseCount = limited.deleted;
  const deduped = dedupeSentences(text);
  text = deduped.text || text;
  deletedClauseCount += deduped.deleted;
  const generic = removeGenericOnly(text);
  text = generic.text || text;
  deletedClauseCount += generic.deleted;
  if (candidate.section === 'learning' && context.observation && overlapRate(text, context.observation) > 0.7) {
    const parts = sentenceParts(text);
    if (parts.length > 1) {
      text = parts.slice(-1).join(' ');
      deletedClauseCount += parts.length - 1;
    }
  }
  if (candidate.section === 'support' && context.learning && overlapRate(text, context.learning) > 0.62) {
    const parts = sentenceParts(text);
    if (parts.length > 1) {
      text = parts.slice(0, 1).join(' ');
      deletedClauseCount += parts.length - 1;
    }
  }
  const nextEvidence = evidenceForUnits(limited.ids, meaningUnits);
  const evidenceIds = nextEvidence.length ? nextEvidence : candidate.evidenceIds || [];
  const lint = lintSurfaceText(text, candidate.section, { hasTeacherSupport: context.graph?.flags?.hasTeacherSupport });
  const requiredMissing = !limited.ids.length || !evidenceIds.length;
  const semanticCompression = {
    applied: deletedClauseCount > 0 || limited.ids.length !== beforeIds.length,
    deletedClauseCount,
    beforeMeaningUnitCount: beforeIds.length,
    afterMeaningUnitCount: limited.ids.length,
    clauseLedger: limited.ids.map((id, index) => ({
      clauseId: `${candidate.section || 'section'}_clause_${index + 1}`,
      meaningUnitIds: [id],
      evidenceIds: evidenceForUnits([id], meaningUnits),
      section: candidate.section === 'learning' ? 'learningReading' : candidate.section,
      priority: index + 1,
    })),
    issueCount: lint.issues.length,
    rejected: requiredMissing,
    metadataOnly: true,
  };
  return {
    ...candidate,
    text,
    meaningUnitIds: limited.ids,
    evidenceIds,
    semanticCompression,
    semanticCompressed: semanticCompression.applied,
    compressionDeletedClauseCount: deletedClauseCount,
    semanticCompressionRejected: requiredMissing,
  };
}

export function sectionMeaningOverlapSummary(sections = {}) {
  const observation = sections.observation?.meaningUnitIds || [];
  const learning = sections.learning?.meaningUnitIds || [];
  const support = sections.support?.meaningUnitIds || [];
  return {
    observationLearning: Math.round(meaningOverlapRate(learning, observation) * 1000) / 10,
    learningSupport: Math.round(meaningOverlapRate(support, learning) * 1000) / 10,
    anyOverlap: meaningOverlapRate(learning, observation) > 0.5 || meaningOverlapRate(support, learning) > 0.5,
  };
}

export default compressCandidate;
