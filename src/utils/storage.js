// Storage keys
const KEYS = {
  CLASSES: 'sw_classes',
  CHILDREN: 'sw_children',
  RECORDS: 'sw_records',
  SETTINGS: 'sw_settings',
  API_KEY: 'sw_api_key',
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

export const getSettings = () => storage.get(KEYS.SETTINGS) || {
  nameStyle: 'name',       // 'name' | 'alias' | 'blank' | 'common'
  softening: true,
  autoCategory: true,
  saveParentVersion: true,
  saveSupportPlan: true,
  tone: 'warm',            // 'warm' | 'professional' | 'formal'
};
export const saveSettings = (v) => storage.set(KEYS.SETTINGS, v);

export const getApiKey = () => storage.get(KEYS.API_KEY) || '';
export const saveApiKey = (v) => storage.set(KEYS.API_KEY, v);

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
