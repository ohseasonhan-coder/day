// 관리자 커스텀 필드 — 기존 16개 고정 필드(documentStudio.js FIELD_DEFINITIONS) 외에,
// 관리자가 직접 이름(라벨)과 값을 정의해서 문서·공개 페이지에 자동으로 채워 넣을 수 있게 한다.
// 기기 공용(sw_shared_custom_fields) — 값 자체를 관리자가 정하므로 원아 개인정보를 담을 이유가 없다.
import { isMaster } from './auth';
import { genId } from './storage';

export const CUSTOM_FIELDS_KEY = 'sw_shared_custom_fields';

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_FIELDS_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeAll(list) {
  localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(list));
}

const slugify = (label) => {
  const base = String(label || '').trim()
    .replace(/[^a-zA-Z0-9가-힣]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `custom_${base || genId().replace(/[^a-zA-Z0-9]/g, '')}`;
};

export function getCustomFields() {
  return readAll();
}
export function getCustomField(key) {
  return readAll().find((f) => f.key === key) || null;
}
export function getCustomFieldValue(key) {
  return getCustomField(key)?.value || '';
}

// 저장(신규/수정) — 관리자만. key는 라벨에서 자동 생성하고 충돌 시 번호를 붙인다.
export function saveCustomField(field, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 필드를 만들 수 있어요.' };
  const label = String(field?.label || '').trim();
  if (!label) return { ok: false, error: '필드 이름을 입력해 주세요.' };

  const list = readAll();
  const now = new Date().toISOString();
  const idx = list.findIndex((f) => f.id === field.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], label, value: field.value ?? list[idx].value ?? '', updatedAt: now };
    writeAll(list);
    return { ok: true, field: list[idx] };
  }

  const existingKeys = new Set(list.map((f) => f.key));
  let key = slugify(label);
  let n = 2;
  while (existingKeys.has(key)) { key = `${slugify(label)}_${n}`; n += 1; }
  const item = { id: genId(), key, label, value: field?.value || '', createdAt: now, updatedAt: now };
  writeAll([item, ...list]);
  return { ok: true, field: item };
}

export function deleteCustomField(id, user) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 삭제할 수 있어요.' };
  const list = readAll();
  if (!list.some((f) => f.id === id)) return { ok: false, error: '필드를 찾을 수 없어요.' };
  writeAll(list.filter((f) => f.id !== id));
  return { ok: true };
}

export default getCustomFields;
