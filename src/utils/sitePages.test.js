// 사이트 관리(공개 페이지 + 문구/디자인) 회귀 — 권한, 공개 필터링, 소프트 삭제, 개인정보 가드,
// storage.js의 getSiteContent/setSiteContent 기본값 폴백.
import {
  getSitePages, listPublishedSitePages, createBlankSitePage, saveSitePage,
  setSitePagePublished, deleteSitePage,
} from './sitePages';
import { getSiteContent, setSiteContent, saveChildren } from './storage';

const MASTER = { userId: 'master', role: 'master', displayName: '관리자' };
const TEACHER = { userId: 'teacher1', displayName: '김교사' };

const text = (value) => ({ type: 'text', text: value });
const paragraph = (...content) => ({ type: 'paragraph', content });
const chip = (fieldKey) => ({ type: 'fieldChip', attrs: { fieldKey } });
const staticDoc = () => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('원 소개')] },
    paragraph(text('저희 어린이집은 2020년에 문을 열었습니다.')),
  ],
});

beforeEach(() => {
  localStorage.clear();
});

describe('공개 페이지 — 권한', () => {
  test('일반 사용자는 페이지를 만들 수 없다', () => {
    const page = createBlankSitePage({ title: '공지사항' });
    const res = saveSitePage({ ...page, content: staticDoc() }, TEACHER);
    expect(res.ok).toBe(false);
    expect(getSitePages()).toHaveLength(0);
  });

  test('관리자는 필드 칩 없는 순수 정적 페이지를 저장할 수 있다', () => {
    const page = createBlankSitePage({ title: '이용 안내' });
    const res = saveSitePage({ ...page, content: staticDoc() }, MASTER);
    expect(res.ok).toBe(true);
    expect(getSitePages().map((p) => p.title)).toContain('이용 안내');
  });
});

describe('공개 페이지 — 검수(문서 서식과 동일 가드 재사용)', () => {
  test('필드 칩에 정의되지 않은 키가 있으면 거부된다', () => {
    const page = createBlankSitePage({ title: '잘못된 페이지' });
    const bad = { ...page, content: { type: 'doc', content: [paragraph(chip('doesNotExist'))] } };
    expect(saveSitePage(bad, MASTER).ok).toBe(false);
  });

  test('실제 원아 이름이 포함된 내용은 저장이 거부된다(개인정보 가드)', () => {
    saveChildren([{ id: 'c1', name: '하준찬', age: '4' }]);
    const page = createBlankSitePage({ title: '위험한 페이지' });
    const bad = { ...page, content: { type: 'doc', content: [paragraph(text('오늘 하준찬이가 놀이터에서 놀았어요.'))] } };
    expect(saveSitePage(bad, MASTER).ok).toBe(false);
  });
});

describe('공개 페이지 — 공개 필터링·소프트 삭제', () => {
  test('공개로 전환하기 전에는 목록에 보이지만 공개 목록에는 없다', () => {
    const page = createBlankSitePage({ title: '비공개 초안' });
    const saved = saveSitePage({ ...page, content: staticDoc() }, MASTER);
    expect(getSitePages().some((p) => p.id === saved.page.id)).toBe(true);
    expect(listPublishedSitePages().some((p) => p.id === saved.page.id)).toBe(false);

    setSitePagePublished(saved.page.id, true, MASTER);
    expect(listPublishedSitePages().some((p) => p.id === saved.page.id)).toBe(true);
  });

  test('삭제는 보관 처리이며(소프트 삭제) 목록·공개 목록 모두에서 사라진다', () => {
    const page = createBlankSitePage({ title: '삭제될 페이지' });
    const saved = saveSitePage({ ...page, content: staticDoc() }, MASTER);
    setSitePagePublished(saved.page.id, true, MASTER);
    deleteSitePage(saved.page.id, MASTER);
    expect(getSitePages().some((p) => p.id === saved.page.id)).toBe(false);
    expect(listPublishedSitePages().some((p) => p.id === saved.page.id)).toBe(false);
  });

  test('일반 사용자는 공개 전환·삭제를 할 수 없다', () => {
    const page = createBlankSitePage({ title: '보호되는 페이지' });
    const saved = saveSitePage({ ...page, content: staticDoc() }, MASTER);
    expect(setSitePagePublished(saved.page.id, true, TEACHER).ok).toBe(false);
    expect(deleteSitePage(saved.page.id, TEACHER).ok).toBe(false);
    expect(getSitePages().some((p) => p.id === saved.page.id)).toBe(true);
  });
});

describe('화면 문구·디자인(storage.js getSiteContent/setSiteContent)', () => {
  test('아무것도 설정하지 않으면 빈 객체를 반환한다(기존 하드코딩 문구가 기본값으로 쓰임)', () => {
    expect(getSiteContent()).toEqual({});
  });

  test('저장한 값은 병합되어 유지되고, 다른 키는 건드리지 않는다', () => {
    setSiteContent({ loginHeadline: '우리원 기록장' });
    setSiteContent({ primaryColor: '#FF6B6B' });
    expect(getSiteContent()).toEqual({ loginHeadline: '우리원 기록장', primaryColor: '#FF6B6B' });
  });
});
