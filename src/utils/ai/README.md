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
   - Softens risky expressions.
   - Reduces unsupported claims and negative labeling.
   - Preserves actual child speech.

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
