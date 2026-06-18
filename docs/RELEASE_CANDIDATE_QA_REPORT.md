# 출시 후보(RC) QA 리포트

- **QA 실행 날짜**: 2026-06-18
- **대상 브랜치**: `codex/refactor-local-ai-engine`
- **테스트 환경**:
  - 정적 코드 점검(흐름·노출·용어), 자동화 테스트(`react-scripts test`, jsdom), CI 빌드(`CI=true react-scripts build`).
  - 실기기 수동 QA는 `docs/MVP_QA_CHECKLIST.md`의 "출시 전 필수 시나리오"를 모바일 실기기에서 별도 수행 권장.
- **AI/생성/백업 구조 변경 없음** — 이번 단계는 점검·문서화 중심.

---

## 1. 핵심 사용 흐름 결과
코드 경로 + 자동화 테스트로 확인. (실기기 클릭 검증은 체크리스트로 보완)

| 흐름 | 경로 | 결과 |
|---|---|---|
| 첫 접속/온보딩 | `App.js` → `isOnboardingDone()` → `OnboardingModal`(3단계) | ✅ 표시/숨김 로직·3단계 구성 테스트 통과 |
| 원아 등록 | 설정 → 아이 목록 → `RecordPage` STEP1 노출 | ✅ 빈 상태 안내 포함 |
| 오늘기록 입력 | `RecordPage` textarea → `processRecord` | ✅ 빈 입력/실패 안내 |
| 예시 버튼 | 빠른 예시 칩 → `insertTextAtCursor` | ✅ `appendExample` 테스트 통과 |
| 문장 생성 | `processRecord` 결과 카드 | ✅ 생성 결과 회귀 테스트 통과 |
| 관찰일지/알림장 카드 | `ResultSection`(기본 펼침) | ✅ 접기/펼치기·복사·편집 |
| 카드별/전체 복사 | `ResultSection`/`CopyAllButton`(`buildCombinedCopy`) | ✅ 형식 테스트 통과 |
| 문서 저장/재열기 | `addRecord` → 전체 기록 → 상세 | ✅ |
| 더보기/설정 | 하단 더보기 시트 / 상단 기어 | ✅ |
| 백업/복원 | `buildBackupPayload` / `importBackup(Merge)` | ✅ engineSettings만 동기화 |

자동화: **전체 테스트 통과 / CI 빌드 성공**(아래 7장).

## 2. 모바일 UI 점검 결과
| 항목 | 상태 | 비고 |
|---|---|---|
| 하단 메뉴 버튼 크기 | ✅ | 탭 패딩 `8px 4px`, 핵심 4 + 더보기 |
| 더보기 시트 높이/스크롤 | ✅ | `maxHeight 70vh` + `overflowY:auto`(이번 수정) |
| 전체 복사 버튼 위치 | ✅ | 결과 상단 풀폭, `minHeight 50` |
| 카드 접기/펼치기 표시 | ✅ | 헤더 화살표(▲/▼) |
| 복사/편집 버튼 밀림 | ✅ | 헤더 우측 고정, `minHeight 36` |
| 긴 문장 줄간격 | ✅ | `line-height 1.9~1.95` |
| 로딩 문구/스피너 | ✅ | 스피너 + "AI가 문서 문장으로 정리 중..." |
| 토스트 지속시간 | ✅ | 2000ms → **2600ms**(이번 수정) |

## 3. 용어 통일 결과
메뉴·관리 용어를 "원아"로 통일(부모 전달 문장·생성 결과 문체는 "아이" 유지).
- 메뉴 `아이기록` → `원아기록`(하단 탭/사이드바/페이지 타이틀)
- 빈 상태 `등록된 아이 없음` → `등록된 원아 없음`, 버튼 `원아 추가하기`
- 입력 화면 `아이 선택` 라벨 → `원아 선택`
- 온보딩 1단계 `원아를 등록해요`
- 유지(자연스러운 표현): "아이별 기록", "아이 N명", 생성 결과 문체

## 4. 관리자/검수 정보 비노출 확인
- 사용자 페이지(RecordPage/TodayPage/DocsPage/ChildrenPage/NotePage/CheckPage/StatsPage)는 엔진/검수 모듈을 **import하지 않음**, `qualityScore`·`fallback 사유`·`modularDrafts`·`legacy 엔진` 등 **표시 토큰 없음** → `adminExposure.test.js`로 보장.
- `EngineComparePanel`/`EngineReviewReport`는 `SettingsPage`의 **`isMaster()` 게이트 안에서만** 장착 → 테스트로 보장.
- (참고) `DocsPage`의 `fallback`은 문장 생성용 지역 변수명일 뿐, 사용자에게 "fallback 사유"로 노출되지 않음.

## 5. 백업/복원 확인
- 백업 번들에는 비민감 `engineSettings`(legacy/modular 플래그)만 포함.
- **제외 유지**: `engine_reviews`(검수), `engine_fallbacks`(fallback 로그), user corrections, inputText/legacyText/modularText/userEditedText 등 — `ai.sync.test.js`/`ai.review.test.js`로 검증.
- 복원: `importBackup`/`importBackupMerge`에서 엔진 설정·데이터 복구.

## 6. 발견된 리스크 (조치 결과 반영)
| 심각도 | 항목 | 위치 | 조치 |
|---|---|---|---|
| 🔴→✅ | 마스터 계정 **하드코딩 비밀번호** (`master` / `saem2026!`) | `src/utils/auth.js` 시드 계정 | **해결** — 운영 시드에서 비밀번호 제거(`mustSetPassword`), 편의용 시드는 `NODE_ENV!=='production'`에서만. 운영 번들·소스맵에 `saem2026!`/`dev-master` 없음(빌드 산출물 확인). |
| 🔴→✅ | 계정 **비밀번호 평문 저장**(localStorage accounts) | `auth.js` register/login | **해결** — Web Crypto SHA-256 + per-account salt 저장(`passwordHash`/`passwordSalt`/`passwordVersion:2`), 평문 미보관. |
| 🟡→✅ | localStorage에 계정/세션·검수 데이터 평문 | 전반 | **완화** — 설정에 "공용 기기 사용 주의" 안내 추가. 세션에는 해시/솔트도 미포함. |
| 🟢 낮음 | 토스트가 빨리 사라짐(2s) | Toast | 2.6s로 상향(수정 완료) |
| ℹ️ 정보 | 검수/fallback/corrections 백업 제외 | — | 정상 유지 |

> 6장의 보안 항목은 별도 보안 수정 단계에서 모두 조치했습니다(7장 참조). 로컬 앱 특성상 완전한 서버 인증 보안은 아니며, 목적은 평문 노출 축소입니다.

## 7. 출시 전 반드시 수정할 항목 — ✅ 완료
1. ✅ **마스터 계정 하드코딩 비밀번호 제거** — 운영 시드는 `mustSetPassword`(최초 로그인 시 관리자가 직접 설정), 편의용 비밀번호는 개발/테스트 빌드 전용.
2. ✅ **계정 비밀번호 해시 저장** — Web Crypto salt+hash, 기존 평문 계정은 로그인 성공 시 자동 마이그레이션 후 평문 제거.
3. ✅ **공용 기기 사용 주의 안내** — 설정 화면 개인정보 안내 옆에 1장 추가.

## 8. 출시 후 개선해도 되는 항목
- 비밀번호 해시 전체 마이그레이션(기존 계정 포함) 및 로그인 흐름 보강.
- 관찰일지 modular 전환(엄격 기준: 샘플 30건+·성공률 100%·발화 실패 0·factPreservation 28+ 충족 후 수동 승인).
- 검수 데이터의 IndexedDB 이전(용량 한도 대비) 및 기기 간 합산 수단.
- 더보기 시트 항목 사용 빈도 기반 정렬, 데스크탑 사이드바 기본 노출 정리.

---

## 자동화 결과 (이번 점검 시점)
- `npm test -- --watchAll=false`: **전체 통과**
- `npm run build`(CI=true): **성공**
