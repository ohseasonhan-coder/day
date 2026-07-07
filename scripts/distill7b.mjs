// 7B → 내장 표현 풀 증류(개발용, 오프라인 1회 실행) — 사용자 기기에서는 실행되지 않는다.
// 로컬 Ollama(qwen2.5:7b-instruct)에 신호 유형별 "배움 읽기 문장 템플릿" 후보를 요청하고,
// 결과를 data/golden_local/(gitignore)에 저장한다. 이후 사람이 검수해 규칙 엔진에 내장한다.
// 사용: node scripts/distill7b.mjs
import fs from 'fs';

const URL = 'http://localhost:11434/v1/chat/completions';
const MODEL = 'qwen2.5:7b-instruct';

// 신호별 의미 설명 + 대표 상황(입력 예시는 문맥 힌트일 뿐, 템플릿은 일반형이어야 함)
const SIGNALS = [
  ['persist', '뜻대로 되지 않아도 다시 시도하는 끈기', '블록 탑이 무너지자 다시 쌓았다'],
  ['express', '자신의 생각과 느낌을 말과 행동으로 표현', '"이건 우리 엄마예요"라고 말하며 그림을 가리켰다'],
  ['explore', '주변을 자세히 살피고 궁금한 점을 탐색', '돋보기로 개미 행렬을 들여다보았다'],
  ['selfhelp', '일과에 필요한 일을 스스로 해 보려는 자립', '낮잠 이불을 스스로 덮었다'],
  ['make', '재료를 자기 방식으로 다루어 만들고 표현', '색종이를 접어 비행기를 만들었다'],
  ['craft', '색과 재료를 살피며 자신만의 방식으로 구성', '한지를 찢어 붙이며 콜라주를 했다'],
  ['share', '친구와 마음을 나누며 함께하는 방법을 찾음(또래 단어 포함 가능)', '크레파스를 친구에게 빌려주었다'],
  ['challenge', '낯설거나 어려운 활동 앞에서 자신의 속도로 시도', '처음 하는 활동을 망설이다 시도했다'],
  ['recover', '흔들린 마음을 다독이고 안정을 찾아감', '엄마를 찾다가 곧 놀이에 집중했다'],
  ['move', '몸을 움직이며 균형과 힘을 조절', '평균대 위에서 팔을 벌려 걸었다'],
];

const SYSTEM = [
  '너는 한국 유아 관찰일지의 "배움 읽기" 문장 템플릿을 만드는 작가다.',
  '템플릿 규칙:',
  '- 반드시 "{이름}" 자리표시자로 시작한다. 예: "{이름} 스스로 방법을 찾아가는 모습을 보였다."',
  '- 특정 재료·특정 행동·발화를 언급하지 않는다(어떤 관찰에도 맞아야 함). 신호의 의미만 담는다.',
  '- 진단·평가·낙인·과장 금지. "유아들은/활용하여/놀이에 참여하였다/발달 경험과 연결" 금지.',
  '- "~했습니다/~것입니다/~기회를 얻었다" 문체 금지. "~보였다/~갔다/~하였다"의 관찰 문체로.',
  '- 각 템플릿은 25~50자, 한 문장, 마침표로 끝난다.',
  '- 또래 신호가 아니면 친구/또래/함께/서로 단어 금지.',
  'JSON 배열만 출력: ["템플릿1","템플릿2","템플릿3","템플릿4"]',
].join('\n');

async function ask(signal, meaning, situation, allowPeer) {
  const user = [
    `신호 유형: ${signal}`,
    `의미: ${meaning}`,
    `상황 예시(참고만, 언급 금지): ${situation}`,
    allowPeer ? '이 신호는 또래 신호이므로 친구/또래 단어 사용 가능.' : '친구/또래/함께/서로 단어 금지.',
    '서로 다른 어휘의 배움 읽기 템플릿 4개를 JSON 배열로만 출력.',
  ].join('\n');
  const res = await fetch(URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 300, stream: false,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`http-${res.status}`);
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content || '';
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return { signal, error: 'no-json', raw: raw.slice(0, 200) };
  try { return { signal, templates: JSON.parse(m[0]) }; }
  catch { return { signal, error: 'parse', raw: raw.slice(0, 200) }; }
}

const out = { model: MODEL, generatedAt: new Date().toISOString(), note: '증류 후보 — 사람이 검수해 내장(gitignore)', results: [] };
for (const [signal, meaning, situation] of SIGNALS) {
  const t0 = Date.now();
  try {
    const r = await ask(signal, meaning, situation, signal === 'share');
    r.sec = Math.round((Date.now() - t0) / 1000);
    out.results.push(r);
    console.log(`[${signal}] ${r.sec}s ${r.templates ? r.templates.length + '개' : 'ERR ' + r.error}`);
  } catch (e) {
    out.results.push({ signal, error: String(e.message) });
    console.log(`[${signal}] ERROR ${e.message}`);
  }
}
fs.mkdirSync('data/golden_local', { recursive: true });
fs.writeFileSync('data/golden_local/distilled_templates.local.json', JSON.stringify(out, null, 1), 'utf-8');
console.log('저장: data/golden_local/distilled_templates.local.json');
