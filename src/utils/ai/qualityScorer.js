// 보육 문서 문장 품질 평가기 (100점 만점, 전부 로컬 규칙 기반 — 외부 API/서버 없음).
//
// 평가 기준(가중치):
//   - 입력 사실 보존 (factPreservation): 30
//   - 문장 자연스러움 (naturalness):     20
//   - 문서 목적 적합성 (documentFit):    20
//   - 부정 표현 순화/안전성 (safety):    15
//   - 반복 표현 방지 (repetition):       10
//   - 발달영역/교사 지원 적합성 (curriculumFit): 5
//
// 반환: { totalScore, detail, warnings, suggestions }
import { extractActualSpeech } from './inputParser';
import {
  ABSOLUTE_OVERSTATEMENTS,
  CONCRETE_OBSERVATION_VERBS,
  CURRICULUM_AREAS,
  NEGATIVE_FACT_MARKERS,
  POSITIVE_SPIN_MARKERS,
  SUBJECTIVE_LABELS,
  SUBJECTIVE_PRAISE,
} from './quality/lexicon';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const includesAny = (text, list) => list.some((w) => text.includes(w));
const countMatches = (text, list) => list.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);

const PARTICLE_RE = /(을|를|이|가|은|는|에서|에게|한테|와|과|도|의|로|으로|랑|이랑|께|부터|까지|마다|보다|처럼)$/;
const STOPWORDS = new Set([
  '그리고', '하지만', '그래서', '이후', '교사', '유아', '선생님', '그렇게', '다시', '조금',
  '정말', '이거', '저거', '그거', '자기', '우리', '오늘', '이때', '그때', '계속', '대해',
  '위해', '통해', '라고', '하고', '하며', '하자', '했고', '한다', '면서', '에서도', '같이',
]);

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(text) {
  return String(text || '')
    .replace(/["“”'‘’]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// 입력에서 변형이 적은 '내용 명사' 후보 추출 (사실 보존 판정용)
function contentNouns(input) {
  const cleaned = String(input || '').replace(/["“”'‘’][^"“”'‘’]*["“”'‘’]/g, ' ');
  const toks = cleaned.split(/[^가-힣]+/).filter(Boolean);
  const nouns = [];
  toks.forEach((t) => {
    const stem = t.replace(PARTICLE_RE, '');
    if (stem.length < 2) return;
    if (STOPWORDS.has(stem) || STOPWORDS.has(t)) return;
    if (/(다|고|며|서|면|지|네|요|자|걸|음|던|니)$/.test(stem) && stem.length <= 3) return; // 동사·어미 형태 제외
    nouns.push(stem);
  });
  return [...new Set(nouns)];
}

const FORMAL_TYPES = new Set(['observation', 'dailyReport', 'counseling', 'development', 'evaluation', 'support']);
const SPEECH_REQUIRED = new Set(['observation']);

// ── 1) 입력 사실 보존 (30) ────────────────────────────────────────
function scoreFactPreservation(text, input, documentType, warnings, suggestions) {
  const speeches = extractActualSpeech(input).filter(Boolean);
  const outputQuotes = extractActualSpeech(text).filter(Boolean);

  // (a) 발화 보존 — 15
  let speechScore = 15;
  if (speeches.length > 0) {
    const preserved = speeches.filter((s) => text.includes(s)).length;
    if (SPEECH_REQUIRED.has(documentType)) {
      speechScore = (preserved / speeches.length) * 15;
      if (preserved < speeches.length) {
        warnings.push('아이의 실제 발화가 원문 그대로 보존되지 않았습니다.');
        suggestions.push('관찰일지·보육일지에는 아이의 말을 따옴표로 그대로 인용하세요.');
      }
    } else {
      // 부모/상담/발달 문서: 인용은 선택이지만, 인용한 발화는 원문과 일치해야 함
      const faithful = outputQuotes.filter((q) => speeches.includes(q)).length;
      speechScore = outputQuotes.length === 0 ? 13 : (faithful / outputQuotes.length) * 15;
      if (outputQuotes.length > 0 && faithful < outputQuotes.length) {
        warnings.push('인용한 발화가 원문과 다릅니다.');
      }
    }
  }

  // (b) 부정 사실 일관성 — 8
  // 관찰일지는 부정 사실을 그대로 남겨야 하고, 해석형 문서(평가·상담·발달)는
  // 어려움을 부드럽게 인정하기만 해도 사실을 왜곡하지 않은 것으로 본다.
  const inputNeg = includesAny(input, NEGATIVE_FACT_MARKERS);
  const outputNeg = includesAny(text, NEGATIVE_FACT_MARKERS);
  const softAck = /(어려|속상|불안|낯설|시간이 필요|조절이 필요|기다|걸리|눈물|좌절|부딪|머뭇|지원이 필요)/.test(text);
  const spins = countMatches(text, POSITIVE_SPIN_MARKERS);
  const isObservation = documentType === 'observation';
  let factScore = 8;
  if (inputNeg) {
    if (!outputNeg && spins > 0) {
      factScore = 0;
      warnings.push('부정·거부 사실을 근거 없는 긍정 표현으로 미화했습니다.');
      suggestions.push('아이가 거부하거나 어려워한 사실은 그대로 두고, 교사 지원만 따뜻하게 덧붙이세요.');
    } else if (outputNeg && spins === 0) {
      factScore = 8;
    } else if (outputNeg && spins > 0) {
      factScore = 4;
    } else if (!isObservation && softAck) {
      factScore = 8; // 해석형 문서가 어려움을 부드럽게 인정함
    } else {
      factScore = isObservation ? 3 : 5; // 사실 누락
      if (isObservation) suggestions.push('관찰일지에는 아이가 어려워하거나 거부한 사실을 그대로 남기세요.');
    }
  } else if (spins > 0 && isObservation) {
    factScore = 6; // 근거 없는 긍정 스핀 가벼운 감점
  }

  // (c) 내용 명사 보존 — 7 (관찰일지는 엄격, 해석형 문서는 요지 보존이면 충분)
  const nouns = contentNouns(input);
  let nounScore = 7;
  if (nouns.length > 0) {
    const matched = nouns.filter((n) => text.includes(n) || text.includes(n.slice(0, 2))).length;
    const ratio = matched / nouns.length;
    nounScore = (isObservation ? ratio : 0.45 + 0.55 * ratio) * 7;
    if (ratio < 0.4) {
      suggestions.push('입력에 등장한 구체적 소재(놀잇감·활동·또래)를 문장에 더 반영하세요.');
    }
  }

  return clamp(Math.round(speechScore + factScore + nounScore), 0, 30);
}

// ── 2) 문장 자연스러움 (20) ───────────────────────────────────────
const ARTIFACT_PATTERNS = [/또래 상호작용:/, /건강·안전 관련 기록:/, /\s이후\s\S+\s관련/, / {2,}/];
function scoreNaturalness(text, warnings, suggestions) {
  let score = 20;
  const value = String(text || '');
  const sentences = splitSentences(value);

  ARTIFACT_PATTERNS.forEach((re) => {
    if (re.test(value)) {
      score -= 4;
      warnings.push('메모·템플릿 흔적(라벨/중복 공백)이 남아 있습니다.');
    }
  });

  if (sentences.length > 0) {
    const wellFormed = sentences.filter((s) => /(다|요|음|까|네|시오|세요|습니다|에요|예요)[.!?]?$/.test(s) || /[.!?]$/.test(s)).length;
    const ratio = wellFormed / sentences.length;
    score -= Math.round((1 - ratio) * 8);
    if (ratio < 1) suggestions.push('문장이 끝맺음 어미로 자연스럽게 마무리되도록 다듬으세요.');
    const tooLong = sentences.filter((s) => s.replace(/\s/g, '').length > 110).length;
    score -= tooLong * 2;
  }

  const compact = value.replace(/\s+/g, '').length;
  if (compact < 25) {
    score -= 6;
    suggestions.push('문장이 너무 짧습니다. 상황·행동·교사 지원을 한 문장 더 보태세요.');
  }
  return clamp(Math.round(score), 0, 20);
}

// ── 3) 문서 목적 적합성 (20) ──────────────────────────────────────
const CUE_WORDS = {
  observation: ['보였다', '하였다', '관찰', '시도', '표현'],
  dailyReport: ['경험', '지원', '필요', '성장', '격려'],
  counseling: ['가정', '함께', '지원', '권유', '상담', '도움'],
  development: ['발달', '영역', '수준', '양상', '관심', '능력'],
  notice: ['오늘', '가정', '함께', '주세요', '드립니다', '보여'],
};
function scoreDocumentFit(text, documentType, warnings, suggestions) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  const wantsWarm = documentType === 'notice';
  const warmEnd = (s) => /(요|습니다|에요|예요|드립니다|주세요)[.!?]?$/.test(s);
  const formalEnd = (s) => /(다|이다)[.!?]?$/.test(s) && !warmEnd(s);

  const matched = sentences.filter((s) => (wantsWarm ? warmEnd(s) : formalEnd(s))).length;
  let voice = (matched / sentences.length) * 14;
  if (matched < sentences.length) {
    if (wantsWarm) suggestions.push('알림장은 “~했어요/~습니다” 같은 부모 친화 존댓말로 써 주세요.');
    else if (FORMAL_TYPES.has(documentType)) suggestions.push('관찰·보육·발달 문서는 “~하였다/~보였다” 문어체로 통일하세요.');
  }

  const cues = CUE_WORDS[documentType] || [];
  const cueHits = countMatches(text, cues);
  const cueBonus = clamp(cueHits * 2, 0, 6);
  if (cueBonus < 2 && (documentType === 'dailyReport' || documentType === 'development')) {
    warnings.push('평가/발달 문서에 어울리는 표현(경험·지원·발달·영역)이 부족합니다.');
  }
  return clamp(Math.round(voice + cueBonus), 0, 20);
}

// ── 4) 부정 표현 순화/안전성 (15) ─────────────────────────────────
const DIAGNOSIS_RE = /(ADHD|자폐|장애|지능|아이큐|IQ)/;
function scoreSafety(text, warnings, suggestions) {
  let score = 15;
  const labels = countMatches(text, SUBJECTIVE_LABELS);
  const overstatements = countMatches(text, ABSOLUTE_OVERSTATEMENTS);
  const praise = countMatches(text, SUBJECTIVE_PRAISE);
  if (labels > 0) {
    score -= labels * 5;
    warnings.push('주관적 라벨(문제행동·산만 등)이 포함되어 있습니다.');
    suggestions.push('라벨 대신 관찰한 행동을 그대로 묘사하세요.');
  }
  if (overstatements > 0) {
    score -= overstatements * 3;
    warnings.push('근거 없는 과장 절대어(항상·완벽하게 등)가 포함되어 있습니다.');
  }
  if (praise > 0) score -= praise * 2;
  if (DIAGNOSIS_RE.test(text)) {
    score -= 8;
    warnings.push('진단성 표현이 포함되어 있습니다.');
  }
  return clamp(Math.round(score), 0, 15);
}

// ── 5) 반복 표현 방지 (10) ────────────────────────────────────────
function scoreRepetition(text, warnings, suggestions) {
  let score = 10;
  const tokens = tokenize(text);
  let adjacentDups = 0;
  for (let i = 1; i < tokens.length; i += 1) {
    if (tokens[i] === tokens[i - 1] && tokens[i].length >= 2) adjacentDups += 1;
  }
  if (adjacentDups > 0) {
    score -= adjacentDups * 3;
    warnings.push('같은 표현이 반복되었습니다.');
    suggestions.push('반복된 단어를 다른 표현으로 바꾸거나 한 번만 쓰세요.');
  }
  // 문장 종결 동사 단조로움
  const endings = splitSentences(text)
    .map((s) => (s.match(/([가-힣]{2,4})[.!?]?$/) || [])[1])
    .filter(Boolean);
  const endingCounts = endings.reduce((m, e) => ({ ...m, [e]: (m[e] || 0) + 1 }), {});
  const maxRepeat = Math.max(0, ...Object.values(endingCounts));
  if (maxRepeat >= 3) {
    score -= 2;
    suggestions.push('문장 끝맺음이 단조롭습니다. 종결 표현에 변화를 주세요.');
  }
  return clamp(Math.round(score), 0, 10);
}

// ── 6) 발달영역/교사 지원 적합성 (5) ──────────────────────────────
const SUPPORT_AGENT_RE = /(교사|기관|가정)/;
const SUPPORT_ACTION_RE = /(지원|안내|제안|도와|도움|격려|중재|기다|읽어|토닥|권유|지지|함께|알려|마련|확보|제공|이어지도록|이어질 수 있도록|할 수 있도록)/;
// 보육과정 영역·경험과 연결되는 핵심어 (관찰·평가·전달 문장에 두루 쓰임)
const CURRICULUM_KEYWORDS = /(놀이|탐구|표현|상호작용|조절|관찰|활동|약속|경험|감정|습관|안전|도전|협력|배려|자립|질문|규칙|균형|관심|수|색|역할)/;
function scoreCurriculumFit(text) {
  let score = 0;
  if (includesAny(text, CURRICULUM_AREAS) || CURRICULUM_KEYWORDS.test(text)) score += 3;
  if (detectsTeacherSupport(text)) score += 2;
  return clamp(score, 0, 5);
}

// 교사 지원 문장 감지 (유연한 표현 포함). 테스트·진단용으로 공개한다.
export function detectsTeacherSupport(text) {
  const value = String(text || '');
  return SUPPORT_AGENT_RE.test(value) && SUPPORT_ACTION_RE.test(value);
}

// ── 메인 ──────────────────────────────────────────────────────────
export function scoreText(text, { input = '', sourceText = '', documentType = 'observation' } = {}) {
  const source = String(input || sourceText || '');
  const out = String(text || '');
  const warnings = [];
  const suggestions = [];

  const detail = {
    factPreservation: scoreFactPreservation(out, source, documentType, warnings, suggestions),
    naturalness: scoreNaturalness(out, warnings, suggestions),
    documentFit: scoreDocumentFit(out, documentType, warnings, suggestions),
    safety: scoreSafety(out, warnings, suggestions),
    repetition: scoreRepetition(out, warnings, suggestions),
    curriculumFit: scoreCurriculumFit(out),
  };

  const totalScore = Object.values(detail).reduce((a, b) => a + b, 0);

  return {
    totalScore,
    detail,
    warnings: [...new Set(warnings)],
    suggestions: [...new Set(suggestions)],
  };
}

// 점수가 낮은 항목을 만점 대비로 정렬해 돌려준다(회귀 로그용).
export const DIMENSION_MAX = {
  factPreservation: 30,
  naturalness: 20,
  documentFit: 20,
  safety: 15,
  repetition: 10,
  curriculumFit: 5,
};

export function explainDeductions(result) {
  return Object.entries(result.detail)
    .map(([key, value]) => ({ dimension: key, lost: DIMENSION_MAX[key] - value, score: value, max: DIMENSION_MAX[key] }))
    .filter((d) => d.lost > 0)
    .sort((a, b) => b.lost - a.lost);
}

export default scoreText;
