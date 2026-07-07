# B4 의미 단위 조합 및 제한형 재작성 리포트

## 1. meaningUnit 구조

B4의 `discoursePlan` 뒤에 `meaningUnits` 레이어를 추가했다. 각 unit은 `section`, `type`, `theme`, `claim`, `sourceNodeIds`, `evidenceIds`, `allowedExpressions`, `blockedExpressions`를 가진다.

지원하는 unit 유형은 관찰 행동, 직접 발화, 사건 변화, 재시도, 탐색, 또래 상호작용, 관계 조정, 자립 행동, 감정 단서, 감정 회복, 실제 교사 지원, 다음 지원 가능성이다.

모든 선택 후보는 `meaningUnitIds`와 `evidenceIds`를 함께 가진다. 하나라도 없으면 B4 안전 점수에서 `missing_meaning_unit` 또는 `missing_evidence`로 탈락한다.

## 2. constructionGraph 구조

`teacherApprovedConstructionBank`와 `CONSTRUCTION_GRAPH`를 추가했다. 실제 원아 기록이나 교사 수정 전문은 넣지 않고, 관리자 승인형 일반화 문장 구조만 둔다.

각 construction 항목은 `section`, `theme`, `discourseRelation`, `meaningUnitTypes`, 기본 골격, 짧은 버전, 두 문장 버전, 객관형, 따뜻한 기록형, `blockedClaims`, `qualityTags`, `verified` 상태를 가진다.

후보 생성은 기존 B4 후보를 대체하지 않고 추가 후보로만 들어간다. 최종 선택은 기존 `sentenceLinter`, `teacherStyleJudge`, `contrastiveRanker`, audit를 그대로 통과해야 한다.

## 3. 재작성 루프와 selfCritic

`selfCritic`은 후보를 `pass`, `rewrite`, `reject` 중 하나로만 분류한다. 새 의미 생성은 하지 않는다.

허용 작업은 중복 절 삭제, 연결어 정리, 종결 어미 수정, 긴 문장 분리, 일반론 삭제, 직접 발화 중복 제거, 같은 동사 반복 완화다.

재작성은 최대 2회만 수행한다. 재작성 후 `meaningUnitIds` 또는 `evidenceIds`가 원본 후보보다 늘어나면 즉시 폐기된다.

## 4. 한국어 문장 조합 품질 규칙

강화한 규칙:

- 연결형 어미로 문장이 끝나는 오류 방지
- `수 있도록`, `과정에서`, `흐름` 반복 완화
- 지원 계획의 완료형 오인 방지
- 관찰내용, 배움 읽기, 지원 계획 간 반복 감점
- 일반론 지원 문구 감점
- 직접 발화 중복 감지
- 한 문장 의미 과밀 감지
- 최근 리듬과 meaningUnit 조합 반복 감점

## 5. 교사 문체 자산 반영 절차

교사 피드백은 자동으로 construction bank에 들어가지 않는다. 피드백은 패턴 선호도와 수정 위치 유형 같은 메타데이터로만 저장하고, 문장 자산 반영은 관리자 승인 구조를 거쳐야 한다.

저장 금지 범위는 원문 기록, 원아 이름, 직접 발화 전문, 생성 문장 전문이다.

## 6. B4 대비 문장 품질 변화

420건 회귀 기준:

- B4 사실 보존율: 100%
- 희박 입력 보수 처리율: 100%
- 연결어 오류율: 0%
- 연결형 종결 오류: 0건
- 조사·어미 오류: 0건
- B3 일반론 비율: 9%
- B4 일반론 비율: 6%
- B3 리듬 중복률: 61%
- B4 리듬 중복률: 59%
- 관찰/배움 평균 중복률: 24%
- 배움/지원 평균 중복률: 12%

자동 지표상 B4의 일반론과 리듬 중복은 기존 비교군보다 증가하지 않았다.

## 7. 420건 검증 결과

실행 결과:

- 전체 사례: 420건
- B4 accepted: 366건
- 평균 후보 수: 27.7개
- 후보 안전 탈락률: 0.6%
- meaningUnit 생성 성공률: 100%
- meaningUnit evidence 연결률: 100%
- 최종 문장 절 evidence 연결률: 100%
- constructionGraph 적용률: 100%
- construction 선택 수: 358
- 제한형 재작성 적용률: 2%
- 재작성 후 탈락률: 0%
- 재작성으로 해결된 문장 품질 이슈: 21건
- support 구체성 통과율: 100%
- support 일반론 비율: 0%
- 자동 품질 점수: 99.1

## 8. 자동 검증과 실제 교사 선호도의 한계

자동 지표는 문법, 반복, evidence 연결, 금지 주장, 일반론을 검증하는 참고 지표다. 실제 교사가 “그대로 사용 가능”하다고 느끼는지, 문장이 더 따뜻하거나 현장 문체에 맞는지는 별도 교사 검토 표본으로 판단해야 한다.

특히 긴 복합 기록에서 핵심 사건을 어떻게 선택하는지, 은유적 발화를 어느 정도까지 살릴지, 지원 계획이 실제 반 운영 방식에 맞는지는 코드만으로 완전히 판단하기 어렵다.

## 9. 변경 파일과 검증

변경 파일:

- `src/utils/ai/b4/meaningUnits.js`
- `src/utils/ai/b4/constructionGraph.js`
- `src/utils/ai/b4/selfCritic.js`
- `src/utils/ai/b4/engine.js`
- `src/utils/ai/datasets/b4Cases.js`
- `src/utils/ai.b4.test.js`
- `docs/B4_MEANING_UNIT_REWRITE_REPORT.md`

검증:

- `npm test -- --runInBand --watchAll=false src/utils/ai.b4.test.js` 통과
- `npm test -- --runInBand --watchAll=false` 통과
- `npm run build` 통과
- `git diff --check` 통과

커밋, push, main 병합, 배포는 진행하지 않았다.
