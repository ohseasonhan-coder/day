# Local Rule-Based AI Engine

This directory contains the modular local AI engine for SaemWork.

The app does not call external LLM APIs. All analysis and draft generation run in the browser with deterministic rules.

## Compatibility

`src/utils/ai.js` is the public compatibility wrapper.

Existing screens should continue importing from:

```js
import { processRecord, generateDailyJournal } from '../utils/ai';
```

The legacy return fields are preserved. Modular results are additive:

- `aiAnalysis`
- `modularDraft`
- `modularDrafts`

Do not remove legacy fields unless every consuming screen has migrated.

## Main Flow

1. `inputParser.js`
   - Normalizes user input.
   - Extracts actual speech, teacher support, peer interaction, emotions, health/safety, play flow, and changes.
   - Preserves quoted child speech.

2. `draftComposer.js`
   - Coordinates analysis, sentence selection, repetition tracking, and draft creation.
   - Keeps `index.js` focused on public exports and compatibility wrappers.

3. `categoryClassifier.js`
   - Classifies records into local development categories.
   - Detects development areas and document use targets.

4. `curriculumMapper.js`
   - Connects analysis to existing standard curriculum helpers.

5. `tagExtractor.js`
   - Produces structured tags from parsed input and classification results.

6. `sceneAnalyzer.js` and `observationFrames.js`
   - Detect common scenes.
   - Build objective observation frames for modular observation drafts.

7. `sentenceSelector.js`
   - Selects tagged sentence templates.
   - Sentences include `category`, `status`, `documentType`, and `tone`.

8. `documentEngines/`
   - Creates modular drafts by document type.
   - Current engines:
     - `observationEngine.js`
     - `noticeEngine.js`
     - `dailyReportEngine.js`
     - `parentMessageEngine.js`
     - `supportPlanEngine.js`
     - `evaluationEngine.js`
     - `growthSummaryEngine.js`
     - `consultDraftEngine.js`

9. `qualityGuard.js`
   - Applies per-field guard policies (`GUARD_POLICIES`).
   - Observation/일화기록: preserves facts, no softening, no positive rephrase (only removes unsupported absolutes like 항상/완벽하게).
   - Parent notice / counseling: softening and gentle positive rephrase allowed.
   - Evaluation / support plan: minimal softening, no over-positive rephrase.
   - Preserves actual child speech verbatim and never appends meta sentences.

10. `normalizationRules.js`
    - Shared normalization, softening, and positive rephrase rule lists.
    - Applies rules outside quoted speech.

11. `documentMeta.js`
    - Builds document readiness metadata.
    - Owns document use labels and document use mapping.

12. `toneAdapter.js`
    - Applies tone variants to modular drafts.

13. `repetitionGuard.js`
    - Tracks recently used sentence IDs in memory and `localStorage`.

14. `legacyEngine.js`
    - Preserves the original rule engine.
    - Should be reduced gradually only when regression tests remain stable.

15. `quality/` (NOT wired to UI yet)
    - `lexicon.js`: word lists for scoring (labels, overstatements, negative-fact markers, positive-spin, concrete verbs).
    - `qualityScorer.js`: deterministic multi-dimension scorer — `scoreText(text, { sourceText, documentType })` and `scoreAgainstGolden(generated, golden)`. Dimensions: speech preservation, factual consistency, objectivity, concreteness, style, non-repetition, length. Per-document weighting in `QUALITY_PROFILES`.
    - `goldenSamples.js`: curated input → ideal observation/evaluation benchmarks with `mustInclude` / `mustNotInclude`.
    - `sentenceDataset.js`: area-based recommended sentence patterns, evaluation/parent frames, banned patterns.
    - Used only by `ai.quality.test.js` for now; safe to evolve before connecting to engines.

16. `qualityScorer.js` + `datasets/` (NOT wired to UI yet) — document-quality rubric layer
    - `qualityScorer.js`: 100-point rubric scorer. `scoreText(text, { input, documentType })` returns `{ totalScore, detail, warnings, suggestions }`. Weights: factPreservation 30, naturalness 20, documentFit 20, safety 15, repetition 10, curriculumFit 5. `explainDeductions(result)` lists where points were lost.
    - `datasets/goldenSamples.js`: 30+ teacher-input → expected-output samples, each with `expected.{observation,notice,dailyReport,counseling,development}`. Speech preserved verbatim, no fabricated facts.
    - `datasets/sentenceDataset.js`: 150+ tag-based sentence fragments (`type`, `category`, `situation`, `documentType`, `status`, `ageGroup`, `tone`, `riskLevel`). Covers situation/behavior/support/evaluation/parent/counseling/development/homeLink/closing/softening.
    - `ai.golden.test.js`: validates golden samples score high, distorted output scores low, dataset integrity, and prints a current-engine quality regression report.

17. `documentEngines/evaluationComposer.js` — 보육일지 평가(evaluation/dailyReport) 전용 문장 조립기
    - `extractEvaluationElements({ input, categories })`: 입력에서 activity·materials·peerInteraction·teacherSupport·childResponse·safetySupport·emotion·difficulty·curriculumArea 추출.
    - `composeEvaluation(...)`: 패턴 A(놀이 확장)/B(또래 상호작용)/C(어려움·소극 — 부드러운 사실 인정)/D(안전교육)로 핵심 소재·교사 지원·발달영역을 반영한 평가 문단 생성. 내부 라벨("놀이 흐름:" 등) 미사용, 발화 원문 보존, 입력에 없는 사실 추가 안 함.
    - `dailyReportEngine.js`/`evaluationEngine.js`가 이 composer를 사용(모듈러 경로, UI 미연결). 골든 입력 기준 보육일지 평가 평균 77.6 → 93.5.

18. `documentEngines/noticeComposer.js` — 알림장(notice/parentMessage) 전용 조립기
    - 부모 친화 패턴 A(긍정 참여)/B(교사지원 후 변화, 입력에 변화 있을 때만)/C(소극·거부·감정, 부드러운 사실 전달)/D(또래 갈등·조율). 발화 보존, 부정 사실 순화하되 삭제 안 함. 평균 86.6 → 97.0.

19. `documentEngines/counselingDevelopmentComposer.js` — 상담자료(counseling)·발달평가(development) 전용 조립기
    - `composeCounseling`: 관찰된 모습·교사 지원·가정 연계 방향을 부드럽고 전문적인 문체로. 단일 사건을 반복 성향처럼 과장하지 않음.
    - `composeDevelopment`: 발달영역별 현재 모습·관찰 근거·지원 방향을 전문 문체로. 입력에 없는 발달 수준 추정 금지, '못한다/부족/늦다' 미사용.
    - `consultDraftEngine.js`/`growthSummaryEngine.js`가 사용(원본 메모 덤프 제거). 상담 평균 95.7, 발달 평균 95.9.
    - `composeDevelopment`는 활동+소재를 결합한 근거 맥락과 관찰 행동·발화를 반영(패턴 A/B/C)하여 factPreservation·documentFit을 높였다.
    - qualityScorer: counseling/development는 정중한 전문 문체(습니다)와 문어체(다.) 모두 인정, '못한다/부족/늦다/지연' 부정 단정 추가 감점.

20. `engineComparison.js` + `userCorrectionLearning.js` + `components/EngineComparePanel.js` (개발자/검수 전용, UI는 마스터에게만)
    - `buildEngineComparison({ childName, rawText, classAge })`: legacy 출력과 modular(composer) 출력을 5종 문서(관찰/보육일지평가/알림장/상담/발달)로 생성하고 qualityScore(총점·factPreservation·naturalness·safety·documentFit) 비교. `getComparisonView({ enabled })`로 게이트 — 꺼지면 비교 데이터를 만들지 않는다.
    - `pickRecommended`: 점수 높은 쪽 추천(자동 대체 없음). 사용자가 직접 선택/수정.
    - `userCorrectionLearning.recordEngineChoice(...)`: 선택/수정 데이터를 받아 두는 스텁(TODO, 로컬 전용). 저장은 미구현.
    - `EngineComparePanel`: SettingsPage에 마스터 전용 토글(`engineCompareMode`)로 장착. 일반 사용자 화면·legacy 출력은 그대로 유지.

21. 검수 데이터 누적 + 리포트 (로컬, 외부 전송 없음)
    - `userCorrectionLearning.recordEngineChoice(...)`: 선택/수정 검수 데이터를 사용자별 localStorage(`sw_<uid>_engine_reviews`)에 저장. 저장 항목: recordId·inputText·documentType·legacyText·modularText·legacyScore·modularScore·recommendedEngine·selectedEngine·userEditedText·finalText·edited·tags·category·warnings·selectedAt. 드라이브 백업 대상 키가 아니라 외부로 나가지 않는다. `getEngineReviews`/`clearEngineReviews`.
    - `engineReviewReport.buildReviewReport()`: 문서 유형별 건수·modular 추천/선택률·legacy 선택률·수정률·평균 legacy/modular 점수·점수차·90점 미만 modular 목록·legacy 선택 사례를 집계.
    - `evaluateSwitchReadiness` + `SWITCH_CRITERIA`: 기본 전환 가능 기준(건수≥30, modular 평균≥90, 선택률≥0.8, 수정률≤0.2, safety 경고 0, factPreservation≥25) 충족 여부만 계산. 자동 전환 없음.
    - `canAccessReviewReport({ isMaster })`: 마스터만 접근. `EngineReviewReport` 컴포넌트는 SettingsPage 마스터 전용 카드에 장착.

22. 문서 유형별 기본 전환(수동 승인) + fallback
    - `documentEngineSettings.js`: 문서 유형별 기본 엔진 설정(`sw_<uid>_engine_prefs`, 기본값 전부 legacy). `getActiveEngineForDocument`/`setDocumentEngine`/`resetDocumentEngine`.
    - `documentEngineResolver.js`: `resolveDocumentEngine({ documentType, input, legacyText, modularFn })` — 설정이 legacy면 legacy, modular면 modular 생성→검수→통과 시 modular, 실패 시 legacy fallback(+`recordFallback` 로그). `validateModularOutput` fallback 사유: empty·internal_label·speech_not_preserved·low_score(<85)·safety_warning·modular_error. `generateWithFallback`는 텍스트만 반환(엔진/점수 비노출).
    - `publicApi.processRecord`가 observation/dailyReport/notice 필드에 resolver 적용(기본 legacy → 기존 동작 동일). 사용자에겐 결과 텍스트만 노출.
    - 관리자 UI(`EngineReviewReport`): 문서 유형별 현재 엔진 표시 + 기준 충족 시에만 'modular 기본 전환' 버튼 활성(확인창), 전환 후 'legacy로 되돌리기'. 자동 전환 없음.
    - 라이브 연결(`LIVE_CONNECTED_DOC_TYPES`, 전 5종): observation/dailyReport/notice는 `processRecord`, counseling은 `generateConsultDoc`(recentGrowth 필드), development는 `generateGrowthSummary`(overall 필드)에서 resolver 적용. 관리자 패널에 '● 라이브 연결됨' 표시.
    - 주의: 커리큘럼 항목 표기는 발화 오인을 막기 위해 작은따옴표가 아닌 「」를 사용한다(speech 보존 검사 오작동 방지).

23. 기기 간 동기화 (본인 구글 드라이브 백업 경유, 외부 서버 없음)
    - 백업 번들에 버전드 `engineSettings: { version, updatedAt, engines:{ docType: 'legacy'|'modular' } }`만 포함 → 기기 간 동기화. `getEnginePrefsForSync`(직렬화)/`applyEnginePrefsFromSync`(복원), `importBackup`·`importBackupMerge`에서 반영(신 `engineSettings`/구 `documentEnginePrefs` 키 모두 호환).
    - 복원 규칙: 알 수 없는 documentType 무시 · 허용되지 않은 값은 legacy 처리 · `engineSettings` 없으면 기존 설정 유지 · 손상되면 안전하게 legacy.
    - 검수/fallback 데이터(`engine_reviews`/`engine_fallbacks`)는 아이 발화·이름이 포함될 수 있어 백업에 **포함하지 않는다**(개인정보 보호).
    - 관리자가 전환/되돌리기 시 `storage.triggerEnginePrefSync()`로 드라이브 동기화 예약(자동 백업·구글 연결 시).

## Safety Rules

- Do not add OpenAI, Gemini, Claude, or other external API calls.
- Do not add a server.
- Do not invent facts that are not present in the input.
- Do not change actual child speech inside quotes.
- Keep Korean childcare documentation style objective, warm, and non-labeling.
- Prefer additive migration over replacing legacy fields.

## Tests

AI tests are split by concern:

- `ai.test.js`: legacy regression coverage.
- `ai.compat.test.js`: compatibility and no external API checks.
- `ai.analysis.test.js`: parser, classification, tags, scene, document metadata.
- `ai.engines.test.js`: document draft engines.
- `ai.rules.test.js`: normalization, quality, tone, repetition.

Run:

```bash
npm test -- --watchAll=false
npm run build
```
