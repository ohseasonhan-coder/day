// 문장 엔진 비교 (개발자/검수 모드 전용, 로컬 100%).
// legacy 출력과 modular(composer) 출력을 5종 문서 유형별로 생성하고 품질 점수를 비교한다.
// 일반 사용자 화면에는 절대 영향을 주지 않는다. 자동 대체하지 않고 추천만 표시한다.
import { processRecord as legacyProcessRecord } from './publicApi';
import { analyzeRecordInput } from './draftComposer';
import { createObservation } from './documentEngines/observationEngine';
import { composeEvaluation } from './documentEngines/evaluationComposer';
import { composeNotice } from './documentEngines/noticeComposer';
import { composeCounseling, composeDevelopment } from './documentEngines/counselingDevelopmentComposer';
import { scoreText } from './qualityScorer';

// 비교 대상 5종 문서
export const COMPARE_DOC_TYPES = [
  { key: 'observation', label: '관찰일지', documentType: 'observation' },
  { key: 'dailyReport', label: '보육일지 평가', documentType: 'dailyReport' },
  { key: 'notice', label: '알림장', documentType: 'notice' },
  { key: 'counseling', label: '상담자료', documentType: 'counseling' },
  { key: 'development', label: '발달평가', documentType: 'development' },
];

// 상담/발달은 단일 입력용 legacy 산출물이 없어, 이전 템플릿 방식(영역 위주, 근거 미반영)을 비교 기준으로 둔다.
function legacyCounselingTemplate(name, areas) {
  return `${name}의 최근 기록을 보면 ${areas}에서 관찰된 모습이 있습니다. 상담에서는 가정에서의 모습과 원에서의 지원 방향을 함께 나누면 좋겠습니다.`;
}
function legacyDevelopmentTemplate(name, areas) {
  return `${name}는 관찰 기간 동안 ${areas}과 관련된 경험을 보였다. 교사는 기록된 장면을 바탕으로 강점과 지원이 필요한 지점을 지속적으로 관찰한다.`;
}

const pickScores = (score) => ({
  totalScore: score.totalScore,
  factPreservation: score.detail.factPreservation,
  naturalness: score.detail.naturalness,
  safety: score.detail.safety,
  documentFit: score.detail.documentFit,
});

// 두 결과 중 점수가 더 높은 쪽을 추천(동점이면 modular). 자동 대체는 하지 않는다.
export function pickRecommended(legacyScore, modularScore) {
  return modularScore.totalScore >= legacyScore.totalScore ? 'modular' : 'legacy';
}

// legacy + modular 출력과 품질 점수를 5종 문서별로 생성한다.
export async function buildEngineComparison({ childName, rawText, classAge } = {}) {
  const analysis = analyzeRecordInput({ childName, rawText, classAge });
  const name = childName || analysis.parsedInput?.childName || '유아';
  const areas = analysis.devAreas?.length ? analysis.devAreas.join(', ') : '놀이와 일상 경험';
  const legacy = await legacyProcessRecord({ childName, rawText, classAge, recordType: 'observe' });

  const legacyText = {
    observation: legacy.observation || '',
    dailyReport: legacy.evaluation || '',
    notice: legacy.parent || '',
    counseling: legacyCounselingTemplate(name, areas),
    development: legacyDevelopmentTemplate(name, areas),
  };
  const opts = { childName, input: rawText, categories: analysis.categories, curriculum: analysis.curriculum };
  const modularText = {
    observation: createObservation({ parsedInput: analysis.parsedInput, categories: analysis.categories, scene: analysis.scene }),
    dailyReport: composeEvaluation(opts),
    notice: composeNotice(opts),
    counseling: composeCounseling(opts),
    development: composeDevelopment(opts),
  };

  const results = COMPARE_DOC_TYPES.map(({ key, label, documentType }) => {
    const lText = legacyText[key] || '';
    const mText = modularText[key] || '';
    const legacyScore = scoreText(lText, { input: rawText, documentType });
    const modularScore = scoreText(mText, { input: rawText, documentType });
    return {
      key,
      label,
      documentType,
      legacy: { engine: 'legacy', text: lText, scores: pickScores(legacyScore) },
      modular: { engine: 'modular', text: mText, scores: pickScores(modularScore) },
      recommended: pickRecommended(legacyScore, modularScore),
    };
  });

  return { results };
}

// 비교 모드 게이트: 꺼져 있으면 비교 데이터를 생성/노출하지 않는다(기존 화면 그대로).
export async function getComparisonView({ enabled = false, childName, rawText, classAge } = {}) {
  if (!enabled) return { enabled: false };
  const comparison = await buildEngineComparison({ childName, rawText, classAge });
  return { enabled: true, ...comparison };
}
