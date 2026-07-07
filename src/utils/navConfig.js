// MVP 메뉴 구성 (테스트 가능하도록 UI에서 분리).
// 핵심(core): 첫 사용자에게 우선 노출. 고급(more): '더보기'로 이동 — 삭제하지 않고 노출만 정리.
// desc: 각 기능 한줄 설명("이럴 때 써요"). level: 간단 모드에서 'basic'만 노출, 'advanced'는 접어둠.
export const NAV_ITEMS = [
  // 핵심 — 모바일 하단 탭(설정은 상단 기어)
  { id: 'record',   label: '오늘기록', group: 'core', level: 'basic', desc: '오늘 본 원아 모습을 짧게 적어 문장으로' },
  { id: 'aiwrite',  label: 'AI작성',   group: 'core', level: 'basic', desc: '메모로 관찰일지·알림장 문장 자동 생성' },
  { id: 'docs',     label: '문서함',   group: 'core', level: 'basic', desc: '만든 보육일지·평가·상담자료 모아보기' },
  { id: 'children', label: '원아기록', group: 'core', level: 'basic', desc: '원아 명단 등록·수정, 아이별 기록' },
  { id: 'settings', label: '설정',     group: 'core', level: 'basic', desc: '백업·동기화·계정·환경 설정' },
  // 고급 — '더보기' 영역(삭제하지 않음)
  { id: 'note',       label: '알림장',     group: 'more', level: 'basic',    desc: '오늘 기록으로 아이별 알림장 한 번에' },
  { id: 'docstudio',  label: '문서 작성실', group: 'more', level: 'basic',    desc: '빈 문서와 서식을 열어 직접 작성·편집' },
  { id: 'automation', label: '자동화',     group: 'more', level: 'basic',    desc: '하루·한 달 문서를 한 번에 자동 생성' },
  { id: 'check',      label: '점검',       group: 'more', level: 'basic',    desc: '누락 기록·영역 균형 점검(평가제 대비)' },
  { id: 'today',      label: '오늘 홈',    group: 'more', level: 'advanced', desc: '오늘 현황 요약 홈으로 이동' },
  { id: 'internal',   label: '원내문서',   group: 'more', level: 'advanced', desc: '교육일지·회의록 등 원내 문서' },
  { id: 'consult',    label: '상담 관리',  group: 'more', level: 'advanced', desc: '부모 상담 일정·자료 관리' },
  { id: 'checklist',  label: '발달 체크',  group: 'more', level: 'advanced', desc: '발달 체크리스트·포트폴리오 연동' },
  { id: 'stats',      label: '통계',       group: 'more', level: 'advanced', desc: '기록 현황·통계 보기' },
  { id: 'newsletter', label: '가정통신문', group: 'more', level: 'advanced', desc: '가정통신문 자동 작성' },
  { id: 'medicine',   label: '투약',       group: 'more', level: 'advanced', desc: '투약 의뢰 기록·보고서' },
  { id: 'accident',   label: '사고기록',   group: 'more', level: 'advanced', desc: '사고·상해 기록·보고서' },
];

export const CORE_MENU = NAV_ITEMS.filter((i) => i.group === 'core');
export const MORE_MENU_ITEMS = NAV_ITEMS.filter((i) => i.group === 'more');
// 모바일 하단 탭에 띄울 핵심 페이지(설정은 기어로 접근하므로 제외)
export const MOBILE_PRIMARY = CORE_MENU.filter((i) => i.id !== 'settings');
