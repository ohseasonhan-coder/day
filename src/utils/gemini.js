import { getApiKey } from './storage';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function callGemini(systemPrompt, userPrompt, maxTokens = 1500) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');

  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 (${response.status})`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJSON(text) {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export async function processRecord({ childName, rawText, classAge }) {
  const system = `당신은 어린이집 교사의 관찰 기록을 분석하고 전문 문서로 변환하는 AI 보조 시스템입니다.
교사의 짧은 관찰 메모를 받아 자동으로 분류하고, 관찰일지, 부모상담용, 지원계획을 생성합니다.

원칙:
- 아동을 진단하지 않고, 관찰된 사실과 지원 방향만 기술합니다
- 부정적 표현은 중립적·긍정적 관찰 표현으로 순화합니다
- 교사의 전문성이 드러나는 문체를 사용합니다
- 반드시 JSON만 응답합니다 (마크다운 코드블록 없이)`;

  const user = `아동명: ${childName}
연령: ${classAge || '미상'}세반
원본 기록: "${rawText}"

다음 JSON 형식으로만 응답해주세요:
{
  "category": "peer|habit|comm|play|nature|art|body|special 중 하나",
  "devAreas": ["발달영역 배열 (신체운동·건강, 의사소통, 사회관계, 예술경험, 자연탐구, 기본생활습관 중)"],
  "tags": ["세부 태그 3~5개"],
  "softened": "부정 표현을 순화한 원본 기록 (순화 불필요시 원본 그대로)",
  "observation": "관찰일지용 객관적 기록 (2~3문장, ${childName}이/가 로 시작)",
  "parent": "부모상담용 부드러운 문장 (2~3문장, 따뜻하고 긍정적 톤)",
  "support": "교사 지원계획 (1~2문장, 구체적 방향)",
  "title": "이 기록의 핵심을 요약한 짧은 제목 (10자 이내)"
}`;

  const raw = await callGemini(system, user, 1000);
  const parsed = parseJSON(raw);
  if (!parsed) throw new Error('AI 응답 파싱에 실패했습니다. 다시 시도해주세요.');
  return parsed;
}

export async function generateDailyJournal({ records, date, classAge, className }) {
  const recordText = records.map((r, i) =>
    `[${i + 1}] ${r.childName}: ${r.observation || r.rawText}`
  ).join('\n');

  const system = `당신은 어린이집 보육일지 작성을 돕는 AI입니다.
오늘의 아동 관찰 기록들을 종합하여 보육일지 초안을 작성합니다.
실제 어린이집에서 사용할 수 있는 전문적이고 자연스러운 문체로 작성합니다.
반드시 JSON만 응답합니다.`;

  const user = `날짜: ${date}
반: ${className || ''} (${classAge || ''}세반)

오늘의 관찰 기록:
${recordText}

다음 JSON 형식으로 보육일지 초안을 작성해주세요:
{
  "playFlow": "놀이 흐름 및 주요 활동 (3~4문장)",
  "childResponse": "유아 반응 및 특이사항 (2~3문장)",
  "teacherSupport": "교사 지원 내용 (2~3문장)",
  "evaluation": "오늘 보육 평가 (2~3문장)",
  "nextPlan": "내일/다음 지원 계획 (1~2문장)"
}`;

  const raw = await callGemini(system, user, 1200);
  const parsed = parseJSON(raw);
  if (!parsed) throw new Error('보육일지 생성에 실패했습니다.');
  return parsed;
}

export async function generateGrowthSummary({ childName, records, period, childAge }) {
  const recordText = records.slice(0, 30).map(r =>
    `[${formatRecordDate(r.date)}] ${r.category} - ${r.observation || r.rawText}`
  ).join('\n');

  const system = `당신은 어린이집 아동 성장 요약을 작성하는 AI입니다.
기간별 관찰 기록을 바탕으로 아동의 성장과 발달을 요약합니다.
반드시 JSON만 응답합니다.`;

  const user = `아동명: ${childName}
연령: ${childAge || ''}세
기간: ${period}
기록 수: ${records.length}건

관찰 기록:
${recordText}

다음 JSON으로 성장 요약을 작성해주세요:
{
  "overall": "전체 성장 요약 (3~4문장, 따뜻하고 전문적으로)",
  "strengths": "잘 성장하고 있는 부분 (2~3문장)",
  "support": "지원이 필요한 부분 (2~3문장, 부드럽게)",
  "parentMessage": "부모상담용 전달 문장 (3~4문장, 상담 시 바로 사용 가능하게)",
  "nextSteps": "향후 지원 방향 (1~2문장)"
}`;

  const raw = await callGemini(system, user, 1200);
  const parsed = parseJSON(raw);
  if (!parsed) throw new Error('성장 요약 생성에 실패했습니다.');
  return parsed;
}

export async function generateConsultDoc({ childName, records, childAge }) {
  const recordText = records.slice(0, 20).map(r =>
    `[${r.category}] ${r.observation || r.rawText}`
  ).join('\n');

  const system = `어린이집 교사가 학부모 상담 시 사용할 상담자료를 작성합니다. 반드시 JSON만 응답합니다.`;

  const user = `아동명: ${childName}, 연령: ${childAge || ''}세
기록: ${recordText}

{
  "recentGrowth": "최근 성장 흐름 (2~3문장)",
  "strengths": "강점 (2~3가지, 문장으로)",
  "supportNeeded": "지원이 필요한 부분 (1~2가지, 부드럽게)",
  "homeLinks": "가정 연계 제안 (2~3가지)",
  "teacherSupport": "교사가 원에서 지원 중인 내용 (1~2문장)",
  "openingMessage": "상담 시작 시 사용할 부드러운 인사말 (2문장)"
}`;

  const raw = await callGemini(system, user, 1000);
  const parsed = parseJSON(raw);
  if (!parsed) throw new Error('상담자료 생성에 실패했습니다.');
  return parsed;
}

function formatRecordDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '.');
}
