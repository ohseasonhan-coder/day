# B4 대조 비교형 문장 선택 품질 개선 보고

## 1. 대조 비교형 선택기 구조

이번 작업은 새 엔진이나 새 화면을 추가하지 않고 기존 B4 흐름 안에 최종 후보 선택 계층만 추가했다.

흐름:

`factCard -> eventGraph -> discoursePlan -> sentencePlan -> surfaceRealizer -> sentenceLinter -> scoreCandidate -> contrastiveRanker -> audit -> fallback`

`contrastiveRanker`는 이미 `safe`를 통과한 후보만 대상으로 1:1 비교한다. 비교 결과는 `winnerId`, `loserId`, `reasons`, `blockedReasons`, `scores` 같은 코드형 메타데이터만 남기며 원문, 이름, 직접 발화 전문, 완성 문장은 저장하지 않는다.

## 2. teacherStyleJudge 판정 기준

`teacherStyleJudge`는 의미를 새로 만들지 않고 후보 문장을 감점·가점한다.

감점:
- 발달, 능력, 향상, 성장 중심의 평가형 표현
- "을 통해", "경험하며", "모습을 보였다" 반복
- 한 문장에 의미가 과도하게 들어간 경우
- 관찰내용과 배움 읽기 반복
- 배움 읽기와 지원 계획 반복
- 직접 발화 중복
- 지원 계획의 일반론 또는 추상 표현

가점:
- 실제 행동과 연결된 표현
- 한 문장에 하나의 핵심 의미
- 교사 기록다운 종결
- 관찰 흐름과 연결된 지원 계획
- 실행 가능한 지원 행동

## 3. contrastSet 문장 자산 구조

`approvedPhraseBank`에 `CONTRAST_SETS`를 추가했다. 이는 렌더링 문장을 새로 만드는 용도가 아니라, 같은 의미 안에서 어떤 문장이 더 안전하고 교사 기록다운지 비교하기 위한 자산이다.

포함 테마:
- retry
- change_explore
- make
- language
- peer_share
- conflict
- rules
- selfhelp
- movement
- emotion_expression
- emotion_recovery
- roleplay
- compare
- peer_help

각 테마는 8개 이상의 contrastSet을 가진다. reject 후보는 발달 단정, 일반론, 보고서식 문체, 관찰 반복, 추상 지원, 연결어 반복 등을 명시하고 prefer 후보는 사실 기반 교사 기록 문체를 지정한다.

## 4. 문장 리듬 중복 완화 방식

문장 리듬 메타데이터를 비식별 구조로 계산한다.

- lengthBucket
- firstTokenType
- connectorType
- verbType
- endingType
- sentenceCount
- hasSpeech
- styleProfile

최근 50건 안에서 같은 테마, 관계, 문체, 리듬 signature가 반복되면 후보 점수에서 감점한다. 이 정보는 원문이나 생성 문장을 저장하지 않고 `patternMemory`의 메타데이터로만 저장 가능하다.

## 5. 지원 계획 품질 개선 방식

지원 계획 후보는 별도 점수로 평가한다.

좋은 후보 조건:
- focusEvent 또는 관찰 흐름과 연결
- 완료형이 아닌 미래 계획형
- 실제 교사가 실행 가능한 행동
- 재료, 공간, 또래, 순서, 선택지, 언어 지원 중 하나 이상과 연결

감점 예:
- "지속적으로 격려한다."
- "다양한 경험을 제공한다."
- "표현할 수 있도록 지원한다."

## 6. B4 대비 문장 선택 변화

자동 회귀 기준에서 대조 선택기가 실제 후보 선택에 반영되었다.

| 항목 | 결과 |
|---|---:|
| 검증 사례 | 340건 |
| B4 채택 | 292건 |
| contrastive 선택 변경률 | 50% |
| contrastSet 적용률 | 100% |
| 지원 계획 구체성 비율 | 100% |
| 지원 계획 일반론 비율 | 0% |
| B3 리듬 중복률 | 51% |
| B4 리듬 중복률 | 46% |
| B3 일반론 비율 | 10% |
| B4 일반론 비율 | 7% |

## 7. 340건 이상 검증 결과

| 항목 | 결과 |
|---|---:|
| B2 사실 보존 | 100% |
| B3 사실 보존 | 100% |
| B4 사실 보존 | 100% |
| 정보 부족 보수 처리 | 100% |
| discoursePlan 생성률 | 93% |
| focusEvent 선택률 | 86% |
| 평균 후보 수 | 26.9개 |
| 후보 안전 탈락률 | 2.6% |
| 연결형 종결 오류 | 0건 |
| 연결어 중복 오류 | 0건 |
| 조사·어미 오류 | 0건 |
| 관찰내용/배움 읽기 평균 중복률 | 23% |
| 배움 읽기/지원 계획 평균 중복률 | 13% |
| 자동 품질 점수 | 99.1 |

추가한 75건은 같은 의미의 문체 차이, 일반론 대 구체 문장, 긴 문장 분리, 관찰 반복 위험, 지원 계획 일반론 위험, 직접 발화 배치, 연결어 반복, 리듬 반복, 짧은 입력, 긴 입력, 정보 부족, 오타·구어체·조사 생략을 포함한다.

## 8. 자동 검증과 실제 교사 선호도의 구분

이 보고서의 수치는 자동 지표다. `contrastiveChangedRate`, `supportSpecificRate`, `automaticQualityScore`는 실제 교사 선호도나 그대로 사용 가능률을 의미하지 않는다.

실제 교사 검토가 필요한 항목:
- 같은 의미 후보 중 실제 현장 문체 선호
- 배움 읽기의 따뜻함과 객관성 균형
- 지원 계획의 구체성 과잉 여부
- 발화가 포함된 문장의 자연스러운 배치
- 장기 사용 시 리듬 반복 체감

## 9. 변경 파일

- `src/utils/ai/b4/contrastiveRanker.js`
- `src/utils/ai/b4/teacherStyleJudge.js`
- `src/utils/ai/b4/approvedPhraseBank.js`
- `src/utils/ai/b4/patternMemory.js`
- `src/utils/ai/b4/engine.js`
- `src/utils/ai/b4/sentenceLinter.js`
- `src/utils/ai/datasets/b4Cases.js`
- `src/utils/ai.b4.test.js`

## 10. 테스트·빌드·배포 상태

실행 완료:
- `npm test -- --runInBand --watchAll=false src/utils/ai.b4.test.js src/utils/reviewFeedback.test.js`: 통과
- `npm test -- --runInBand --watchAll=false`: 통과, 38개 suite / 402개 test 통과, 4개 suite / 4개 test skipped
- `npm run build`: 통과
- `git diff --check`: 통과, Windows LF/CRLF 변환 경고만 출력

하지 않은 것:
- 커밋하지 않음
- 원격 push 하지 않음
- main 병합하지 않음
- 배포하지 않음
- 외부 API, 외부 LLM, 모델 다운로드 사용하지 않음
