// 공개 페이지(관리자가 만드는 정적 안내 페이지) — documentStudio.js의 리치 에디터 엔진(Tiptap JSON,
// RichDocumentEditor, renderRichDocumentHtml)을 그대로 재사용하되, 원아 기록과 무관한 완전히 별도
// 개념이라 저장소는 분리한다. 이 앱은 백엔드가 없으므로 "공개"는 이 기기(브라우저)에 로그인한
// 사람 기준이며, 실제 인터넷에 공개되는 페이지는 아니다.
//
//  Page: sw_shared_site_pages(기기 공용) — { id, title, slug, content(Tiptap JSON), published,
//        order, createdAt, updatedAt }. 필드 칩(fieldChip)을 쓰지 않는 순수 정적 콘텐츠 전제.
import { isMaster } from './auth';
import { genId } from './storage';
import { emptyTiptapDoc, validateRichDocumentContent, validateTemplatePrivacy } from './documentStudio';

export const SITE_PAGES_KEY = 'sw_shared_site_pages';

const clone = (value) => JSON.parse(JSON.stringify(value));

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SITE_PAGES_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeAll(list) {
  localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(list));
}

const slugify = (title) => String(title || '')
  .trim().toLowerCase()
  .replace(/[^a-z0-9가-힣\s-]/g, '')
  .replace(/\s+/g, '-')
  .slice(0, 40) || `page-${Date.now().toString(36)}`;

// 관리자 화면(전체) — 보관되지 않은 페이지 전부(비공개 포함)
export function getSitePages() {
  return readAll().filter((p) => !p.archived).map(clone);
}
// 교사 화면 — 공개된 페이지만
export function listPublishedSitePages() {
  return getSitePages().filter((p) => p.published);
}
export function getSitePage(id) {
  return getSitePages().find((p) => p.id === id) || null;
}

export function createBlankSitePage({ title = '새 페이지' } = {}) {
  const now = new Date().toISOString();
  return {
    id: genId(), title, slug: slugify(title), content: emptyTiptapDoc(),
    published: false, archived: false, order: 0, createdAt: now, updatedAt: now,
  };
}

// 저장(신규/수정) — 관리자만. 필드 칩·개인정보(실제 원아 이름·기록 원문) 포함 시 저장 거부.
export function saveSitePage(page, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 페이지를 만들 수 있어요.' };
  const contentCheck = validateRichDocumentContent(page?.content);
  if (!contentCheck.ok) return { ok: false, error: contentCheck.errors.join(' / ') };
  const privacyCheck = validateTemplatePrivacy(page?.content);
  if (!privacyCheck.ok) return privacyCheck;
  if (!String(page?.title || '').trim()) return { ok: false, error: '제목을 입력해 주세요.' };

  const list = readAll();
  const now = new Date().toISOString();
  const title = String(page.title).trim();
  const idx = list.findIndex((p) => p.id === page.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...page, title, slug: list[idx].slug || slugify(title), updatedAt: now };
    writeAll(list);
    return { ok: true, page: list[idx] };
  }
  const item = { ...createBlankSitePage({ title }), ...page, title, updatedAt: now };
  writeAll([item, ...list]);
  return { ok: true, page: item };
}

export function setSitePagePublished(id, published, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 공개 상태를 바꿀 수 있어요.' };
  const list = readAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: '페이지를 찾을 수 없어요.' };
  list[idx] = { ...list[idx], published: !!published, updatedAt: new Date().toISOString() };
  writeAll(list);
  return { ok: true, page: list[idx] };
}

// 삭제 대신 보관(archived) — 기존 문서 서식 관례와 동일
export function deleteSitePage(id, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 삭제할 수 있어요.' };
  const list = readAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: '페이지를 찾을 수 없어요.' };
  list[idx] = { ...list[idx], archived: true, published: false, updatedAt: new Date().toISOString() };
  writeAll(list);
  return { ok: true };
}

export default getSitePages;
