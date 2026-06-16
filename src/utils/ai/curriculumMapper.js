import { ageKeyForClassAge, curriculumNameForAge, matchCurriculumBest } from '../standardCurriculum';

const AREA_ALIASES = {
  신체운동건강: '신체운동·건강',
  신체운동: '신체운동·건강',
  건강: '신체운동·건강',
};

const normalizeArea = (area) => AREA_ALIASES[area] || area;

export function mapCurriculum({ parsedInput, categories, classAge } = {}) {
  const text = parsedInput?.normalizedText || parsedInput?.rawText || '';
  const ageKey = ageKeyForClassAge(classAge);
  const areas = (categories || []).map(normalizeArea);
  const basis = matchCurriculumBest(text, ageKey, areas);
  if (!basis) {
    return {
      source: curriculumNameForAge(ageKey),
      areas,
      item: null,
    };
  }
  return {
    ...basis,
    source: curriculumNameForAge(ageKey),
    areas,
  };
}

export function mapCurriculumForAnalysis({ parsedInput, categories, devAreas, classAge } = {}) {
  const primary = mapCurriculum({ parsedInput, categories: devAreas?.length ? devAreas : categories, classAge });
  return {
    ...primary,
    matched: !!primary?.item,
    requestedAreas: devAreas?.length ? devAreas : categories || [],
  };
}
