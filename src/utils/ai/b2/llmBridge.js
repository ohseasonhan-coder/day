import { auditObservationCopy } from '../observationAudit';
import { parseTargetSections } from '../targetQuality';
import { getServerConfig, hasServerModel, privateServerAdapter } from '../llm/privateServerLLM';
import { geminiAdapter, getGeminiConfig } from '../llm/geminiLLM';
import { anonymizeOtherChildNames, restoreOtherChildNames } from '../llm/externalPrivacyGuard';
import { isReviewModeEnabled } from '../../reviewFeedback';
import { buildB2FactCard, buildB2SentencePlan, generateB2, judgeB2Themes } from './engine';
import { DEFAULT_B2_ENGINE, resolveB2SentenceEngine } from './config';

export const B2_LLM_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['learningTheme', 'learningReading', 'supportAction', 'supportAndNextPlan'],
  properties: {
    learningTheme: { type: 'string' },
    learningReading: { type: 'string', minLength: 10, maxLength: 220 },
    supportAction: { type: 'string' },
    supportAndNextPlan: { type: 'string', minLength: 10, maxLength: 220 },
  },
};

const GLOBAL_FORBIDDEN = [
  /유아들은|활용하여|놀이에 참여하였다|기회를 얻었다|할 것이다/,
  /발달(하|했|되|수준|능력)|향상(되|했)|뛰어(나|남)|우수|완성|확립/,
  /자신감|리더십|창의력|사회성|배려심|협동심|문제\s*해결\s*능력/,
  /의도하|생각했을|마음먹|원했을|느꼈을|분명히 알고|이해했다/,
];
const SUPPORT_DONE = /(지원하였|지원했|도와주었|도와 주었|제공하였|제공했|격려하였|격려했|마련해 주었|계획하였|계획했|활용하였)/;
const FUTURE_PLAN = /(한다|둔다|돕는다|마련한다|이어 본다|기다린다|확보한다|짚어 준다|되돌려 준다|열어 준다|남겨 둔다|하게 한다|수 있도록 한다|시간을 준다)[.!?]?$/;
const CONCRETE_TERMS = ['친구', '또래', '교사', '선생님', '엄마', '아빠', '블록', '점토', '물감', '가위', '돋보기', '그림', '사진', '책', '공', '자동차', '곤충', '식물', '모래', '물', '교실', '바깥', '놀이터'];
const EMOTION_TERMS = ['기뻐', '즐거', '행복', '속상', '화가', '무서', '불안', '슬퍼', '아쉬', '자랑스러'];

const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const finish = (value) => {
  const text = clean(value);
  return text && !/[.!?]["”']?$/.test(text) ? `${text}.` : text;
};
const unique = (values) => [...new Set(values.filter(Boolean))];
const quoteTexts = (value) => Array.from(String(value || '').matchAll(/["“]([^"”]+)["”]/g)).map((m) => m[1]);
const tokens = (value) => unique(String(value || '').replace(/[^가-힣\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 2));
const tokenOverlap = (a, b) => {
  const left = tokens(a);
  const right = new Set(tokens(b));
  return left.length ? left.filter((word) => right.has(word)).length / left.length : 0;
};

function replaceChild(value, childName, childLabel = '원아 A') {
  if (!childName) return String(value || '');
  return String(value || '').replace(new RegExp(childName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), childLabel);
}

function restoreChild(value, childName, childLabel = '원아 A') {
  return String(value || '').replaceAll(childLabel, childName || '유아');
}

function allowedSupportRows(judgment) {
  return unique([judgment.primary, judgment.secondary].filter(Boolean)
    .flatMap((theme) => theme.allowedSupportActions || []).map((item) => item.id))
    .map((id) => {
      const action = [judgment.primary, judgment.secondary].filter(Boolean)
        .flatMap((theme) => theme.allowedSupportActions || []).find((item) => item.id === id);
      return { id, allowedMeaning: clean(action?.text) };
    });
}

export function buildRestrictedLLMContext({ input = '', childName = '', observation = '', fallbackCopyReady = '' } = {}) {
  const b2 = generateB2({ input, childName, observation, fallbackCopyReady });
  const card = buildB2FactCard({ input, childName });
  const judgment = judgeB2Themes(card);
  if (!judgment.primary) card.flags.sparse = true;
  const plan = buildB2SentencePlan({ card, judgment, observation: b2.sections.observation });
  const themes = [judgment.primary, judgment.secondary].filter(Boolean);
  const childLabel = '원아 A';
  const llmInput = {
    childLabel,
    observation: replaceChild(b2.sections.observation, childName, childLabel),
    speech: card.speech.map((item) => item.text),
    allowedLearningThemes: themes.map((theme) => ({
      id: theme.id,
      allowedClaims: [...theme.allowedClaims],
      blockedClaims: unique([...theme.blockedClaims, ...card.forbiddenClaims]),
    })),
    allowedSupportActions: allowedSupportRows(judgment),
    forbiddenClaims: unique([...card.forbiddenClaims, '사실 카드 밖의 사건·대상·재료', '입력에 없는 직접 발화']),
    styleRules: [
      '교사가 기록에 바로 사용할 수 있는 자연스러운 문장',
      '배움 읽기는 1~2문장',
      '지원 계획은 미래형 1~2문장',
      '과장·일반론·진단·감정 추정 금지',
      '관찰내용을 그대로 반복하지 않기',
    ],
  };
  return { b2, card, judgment, plan, llmInput };
}

export function buildRestrictedMessages(llmInput) {
  const system = [
    '당신은 어린이집 교사 기록 문장화 도구다.',
    '아래 JSON에 명시된 허용 의미만 자연스럽게 문장화한다.',
    '관찰내용을 수정하거나 새 사실, 감정, 의도, 발달 평가, 또래 반응, 완료된 교사 지원을 만들지 않는다.',
    'learningTheme과 supportAction은 제공된 id 중 하나만 선택한다.',
    '설명, 머리말, 코드블록 없이 지정된 JSON 객체 하나만 반환한다.',
  ].join(' ');
  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ input: llmInput, outputSchema: B2_LLM_OUTPUT_SCHEMA }) },
  ];
}

export function parseRestrictedLLMJson(raw) {
  const text = clean(raw);
  if (!text) return { ok: false, error: 'empty_output' };
  if (!text.startsWith('{') || !text.endsWith('}') || /```/.test(text)) return { ok: false, error: 'strict_json_required' };
  try {
    const data = JSON.parse(text);
    const keys = Object.keys(data || {}).sort();
    const expected = B2_LLM_OUTPUT_SCHEMA.required.slice().sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return { ok: false, error: 'json_schema_mismatch' };
    if (expected.some((key) => typeof data[key] !== 'string' || !clean(data[key]))) return { ok: false, error: 'json_value_invalid' };
    return { ok: true, data };
  } catch { return { ok: false, error: 'json_parse_failed' }; }
}

function unsupportedConcreteTerms(text, allowedText) {
  return CONCRETE_TERMS.filter((term) => text.includes(term) && !allowedText.includes(term));
}

function themeMeaningGrounded(text, theme) {
  const claimTokens = tokens((theme?.allowedClaims || []).join(' ')).filter((word) => !['자신의', '관찰된', '행동으로'].includes(word));
  if (!claimTokens.length) return false;
  return claimTokens.some((word) => text.includes(word.slice(0, Math.max(2, word.length - 1))));
}

export function validateRestrictedLLMOutput({ data, context }) {
  const reasons = [];
  const { b2, card, judgment, llmInput, plan } = context;
  const theme = llmInput.allowedLearningThemes.find((item) => item.id === data.learningTheme);
  const action = llmInput.allowedSupportActions.find((item) => item.id === data.supportAction);
  if (!theme) reasons.push('theme_not_allowed');
  if (!action) reasons.push('support_action_not_allowed');

  const learningMasked = finish(data.learningReading);
  const supportMasked = finish(data.supportAndNextPlan);
  const learning = restoreChild(learningMasked, card.name, llmInput.childLabel);
  const support = restoreChild(supportMasked, card.name, llmInput.childLabel);
  const combined = `${learning} ${support}`;
  const blocked = unique([...(theme?.blockedClaims || []), ...llmInput.forbiddenClaims]);

  if (learning.length > 220 || support.length > 220) reasons.push('too_long');
  if (GLOBAL_FORBIDDEN.some((pattern) => pattern.test(combined))) reasons.push('forbidden_claim');
  if (blocked.some((claim) => claim.length >= 4 && combined.includes(claim))) reasons.push('blocked_claim');
  if (SUPPORT_DONE.test(support)) reasons.push('support_completed');
  if (!FUTURE_PLAN.test(support)) reasons.push('support_not_future_plan');
  if (tokenOverlap(learning, b2.sections.observation) >= 0.72) reasons.push('observation_repeated');
  if (theme && !themeMeaningGrounded(learning, theme)) reasons.push('learning_outside_allowed_claims');
  if (action && tokenOverlap(support, action.allowedMeaning) < 0.12) reasons.push('support_outside_allowed_meaning');

  const sourceQuotes = card.speech.map((item) => item.text);
  const generatedQuotes = [...quoteTexts(learning), ...quoteTexts(support)];
  if (generatedQuotes.some((quote) => !sourceQuotes.includes(quote))) reasons.push('speech_conflict');
  if (unsupportedConcreteTerms(learning, `${card.source} ${(theme?.allowedClaims || []).join(' ')}`).length) reasons.push('new_concrete_fact');
  if (unsupportedConcreteTerms(support, `${card.source} ${action?.allowedMeaning || ''}`).length) reasons.push('new_support_fact');
  if (EMOTION_TERMS.some((term) => learning.includes(term) && !card.normalized.includes(term))) reasons.push('emotion_fabricated');

  const audit = auditObservationCopy({
    input: card.source,
    observation: b2.sections.observation,
    learning,
    support,
    childName: card.name,
  });
  if (audit.severity === 'major') reasons.push(...audit.warnings.map((warning) => `audit:${warning}`));
  if (plan.meta.sparse && learning) reasons.push('sparse_input_overclaim');

  return {
    ok: reasons.length === 0,
    reasons: unique(reasons),
    learning,
    support,
    audit,
    selected: {
      learningTheme: data.learningTheme,
      supportAction: data.supportAction,
      themeEvidenceIds: judgment.primary?.id === data.learningTheme ? judgment.primary.evidenceIds : judgment.secondary?.evidenceIds || [],
    },
  };
}

function assembleCopy(observation, learning, support) {
  return [
    ['관찰내용', observation],
    ['배움 읽기', learning],
    ['교사 지원 및 다음 계획', support],
  ].filter(([, value]) => clean(value)).map(([label, value]) => `[${label}]\n${finish(value)}`).join('\n\n');
}

async function resolveEngine(engine, overrideAdapter) {
  if (overrideAdapter) return { adapter: overrideAdapter, engineId: engine, model: undefined };
  if (engine === 'gemini') return { adapter: geminiAdapter, engineId: engine, model: getGeminiConfig().model };
  const config = getServerConfig();
  if (engine === 'private-server-14b') return { adapter: privateServerAdapter, engineId: engine, model: config.model14b };
  if (engine === 'local-7b' || engine === 'private-server-7b') return { adapter: privateServerAdapter, engineId: engine, model: config.model };
  if (engine === 'auto') {
    if (await hasServerModel(config.model14b)) return { adapter: privateServerAdapter, engineId: 'private-server-14b', model: config.model14b };
    if (await hasServerModel(config.model)) return { adapter: privateServerAdapter, engineId: 'private-server-7b', model: config.model };
  }
  return { adapter: null, engineId: DEFAULT_B2_ENGINE, model: undefined };
}

function fallbackResult(context, fallbackReason = '') {
  return {
    copyReady: context.b2.copyReady,
    b2CopyReady: context.b2.copyReady,
    audit: context.b2.audit,
    engineUsed: DEFAULT_B2_ENGINE,
    fallbackReason,
    b2: context.b2,
    llmMeta: { requested: true, accepted: false, auditPassed: false, fallbackReason },
  };
}

export async function runConstrainedB2LLM({
  input = '', childName = '', observation = '', fallbackCopyReady = '',
  engine = DEFAULT_B2_ENGINE, adapter: overrideAdapter = null, reviewMode = isReviewModeEnabled(), timeoutMs = 45000,
} = {}) {
  const effectiveEngine = resolveB2SentenceEngine(engine, { reviewMode });
  const context = buildRestrictedLLMContext({ input, childName, observation, fallbackCopyReady });
  if (effectiveEngine === DEFAULT_B2_ENGINE) {
    return { ...fallbackResult(context), fallbackReason: '', llmMeta: { requested: false, accepted: false, auditPassed: true } };
  }
  if (context.plan.meta.sparse || !context.llmInput.allowedLearningThemes.length || !context.llmInput.allowedSupportActions.length) {
    return fallbackResult(context, 'b2_context_insufficient');
  }

  const resolved = await resolveEngine(effectiveEngine, overrideAdapter);
  if (!resolved.adapter) return fallbackResult(context, 'engine_unavailable');
  let status;
  try { status = await resolved.adapter.getStatus(); } catch { status = { state: 'error' }; }
  if (status.state !== 'ready') return fallbackResult(context, `engine_${status.state || 'unavailable'}`);

  const messages = buildRestrictedMessages(context.llmInput);
  let lastReason = 'generation_failed';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const attemptMessages = attempt === 0 ? messages : [
        ...messages,
        { role: 'system', content: '이전 출력은 형식 또는 안전 검사를 통과하지 못했다. 허용 id와 의미만 사용해 JSON 객체만 다시 반환한다.' },
      ];
      // 인터넷을 통해 나가는 어댑터(예: gemini)에는 전송 직전 다른 원아 이름까지 비식별화한다
      // (대상 원아 이름은 buildRestrictedLLMContext가 이미 '원아 A'로 치환했다). 응답은 복원 후 파싱한다.
      const external = resolved.adapter?.external === true;
      const anon = external ? anonymizeOtherChildNames(attemptMessages, { input, targetChild: childName }) : { messages: attemptMessages, nameMap: [] };
      // Adapter retries are disabled here. This layer owns the single allowed retry.
      // eslint-disable-next-line no-await-in-loop
      const rawSent = await resolved.adapter.generate({ messages: anon.messages, schema: B2_LLM_OUTPUT_SCHEMA, model: resolved.model, retries: 0, timeoutMs });
      const raw = anon.nameMap.length ? restoreOtherChildNames(rawSent, anon.nameMap) : rawSent;
      const parsed = parseRestrictedLLMJson(raw);
      if (!parsed.ok) { lastReason = parsed.error; continue; }
      const validation = validateRestrictedLLMOutput({ data: parsed.data, context });
      if (!validation.ok) { lastReason = validation.reasons.join(','); continue; }
      const copyReady = assembleCopy(context.b2.sections.observation, validation.learning, validation.support);
      return {
        copyReady,
        b2CopyReady: context.b2.copyReady,
        audit: validation.audit,
        engineUsed: resolved.engineId,
        fallbackReason: '',
        b2: context.b2,
        llm: { learning: validation.learning, support: validation.support },
        llmMeta: {
          requested: true,
          accepted: true,
          auditPassed: true,
          attempts: attempt + 1,
          learningTheme: validation.selected.learningTheme,
          supportAction: validation.selected.supportAction,
        },
      };
    } catch (error) {
      lastReason = `generate_failed:${String(error?.message || error)}`;
      if (/timeout/i.test(lastReason)) break;
    }
  }
  return fallbackResult(context, lastReason);
}

export function getB2Sections(result) {
  return parseTargetSections(result?.b2CopyReady || result?.b2?.copyReady || result?.copyReady || '');
}

export default runConstrainedB2LLM;
