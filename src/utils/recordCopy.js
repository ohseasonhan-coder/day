// 기록 결과 복사/예시 입력용 순수 헬퍼 (UI에서 분리해 테스트 가능하게 둔다).

// 전체 복사 대상 섹션(라벨, result 필드 키) — 표시 순서대로.
export const RECORD_COPY_SECTIONS = [
  ['관찰일지 문장', 'observation'],
  ['보육일지 평가', 'evaluation'],
  ['알림장', 'parent'],
  ['교사 지원계획', 'support'],
];

// 결과를 [라벨]\n내용 형식으로 묶는다(빈 섹션은 제외).
export function buildCombinedCopy(result) {
  if (!result) return '';
  return RECORD_COPY_SECTIONS
    .map(([label, key]) => [label, result[key]])
    .filter(([, text]) => text && String(text).trim())
    .map(([label, text]) => `[${label}]\n${String(text).trim()}`)
    .join('\n\n');
}

// 입력창에 예시 문장을 자연스럽게 덧붙인다(기존 입력이 있으면 줄바꿈 후 추가).
export function appendExample(current, text) {
  const cur = String(current || '');
  if (!text) return cur;
  if (!cur.trim()) return String(text);
  return cur.endsWith('\n') ? `${cur}${text}` : `${cur}\n${text}`;
}

// 빠른 예시 문장(누르면 입력창에 추가).
export const QUICK_EXAMPLES = [
  '친구와 놀이했어요',
  '교사 지원 후 참여했어요',
  '감정을 표현했어요',
  '안전교육에 참여했어요',
  '정리정돈을 했어요',
  '미술놀이를 했어요',
];
