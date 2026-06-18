# RC1 main 병합 PR 초안

- **base**: `main`
- **head**: `codex/refactor-local-ai-engine`
- **수동 생성 URL**: https://github.com/ohseasonhan-coder/day/compare/main...codex/refactor-local-ai-engine?expand=1
- ⚠️ 지금은 **병합하지 말 것**. 아래 "main 병합 전 필수 조건" 충족 후 병합.

---

## 제목
Release Candidate 1: local AI engine stabilization, auth hardening, and MVP QA docs

(한국어: RC1 준비 — 로컬 AI 엔진 안정화, 인증 보안 정리, MVP QA 문서화)

---

## 본문

### 핵심 요약
쌤워크(보육교사 문서 자동화)의 **출시 후보 1차(RC1)** 입니다. 로컬 AI 문장 엔진을 모듈화/안정화하고, 출시 전 **인증 보안 리스크를 제거**했으며, 사람이 수행할 **모바일 QA·릴리즈 문서**를 정리했습니다. 앱 구조는 그대로 **100% 로컬(localStorage) 기반 · 외부 서버 없음 · 외부 LLM API 없음**입니다.

### 주요 변경사항
- **로컬 AI 엔진 모듈화/안정화**: 문서유형별 엔진·composer·품질 평가 인프라(golden sample/qualityScorer), 비교/검수 모드(관리자 전용), 문서유형별 modular 기본 전환 + legacy fallback resolver.
- **인증 보안 하드닝**: 마스터 하드코딩 비밀번호 제거, 비밀번호 salt+해시 저장, 기존 평문 계정 로그인 시 자동 마이그레이션.
- **MVP UX 정리**: 메뉴 단순화(핵심 4 + 더보기), 온보딩/빈 상태 안내, 결과 카드 접기·전체 복사, 용어 통일(원아).
- **QA/릴리즈 문서**: RC QA 리포트, RC1 모바일 QA 체크리스트, RC1 릴리즈 노트.

### AI 생성 로직 변경 여부
- **이번 보안/문서 작업에서는 AI 생성 로직·modular/legacy·fallback·문장 엔진을 변경하지 않았습니다.** 엔진 모듈화는 이전 커밋들에서 완료된 것으로, 이번 RC 마감 단계에서는 인증/문서만 손댔습니다.

### 보안 수정 내역
| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 마스터 비밀번호 | 코드에 `master / saem2026!` 하드코딩 | 운영 시드는 비밀번호 없이 `mustSetPassword` → 최초 로그인 시 관리자가 직접 설정. 편의용 계정은 `NODE_ENV!=='production'`에서만 시드(운영 번들에서 제거) |
| 비밀번호 저장 | localStorage 평문 `password` | Web Crypto SHA-256 + per-account salt: `{ passwordHash, passwordSalt, passwordVersion: 2 }`, 평문 미보관 |
| 기존 계정 | 평문 유지 | 로그인 성공 시 해시로 자동 변환 후 평문 제거 |
| 세션 | password 제외 | password/passwordHash/passwordSalt 모두 제외 |
| 손상 데이터 | 깨질 수 있음 | `getAccounts()`에서 비정상 항목 필터 + 로그인 방어 |
| 빌드 산출물 | 소스맵에 원본 노출 | 운영 소스맵 비활성화(`.env.production`) |

### 개인정보 보호 구조
- 기록/문서/계정은 **사용자 기기(localStorage)** 에만 저장, 외부 서버 전송 없음.
- 구글 로그인은 **인증만** 사용. 드라이브 백업은 **사용자 본인 드라이브**에만 저장(켠 경우).
- 백업 번들은 비민감 `engineSettings`만 포함, 검수 데이터/fallback 로그/사용자 교정은 제외.

### 모바일 UX / 메뉴 정리
- 하단 핵심 메뉴 4 + 더보기 시트(`maxHeight 70vh` 스크롤), 결과 상단 전체 복사 버튼, 카드 접기/펼치기, 토스트 2.6s.
- 용어 통일: 메뉴/관리 표기 "원아"(부모 전달 문체는 "아이" 유지).

### 테스트 결과
- **232 / 232 통과** (20 suites). 보안 14건 + 관리자 비노출(`adminExposure.test.js`) 포함.

### 빌드 결과
- `CI=true react-scripts build` **성공**(린트-에러 모드), 운영 소스맵 **미생성**.

### 운영 빌드 보안 문자열 검사 결과
- `saem2026` → **0건** · `dev-master` → **0건** · `fallback 사유`/`legacy 엔진` → **0건** · 소스맵 → **없음**.
- `qualityScore`/`modularDrafts` → 번들에 존재하나 **로컬 AI 엔진 내부 속성명**으로 사용자 화면 비노출(`adminExposure.test.js` 보장). 제거하려면 엔진 변경 필요 → 범위 외로 유지(출시 후 code-splitting 후보).
- `passwordHash` → 새 보안 필드명(비밀값 아님).

### 사람이 직접 확인해야 할 RC1 모바일 QA 항목
`docs/RC1_MOBILE_QA_CHECKLIST.md` 전 항목. 특히:
- 첫 접속/온보딩, 관리자 최초 비밀번호 설정, 일반 구글 로그인/재로그인
- 원아 등록 → 오늘기록 → 문장 생성 → 카드(관찰일지/알림장/보육일지 평가) → 복사
- 키즈노트/카카오톡/메모장 붙여넣기 형식 유지
- 문서 저장/재열기, 더보기/설정, 공용 기기 안내 노출
- 구글 드라이브 백업/복원(실계정), 오프라인 기본 기능
- 일반 사용자 화면 관리자/검수 정보 비노출 육안 확인

### 알려진 한계
- 로컬 단일 SHA-256은 느린 KDF(bcrypt/PBKDF2)가 아니므로 오프라인 대입에 상대적으로 취약. 기기 물리 접근 시 localStorage 열람 가능.
- 기존 평문 계정은 **최초 로그인 전까지** 평문 유지(로그인 시 1회 전환). 서버 없는 구조라 강제 일괄 전환 미적용.
- 운영 마스터 최초 비밀번호는 "첫 입력값으로 설정" → 설치 직후 관리자가 먼저 설정해야 선점 위험 없음.
- AI 엔진 내부 토큰은 번들 포함(사용자 비노출). 완전 제거는 code-splitting 필요(출시 후 개선).

### main 병합 전 필수 조건 (모두 충족해야 병합)
- [ ] 실제 모바일 기기에서 `docs/RC1_MOBILE_QA_CHECKLIST.md` 전 항목 완료
- [ ] Google Drive 백업/복원 **실계정** 테스트 통과
- [ ] 관리자 최초 비밀번호 설정 **실배포 환경** 동작 확인
- [ ] 일반 사용자 화면 관리자/검수 정보 **비노출 육안 확인**
- [ ] 키즈노트/카카오톡/메모장 **붙여넣기 형식** 확인

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
