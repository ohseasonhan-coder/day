// MVP 메뉴 구성 (테스트 가능하도록 UI에서 분리).
// 핵심(core): 첫 사용자에게 우선 노출. 고급(more): '더보기'로 이동 — 삭제하지 않고 노출만 정리.
export const NAV_ITEMS = [
  // 핵심 — 모바일 하단 탭(설정은 상단 기어)
  { id: 'record',   label: '오늘기록', group: 'core' },
  { id: 'aiwrite',  label: 'AI작성',   group: 'core' },
  { id: 'docs',     label: '문서함',   group: 'core' },
  { id: 'children', label: '원아기록', group: 'core' },
  { id: 'settings', label: '설정',     group: 'core' },
  // 고급 — '더보기' 영역(삭제하지 않음)
  { id: 'today',      label: '오늘',       group: 'more' },
  { id: 'internal',   label: '원내문서',   group: 'more' },
  { id: 'consult',    label: '상담 관리',  group: 'more' },
  { id: 'checklist',  label: '발달 체크',  group: 'more' },
  { id: 'check',      label: '점검',       group: 'more' },
  { id: 'stats',      label: '통계',       group: 'more' },
  { id: 'newsletter', label: '가정통신문', group: 'more' },
  { id: 'note',       label: '알림장',     group: 'more' },
  { id: 'medicine',   label: '투약',       group: 'more' },
  { id: 'accident',   label: '사고기록',   group: 'more' },
  { id: 'automation', label: '자동화',     group: 'more' },
];

export const CORE_MENU = NAV_ITEMS.filter((i) => i.group === 'core');
export const MORE_MENU_ITEMS = NAV_ITEMS.filter((i) => i.group === 'more');
// 모바일 하단 탭에 띄울 핵심 페이지(설정은 기어로 접근하므로 제외)
export const MOBILE_PRIMARY = CORE_MENU.filter((i) => i.id !== 'settings');
