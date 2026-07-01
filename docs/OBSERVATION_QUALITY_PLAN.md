# 관찰일지 품질 개선 — 설계 메모 (1단계 이후)

> 이번 커밋은 **1단계(규칙 기반 복붙 품질)** 만 구현했다. 아래는 다음 단계 설계 메모로, 이번에 구현하지 않는다.
> 절대 원칙 유지: 외부 유료 LLM 금지 · 개인정보 외부 전송 0 · 규칙 엔진 유지 · legacy/modular·feature flag 유지 · 기존 테스트/문서 생성 무파괴.

## 이번 단계에서 구현한 것 (요약)
- `copyReadyObservation.js`: 복사용 3단 문서 `[관찰내용]/[배움 읽기]/[교사 지원 및 다음 계획]` 블록 형식.
- `buildLearningReading()`: **반(class) 평가 composer를 건드리지 않고**, 개별 관찰 입력의 실제 단서(끈기·나눔·표현·탐색·자립·움직임·만들기)에만 반응하는 근거 기반 배움 읽기. 금지 표현("유아들은/활용하여 놀이에 참여/발달 경험과 연결된다") 회피, 사실 추가 없음, 원아 이름·조사 처리.
- `observationAudit.js`: 발화 손실·금지표현·관찰↔배움 중복·낙인/진단·문장 완결성·조사 오류 검사.
- 평가 composer의 일상생활/신체 전용 패턴(직전 커밋)로 어색한 "활용하여" 제거.
- 회귀 테스트: `ai.copyReady.test`, `ai.observationQuality.test`(정상/발화/또래/지원미입력/사실추가방지/대량 감사).

## 다음 단계 (설계만)

### A. 사실 요소 구조화 (fact elements)
- 목표: 관찰 입력을 명시 구조로 파싱해 각 생성 단계에 근거로 전달.
  ```
  { childName, actions[], speeches[], materials[], peers[], teacherSupport|null, nextPossibilities[], forbiddenInferences[] }
  ```
- 현재 `analyzeRecordInput`(draftComposer) + `extractEvaluationElements`가 유사 정보를 부분 추출 중. 이를 **단일 정규 구조**로 통합하고, `buildLearningReading`/support가 신호 정규식 대신 이 구조를 소비하도록 개선.
- 호환성: 기존 출력 필드(observation/evaluation/support/parent)는 유지, 구조는 내부 전달용으로만.

### B. 교사 지원 "실제 vs 계획" 분리
- 현재 support는 계획 문체("~한다")로 통일되어 "하지 않은 지원을 했다고" 쓰지 않음(안전).
- 다음: 입력에 실제 교사 지원 단서가 있으면 `[제공한 지원]`과 `[다음 계획]`을 구분해 2줄로. 단서 없으면 계획만.

### C. 배움 읽기 표현 다양화
- 신호별 1문장 → 신호 강도/조합(끈기+표현 등)에 따라 2문장까지 자연 확장. 표현 풀을 입력 해시로 결정적 선택(반복 방지).

### D. 자동 검수 → 재생성 루프
- `auditObservationCopy` 실패 코드별 대응:
  - `banned_phrase`/`learning_repeats_observation` → 다른 신호/표현으로 재생성.
  - `speech_lost` → 관찰내용에 원문 발화 복원(이미 observationEngine에 유사 로직) 후 재검수.
  - 재생성 불가 → 사실 보존 우선 보수적 결과(현재 규칙 출력) 유지.
- `generateWithFallback`/`documentEngineResolver`의 scoreFn에 감사 결과를 게이트로 추가 검토.

### E. 비식별 데이터셋 & 장기 학습 (이번 범위 제외)
- 교사 수정 전/후(비식별) 쌍을 로컬에만 축적 → 표현 풀·신호 규칙 보정. **개인정보 외부 전송 없이 로컬 통계만.**
- 기존 `engine_reviews`/`user_corrections`는 백업·동기화 제외 정책 유지.

### F. 타 문서유형 확대 (이번 범위 제외)
- 알림장/상담/발달평가에도 동일한 "근거 기반 + 감사 + (지원 기기)자동 다듬기" 패턴 적용. 문서유형별 금지표현·톤 규칙 분리.

### G. 온디바이스 LLM 계층 (이미 존재, 규칙 위에 얹힘)
- `ondeviceLLM.js`(크롬 내장 AI)는 지원 브라우저에서만 동작. 규칙 출력 위에 자동 다듬기 + `passesFactGuard`(사실/발화 보존)로 적용. 미지원 기기는 규칙 출력 그대로.
- 확대 시에도 **입력 개인정보를 외부로 보내지 않음**(브라우저 내장 모델).

## 남은 한계 (1단계 기준)
- 배움 읽기는 신호 정규식 기반이라, 드문 상황은 기본 문장으로 수렴(과장 없음, 다만 개별성 약함).
- 교사 지원은 계획 문체 통일 — "실제 제공 지원" 분리는 B단계.
- 규칙 출력의 문학적 자연스러움 상한은 존재. 그 이상은 지원 기기의 온디바이스 다듬기(G)가 담당.
