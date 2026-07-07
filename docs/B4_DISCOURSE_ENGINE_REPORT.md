# B4 담화 계획 엔진 검증 보고서

## 1. 구조

이번 변경은 새 엔진 이름이나 새 화면을 만들지 않고 기존 B4 내부를 강화했다.

흐름은 다음과 같다.

`factCard -> eventGraph -> meaningUnits -> candidateDiscoursePlan -> section candidates -> semanticCompressor -> planContrastiveRanker -> audit -> fallback`

B4는 입력 사실, 직접 발화, 사건 순서, 허용 의미, 금지 주장, evidenceId 연결을 유지한다. 다중 담화 계획과 문장 선택기는 같은 사실 카드와 meaningUnit 안에서만 후보를 비교하며, 새 행동·감정·의도·또래 반응·교사 지원을 만들지 않는다.

## 2. 핵심 사건과 의미 압축

각 candidateDiscoursePlan은 핵심 사건 1개와 보조 사건 0~1개만 선택한다. 우선순위는 사건 변화, 직접 발화, 또래 상호작용, 재료·방법·선택의 구체성, 지원 계획 연결 가능성, 과장 위험, 정보 충분성이다.

`semanticCompressor`는 clause 단위로 `meaningUnitIds`와 `evidenceIds`를 유지하면서 중복 절 삭제, 축약, 재배열만 수행한다. 압축 뒤에도 섹션의 필수 meaningUnit이 남아 있어야 하며, evidence가 늘어나면 후보를 폐기한다.

`claimLedger`는 관찰내용, 배움 읽기, 교사 지원 및 다음 계획의 역할을 분리한다. 관찰내용은 행동·순서·직접 발화만 사용하고, 배움 읽기는 안전한 의미만 최대 2개로 제한하며, 지원 계획은 선택된 supportMeaningUnit과 미래형 지원만 사용한다.

## 3. 대조 비교와 문체 선택

`contrastiveRanker`와 `planContrastiveRanker`는 안전 통과 후보끼리 비교한다. 비교 순서는 safetyScore, evidenceCoverage, audit 통과, 핵심 사건 선명도, 섹션 간 의미 분리, 일반론 회피, 교사 기록 문체, 문장 호흡, 직접 발화 배치, 지원 계획 실행 가능성, 최근 리듬 중복, 로컬 선호 가중치다.

`teacherStyleJudge`는 보고서식 표현, 과도한 일반론, 평가형 표현, 반복 연결어, 추상적 지원 계획을 감점하고, 실제 행동과 연결된 짧고 자연스러운 교사 기록 문체를 가점한다.

## 4. Fallback과 개인정보 차단

다음 상황에서는 B4 결과를 사용하지 않고 기존 안전 결과로 fallback한다.

- 정보 부족
- 안전한 관찰내용 생성 실패
- audit에서 사실 추가 감지
- 모든 계획 후보 탈락
- 압축 후 필수 meaningUnit 소실
- evidenceId 불일치
- 다중 계획 결과가 단일 계획보다 낮은 품질

fallback 및 trace metadata에는 reason code만 남긴다. 원문 기록, 원아 이름, 직접 발화 전문, 생성 문장 전문은 trace와 로컬 선호 데이터에 저장하지 않는다.

## 5. 로컬 교사 선호 메타데이터

로컬 선호 학습은 문장 전문이 아니라 다음 메타데이터만 저장한다.

- theme 조합
- patternId
- section
- styleProfile
- 후보 점수
- 선택 여부
- 그대로 사용 가능 여부
- 표현 수정 필요 여부
- 사실과 다름 여부
- 수정 위치 유형

`preferred_result`는 선호 표시일 뿐이며 `use_as_is`와 분리한다. 문장 골격 가중치는 안전 점수보다 우선하지 않는다.

## 6. 문장 자산 승인 절차

교사 수정문을 그대로 문장 자산에 넣지 않는다. 일반화된 골격 제안만 허용하며, 승인 전에는 다음을 확인한다.

- 원문·이름·발화 전문·교사 메모 전문 없음
- section, theme, relation, patternId, evidence requirement 존재
- blockedClaims 명시
- regressionStatus가 passed
- acceptedRate, editedRate, factIssueRate, confidence는 참고 메타데이터로만 사용

## 7. LLM 및 LoRA 준비 구조

이번 단계에서 런타임 LLM, 외부 API, 모델 다운로드, LoRA 학습은 실행하지 않았다.

역할 분리는 다음과 같이 고정했다.

- B4: 사실 카드, 허용 의미, 금지 주장, 관찰내용, 문장 계획, audit, fallback
- LLM 후보: 허용된 meaningUnit 안에서 배움 읽기와 지원 계획의 문장화만 가능
- LoRA 준비 데이터: factsShape, themeIds, planId, patternId, feedback tag, approved skeleton id 같은 비식별 메타데이터만 사용

LoRA 시작 조건은 충분한 비식별 검토 사례, 낮은 사실 오류율, 반복 수정 유형 확인, 역할 분리 검증, LLM 선호도 상승, 개인 PC 모델 검증이 모두 충족될 때로 제한했다.

## 8. 600건 검증 결과

| 항목 | 결과 |
|---|---:|
| 전체 검증 사례 | 600건 |
| adversarial 사례 | 80건 |
| B4 채택 | 524건 |
| B2 사실 보존 | 100% |
| B3 사실 보존 | 100% |
| B4 사실 보존 | 100% |
| 정보 부족 보수 처리 | 100% |
| discoursePlan 생성률 | 92% |
| focusEvent 선택률 | 87% |
| 평균 후보 수 | 27.8개 |
| 후보 안전 탈락률 | 0.5% |
| candidateDiscoursePlan 평균 | 3.3개 |
| 계획 생성 성공률 | 100% |
| 핵심 사건 evidence 연결률 | 100% |
| meaningUnit evidence 연결률 | 100% |
| clause evidence 연결률 | 100% |
| 의미 압축 적용률 | 2% |
| 압축 삭제 절 수 | 25개 |
| 섹션 간 의미 중복률 | 0% |
| B4 fallback 비율 | 13% |
| adversarial 차단률 | 31% |
| adversarial fallback 비율 | 18% |
| B3 표현 중복률 | 5% |
| B4 표현 중복률 | 5% |
| B3 리듬 중복률 | 64% |
| B4 리듬 중복률 | 60% |
| B3 일반론 비율 | 9% |
| B4 일반론 비율 | 1% |
| 지원 계획 구체성 | 100% |
| 지원 계획 일반론 | 0% |
| 연결형 종결 오류 | 0건 |
| 연결어 중복 오류 | 0건 |
| 조사·어미 오류 | 0건 |
| surface issue 개선 | 177건 -> 0건 |
| 자동 품질 점수 | 98.9 |

fallback reason 분포:

- `audit:fact_addition_peer`: 29건
- `insufficient_information`: 46건
- `safe_observation_not_found`: 1건

## 9. 한계

자동 지표는 사실 보존, 금지 주장 차단, evidence 연결, 중복, 일반론, 문장 표면 오류를 검증한다. 그러나 “교사가 그대로 쓸 수 있는지”, “정말 자연스럽게 느끼는지”, “원 분위기와 맞는지”는 실제 교사 검토 데이터와 분리해서 판단해야 한다.

특히 긴 복합 서사에서 어떤 사건을 중심으로 잡는 것이 더 좋은지, 직접 발화를 얼마나 살리는 것이 자연스러운지, 보수 문장이 너무 딱딱하지 않은지는 사람 검토가 필요하다.

## 10. 변경 파일과 실행 결과

주요 변경 파일:

- `src/utils/ai/b4/engine.js`
- `src/utils/ai/b4/constructionGraph.js`
- `src/utils/ai/b4/loraPreparation.js`
- `src/utils/ai/b4/teacherPreferenceProfile.js`
- `src/utils/ai/datasets/b4Cases.js`
- `src/utils/ai.b4.test.js`
- `src/utils/reviewFeedback.test.js`
- `docs/B4_DISCOURSE_ENGINE_REPORT.md`

실행 결과:

- `npm test -- --runInBand --watchAll=false src/utils/ai.b4.test.js`: 통과
- `npm test -- --runInBand --watchAll=false src/utils/reviewFeedback.test.js`: 통과

이번 단계에서 하지 않은 것:

- 새 엔진 이름 추가 없음
- 새 화면 추가 없음
- 새 문서 유형 추가 없음
- 외부 API 사용 없음
- 런타임 LLM 사용 없음
- 모델 다운로드 없음
- 서버 저장 없음
- main 병합 없음
- 배포 없음
