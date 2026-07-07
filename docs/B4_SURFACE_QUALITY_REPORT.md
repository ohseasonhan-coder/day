# B4 문장 표현 품질 집중 개선 보고서

## 1. 문장 실현 레이어 구조

이번 작업은 새 엔진이나 새 화면을 추가하지 않고, 기존 B4 내부의 마지막 문장 표현 단계만 분리했다.

흐름:

`factCard -> eventGraph -> discoursePlan -> sentencePlan -> surfaceRealizer -> sentenceLinter -> candidateRanker -> 기존 audit -> B4 fallback`

B4의 사실 카드, eventGraph, discoursePlan, evidenceIds, allowedClaims, blockedClaims, audit, fallback 구조는 유지했다. 새 레이어는 사실·핵심 사건·허용 의미·지원 계획을 바꾸지 않고 주어 위치, 조사, 연결어, 문장 길이, 종결 표현, 직접 발화 배치만 다룬다.

## 2. 문장 자산 구조와 범위

`src/utils/ai/b4/approvedPhraseBank.js`에 완전 일반화된 문장 자산을 추가했다. 실제 원아 기록, 이름, 발화 전문, 개인정보는 포함하지 않았다.

각 문장 자산은 아래 구조를 가진다.

- id
- section
- relation
- themes
- requiredClaims
- blockedClaims
- pattern
- tone
- length
- qualityTags

포함 범위:

- 재시도·끈기
- 탐색·변화 관찰
- 만들기·구성·표상
- 언어·질문·설명
- 역할놀이·상상
- 또래 협력·나눔
- 갈등·사과·관계 조정
- 차례·규칙
- 자립·일상생활
- 신체 움직임·조절
- 감정 표현
- 감정 회복
- 선택·분류·비교
- 도움 요청·도움 주기

## 3. 한국어 문장 품질 규칙

`src/utils/ai/b4/sentenceLinter.js`에서 아래 오류를 검사하고, 가능한 경우 삭제·정리·재배열 수준으로만 보정한다.

- 연결형 종결: “해 보며.”
- 연결어 반복: “수 있도록 ... 수 있도록”, “과정에서 ... 과정에서”
- 조사·호응 오류: “은 가”, “모습는”
- 기계적 표현: “활용하여”, “경험하였다”, “자료를 제공한다”
- 관찰내용의 해석 섞임
- 지원 계획 완료형
- 직접 발화 따옴표 훼손
- 긴 문장 분리 필요
- 같은 어간 반복

섹션별 종결 기준:

- 관찰내용: 사실 기록형
- 배움 읽기: 해석 과장 없는 의미 연결형
- 지원 계획: 미래 지원형

## 4. 후보 생성·편집·선택 방식

각 섹션 후보는 5~10개 안에서 유지한다. 기존 B4 후보에 문장 자산 기반 후보를 섞되, 단어만 바뀐 중복 후보는 제거한다.

후보 선택 순서:

1. safetyScore
2. evidenceCoverage
3. discoursePlan 적합성
4. 문장 완결성
5. 조사·어미 자연스러움
6. 일반론 회피
7. 관찰내용과의 중복 회피
8. 최근 patternId 중복 회피
9. 로컬 교사 선호 가중치

편집 단계에서 허용한 작업:

- 중복 구절 삭제
- 연결어 교체
- 조사 수정
- 문장 분리
- 동일 어간 반복 완화
- 일반론 문구 삭제
- 종결 수정

금지한 작업:

- 새 행동 추가
- 새 감정 추가
- 새 의도 추가
- 새 또래 반응 추가
- 새 교사 지원 추가
- 발달 수준 판단 추가
- 입력에 없는 인과관계 추가

## 5. B4 대비 문장 품질 변화

비식별 합성 사례 60건을 추가해 총 265건으로 검증했다.

| 항목 | 결과 |
|---|---:|
| 검증 사례 | 265건 |
| B4 채택 | 227건 |
| B4 사실 보존 | 100% |
| 정보 부족 보수 처리 | 100% |
| 평균 후보 수 | 27개 |
| 후보 안전 탈락률 | 2.4% |
| 연결형 종결 오류 | 0건 |
| 연결어 중복 오류 | 0건 |
| 조사·어미 오류 | 0건 |
| B3 일반론 비율 | 11% |
| B4 일반론 비율 | 7% |
| 관찰내용/배움 읽기 평균 중복률 | 19% |
| 배움 읽기/지원 계획 평균 중복률 | 11% |
| B3 전체 결과 중복률 | 6% |
| B4 전체 결과 중복률 | 6% |
| 표면 보정 전 이슈 | 66건 |
| 표면 보정 후 이슈 | 0건 |

자동 점수는 실제 교사 사용성이나 LLM급 완성도를 의미하지 않는다. 문장 구조와 금지 표현을 기계적으로 점검한 참고 지표다.

## 6. 실제 교사 검토가 필요한 항목

- “이 장면에서” 같은 안전한 연결 표현의 실제 선호도
- 관찰문을 얼마나 압축해도 되는지
- 배움 읽기에서 “흐름” 표현의 반복 허용 정도
- 부모 공유 문체와 교사 내부 기록 문체의 차이
- 긴 복합 서사에서 교사가 중요하게 보는 사건 우선순위

## 7. 변경 파일

- `src/utils/ai/b4/approvedPhraseBank.js`
- `src/utils/ai/b4/surfaceRealizer.js`
- `src/utils/ai/b4/sentenceLinter.js`
- `src/utils/ai/b4/engine.js`
- `src/utils/ai/b4/config.js`
- `src/utils/ai/b4/patternMemory.js`
- `src/utils/ai/datasets/b4Cases.js`
- `src/utils/ai.b4.test.js`
- `src/utils/reviewFeedback.js`

## 8. 하지 않은 것

- 외부 API 사용 없음
- 런타임 LLM 사용 없음
- 모델 다운로드 없음
- 새 기능 화면 추가 없음
- 새 문서 유형 추가 없음
- B4 의미·안전 구조 변경 없음
- main 병합 없음
- 원격 push 없음
- 배포 없음

## 9. 테스트 상태

실행 결과:

- `npm test -- --runInBand --watchAll=false src/utils/ai.b4.test.js src/utils/reviewFeedback.test.js`: 통과
- `npm test -- --runInBand --watchAll=false`: 통과
- `npm run build`: 통과
- `git diff --check`: 통과
