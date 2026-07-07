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

---

# 2.5단계 — "안전 검수"와 "목표 품질"의 분리 측정

> 목적: `observationAudit`/`pasteScore`의 100점이 **안전·사실성 위반 없음**을 뜻할 뿐, v3 목표 문장 수준의
> **자연스러움·개별성·문서 완성도**를 보장하지 않는다는 점을 코드·리포트에서 분리해 측정한다. (생성 엔진은 그대로.)

## 세 가지 점수 축 (혼동 금지)
| 점수 | 정의 | 산출 |
|---|---|---|
| **Safety Score** | 사실 추가·발화 손실·금지표현·이름 오류·낙인 등 안전·사실성 위반 없음 | `observationAudit.pasteScore` |
| **Target Alignment** | v3 목표 문장과 비교한 문서 품질(관찰 사실 유지·근거 있는 배움 읽기·역할 분리·개인화·자연스러움·길이) | `targetQuality.scoreTargetAlignment` |
| **Copy-Ready Score** | 교사가 그대로 붙여넣을 수 있는 형식·완결성·자연스러움 | `targetQuality.scoreCopyReady` |

- **"100점"의 의미**: Safety 100 = "안전 통과", 품질 보장 아님. 목표 수준 여부는 Target Alignment로 본다.
- Target Alignment는 **완전 문장 일치를 요구하지 않는다** — 사실·역할이 적절하면 표현이 달라도 감점하지 않고, 안전하지만 일반적(개별성 약함)인 문장은 목표 대비 낮은 점수를 받는다.

## 파일
- `src/utils/ai/targetQuality.js` — 목표 대비 평가기 + 복붙 평가기(+ `parseTargetSections`).
- `src/utils/ai/reportAggregate.js` — 중복 입력 정규화(고유 입력 기준) 집계.
- `scripts/analyze_v3.py` — v3 읽기 전용 분석 + **완전 비식별**(이름 컬럼 + 앱 합성 이름 풀) + 목표 3섹션 분해 + 중복/목표 통계.
- `src/utils/ai.targetQuality.test.js` — 분리·역감점·중복 왜곡·목표 금지표현 비전파 회귀.
- `src/utils/ai.observationReport.test.js`(gate) — 리포트 + 교사 검토용 비교 파일 생성.

## 실행
```
# 1) v3 재분석 + 비식별 로컬 데이터셋(목표 포함) 생성 (gitignore 경로)
python scripts/analyze_v3.py
# 2) 목표 품질 리포트 + 교사 검토 비교 리포트(로컬 MD)
OBSREPORT=1 CI=true npx react-scripts test src/utils/ai.observationReport.test.js --watchAll=false
```
- 산출물(로컬 전용, Git 제외): `data/golden_local/observation_golden.local.json`, `data/golden_local/review_report.local.md`.

## v3 데이터 성격 (측정 타당성 주의)
- v3 시트명은 **"자동검수결과(1000건)"** — 목표 열(관찰/배움/지원/복사용)은 **앱이 합성 이름으로 자동 생성한 참조 서식**이다. 사람이 독립 작성한 golden이 아니므로 Target Alignment는 "richer 참조 서식과의 정렬"로 해석한다.
- 1,000행 중 **고유 입력 70개**(각 ~14회 중복), 그중 **42개 그룹은 같은 입력·다른 목표**. → 중복이 평균을 부풀리므로 **고유 입력 기준**을 주요 지표로 사용한다.

## 측정 결과(고유 입력 70 기준, 2.5단계 시점)
- Safety **100** · Copy-Ready **100** · Target Alignment **약 96.5** — 안전은 만점이나 목표 정렬엔 여지.
- 최다 약점: **배움 읽기가 일반 문장(SAFE 폴백)으로 후퇴** — 표현·자립·구성·탐색·또래 신호를 정규식이 못 잡는 ~13/70 사례. 즉 갭의 원인은 안전이 아니라 **배움 읽기 근거성/개별성**.

---

# 3단계 — 배움 읽기 신호 사전 확장 (SAFE 폴백 축소)

> 목적: 2.5단계에서 확인된 "신호 미포착 → 일반 SAFE 문장 후퇴"를 규칙 기반으로 개선.
> 성공 기준은 점수가 아니라 **사실을 벗어나지 않으면서 SAFE 폴백 사례를 줄이는 것**.

## 추가된 신호 (copyReadyObservation.js LEARNING_SIGNALS)
| 신호 | 발화 조건(입력 단서) | 비고 |
|---|---|---|
| 정서·도전(challenge) | 처음 해 보/망설이/낯설어/어려워하 | '격려 속에서'는 입력에 격려·도움 있을 때만 |
| 정서·안정(recover) | 감정 단서 **+** 회복 단서(re2) 동시 충족 | 불안 해소·자신감 향상 단정 금지 |
| 역할·상상(roleplay) | 역할을 맡/역할놀이/인 척 등 | 친구 언급은 입력에 있을 때만 |
| 차례·규칙(rules) | 차례를 기다/순서를 지키/규칙을 지키 | 사회성 향상 단정 금지 |
| 분류·배열(sort) | 크기 순/순서대로 늘어놓/분류하 | |
| 변화·탐구(change) | 색을 섞/변하는 것/새로운 색 | |
| 위생·자조(hygiene) | 손을 씻/비누/거품(활용형 보강) | 습관 확립 단정 금지 |
| 식습관(meal) | 골고루/채소도/먹으려고 | |
| 조준·조절(aim) | 던져/맞히(활용형 보강, move 뒤 배치) | |
| 구성·표상(craft) | 찢어/붙이/콜라주/물감/찍어/꾸몄 | 결정론적 2변형, 창의성 단정 금지 |

- 우선순위: 기존 7신호의 순서·템플릿은 **무변경**(persist→…→make), 신규는 사이·뒤에 삽입해 기존 매치 케이스가 바뀌지 않도록 함. 다신호 충돌 시 가장 구체적 행동 단서 우선(예: 정서·도전+만들기 → 정서·도전).
- 미감지 시 보수적 SAFE 폴백 유지(결정론적 2변형). `readLearningSignal(input)`으로 감지 신호를 외부(리포트·테스트)에서 확인 가능.
- support 미입력 시에만 신호 연동 계획 문장(SUPPORT_HINTS, 계획 문체) 채움 — 엔진 support가 있으면 절대 덮지 않음.

## 측정 결과(고유 입력 70 기준, 3단계 후 — 동일 스코어러로 배움 읽기만 교체 비교)
- **신호 감지 100%(70/70) · SAFE 폴백 12/70 → 0/70**
- **Target Alignment 96.6 → 99(+2.4) · Safety 100 → 100(유지) · Copy-Ready 100 → 100(유지)**
- 남은 약점 1건: 갈등·화해 사례(0013)의 '행동' 어휘 반복 — 갈등 해석은 "갈등이 해결되었다" 단정 금지 원칙상 규칙 확장 보류.
- 산출물(로컬 전용): `review_report.local.md`(비교), `review_samples.local.md`(교사 검토 체크박스 ≤20건), `baseline_learning.local.json`(이전 단계 스냅샷 — 덮어쓰기 금지).
- 회귀: `ai.learningSignals.test.js`(15) — 단서 기반 발화·사실 추가 방지·결정론·금지표현·폴백 유지.

---

# 4단계 — 실제 교사 검토를 위한 로컬 비교·피드백 체계

> 목적: v3(합성 참조) 기준 Target 99가 **실제 교사 비정형 입력**에서도 "수정 없이 복붙 가능"인지 검증할
> 실사용 데이터를 안전하게 수집. 이번 단계는 신호·엔진 무변경, 수집 구조만.

## 구성
- **feature flag**: `sw_review_mode`(기본 OFF — OFF면 기존 화면·결과 완전 동일). RecordPage 결과 화면의 "검토 모드" 토글.
- **A안** = 기존 방식(관찰일지 문장 + 보육일지 평가 + 교사 지원계획), **B안** = 3단계 복사용 3단(관찰내용/배움 읽기/교사 지원 및 다음 계획). 같은 입력에서 나란히 표시, 각각 전체 복사·안전 상태(audit, 개발 검토 정보로 작게)·피드백 5지선다(복수 가능, "그대로 사용 가능"은 배타)·한 줄 메모.
- **저장(로컬 전용)**: `sw_review_entries` — 화이트리스트 필드만(결과 식별자·문서유형·변형·선택 항목·메모≤120자·audit 코드·수정 통계). **원아 이름·원문 관찰기록·생성 전문은 저장하지 않음.** 최근 200건. 백업·동기화 제외(SYNC_EXCLUDED_KEYS) + 백업 payload 자체가 화이트리스트 방식이라 구조적으로도 미포함. (주의: `sw_review_feedback`은 계정 키 `sw_${uid}_feedback`(uid='review')과 충돌하므로 사용 금지 — 배포 전 점검에서 교정됨.)
- **수정 전후 비교**: 생성 스냅샷 대비 저장 시점의 **파생 통계만**(수정 여부/길이/변경 섹션) — 원문 복제 없음. 온디바이스 자동 다듬기는 스냅샷을 갱신해 사용자 수정으로 오인하지 않음.
- **리포트**: 패널 내 "검토 리포트" — 검토 건수, A/B별 그대로 사용·표현 수정·사실 다름·자연스러움·지원 계획 비율, B안 선호율, 수정률·평균 수정 길이·섹션 집중도, 최근 20건 반복 유형, 사실 오류 시 audit 코드 빈도. **원문·메모 미출력.**
- **개인정보**: 첫 진입 시 "이 기기에만 저장·외부 미전송" 안내 + 상시 푸터 문구 + "검토 데이터 삭제" 즉시 삭제.

---

# 5단계 — 앱 내장형 로컬 LLM 엔진 (POC)

> 목표: Chrome `window.LanguageModel` 의존 없이, 앱이 자체적으로 로컬 LLM을 실행해
> 배움 읽기·교사 지원을 생성. 규칙 엔진은 사실 카드 추출·검수·fallback으로 유지.

## 런타임·모델
- **런타임**: WebLLM(@mlc-ai/web-llm, Apache-2.0) — WebGPU 로컬 추론, JSON 스키마 강제(XGrammar),
  모델 가중치 브라우저 Cache Storage 자동 캐시. 대안 비교: Transformers.js(WASM fallback 있으나
  1B+ 생성은 실용 불가, 스키마 강제 없음), wllama(CPU 전용, 느림). → WebGPU 대상(크롬·엣지 = 앱 공식 지원 브라우저)에 최적.
- **모델**: `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (Apache-2.0, 상업 사용 가능, 한국어 생성 가능한 최소급).
  ⚠ Qwen2.5-**3B**는 연구 라이선스라 금지. 가중치는 Git/번들 미포함 — 최초 "엔진 준비" 시 1회 다운로드.
- **번들 영향**: web-llm은 dynamic import 지연 청크(원시 5.9MB, 검토 패널에서만 로드). main +8.4kB(어댑터 호출부만).

## 구조 (src/utils/ai/llm/)
```
입력 메모 → factCard.js(사실 카드 추출·정규화, 규칙)
         → promptBuilder.js(카드만 직렬화 + JSON 스키마 강제)
         → embeddedLLM.js(WebLLM 어댑터: idle/need-download/preparing/ready/unsupported/error)
         → postProcess.js(JSON 파싱→형식·길이·반복·금지어→사실카드 발화 대조→observationAudit)
         → 통과: 복사용 3단 반영(관찰내용은 항상 규칙 결과) / 실패·미지원: 규칙 B안 fallback(사유는 개발 정보)
engineAdapter.js: rule(기본) | embedded-local-llm | chrome-builtin(선택 보조) | auto
```
- LLM 담당: **배움 읽기 + 교사 지원 및 다음 계획만**. 관찰내용은 규칙 결과 고정(발화·사실 보존).
- 원문 전체를 LLM에 자유 전달하지 않음 — 사실 카드 필드만(이름/행동/발화/재료/또래/실지원/다음가능성/금지요소/작성규칙).
- 원문·프롬프트·LLM 전문 출력은 저장하지 않음(반환값 전달만).
- UI: 검토 flag 안 "AI 문장 엔진(실험)" 섹션 — 준비(진행률)/미지원/실패/저장공간부족 구분, C안 카드로만 표시(A/B 미덮어쓰기), 모델 삭제 버튼.
- 테스트: mock 어댑터(ai.llmEngine.test, 17건) — CI에서 모델 다운로드 없음.

---

# 5.5단계 — 실기기 검증 결과 + 관리자 서식 관리 MVP

## 실기기 모델 검증 (Intel Gen-12LP iGPU · Chrome 148 · WebGPU 하드웨어)
- 모델 `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` · 런타임 web-llm **0.2.84(정확 고정)** · 원본: HF CDN(가중치 30샤드) + raw.githubusercontent(mlc wasm, v0_2_84 일치).
- 실측: 다운로드+초기화 **177초 / 840MB**, 새로고침 후 캐시 재초기화 **27초**, 생성 37초~2분(iGPU 기준 — 느림).
- **개인정보 경계(실측)**: 전 요청 GET·관찰기록/프롬프트 미포함, 생성 중 외부 요청 **0건**,
  외부 fetch 전면 차단(오프라인 시뮬레이션)에서 초기화·생성 **성공(차단 시도 0건)**, 모델 삭제 시 **840MB 전량 회수**.
- 품질(실측 2건, 20건 배터리는 미완): C안이 B안보다 나은 사례 0건 — ① 발화 사례: audit 통과했으나 해석 얕음
  ② 또래 사례: 기계적 반복 → **후처리 차단 실전 작동** → B안 자동 유지. 사실 추가·발화 훼손·금지어 0건.
- **판정: C안(1.5B) 확대 보류** — 안전 파이프라인은 전부 실증, 품질은 모델 한계. 다음 수순 = 개인 PC 7B 서버
  (`private-server-7b` 어댑터 준비 완료: OpenAI 호환 로컬 서버, 관리자 URL 설정 시에만 ready, 미설정·오류 시 B안).
- 공급망: 버전 정확 고정 완료. 차기 과제 — 모델 매니페스트(SHA256) 문서화·자체 호스팅 전환.

## 관리자 전용 문서 서식 관리 MVP (docTemplates)
- 블록 서식(문단/표/줄바꿈/체크박스/안내/필드) + 공통 필드 사전 15종(auto/manual/ai · 엔진 rule/7b/manual/none).
- 권한: isMaster 재사용 — UI 아닌 **저장 계층 전 변이 함수에서 재검사**. 교사는 공개 서식만 조회.
- 미정의 {{태그}} 저장 차단 / observation은 규칙 고정(7B 미덮어쓰기) / learningReading·support는 audit 통과분만,
  실패·미연결 시 B안 / 직접 입력은 AI가 덮어쓰지 않음 / 인스턴스는 원본 불변·값 장기 미저장(복사만).
- 저장: `sw_shared_doc_forms`(기기 공용, 동기화·백업 제외). 7B 서버 주소 `sw_admin_llm_server_url`(관리자 전용, 교사 미노출).
- 다음 단계: DOCX/PDF/한글 출력, dailyRoutine류 엔진 연결, 문서 인스턴스 보관함, 7B 서버 실검증.

## 설정 0회·내장 표현 풀 (5.5 후속 — "사용자 설정 없는 AI")
- **자동 감지**: 관리자 주소 미설정 시 같은 PC 표준 주소(Ollama 11434, LM Studio 1234)를 AI 사용 시점에 1회 탐지(세션 캐시).
  실증: 주소 삭제 상태에서 `GET /v1/models` 자동 탐지 → `POST /chat/completions` 실생성 확인. 서버 없으면 조용히 규칙 엔진.
- **7B → 내장 코드(증류) 판정**: 7B 모델 자체 내장은 불가(4.7GB·속도). scripts/distill7b.mjs로 템플릿 증류를 실측한 결과
  **품질 미달 폐기**(환각·중국어 혼입·조각문·또래 창작). 대신 표현 풀을 수작업 정제해 내장 — persist/express/explore/make에
  결정론적 2변형(pickBy), 전 변형 audit 무경고 가드 테스트. 용량 +0.5KB, 설정 0회, 즉시·오프라인.
- **문체 가드(style_mismatch)**: '습니다/것입니다/기회를 얻었다/향상되었다' 류 차단 — 실검증에서 통과했던 유형이
  보강 후 실전 차단 확인(콘솔 '[로컬 LLM 검수 탈락] style_mismatch').

---

# 6단계 — 규칙 엔진 고도화: LLM 없이 LLM급 (5단 파이프라인)

```
입력 메모 → 사실 카드(llm/factCard: 3분리 — observedFacts/safeMeanings/forbidden)
         → 의미·상황 판정(planner/situationJudge: trigger+required+excluded+needPeer, primary+secondary)
         → 문장 계획(planner/sentencePlanner: observationPlan/learningPlan/supportPlan + blockedClaims)
         → 렌더링(planner/sentenceRenderer: 결정론 변형, emotionOnly 가드, 계획 밖 의미 추가 금지)
         → audit·fallback(observationAudit + rules/blockedClaims 근거 대조)
```

## 선언형 규칙(src/utils/ai/rules/)
- **themes.js** — 19테마(기존 17 + 갈등·사과 + 질문·설명): id/category/trigger/required/excluded/needPeer/
  priority(배열 순서)/coexist/충돌규칙(excluded로 양보 선언)/allowed·blockedClaims/learningVariants(결정론 2변형)/
  secondary(보조문장)/supportVariants(상황 연결 계획형 2종)/testCases. **새 규칙 = 항목 추가만.**
- **blockedClaims.js** — 근거 기반 금지 주장: 감정 단정(evidence로 입력 감정 있으면 면제)/의도 추정(발화 있으면 면제)/
  발달·성취 단정(무조건)/문체(습니다·기회를 얻었)/일반론 지원(GENERIC_SUPPORT). audit·렌더러·7B 후처리가 공유.

## 핵심 규칙 변경(사실 충실성)
- persist: '무너지/넘어지' **단독 발화 제거**(재시도 단서 필수) — 울음만 있는 입력에서 "시도 이어감" 창작 방지.
- persist excluded=/미안|사과|화해|다툰/ — 화해 맥락의 "다시(놀이 재개)"를 conflict에 양보(선언형 충돌 처리).
- 부정 감정만+회복 없음(emotionOnly): recover 비활성(required) + '즐거움' 계열 변형 회피(렌더러 가드).
  '놀라워(감탄)'는 부정 감정으로 취급하지 않음.
- 구어체 일반화: 조사 생략('차례 기다렸다가'), 활용형(그렸/건네주/들여다보/버티/그네/녹아 등) 트리거 확장.

## audit 보강(근거 대조)
- major 추가: emotion_fabricated / intent_speculation / development_claim (blockedClaims 대조, 입력 근거 시 면제)
- minor 추가: achievement_claim / style_formal / learning_support_duplicate(토큰 80% 중복) / generic_support(일반론 단독)

## 자유입력 55건 리포트(ai.ruleEngine.test — CI 상시)
Safety 98.4 · Copy-Ready 98.9 · 자연스러움 100% · 개인화 100% · 신호감지 91% · SAFE(일반론) 9%(희박·부정감정 의도적)
· 배움 문형 고유율 69% · 중대 오류 0 · 금지 표현 0 · 결정론 검증 통과.
게이트: SAFE≤20%, 감지≥80%, Safety≥95, 고유율≥55, major=0.

## 품질 게이트(개발 판단 기준 — 코드 반영 전 필독)
1. **fact_mismatch("사실과 다름") > 0이면** 규칙 확장보다 **사실 보존 원인 분석 우선**(리포트의 audit 코드 빈도부터).
2. **need_natural("더 자연스럽게")이 반복되면** 해당 표현 유형을 분류해 표현 풀 개선 후보로 축적(즉시 엔진 수정 금지).
3. **B안 확대 검토 조건(제안)**: 표본이 적으므로 확정 기준이 아닌 최소 조건 —
   - 변형별(A·B 각) 피드백 **최소 30건** 이상, 서로 다른 날짜 **2주 이상** 수집.
   - B안 "그대로 사용 가능" 비율이 A안보다 **+15%p 이상** 그리고 B안 fact_mismatch **0건**일 때만 기본 엔진 확대 논의.
   - 표본 30건 미만이면 판단 보류(수집 지속).
4. **온디바이스 LLM 검토 조건**: 실제 비정형 입력에서 신호 미감지(SAFE 폴백)율이 유의하게 높거나(예: 30건 중 20%+), need_natural이 B안 피드백의 30%+로 반복될 때만. 이때도 audit·사실 보존 가드를 최종 게이트로.
5. **Target Alignment 점수 상승만으로 엔진 전환 금지** — v3는 합성 참조이므로 교사 피드백 KPI(위 1~3)가 우선.
