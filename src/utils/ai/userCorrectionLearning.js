// 사용자 선택/수정 학습 연결 지점 (스텁).
// 이번 단계에서는 저장을 완전히 구현하지 않는다. 선택/수정 데이터를 받아 둘 구조만 열어 둔다.
// 외부 서버 없이, 추후 로컬(localStorage/IndexedDB) 또는 로컬 학습 파이프라인에 연결한다.

const pending = [];

// 비교 모드에서 사용자가 legacy/modular 중 하나를 선택하거나 직접 수정했을 때 호출.
export function recordEngineChoice({ docType, chosenEngine, legacyText = '', modularText = '', finalText, input = '' } = {}) {
  const resolvedFinal = finalText != null
    ? finalText
    : (chosenEngine === 'modular' ? modularText : legacyText);
  const entry = {
    docType,
    chosenEngine,            // 'legacy' | 'modular'
    finalText: resolvedFinal, // 사용자가 최종 채택(또는 수정)한 문장
    edited: finalText != null && finalText !== legacyText && finalText !== modularText,
    input,
    at: new Date().toISOString(),
  };
  pending.push(entry);
  // TODO(userCorrectionLearning): 선택/수정 데이터를 로컬 학습 신호로 누적·저장.
  //  - 어떤 엔진이 더 자주 선택되는지(엔진 선호도)
  //  - 사용자가 어떤 식으로 문장을 고치는지(수정 패턴 → 규칙/데이터셋 보강)
  //  외부 API/서버 없이 로컬에서만 처리한다.
  return entry;
}

export function getPendingCorrections() {
  return [...pending];
}

export function clearPendingCorrections() {
  pending.length = 0;
}
