// ── 사용자별 스토리지 키 분리 ──────────────────────────────────────────────────
// 로그인한 사용자의 userId를 prefix로 사용 → 멀티 계정 지원
// auth.js import를 피하기 위해 직접 localStorage에서 읽음
function _getUid() {
  try {
    const s = localStorage.getItem('sw_session');
    return s ? (JSON.parse(s)?.userId || 'default') : 'default';
  } catch { return 'default'; }
}

// getter 프로퍼티로 선언 → 호출 시점의 userId를 반영
const KEYS = {
  get CLASSES()    { return `sw_${_getUid()}_classes`; },
  get CHILDREN()   { return `sw_${_getUid()}_children`; },
  get RECORDS()    { return `sw_${_getUid()}_records`; },
  get DOCUMENTS()  { return `sw_${_getUid()}_documents`; },
  get SETTINGS()   { return `sw_${_getUid()}_settings`; },
  get TEMPLATES()  { return `sw_${_getUid()}_templates`; },
  get DRAFT()      { return `sw_${_getUid()}_draft`; },
};

// Generic storage helpers
export const storage = {
  get: (key) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove: (key) => {
    try { localStorage.removeItem(key); } catch {}
  },
};

// Domain-specific getters/setters
export const getClasses = () => storage.get(KEYS.CLASSES) || [];
export const saveClasses = (v) => storage.set(KEYS.CLASSES, v);

export const getChildren = () => storage.get(KEYS.CHILDREN) || [];
export const saveChildren = (v) => storage.set(KEYS.CHILDREN, v);

export const getRecords = () => storage.get(KEYS.RECORDS) || [];
export const saveRecords = (v) => storage.set(KEYS.RECORDS, v);

export const getDocuments = () => storage.get(KEYS.DOCUMENTS) || [];
export const saveDocuments = (v) => storage.set(KEYS.DOCUMENTS, v);

export const getSettings = () => storage.get(KEYS.SETTINGS) || {
  nameStyle: 'name',       // 'name' | 'alias' | 'blank' | 'common'
  softening: true,
  autoCategory: true,
  saveParentVersion: true,
  saveSupportPlan: true,
  tone: 'warm',            // 'warm' | 'professional' | 'formal'
};
export const saveSettings = (v) => storage.set(KEYS.SETTINGS, v);

// ID generator
export const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Date helpers
export const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
export const formatDateKo = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

// Category metadata
export const CATEGORIES = {
  peer: { label: '또래관계', color: 'var(--cat-peer)', bg: 'var(--cat-peer-light)', emoji: '🤝' },
  habit: { label: '생활습관', color: 'var(--cat-habit)', bg: 'var(--cat-habit-light)', emoji: '🌱' },
  comm: { label: '의사소통', color: 'var(--cat-comm)', bg: 'var(--cat-comm-light)', emoji: '💬' },
  play: { label: '놀이·활동', color: 'var(--cat-play)', bg: 'var(--cat-play-light)', emoji: '🎮' },
  nature: { label: '자연탐구', color: 'var(--cat-nature)', bg: 'var(--cat-nature-light)', emoji: '🌿' },
  art: { label: '예술경험', color: 'var(--cat-art)', bg: 'var(--cat-art-light)', emoji: '🎨' },
  body: { label: '신체운동', color: 'var(--cat-body)', bg: 'var(--cat-body-light)', emoji: '🏃' },
  special: { label: '특이사항', color: 'var(--cat-special)', bg: 'var(--cat-special-light)', emoji: '📋' },
};

export const DEV_AREAS = [
  '신체운동·건강',
  '의사소통',
  '사회관계',
  '예술경험',
  '자연탐구',
  '기본생활습관',
];

// Records helpers
export const getRecordsByChild = (childId) =>
  getRecords().filter(r => r.childId === childId);

export const getRecordsByDate = (date) =>
  getRecords().filter(r => r.date === date);

export const addRecord = (record) => {
  const records = getRecords();
  const newRecord = { ...record, id: genId(), createdAt: new Date().toISOString() };
  saveRecords([newRecord, ...records]);
  return newRecord;
};

export const updateRecord = (id, updates) => {
  const records = getRecords();
  saveRecords(records.map(r => r.id === id ? { ...r, ...updates } : r));
};

export const deleteRecord = (id) => {
  saveRecords(getRecords().filter(r => r.id !== id));
};

// ── 기록 임시저장 (자동저장) ──────────────────────────────────────────────────
export const getDraft     = () => storage.get(KEYS.DRAFT);
export const saveDraft    = (draft) => storage.set(KEYS.DRAFT, { ...draft, savedAt: new Date().toISOString() });
export const clearDraft   = () => storage.remove(KEYS.DRAFT);

// ── 문서 이력 조회 (최근 20개) ────────────────────────────────────────────────
export const getDocumentHistory = () => (storage.get(KEYS.DOCUMENTS) || []).slice(0, 20);

// Star / bookmark a record
export const toggleStarRecord = (id) => {
  const records = getRecords();
  saveRecords(records.map(r => r.id === id ? { ...r, starred: !r.starred } : r));
};

// Update a child's info (name, birthdate, notes, etc.)
export const updateChild = (id, updates) => {
  const children = getChildren();
  saveChildren(children.map(c => c.id === id ? { ...c, ...updates } : c));
};

export const deleteChild = (id) => {
  saveChildren(getChildren().filter(c => c.id !== id));
};

// Custom quick templates
export const getCustomTemplates = () => storage.get(KEYS.TEMPLATES) || [];
export const saveCustomTemplates = (v) => storage.set(KEYS.TEMPLATES, v);
export const addCustomTemplate = (tpl) => {
  const list = getCustomTemplates();
  const newTpl = { ...tpl, id: genId(), custom: true };
  saveCustomTemplates([...list, newTpl]);
  return newTpl;
};
export const deleteCustomTemplate = (id) => {
  saveCustomTemplates(getCustomTemplates().filter(t => t.id !== id));
};

export const addDocumentDraft = (document) => {
  const documents = getDocuments();
  const newDocument = {
    ...document,
    id: genId(),
    status: document.status || 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveDocuments([newDocument, ...documents]);
  return newDocument;
};

export const updateDocumentDraft = (id, updates) => {
  const documents = getDocuments();
  saveDocuments(documents.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d));
};

export const deleteDocumentDraft = (id) => {
  saveDocuments(getDocuments().filter(d => d.id !== id));
};

// ── 백업 / 복구 ──────────────────────────────────────────────────────────────
export function exportBackup() {
  const uid = _getUid();
  const payload = {
    version: 2,
    appName: '쌤워크',
    userId: uid,
    exportedAt: new Date().toISOString(),
    classes: getClasses(),
    children: getChildren(),
    records: getRecords(),
    documents: getDocuments(),
    settings: getSettings(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const dateStr = today().replace(/-/g, '');
  a.href     = url;
  a.download = `saemwork_backup_${uid}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 복구: 파일 내용(string) → 현재 사용자의 데이터에 덮어씀
// 반환값: { ok: true, summary } | { ok: false, error: string }
export function importBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.appName)
      return { ok: false, error: '쌤워크 백업 파일이 아니에요.' };

    if (data.classes)   saveClasses(data.classes);
    if (data.children)  saveChildren(data.children);
    if (data.records)   saveRecords(data.records);
    if (data.documents) saveDocuments(data.documents);
    if (data.settings)  saveSettings(data.settings);

    return {
      ok: true,
      summary: {
        children:  (data.children  || []).length,
        records:   (data.records   || []).length,
        documents: (data.documents || []).length,
        exportedAt: data.exportedAt,
      },
    };
  } catch (e) {
    return { ok: false, error: `파일 형식이 올바르지 않아요. (${e.message})` };
  }
}
