import fs from 'fs';
import path from 'path';
import { CORE_MENU, MORE_MENU_ITEMS, MOBILE_PRIMARY, NAV_ITEMS } from './navConfig';

const ids = (list) => list.map((i) => i.id);

describe('MVP 메뉴 단순화', () => {
  test('핵심 메뉴가 우선 노출된다(오늘기록/AI작성/문서함/아이기록/설정)', () => {
    expect(ids(CORE_MENU).sort()).toEqual(['aiwrite', 'children', 'docs', 'record', 'settings'].sort());
  });

  test('모바일 하단 탭은 설정을 제외한 핵심 4개다(설정은 기어/더보기로 접근)', () => {
    expect(ids(MOBILE_PRIMARY)).toEqual(['record', 'aiwrite', 'docs', 'children']);
  });

  test('고급 기능은 삭제되지 않고 더보기 영역에 남아 있다', () => {
    const more = ids(MORE_MENU_ITEMS);
    ['internal', 'consult', 'checklist', 'check', 'stats', 'newsletter', 'medicine', 'accident'].forEach((id) => {
      expect(more).toContain(id);
    });
  });

  test('관리자/검수 메뉴(엔진 비교·리포트)는 일반 메뉴에 노출되지 않는다', () => {
    const all = ids(NAV_ITEMS);
    ['engineCompare', 'engineReview', 'review', 'compare', 'fallback'].forEach((id) => {
      expect(all).not.toContain(id);
    });
  });
});

describe('설정 화면 개인정보 안내', () => {
  test('SettingsPage에 개인정보 저장 안내 문구가 있다', () => {
    const file = path.join(__dirname, '..', 'pages', 'SettingsPage.js');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('개인정보 저장 안내');
    expect(src).toContain('이 기기에 저장');
    expect(src).toContain('외부 서버로 전송되지 않습니다');
  });
});
