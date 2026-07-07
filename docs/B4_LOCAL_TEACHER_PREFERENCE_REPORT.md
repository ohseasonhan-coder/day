# B4 로컬 교사 선호 학습 레이어 보고

## 1. 목적

이번 작업은 새 엔진, 새 화면, 새 문서 유형을 추가하지 않고 기존 B4 구조 위에 로컬 교사 선호 학습 레이어만 추가했다.

유지한 구조:

`eventGraph -> discoursePlan -> surfaceRealizer -> sentenceLinter -> contrastiveRanker -> teacherStyleJudge -> patternMemory -> audit -> fallback`

추가한 구조:

`ReviewComparePanel feedback -> 수정 유형 임시 분석 -> teacherPreferenceProfile 메타데이터 누적 -> 안전 후보 비교 시 제한 가중치 반영`

## 2. 저장되는 메타데이터

`teacherPreferenceProfile`은 `localStorage`의 `sw_b4_teacher_preference_profile`에 저장된다.

저장 항목:
- section
- primaryTheme
- secondaryTheme
- discourseRelation
- patternId
- supportPatternId
- styleProfile
- rhythmSignature
- shownCount
- acceptedCount
- editedCount
- rejectedCount
- factIssueCount
- holdCount
- preferredCount
- editTags
- auditPassedCount / auditFailedCount
- 날짜 없는 익명 sequence
- preferenceWeight

## 3. 저장 금지 데이터

장기 저장하지 않는 항목:
- 교사 원문 기록
- 원아 이름
- 직접 발화 전문
- 생성 결과 전문
- 교사가 수정한 최종 문장 전문
- 교사 메모 전문

`ReviewComparePanel`에서 수정 후 사용 문장을 입력해도 저장 전에 `extractTeacherEditMetadata`가 수정 유형 태그만 추출하고, 수정 전문은 state에서만 일시 사용한 뒤 폐기한다.

## 4. 선호 가중치 계산 방식

가중치 범위는 `-8 ~ +8`로 제한했다.

반영 원칙:
- 최소 노출 4회 이상
- 최소 피드백 3회 이상
- 그대로 사용 가능과 선호 선택은 양수
- 수정 후 사용은 약한 신호로 반영
- 사용하지 않음/보류와 사실과 다름은 감점
- 사실과 다름은 강한 감점
- 안전하지 않은 후보에는 가중치 0

가중치는 B4의 안전성, 근거 적합성, audit보다 우선하지 않는다.

## 5. 수정 유형 추출 방식

현재 화면의 생성 결과와 교사가 붙여넣은 수정 후 사용 문장을 비교해 아래 태그만 추출한다.

- shorten
- splitSentence
- mergeSentence
- fixParticle
- changeEnding
- changeConnector
- removeGeneric
- removeObservationRepeat
- editLearningReading
- makeSupportSpecific
- makeSupportConcise
- moveDirectSpeech
- warmTone
- objectiveTone
- other

이 태그는 문장 전문 없이 패턴별 누적 통계로만 저장된다.

## 6. 후보 선택 반영 방식

B4 후보 선택에서는 기존 안전 구조를 유지했다.

우선순위:
1. safetyScore
2. evidenceCoverage
3. discoursePlan 적합성
4. audit 통과 여부
5. teacherStyleJudge
6. contrastiveRanker
7. 로컬 선호 가중치
8. 최근 리듬·patternId 중복 감점

구현상 선호 가중치는 `contrastiveRanker`의 안전 통과 후보 비교에서만 사용된다. `qualityScore` 자체를 선호 데이터로 올리지 않도록 하여, 표본 부족이나 취향 신호가 안전성보다 앞서지 않게 했다.

## 7. 패턴 개선 후보 생성 기준

`getPhraseImprovementCandidates`는 approvedPhraseBank를 자동 수정하지 않는다. 반복 수정 경향만 관리자 검토용 메타데이터로 집계한다.

조건:
- 같은 patternId/supportPatternId 사용 누적
- 수정 후 사용 비율이 높음
- 같은 editTag 반복
- factIssueCount가 낮음
- audit 실패가 낮음

추천 값:
- keep
- shorter_variant_needed
- connector_improvement_needed
- support_specificity_needed
- fact_issue_check_needed
- sample_insufficient

관리자 화면에도 원문, 이름, 발화, 생성 문장 전문은 표시하지 않는 구조다.

## 8. phrase bank 반영 절차

실제 수정문은 자동으로 phrase bank에 들어가지 않는다.

반영 절차:
1. 반복 수정 경향을 메타데이터로 확인
2. 관리자가 테마와 수정 유형 확인
3. 일반화된 새 문장 골격을 수동 작성
4. requiredClaims, blockedClaims, section, theme, styleProfile, qualityTags 부여
5. 합성 회귀 테스트 사례 추가
6. audit와 문장 품질 검증 통과 시에만 approvedPhraseBank 반영

## 9. 개인정보 보호 확인 결과

자동 검증으로 확인한 항목:
- 수정 후 사용 피드백 저장 시 수정 전문이 localStorage에 남지 않음
- 원문 기록이 reviewFeedback에 남지 않음
- 원아 이름이 reviewFeedback에 남지 않음
- 생성 전문이 reviewFeedback에 남지 않음
- teacherPreferenceProfile에는 patternId와 비식별 카운트만 저장됨
- `sw_b4_teacher_preference_profile`은 동기화 제외 목록에 포함됨

## 10. 자동 검증과 실제 교사 선호도의 구분

이 레이어의 preferenceWeight는 실제 교사 선호도를 추정하는 보조 메타데이터다. 자동 점수만으로 “교사 사용성”을 확정하지 않는다.

실제 검토가 필요한 항목:
- 수정 후 사용 태그가 실제 수정 이유와 일치하는지
- 충분한 표본 이후에도 선호 가중치가 과하게 한 문체로 쏠리지 않는지
- 특정 교사의 문체 선호가 기관 공통 문체로 오해되지 않는지
- phraseImprovementCandidates 추천이 실제 관리자 검토와 일치하는지

## 11. 변경 파일

- `src/utils/ai/b4/teacherPreferenceProfile.js`
- `src/utils/ai/b4/config.js`
- `src/utils/ai/b4/engine.js`
- `src/utils/ai/b4/contrastiveRanker.js`
- `src/utils/reviewFeedback.js`
- `src/components/ReviewComparePanel.js`
- `src/utils/storage.js`
- `src/utils/reviewFeedback.test.js`

## 12. 테스트와 빌드 결과

실행 완료:
- `npm test -- --runInBand --watchAll=false src/utils/reviewFeedback.test.js src/utils/ai.b4.test.js`: 통과
- `npm test -- --runInBand --watchAll=false`: 통과, 38개 suite / 407개 test 통과, 4개 suite / 4개 test skipped
- `npm run build`: 통과
- `git diff --check`: 통과, Windows LF/CRLF 변환 경고만 출력

## 13. 하지 않은 것

- 새 엔진 이름 추가하지 않음
- 새 문서 유형 추가하지 않음
- 외부 API 사용하지 않음
- 외부 LLM 사용하지 않음
- 서버 저장 또는 자동 학습 서버 추가하지 않음
- approvedPhraseBank 자동 수정하지 않음
- main 병합하지 않음
- 원격 push 하지 않음
- 배포하지 않음
