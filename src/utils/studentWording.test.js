import fs from 'fs';
import path from 'path';

// 관리 기능을 뜻하는 화면 문구는 "원아"로 통일한다.
// (부모 전달 생성 문장·"아이별" 같은 자연스러운 표현은 허용 — 아래 검사 대상에서 제외)
const PAGES_DIR = path.join(__dirname, '..', 'pages');

// 사용자 화면에 남으면 안 되는 관리/선택 문구
const FORBIDDEN = [
  '아이 관리', '아이관리', '아이 목록',
  '전체 아이', '아이 추가하기', '아이 이름으로 검색',
  '등록된 아이가 없',
];

describe('원아 용어 통일', () => {
  test('페이지 소스에 "아이관리"류 관리 문구가 남아 있지 않다', () => {
    const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.js'));
    const hits = [];
    files.forEach((f) => {
      const src = fs.readFileSync(path.join(PAGES_DIR, f), 'utf8');
      FORBIDDEN.forEach((tok) => { if (src.includes(tok)) hits.push(`${f}: "${tok}"`); });
    });
    expect(hits).toEqual([]);
  });

  test('"원아 관리" 문구가 표시된다 (설정 메뉴 + 원아 관리 화면)', () => {
    const settings = fs.readFileSync(path.join(PAGES_DIR, 'SettingsPage.js'), 'utf8');
    const children = fs.readFileSync(path.join(PAGES_DIR, 'ChildrenPage.js'), 'utf8');
    expect(settings).toContain('원아 관리');
    expect(children).toContain('원아 관리');
  });

  test('선택/빈 상태 라벨이 "원아"로 통일된다', () => {
    const children = fs.readFileSync(path.join(PAGES_DIR, 'ChildrenPage.js'), 'utf8');
    expect(children).toContain('등록된 원아가 없어요');
    expect(children).toContain('원아 추가하기');
    expect(children).toContain('원아 이름으로 검색');
  });
});
