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
  get DRAFT()           { return `sw_${_getUid()}_draft`; },
  get FORM_TEMPLATES()  { return `sw_${_getUid()}_form_templates`; },
  get ROUTINES()        { return `sw_${_getUid()}_routines`; },
  get MEDICINES()       { return `sw_${_getUid()}_medicines`; },
  get ACCIDENTS()       { return `sw_${_getUid()}_accidents`; },
  get NEWSLETTERS()     { return `sw_${_getUid()}_newsletters`; },
  get ACTIVE_CLASS()    { return `sw_${_getUid()}_active_class`; },
  get EVENTS()          { return `sw_${_getUid()}_events`; },
  get ONBOARDING_DONE() { return `sw_${_getUid()}_onboarding_done`; },
  get DOC_TEMPLATES()   { return `sw_${_getUid()}_doc_templates`; },
  get CONSULTS()        { return `sw_${_getUid()}_consults`; },
  get BACKUP_HISTORY()  { return `sw_${_getUid()}_backup_history`; },
  get AUTOMATION_STATE(){ return `sw_${_getUid()}_automation_state`; },
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

// Automation helpers
const DOCUMENT_TARGETS = {
  observation: '관찰일지',
  parentConsult: '부모상담자료',
  supportPlan: '지원계획',
  dailyJournal: '보육일지',
  playReview: '주간/월간 놀이평가',
  development: '발달평가',
  checklist: '평가제 점검',
};

const toArray = (value) => Array.isArray(value) ? value : [];

const daysAgo = (dateStr) => {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return Infinity;
  return (new Date() - date) / 86400000;
};

const countBy = (list, selector) =>
  list.reduce((acc, item) => {
    const key = selector(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const unique = (values) => [...new Set(values.filter(Boolean))];

const getRecordTargets = (record) => {
  const targets = new Set(['observation', 'dailyJournal', 'checklist']);
  if (record.parent) targets.add('parentConsult');
  if (record.support) targets.add('supportPlan');
  if (toArray(record.devAreas).length > 0) targets.add('development');
  if (['play', 'peer', 'nature', 'art', 'body'].includes(record.category)) targets.add('playReview');
  if (record.recordType === 'consult') targets.add('parentConsult');
  return [...targets];
};

const makeRecordAutomationMeta = (record) => {
  const appliedTargets = getRecordTargets(record);
  return {
    appliedAt: new Date().toISOString(),
    appliedTargets,
    appliedLabels: appliedTargets.map(target => DOCUMENT_TARGETS[target] || target),
    documentReady: !!record.observation && !!record.parent && !!record.support,
    needsReview: toArray(record.documentMeta?.reviewFlags).length > 0,
  };
};

const makeDocumentQueue = (records) => {
  const todayStr = today();
  const todayRecords = records.filter(r => r.date === todayStr);
  const weekRecords = records.filter(r => daysAgo(r.date) <= 7);
  const monthRecords = records.filter(r => daysAgo(r.date) <= 30);
  const consultRecords = monthRecords.filter(r => r.parent || r.recordType === 'consult');
  const developmentRecords = records.filter(r => toArray(r.devAreas).length > 0);

  return {
    daily: {
      ready: todayRecords.length > 0,
      count: todayRecords.length,
      recordIds: todayRecords.map(r => r.id),
      label: todayRecords.length ? `오늘 기록 ${todayRecords.length}건이 보육일지에 반영됩니다.` : '오늘 보육일지에 반영할 기록이 아직 없습니다.',
    },
    weekly: {
      ready: weekRecords.length > 0,
      count: weekRecords.length,
      recordIds: weekRecords.map(r => r.id),
      label: weekRecords.length ? `최근 7일 기록 ${weekRecords.length}건이 주간평가에 반영됩니다.` : '주간평가에 반영할 최근 기록이 없습니다.',
    },
    monthly: {
      ready: monthRecords.length > 0,
      count: monthRecords.length,
      recordIds: monthRecords.map(r => r.id),
      label: monthRecords.length ? `최근 30일 기록 ${monthRecords.length}건이 월간평가에 반영됩니다.` : '월간평가에 반영할 최근 기록이 없습니다.',
    },
    parent: {
      ready: consultRecords.length > 0,
      count: consultRecords.length,
      recordIds: consultRecords.map(r => r.id),
      label: consultRecords.length ? `상담자료용 문장 ${consultRecords.length}건이 누적되었습니다.` : '부모상담자료로 쓸 기록이 아직 없습니다.',
    },
    development: {
      ready: developmentRecords.length > 0,
      count: developmentRecords.length,
      recordIds: developmentRecords.map(r => r.id),
      label: developmentRecords.length ? `발달영역 기록 ${developmentRecords.length}건이 발달평가에 반영됩니다.` : '발달평가에 반영할 발달영역 기록이 없습니다.',
    },
  };
};

const makeChildAutomation = (children, records) =>
  children.reduce((acc, child) => {
    const childRecords = records
      .filter(r => r.childId === child.id)
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
    const recent30 = childRecords.filter(r => daysAgo(r.date) <= 30);
    const devAreas = recent30.flatMap(r => toArray(r.devAreas));

    acc[child.id] = {
      childId: child.id,
      childName: child.name,
      totalRecords: childRecords.length,
      recent30Count: recent30.length,
      lastRecordDate: childRecords[0]?.date || null,
      recentRecordIds: recent30.slice(0, 20).map(r => r.id),
      categoryCounts: countBy(recent30, r => r.category),
      devAreaCounts: countBy(devAreas, area => area),
      consultReadyCount: recent30.filter(r => r.parent || r.recordType === 'consult').length,
      supportPlanCount: recent30.filter(r => r.support).length,
      needsRecord: recent30.length < 3,
    };
    return acc;
  }, {});

const makeChecklist = (children, records) => {
  const todayStr = today();
  const recent30 = records.filter(r => daysAgo(r.date) <= 30);
  const todayChildIds = new Set(records.filter(r => r.date === todayStr).map(r => r.childId));
  const categoryCounts = countBy(recent30, r => r.category);
  const childStats = makeChildAutomation(children, records);

  return {
    todayMissingChildIds: children.filter(child => !todayChildIds.has(child.id)).map(child => child.id),
    lowRecordChildIds: Object.values(childStats).filter(stat => stat.recent30Count > 0 && stat.recent30Count < 3).map(stat => stat.childId),
    noRecentRecordChildIds: Object.values(childStats).filter(stat => stat.recent30Count === 0).map(stat => stat.childId),
    missingCategoryKeys: Object.keys(CATEGORIES).filter(key => !categoryCounts[key]),
    categoryCounts,
  };
};

const makeAutomationAudit = (records, children) => {
  const latest = records[0] || null;
  const todayRecords = records.filter(r => r.date === today());
  const weekRecords = records.filter(r => daysAgo(r.date) <= 7);
  const monthRecords = records.filter(r => daysAgo(r.date) <= 30);
  const parentRecords = monthRecords.filter(r => r.parent || r.recordType === 'consult');
  const supportRecords = monthRecords.filter(r => r.support);
  const developmentRecords = monthRecords.filter(r => toArray(r.devAreas).length > 0);
  const reviewRecords = records.filter(r => r.automation?.needsReview || toArray(r.documentMeta?.reviewFlags).length > 0);

  const items = [
    {
      key: 'recordProcessing',
      label: '기록 문장 정리',
      ready: !!latest?.observation,
      detail: latest?.observation ? '최근 기록이 관찰일지 문장으로 정리됐습니다.' : '기록 정리 결과가 아직 없습니다.',
    },
    {
      key: 'classification',
      label: '카테고리·발달영역 분류',
      ready: !!latest?.category || toArray(latest?.devAreas).length > 0,
      detail: latest?.category ? '대표 카테고리와 발달영역이 문서 분류에 연결됩니다.' : '분류할 기록이 필요합니다.',
    },
    {
      key: 'parentConsult',
      label: '부모상담자료 누적',
      ready: parentRecords.length > 0,
      detail: parentRecords.length ? `최근 30일 상담자료용 기록 ${parentRecords.length}건이 준비됐습니다.` : '부모상담용 문장이 있는 기록이 필요합니다.',
    },
    {
      key: 'supportPlan',
      label: '지원계획 누적',
      ready: supportRecords.length > 0,
      detail: supportRecords.length ? `지원계획 ${supportRecords.length}건이 누적됐습니다.` : '지원계획 문장이 있는 기록이 필요합니다.',
    },
    {
      key: 'dailyJournal',
      label: '오늘 보육일지',
      ready: todayRecords.length > 0,
      detail: todayRecords.length ? `오늘 기록 ${todayRecords.length}건으로 보육일지 초안을 만들 수 있습니다.` : '오늘 기록이 필요합니다.',
    },
    {
      key: 'weeklyReview',
      label: '주간 놀이평가',
      ready: weekRecords.length > 0,
      detail: weekRecords.length ? `최근 7일 기록 ${weekRecords.length}건으로 주간평가를 만들 수 있습니다.` : '최근 7일 기록이 필요합니다.',
    },
    {
      key: 'monthlyReview',
      label: '월간 놀이평가',
      ready: monthRecords.length > 0,
      detail: monthRecords.length ? `최근 30일 기록 ${monthRecords.length}건으로 월간평가를 만들 수 있습니다.` : '최근 30일 기록이 필요합니다.',
    },
    {
      key: 'development',
      label: '발달평가',
      ready: developmentRecords.length > 0,
      detail: developmentRecords.length ? `발달영역 기록 ${developmentRecords.length}건이 평가 근거로 연결됩니다.` : '발달영역이 분류된 기록이 필요합니다.',
    },
    {
      key: 'missingCheck',
      label: '누락·균형 점검',
      ready: children.length > 0,
      detail: children.length ? '아이별 기록 수와 카테고리 균형을 자동 점검합니다.' : '아이 명단 등록이 필요합니다.',
    },
    {
      key: 'reviewQueue',
      label: '확인 필요 기록',
      ready: reviewRecords.length === 0,
      detail: reviewRecords.length ? `문서화 전 확인이 필요한 기록 ${reviewRecords.length}건이 있습니다.` : '확인 필요한 기록이 없습니다.',
    },
  ];

  return {
    readyCount: items.filter(item => item.ready).length,
    totalCount: items.length,
    percent: Math.round((items.filter(item => item.ready).length / items.length) * 100),
    items,
    latestRecord: latest ? {
      id: latest.id,
      childId: latest.childId,
      childName: latest.childName,
      date: latest.date,
      appliedTargets: latest.automation?.appliedTargets || getRecordTargets(latest),
      appliedLabels: latest.automation?.appliedLabels || getRecordTargets(latest).map(target => DOCUMENT_TARGETS[target] || target),
    } : null,
  };
};

export function rebuildAutomationState(records = getRecords(), children = getChildren(), classes = getClasses()) {
  const sortedRecords = [...records].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  const todayRecordIds = sortedRecords.filter(r => r.date === today()).map(r => r.id);
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    classId: classes[0]?.id || null,
    className: classes[0]?.name || '',
    totalRecords: sortedRecords.length,
    latestRecordId: sortedRecords[0]?.id || null,
    today: {
      date: today(),
      recordIds: todayRecordIds,
      childIds: unique(sortedRecords.filter(r => r.date === today()).map(r => r.childId)),
    },
    documents: makeDocumentQueue(sortedRecords),
    children: makeChildAutomation(children, sortedRecords),
    checklist: makeChecklist(children, sortedRecords),
    audit: makeAutomationAudit(sortedRecords, children),
  };
  storage.set(KEYS.AUTOMATION_STATE, state);
  return state;
}

export const getAutomationState = () => storage.get(KEYS.AUTOMATION_STATE) || rebuildAutomationState();

// Records helpers
export const getRecordsByChild = (childId) =>
  getRecords().filter(r => r.childId === childId);

export const getRecordsByDate = (date) =>
  getRecords().filter(r => r.date === date);

export const addRecord = (record) => {
  const records = getRecords();
  const baseRecord = { ...record, id: genId(), createdAt: new Date().toISOString() };
  const newRecord = { ...baseRecord, automation: makeRecordAutomationMeta(baseRecord) };
  const nextRecords = [newRecord, ...records];
  saveRecords(nextRecords);
  rebuildAutomationState(nextRecords);
  return newRecord;
};

export const updateRecord = (id, updates) => {
  const records = getRecords();
  const nextRecords = records.map(r => {
    if (r.id !== id) return r;
    const updated = { ...r, ...updates, updatedAt: new Date().toISOString() };
    return { ...updated, automation: makeRecordAutomationMeta(updated) };
  });
  saveRecords(nextRecords);
  rebuildAutomationState(nextRecords);
};

export const deleteRecord = (id) => {
  const nextRecords = getRecords().filter(r => r.id !== id);
  saveRecords(nextRecords);
  rebuildAutomationState(nextRecords);
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
  const nextChildren = children.map(c => c.id === id ? { ...c, ...updates } : c);
  saveChildren(nextChildren);
  rebuildAutomationState(getRecords(), nextChildren);
};

export const deleteChild = (id) => {
  const nextChildren = getChildren().filter(c => c.id !== id);
  saveChildren(nextChildren);
  rebuildAutomationState(getRecords(), nextChildren);
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

// ── 원 양식 템플릿 ────────────────────────────────────────────────────────────
// 각 양식: { id, name, docType, fields: [{ id, label, mappedTo, charLimit }] }
// mappedTo: 앱 섹션 title 또는 '__date__' | '__childName__' | '__className__' | '__period__'
export const getFormTemplates   = () => storage.get(KEYS.FORM_TEMPLATES) || [];
export const saveFormTemplates  = (v) => storage.set(KEYS.FORM_TEMPLATES, v);
export const addFormTemplate    = (tpl) => {
  const list = getFormTemplates();
  const newTpl = { ...tpl, id: genId(), createdAt: new Date().toISOString() };
  saveFormTemplates([...list, newTpl]);
  return newTpl;
};
export const updateFormTemplate = (id, updates) => {
  saveFormTemplates(getFormTemplates().map(t => t.id === id ? { ...t, ...updates } : t));
};
export const deleteFormTemplate = (id) => {
  saveFormTemplates(getFormTemplates().filter(t => t.id !== id));
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
    rebuildAutomationState(data.records || getRecords(), data.children || getChildren(), data.classes || getClasses());

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

// ── 반복 일정 (루틴) ──────────────────────────────────────────────────────────
// 루틴 shape: { id, title, days: [0-6], category, template }
export const getRoutines    = () => storage.get(KEYS.ROUTINES) || [];
export const saveRoutines   = (v) => storage.set(KEYS.ROUTINES, v);
export const addRoutine     = (r) => {
  const list = getRoutines();
  const n = { ...r, id: genId() };
  saveRoutines([...list, n]);
  return n;
};
export const deleteRoutine  = (id) => saveRoutines(getRoutines().filter(r => r.id !== id));

// ── 투약 관리 ──────────────────────────────────────────────────────────────────
export const getMedicines   = () => storage.get(KEYS.MEDICINES) || [];
export const saveMedicines  = (v) => storage.set(KEYS.MEDICINES, v);
export const addMedicine    = (m) => { const list = getMedicines(); const n = {...m, id: genId(), createdAt: new Date().toISOString()}; saveMedicines([...list, n]); return n; };
export const updateMedicine = (id, updates) => saveMedicines(getMedicines().map(m => m.id === id ? {...m,...updates} : m));
export const deleteMedicine = (id) => saveMedicines(getMedicines().filter(m => m.id !== id));

// ── 사고·상해 기록 ────────────────────────────────────────────────────────────
export const getAccidents   = () => storage.get(KEYS.ACCIDENTS) || [];
export const saveAccidents  = (v) => storage.set(KEYS.ACCIDENTS, v);
export const addAccident    = (a) => { const list = getAccidents(); const n = {...a, id: genId(), createdAt: new Date().toISOString()}; saveAccidents([...list, n]); return n; };
export const deleteAccident = (id) => saveAccidents(getAccidents().filter(a => a.id !== id));
export const updateAccident = (id, updates) => saveAccidents(getAccidents().map(a => a.id === id ? {...a,...updates} : a));

// ── 가정통신문 ────────────────────────────────────────────────────────────────
export const getNewsletters   = () => storage.get(KEYS.NEWSLETTERS) || [];
export const saveNewsletters  = (v) => storage.set(KEYS.NEWSLETTERS, v);
export const addNewsletter    = (n) => { const list = getNewsletters(); const item = {...n, id: genId(), createdAt: new Date().toISOString()}; saveNewsletters([...list, item]); return item; };
export const deleteNewsletter = (id) => saveNewsletters(getNewsletters().filter(n => n.id !== id));

// ── 활성 반 ───────────────────────────────────────────────────────────────────
export const getActiveClassId = () => storage.get(KEYS.ACTIVE_CLASS);
export const setActiveClassId = (id) => storage.set(KEYS.ACTIVE_CLASS, id);

// ── 온보딩 ────────────────────────────────────────────────────────────────────
export const isOnboardingDone = () => !!storage.get(KEYS.ONBOARDING_DONE);
export const setOnboardingDone = () => storage.set(KEYS.ONBOARDING_DONE, true);

// ── 문서 템플릿 커스터마이징 ────────────────────────────────────────────────────
export const getDocTemplates = () => storage.get(KEYS.DOC_TEMPLATES) || {};
export const saveDocTemplates = (v) => storage.set(KEYS.DOC_TEMPLATES, v);

// ── 상담 관리 ─────────────────────────────────────────────────────────────────
export const getConsults    = () => storage.get(KEYS.CONSULTS) || [];
export const saveConsults   = (v) => storage.set(KEYS.CONSULTS, v);
export const addConsult     = (c) => { const list = getConsults(); const n = {...c, id: genId(), createdAt: new Date().toISOString()}; saveConsults([...list, n]); return n; };
export const updateConsult  = (id, u) => saveConsults(getConsults().map(c => c.id === id ? {...c,...u} : c));
export const deleteConsult  = (id) => saveConsults(getConsults().filter(c => c.id !== id));

// ── 백업 이력 ─────────────────────────────────────────────────────────────────
export const getBackupHistory  = () => storage.get(KEYS.BACKUP_HISTORY) || [];
export const addBackupRecord   = () => {
  const hist = getBackupHistory().slice(0, 9);
  storage.set(KEYS.BACKUP_HISTORY, [{ date: new Date().toISOString(), type: 'manual' }, ...hist]);
};

// ── 연간 행사 ─────────────────────────────────────────────────────────────────
export const getEvents   = () => storage.get(KEYS.EVENTS) || [];
export const saveEvents  = (v) => storage.set(KEYS.EVENTS, v);
export const addEvent    = (ev) => { const list = getEvents(); const n = {...ev, id: genId(), createdAt: new Date().toISOString()}; saveEvents([...list, n]); return n; };
export const updateEvent = (id, updates) => saveEvents(getEvents().map(e => e.id === id ? {...e,...updates} : e));
export const deleteEvent = (id) => saveEvents(getEvents().filter(e => e.id !== id));
