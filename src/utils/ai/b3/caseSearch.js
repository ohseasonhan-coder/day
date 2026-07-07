import { B3_CASE_LIBRARY } from './caseLibrary';
import { B3_CASE_SCORE_MIN, B3_MAX_SIMILAR_CASES } from './config';

const unique = (values) => [...new Set(values.filter(Boolean))];

export function extractB3FactsShape(card = {}) {
  const text = String(card.normalized || card.source || '');
  return unique([
    /(무너지|실패|안 되|틀리|잘못|흘리|끊어)/.test(text) && 'failed_attempt',
    /(다시|재시도|계속|고쳐|반복)/.test(text) && 'retry',
    card.speech?.length && 'direct_speech',
    card.flags?.hasPeer && 'peer_interaction',
    card.flags?.hasTeacherSupport && 'actual_teacher_support',
    card.flags?.hasEmotion && 'emotion_cue',
    card.flags?.hasRecovery && 'recovery_cue',
    /(왜|어디|어떻게|질문|궁금|물었|물어)/.test(text) && 'question',
    /(관찰|살펴|돋보기|들여다|변하|섞|녹|얼)/.test(text) && 'exploration',
    /(변하|섞|녹|얼|달라)/.test(text) && 'change_observation',
    /(만들|쌓|붙|접|그리|점토|물감|꾸미)/.test(text) && 'construction',
    /(재료|블록|점토|종이|물감|가위|풀|천|나무)/.test(text) && 'material_use',
    /(말하|설명|이야기|표현|"|“)/.test(text) && 'language_expression',
    /(역할|손님|주인|의사|엄마 역할|아빠 역할|인 척)/.test(text) && 'role_assignment',
    /(나누|건네|빌려|함께|같이|양보|번갈아)/.test(text) && 'sharing',
    /(다투|싸우|밀|빼앗|잡아당|부딪)/.test(text) && 'conflict',
    /(미안|사과)/.test(text) && 'apology',
    /(차례|순서|줄을 서|기다렸|기다렸다|새치기)/.test(text) && 'turn_waiting',
    /(스스로|혼자|정리|치우|신발|지퍼|화장실|손을 씻|양치|식판|식사)/.test(text) && 'self_help',
    /(정리|씻|양치|식사|화장실|신발|옷|이불)/.test(text) && 'daily_routine',
    /(뛰|달리|점프|평균대|균형|던지|기어|그네|미끄럼틀|페달)/.test(text) && 'body_movement',
    /(비교|분류|크기 순|순서대로|더 크|더 작|같은 것|다른 것|짝)/.test(text) && 'comparison',
    /(분류|나누어|순서대로|짝을 맞)/.test(text) && 'classification',
    /(그 다음|그러고 나서|다음에는|처음|마지막|이야기를 만들)/.test(text) && 'story_sequence',
    text.length >= 100 && 'long_narrative',
    /(도와|잡아 줘|해 줘|도움.{0,8}(요청|청하))/.test(text) && 'help_request',
    /(건네주|알려 주|도와주|잡아 주)/.test(text) && 'help_action',
    card.flags?.sparse && 'sparse',
  ]);
}

const boolMatch = (expected, actual) => expected == null ? 0 : (expected === actual ? 6 : -18);

export function scoreB3Case(item, context) {
  const primary = context.plan.learningPlan.primaryTheme;
  const secondary = context.plan.learningPlan.secondaryTheme;
  const shapes = context.factsShape || [];
  const intersection = item.factsShape.filter((shape) => shapes.includes(shape)).length;
  const union = new Set([...item.factsShape, ...shapes]).size || 1;
  const shapeScore = Math.round((intersection / union) * 34);
  let score = 0;
  const reasons = [];
  if (item.themes[0] === primary) { score += 58; reasons.push('primary_theme'); }
  else if (item.themes.includes(primary)) { score += 44; reasons.push('theme_present'); }
  else { score -= 45; reasons.push('primary_mismatch'); }
  if (secondary && item.themes.includes(secondary)) { score += 22; reasons.push('secondary_theme'); }
  if (!secondary && item.themes.length === 1) score += 5;
  score += shapeScore;
  if (intersection) reasons.push('fact_shape');
  score += boolMatch(item.constraints.hasSpeech, !!context.card.speech.length);
  score += boolMatch(item.constraints.hasPeer, !!context.card.flags.hasPeer);
  score += boolMatch(item.constraints.hasTeacherSupport, !!context.card.flags.hasTeacherSupport);
  score += boolMatch(item.constraints.sparse, !!context.card.flags.sparse);
  if (item.constraints.documentType === context.documentType) score += 5;
  return { ...item, score, matchedShapeCount: intersection, shapeScore, reasons };
}

export function findSimilarB3Cases({ card, plan, documentType = 'observation', limit = B3_MAX_SIMILAR_CASES } = {}) {
  const factsShape = extractB3FactsShape(card);
  const context = { card, plan, documentType, factsShape };
  const ranked = B3_CASE_LIBRARY.map((item) => scoreB3Case(item, context))
    .sort((a, b) => b.score - a.score || b.matchedShapeCount - a.matchedShapeCount || a.id.localeCompare(b.id));
  const matches = ranked.filter((item) => item.score >= B3_CASE_SCORE_MIN).slice(0, limit);
  return {
    factsShape,
    matches,
    topScore: ranked[0]?.score || 0,
    searched: ranked.length,
    success: matches.length > 0,
  };
}

export default findSimilarB3Cases;
