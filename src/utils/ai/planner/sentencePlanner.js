// 문장 계획(6단계) — 문장을 바로 만들지 않고 "무엇을 쓸지"를 먼저 계획 객체로 만든다.
// 렌더러는 이 계획 안의 내용만 표현할 수 있고, 새로운 의미를 추가하면 안 된다.
import { judgeSituation } from './situationJudge';

const clean = (s) => String(s || '').trim();
const quotesOf = (s) => Array.from(String(s).matchAll(/"([^"]+)"/g)).map((m) => m[1]);

// 반환(계획 객체):
// {
//   observationPlan: { facts[], speech[], sequence },        // 사실·발화·순서 — 해석 없음
//   learningPlan:   { primaryTheme, secondaryTheme, allowedClaims[], blockedClaims[] },
//   supportPlan:    { actualSupport[], nextSupportTheme, blockedClaims[] },
//   meta:           { name, hasPeer, emotionOnly }
// }
export function buildSentencePlan({ input = '', childName = '', ruleObservation = '', engineSupport = '' } = {}) {
  const src = clean(input);
  const { primary, secondary } = judgeSituation(src);
  const speech = quotesOf(src);
  const hasPeer = /(친구|또래)/.test(src);
  // 부정 감정 단서만(즐거움 상충·안정 창작 방지용) — '놀라워(감탄)'는 부정 감정이 아님
  const emotionCue = /(놀랐|놀라(?!워)|속상|울음|울었|우는|눈물|무서워|화나|짜증|서운|아쉬워)/.test(src);
  const recoveryCue = /(안정을 찾|진정|괜찮아|(곧|이내|다시)[^.]{0,10}집중)/.test(src);
  const actualSupport = (src.match(/(교사|선생님)[^."]{0,30}/) || []).slice(0, 1).map((s) => clean(s));

  return {
    observationPlan: {
      // 관찰내용은 사실 보존 엔진 결과를 그대로 쓴다(계획은 audit 대조용 기록)
      facts: [clean(ruleObservation) || src].filter(Boolean),
      speech,
      sequence: secondary ? `${primary?.id}_then_${secondary.id}` : (primary?.id || 'plain'),
    },
    learningPlan: {
      primaryTheme: primary ? primary.id : null,
      secondaryTheme: secondary ? secondary.id : null,
      allowedClaims: primary ? primary.allowedClaims : [],
      blockedClaims: [
        ...(primary ? primary.blockedClaims : []),
        ...(emotionCue && !recoveryCue ? ['안정을 찾음(회복 단서 없음)'] : []),
        ...(hasPeer ? [] : ['또래 상호작용 언급']),
        '감정·의도·발달 수준 추정',
      ],
    },
    supportPlan: {
      actualSupport, // 입력에 실제 교사 지원이 있을 때만(과거형 서술 허용 근거)
      engineSupport: clean(engineSupport),
      nextSupportTheme: primary ? primary.id : null,
      blockedClaims: actualSupport.length ? [] : ['교사 지원 완료형 표현'],
    },
    meta: { name: clean(childName), hasPeer, emotionOnly: emotionCue && !recoveryCue, primary, secondary },
  };
}

export default buildSentencePlan;
