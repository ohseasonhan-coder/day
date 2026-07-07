import { getChildren, getClasses, getRecords, genId, today } from './storage';
import { isMaster } from './auth';

export const RICH_DOCUMENTS_SUFFIX = 'rich_documents';
export const RICH_TEMPLATES_KEY = 'sw_shared_rich_doc_templates';

export const FIELD_DEFINITIONS = [
  { key: 'childName', label: '원아명', description: '선택한 기록의 원아 이름입니다.', type: 'auto', sensitive: true },
  { key: 'childAge', label: '연령', description: '현재 반 또는 원아 정보의 연령입니다.', type: 'auto', sensitive: false },
  { key: 'className', label: '반명', description: '현재 반 이름입니다.', type: 'auto', sensitive: false },
  { key: 'teacherName', label: '교사명', description: '현재 로그인한 교사 이름입니다.', type: 'auto', sensitive: true },
  { key: 'recordDate', label: '기록일', description: '선택한 기록의 작성일입니다.', type: 'auto', sensitive: false },
  { key: 'weather', label: '날씨', description: '문서 작성자가 직접 입력하는 날씨입니다.', type: 'manual', sensitive: false },
  { key: 'observation', label: '관찰내용', description: '기존 B4/규칙 엔진이 만든 관찰내용입니다.', type: 'b4', sensitive: true },
  { key: 'learningReading', label: '배움 읽기', description: '기존 B4 결과의 배움 읽기 영역입니다.', type: 'b4', sensitive: true },
  { key: 'supportAndNextPlan', label: '교사 지원 및 다음 계획', description: '기존 B4 결과의 지원 계획 영역입니다.', type: 'b4', sensitive: true },
  { key: 'dailyRoutine', label: '하루 일과', description: '하루 일과 또는 운영 흐름입니다.', type: 'manual', sensitive: true },
  { key: 'playEvaluation', label: '놀이 평가', description: '놀이 흐름과 평가 내용입니다.', type: 'manual', sensitive: true },
  { key: 'parentNotice', label: '부모 알림장', description: '부모에게 전달할 알림장 문장입니다.', type: 'manual', sensitive: true },
  { key: 'teacherMemo', label: '교사 메모', description: '교사가 직접 남기는 메모입니다.', type: 'manual', sensitive: true },
  { key: 'parentRequest', label: '부모 요청사항', description: '부모 요청이나 전달사항입니다.', type: 'manual', sensitive: true },
  { key: 'consultContent', label: '상담 내용', description: '부모 상담 기록 내용입니다.', type: 'manual', sensitive: true },
  { key: 'checklist', label: '체크리스트', description: '문서에 넣을 점검 항목입니다.', type: 'manual', sensitive: false },
];

export const FIELD_KEYS = FIELD_DEFINITIONS.map((field) => field.key);
export const FIELD_MAP = FIELD_DEFINITIONS.reduce((acc, field) => ({ ...acc, [field.key]: field }), {});

const clone = (value) => JSON.parse(JSON.stringify(value));

function currentUid() {
  try {
    const session = JSON.parse(localStorage.getItem('sw_session') || 'null');
    return session?.userId || 'default';
  } catch {
    return 'default';
  }
}

export function getRichDocumentsKey(userId = currentUid()) {
  return `sw_${userId}_${RICH_DOCUMENTS_SUFFIX}`;
}

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const emptyTiptapDoc = () => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

const textNode = (text) => ({ type: 'text', text });
const paragraph = (...content) => ({ type: 'paragraph', content: content.filter(Boolean) });
const heading = (level, text) => ({ type: 'heading', attrs: { level }, content: [textNode(text)] });
const fieldChip = (fieldKey) => ({ type: 'fieldChip', attrs: { fieldKey } });
const tableCell = (...content) => ({ type: 'tableCell', content: content.length ? content : [paragraph()] });
const tableRow = (...cells) => ({ type: 'tableRow', content: cells });
const table = (...rows) => ({ type: 'table', content: rows });

function templateContent(kind) {
  if (kind === 'consult') {
    return {
      type: 'doc',
      content: [
        heading(1, '부모 상담 기록'),
        table(
          tableRow(tableCell(paragraph(textNode('원아명'))), tableCell(paragraph(fieldChip('childName')))),
          tableRow(tableCell(paragraph(textNode('반명'))), tableCell(paragraph(fieldChip('className')))),
          tableRow(tableCell(paragraph(textNode('상담일'))), tableCell(paragraph(fieldChip('recordDate')))),
        ),
        heading(2, '상담 내용'),
        paragraph(fieldChip('consultContent')),
        heading(2, '가정 연계'),
        paragraph(fieldChip('parentRequest')),
        heading(2, '교사 메모'),
        paragraph(fieldChip('teacherMemo')),
      ],
    };
  }
  if (kind === 'meeting') {
    return {
      type: 'doc',
      content: [
        heading(1, '교사 회의록'),
        table(
          tableRow(tableCell(paragraph(textNode('일자'))), tableCell(paragraph(fieldChip('recordDate')))),
          tableRow(tableCell(paragraph(textNode('작성자'))), tableCell(paragraph(fieldChip('teacherName')))),
        ),
        heading(2, '회의 내용'),
        paragraph(textNode('논의한 내용을 입력하세요.')),
        heading(2, '체크리스트'),
        paragraph(fieldChip('checklist')),
        heading(2, '후속 메모'),
        paragraph(fieldChip('teacherMemo')),
      ],
    };
  }
  return {
    type: 'doc',
    content: [
      heading(1, '관찰일지'),
      table(
        tableRow(tableCell(paragraph(textNode('원아명'))), tableCell(paragraph(fieldChip('childName')))),
        tableRow(tableCell(paragraph(textNode('반명'))), tableCell(paragraph(fieldChip('className')))),
        tableRow(tableCell(paragraph(textNode('기록일'))), tableCell(paragraph(fieldChip('recordDate')))),
      ),
      heading(2, '관찰내용'),
      paragraph(fieldChip('observation')),
      heading(2, '배움 읽기'),
      paragraph(fieldChip('learningReading')),
      heading(2, '교사 지원 및 다음 계획'),
      paragraph(fieldChip('supportAndNextPlan')),
    ],
  };
}

export const BUILTIN_RICH_TEMPLATES = [
  {
    templateId: 'builtin_observation',
    title: '관찰일지',
    description: '관찰내용, 배움 읽기, 교사 지원 계획 필드가 들어간 기본 서식',
    type: 'template',
    published: true,
    system: true,
    createdBy: 'system',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: templateContent('observation'),
  },
  {
    templateId: 'builtin_consult',
    title: '부모 상담 기록',
    description: '상담 내용과 가정 연계 내용을 정리하는 기본 서식',
    type: 'template',
    published: true,
    system: true,
    createdBy: 'system',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: templateContent('consult'),
  },
  {
    templateId: 'builtin_meeting',
    title: '교사 회의록',
    description: '회의 내용과 후속 메모를 작성하는 기본 서식',
    type: 'template',
    published: true,
    system: true,
    createdBy: 'system',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: templateContent('meeting'),
  },
];

export function getRichDocuments(userId = currentUid()) {
  return readJson(getRichDocumentsKey(userId), []).sort((a, b) =>
    new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

export function getRichDocument(id, userId = currentUid()) {
  return getRichDocuments(userId).find((doc) => doc.id === id) || null;
}

export function getCustomRichTemplates() {
  return readJson(RICH_TEMPLATES_KEY, []);
}

function writeCustomRichTemplates(list) {
  writeJson(RICH_TEMPLATES_KEY, list);
}

export function listRichTemplates(user, { includePrivate = false } = {}) {
  const custom = getCustomRichTemplates().filter((tpl) => !tpl.archived);
  const visible = isMaster(user) && includePrivate
    ? custom
    : custom.filter((tpl) => tpl.published);
  return [...BUILTIN_RICH_TEMPLATES.map(clone), ...visible.map(clone)];
}

export function createBlankRichDocument({ title = '새 문서', user } = {}) {
  const now = new Date().toISOString();
  return {
    id: genId(),
    type: 'document',
    title,
    content: emptyTiptapDoc(),
    ownerId: user?.userId || currentUid(),
    createdAt: now,
    updatedAt: now,
    sourceTemplateId: null,
  };
}

export function createDocumentFromTemplate(templateId, user) {
  const template = listRichTemplates(user, { includePrivate: isMaster(user) })
    .find((tpl) => tpl.templateId === templateId);
  if (!template) return { ok: false, error: '서식을 찾을 수 없습니다.' };
  const doc = createBlankRichDocument({ title: `${template.title} 문서`, user });
  doc.content = clone(template.content);
  doc.sourceTemplateId = template.templateId;
  doc.sourceTemplateTitle = template.title;
  return { ok: true, document: doc, template: clone(template) };
}

function walkNode(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  (node.content || []).forEach((child) => walkNode(child, visit));
}

export function collectFieldKeys(content) {
  const keys = [];
  walkNode(content, (node) => {
    if (node.type === 'fieldChip') keys.push(node.attrs?.fieldKey || '');
  });
  return keys;
}

export function validateRichDocumentContent(content) {
  const errors = [];
  if (!content || content.type !== 'doc') errors.push('문서 JSON 구조가 올바르지 않습니다.');
  const unknown = collectFieldKeys(content).filter((key) => !FIELD_MAP[key]);
  if (unknown.length) errors.push(`지원하지 않는 자동 필드: ${[...new Set(unknown)].join(', ')}`);
  return { ok: errors.length === 0, errors };
}

export function extractPlainTextFromContent(content, { includeFieldLabels = true } = {}) {
  const parts = [];
  walkNode(content, (node) => {
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (includeFieldLabels && node.type === 'fieldChip') {
      const field = FIELD_MAP[node.attrs?.fieldKey];
      parts.push(field ? `[${field.label}]` : `[${node.attrs?.fieldKey || '알 수 없는 필드'}]`);
    }
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function privacyFragments(extraFragments = []) {
  const names = getChildren().map((child) => child.name).filter((name) => String(name || '').trim().length >= 2);
  const recordTexts = getRecords().flatMap((record) => [
    record.rawText, record.observation, record.evaluation, record.parent, record.support,
    record.teacherMemo, record.parentRequest,
  ]).filter((text) => String(text || '').trim().length >= 8);
  return [...names, ...recordTexts, ...extraFragments]
    .map((value) => String(value || '').trim())
    .filter((value) => value.length >= 2);
}

export function validateTemplatePrivacy(content, { extraFragments = [] } = {}) {
  const text = extractPlainTextFromContent(content, { includeFieldLabels: false });
  const matched = privacyFragments(extraFragments).find((fragment) => fragment && text.includes(fragment));
  if (matched) return { ok: false, error: '서식에는 실제 원아 이름, 관찰 기록, 생성 문장 전문을 저장할 수 없습니다.' };
  return { ok: true };
}

export function saveRichDocument(document, user) {
  const validation = validateRichDocumentContent(document?.content);
  if (!validation.ok) return { ok: false, error: validation.errors.join(' / ') };
  const userId = user?.userId || currentUid();
  const now = new Date().toISOString();
  const list = getRichDocuments(userId);
  const item = {
    ...document,
    id: document.id || genId(),
    type: 'document',
    ownerId: userId,
    title: String(document.title || '제목 없는 문서').trim() || '제목 없는 문서',
    createdAt: document.createdAt || now,
    updatedAt: now,
  };
  const next = [item, ...list.filter((doc) => doc.id !== item.id)];
  writeJson(getRichDocumentsKey(userId), next);
  return { ok: true, document: item };
}

export function deleteRichDocument(id, user) {
  const userId = user?.userId || currentUid();
  writeJson(getRichDocumentsKey(userId), getRichDocuments(userId).filter((doc) => doc.id !== id));
  return { ok: true };
}

export function duplicateRichDocument(id, user) {
  const source = getRichDocument(id, user?.userId || currentUid());
  if (!source) return { ok: false, error: '문서를 찾을 수 없습니다.' };
  const copy = {
    ...clone(source),
    id: genId(),
    title: `${source.title} 복제본`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return saveRichDocument(copy, user);
}

export function renameRichDocument(id, title, user) {
  const doc = getRichDocument(id, user?.userId || currentUid());
  if (!doc) return { ok: false, error: '문서를 찾을 수 없습니다.' };
  return saveRichDocument({ ...doc, title }, user);
}

export function saveRichTemplateFromDocument(document, user, { published = false, extraFragments = [] } = {}) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 문서 서식을 저장할 수 있습니다.' };
  const validation = validateRichDocumentContent(document?.content);
  if (!validation.ok) return { ok: false, error: validation.errors.join(' / ') };
  const privacy = validateTemplatePrivacy(document.content, { extraFragments });
  if (!privacy.ok) return privacy;
  const now = new Date().toISOString();
  const template = {
    templateId: `rich_tpl_${genId()}`,
    type: 'template',
    title: String(document.title || '새 문서 서식').trim(),
    description: '문서 작성실에서 저장한 서식',
    content: clone(document.content),
    createdBy: user.userId,
    createdAt: now,
    updatedAt: now,
    published: !!published,
    archived: false,
    version: 1,
  };
  writeCustomRichTemplates([template, ...getCustomRichTemplates()]);
  return { ok: true, template };
}

export function deleteRichTemplate(templateId, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 문서 서식을 삭제할 수 있습니다.' };
  const list = getCustomRichTemplates();
  const target = list.find((tpl) => tpl.templateId === templateId);
  if (!target) return { ok: false, error: '서식을 찾을 수 없습니다.' };
  writeCustomRichTemplates(list.map((tpl) => tpl.templateId === templateId ? { ...tpl, archived: true, updatedAt: new Date().toISOString() } : tpl));
  return { ok: true };
}

export function setRichTemplatePublished(templateId, published, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 공개 상태를 변경할 수 있습니다.' };
  const list = getCustomRichTemplates();
  const target = list.find((tpl) => tpl.templateId === templateId);
  if (!target) return { ok: false, error: '서식을 찾을 수 없습니다.' };
  writeCustomRichTemplates(list.map((tpl) => tpl.templateId === templateId ? { ...tpl, published: !!published, updatedAt: new Date().toISOString() } : tpl));
  return { ok: true };
}

export function getDefaultFieldValues({ currentUser, recordId, manualValues = {} } = {}) {
  const records = getRecords();
  const record = recordId ? records.find((item) => item.id === recordId) : records[0];
  const child = getChildren().find((item) => item.id === record?.childId || item.name === record?.childName);
  const klass = getClasses()[0] || {};
  return {
    childName: child?.name || record?.childName || '',
    childAge: child?.age || klass.age || '',
    className: klass.name || '',
    teacherName: currentUser?.displayName || '',
    recordDate: record?.date || today(),
    weather: manualValues.weather || '',
    observation: record?.observation || record?.rawText || '',
    learningReading: record?.evaluation || '',
    supportAndNextPlan: record?.support || '',
    dailyRoutine: manualValues.dailyRoutine || '',
    playEvaluation: manualValues.playEvaluation || '',
    parentNotice: record?.parent || manualValues.parentNotice || '',
    teacherMemo: manualValues.teacherMemo || '',
    parentRequest: manualValues.parentRequest || '',
    consultContent: manualValues.consultContent || '',
    checklist: manualValues.checklist || '',
  };
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function attrsToStyle(attrs = {}) {
  const styles = [];
  if (attrs.textAlign) styles.push(`text-align:${attrs.textAlign}`);
  if (attrs.indent) styles.push(`margin-left:${Number(attrs.indent) * 24}px`);
  if (attrs.lineHeight) styles.push(`line-height:${escapeHtml(attrs.lineHeight)}`);
  if (attrs.color) styles.push(`color:${escapeHtml(attrs.color)}`);
  if (attrs.backgroundColor) styles.push(`background-color:${escapeHtml(attrs.backgroundColor)}`);
  if (attrs.fontSize) styles.push(`font-size:${escapeHtml(attrs.fontSize)}`);
  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function renderTextNode(node) {
  let html = escapeHtml(node.text || '');
  (node.marks || []).forEach((mark) => {
    if (mark.type === 'bold') html = `<strong>${html}</strong>`;
    if (mark.type === 'italic') html = `<em>${html}</em>`;
    if (mark.type === 'underline') html = `<u>${html}</u>`;
    if (mark.type === 'strike') html = `<s>${html}</s>`;
    if (mark.type === 'textStyle') html = `<span${attrsToStyle(mark.attrs)}>${html}</span>`;
    if (mark.type === 'highlight') html = `<mark${attrsToStyle({ backgroundColor: mark.attrs?.color || '#fff3bf' })}>${html}</mark>`;
  });
  return html;
}

export function renderRichDocumentHtml(content, fieldValues = {}) {
  const renderChildren = (node) => (node.content || []).map(renderNode).join('');
  const renderNode = (node) => {
    if (!node) return '';
    if (node.type === 'text') return renderTextNode(node);
    if (node.type === 'hardBreak') return '<br />';
    if (node.type === 'fieldChip') {
      const key = node.attrs?.fieldKey;
      const field = FIELD_MAP[key];
      const value = fieldValues[key];
      return `<span class="field-chip-rendered" data-field="${escapeHtml(key)}">${escapeHtml(value || `[${field?.label || key}]`)}</span>`;
    }
    if (node.type === 'paragraph') return `<p${attrsToStyle(node.attrs)}>${renderChildren(node) || '<br />'}</p>`;
    if (node.type === 'heading') {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level || 1)));
      return `<h${level}${attrsToStyle(node.attrs)}>${renderChildren(node)}</h${level}>`;
    }
    if (node.type === 'bulletList') return `<ul>${renderChildren(node)}</ul>`;
    if (node.type === 'orderedList') return `<ol>${renderChildren(node)}</ol>`;
    if (node.type === 'listItem' || node.type === 'taskItem') return `<li>${renderChildren(node)}</li>`;
    if (node.type === 'taskList') return `<ul class="task-list">${renderChildren(node)}</ul>`;
    if (node.type === 'blockquote') return `<blockquote>${renderChildren(node)}</blockquote>`;
    if (node.type === 'horizontalRule') return '<hr />';
    if (node.type === 'pageBreak') return '<div class="document-page-break"></div>';
    if (node.type === 'table') return `<table>${renderChildren(node)}</table>`;
    if (node.type === 'tableRow') return `<tr>${renderChildren(node)}</tr>`;
    if (node.type === 'tableHeader') return `<th>${renderChildren(node)}</th>`;
    if (node.type === 'tableCell') return `<td>${renderChildren(node)}</td>`;
    if (node.type === 'doc') return renderChildren(node);
    return renderChildren(node);
  };
  return renderNode(content);
}
