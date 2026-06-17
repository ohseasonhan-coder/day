import { scheduleDriveBackup } from './driveBackup';
import { deletePhotosByRecord } from './photoStore';
import { getEnginePrefsForSync, applyEnginePrefsFromSync } from './ai/documentEngineSettings';

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
  get AUTOMATION_LOG()  { return `sw_${_getUid()}_automation_log`; },
  get FEEDBACK()        { return `sw_${_getUid()}_feedback`; },
  get COPY_HISTORY()    { return `sw_${_getUid()}_copy_history`; },
  get TRASH()           { return `sw_${_getUid()}_trash`; },
  get ARCHIVED_CHILDREN() { return `sw_${_getUid()}_archived_children`; },
  get INTERNAL_DOCS()   { return `sw_${_getUid()}_internal_docs`; },
};

// ── 저장 공간 사용량 ──────────────────────────────────────────────────────────
// localStorage 한도는 브라우저당 약 5MB. 80%를 넘으면 경고를 띄운다.
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export function getStorageUsage() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16 ≈ 2바이트/문자
    }
  } catch {}
  return {
    bytes,
    mb: bytes / 1024 / 1024,
    percent: Math.min(100, Math.round((bytes / STORAGE_LIMIT_BYTES) * 100)),
    warning: bytes > STORAGE_LIMIT_BYTES * 0.8,
  };
}

// ── 신학기 진급 / 졸업 아동 보관 ──────────────────────────────────────────────
// 졸업한 아이는 명단에서 빠지지만 기록은 그대로 남는다 (기록의 childName으로 식별 가능)
// ── 원내문서 (교직원 교육일지·회의록 등) ──────────────────────────────────────
export const getInternalDocs = () => storage.get(KEYS.INTERNAL_DOCS) || [];
export const addInternalDoc = (doc) => {
  const list = getInternalDocs();
  const item = { ...doc, id: genId(), createdAt: new Date().toISOString() };
  storage.set(KEYS.INTERNAL_DOCS, [item, ...list]);
  return item;
};
export const updateInternalDoc = (id, updates) =>
  storage.set(KEYS.INTERNAL_DOCS, getInternalDocs().map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d));
export const deleteInternalDoc = (id) =>
  storage.set(KEYS.INTERNAL_DOCS, getInternalDocs().filter(d => d.id !== id));

export const getArchivedChildren = () => storage.get(KEYS.ARCHIVED_CHILDREN) || [];

export function promoteToNewYear({ classUpdates, graduateIds }) {
  const classes = getClasses();
  const children = getChildren();

  const nextClasses = classes.map((c, i) => i === 0 ? { ...c, ...classUpdates } : c);
  saveClasses(nextClasses);

  const graduates = children.filter(c => graduateIds.includes(c.id));
  const remaining = children.filter(c => !graduateIds.includes(c.id));
  if (graduates.length > 0) {
    const archived = getArchivedChildren();
    storage.set(KEYS.ARCHIVED_CHILDREN, [
      ...graduates.map(c => ({ ...c, graduatedAt: new Date().toISOString(), lastClassName: classes[0]?.name || '' })),
      ...archived,
    ]);
  }
  saveChildren(remaining);
  rebuildAutomationState(getRecords(), remaining, nextClasses);
  return { promoted: remaining.length, graduated: graduates.length };
}

export function restoreArchivedChild(id) {
  const archived = getArchivedChildren();
  const child = archived.find(c => c.id === id);
  if (!child) return { ok: false };
  const { graduatedAt, lastClassName, ...rest } = child; // eslint-disable-line no-unused-vars
  saveChildren([...getChildren(), rest]);
  storage.set(KEYS.ARCHIVED_CHILDREN, archived.filter(c => c.id !== id));
  return { ok: true };
}

// ── PIN 잠금 ─────────────────────────────────────────────────────────────────
// 화면 잠금용 4자리 PIN 해시 (가벼운 열람 방지용 — 암호학적 보안 아님)
export function hashPin(pin) {
  let h = 5381;
  const s = `sw-pin-${pin}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// 구글 OAuth 클라이언트 ID — 로그인 전에도 필요하므로 계정 구분 없이 전역 저장
// 비밀키가 아니라 "승인된 앱 주소에서만 구글 인증을 쓸 수 있다"는 공개 식별자라서
// 앱에 기본값으로 내장한다. 관리자 탭에서 다른 값으로 덮어쓸 수 있다.
const DEFAULT_GOOGLE_CLIENT_ID = '613797069993-4h916l8qmn3bkoueuht5hhg7mp8t8kao.apps.googleusercontent.com';

export const getGoogleClientId = () => {
  try { return localStorage.getItem('sw_google_client_id') || DEFAULT_GOOGLE_CLIENT_ID; } catch { return DEFAULT_GOOGLE_CLIENT_ID; }
};
export const setGoogleClientId = (id) => {
  try { localStorage.setItem('sw_google_client_id', String(id || '').trim()); } catch {}
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
    maybeScheduleDriveBackup(key);
  },
  remove: (key) => {
    try { localStorage.removeItem(key); } catch {}
  },
};

// ── 변경 시 드라이브 자동 백업 ────────────────────────────────────────────────
// 실제 자료(기록·아이·문서 등)가 바뀐 경우에만 백업을 예약한다.
// 임시저장(draft)·알림 플래그 같은 잦은 잡음성 키는 제외.
const AUTO_BACKUP_KEY_SUFFIXES = [
  '_records', '_children', '_classes', '_documents', '_consults',
  '_medicines', '_accidents', '_newsletters', '_routines',
  '_form_templates', '_events', '_templates',
];

function maybeScheduleDriveBackup(key) {
  try {
    if (!AUTO_BACKUP_KEY_SUFFIXES.some(suffix => String(key).endsWith(suffix))) return;
    if (!getGoogleClientId()) return;
    if (!getSettings().driveAutoBackup) return;
    scheduleDriveBackup(getBackupJson);
  } catch {}
}

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

const AUTOMATION_CHANGE_LABELS = [
  '알림장 초안',
  '상담자료 누적',
  '아이별 성장요약',
  '문서 초안 후보',
  '부족 기록 추천',
  '자동화 점검표',
];

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

const CATEGORY_GUIDES = {
  peer: { label: '또래관계', prompt: '친구와 함께 놀이하거나 차례를 기다리는 장면을 기록해보세요.' },
  habit: { label: '생활습관', prompt: '식사, 정리, 배변, 낮잠, 위생 중 하나를 짧게 기록해보세요.' },
  comm: { label: '의사소통', prompt: '유아가 말로 표현하거나 질문한 장면을 기록해보세요.' },
  play: { label: '놀이·활동', prompt: '오늘 이어진 놀이 흐름과 유아 반응을 기록해보세요.' },
  nature: { label: '자연탐구', prompt: '곤충, 식물, 날씨, 수, 비교, 관찰 장면을 기록해보세요.' },
  art: { label: '예술경험', prompt: '그리기, 만들기, 노래, 움직임 표현 장면을 기록해보세요.' },
  body: { label: '신체운동', prompt: '대근육, 소근육, 바깥놀이, 도구 사용 장면을 기록해보세요.' },
  special: { label: '특이사항', prompt: '건강, 안전, 투약, 부모 요청, 행사 관련 상황을 기록해보세요.' },
};

const firstText = (...values) => values.find(v => typeof v === 'string' && v.trim())?.trim() || '';

const makeNoticeDrafts = (children, records) => {
  const todayStr = today();
  const todayRecords = records.filter(r => r.date === todayStr);
  const byChild = {};

  children.forEach(child => {
    const childRecords = todayRecords.filter(r => r.childId === child.id);
    const play = childRecords.filter(r => ['play', 'peer', 'nature', 'art', 'body'].includes(r.category));
    const habit = childRecords.filter(r => r.category === 'habit');
    const special = childRecords.filter(r => r.category === 'special' || r.recordType === 'special');
    const samples = childRecords.map(r => firstText(r.parent, r.observation, r.rawText)).filter(Boolean);

    byChild[child.id] = {
      childId: child.id,
      childName: child.name,
      date: todayStr,
      ready: childRecords.length > 0,
      recordIds: childRecords.map(r => r.id),
      sections: {
        play: play.length ? firstText(play[0].parent, play[0].observation, play[0].rawText) : '',
        habit: habit.length ? firstText(habit[0].parent, habit[0].observation, habit[0].rawText) : '',
        special: special.length ? firstText(special[0].parent, special[0].observation, special[0].rawText) : '',
      },
      text: samples.length
        ? `${child.name}은(는) 오늘 ${samples.slice(0, 2).join(' 또한 ')}`
        : '',
    };
  });

  return {
    date: todayStr,
    readyCount: Object.values(byChild).filter(v => v.ready).length,
    totalChildren: children.length,
    byChild,
  };
};

const makeConsultAccumulations = (children, records) => {
  const byChild = {};
  children.forEach(child => {
    const childRecords = records
      .filter(r => r.childId === child.id && daysAgo(r.date) <= 30)
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
    const consultRecords = childRecords.filter(r => r.parent || r.support || r.recordType === 'consult');
    const categoryCounts = countBy(childRecords, r => r.category);
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topLabel = CATEGORY_GUIDES[topCategory]?.label || '일상생활';
    const sample = firstText(consultRecords[0]?.parent, consultRecords[0]?.observation, childRecords[0]?.observation);

    byChild[child.id] = {
      childId: child.id,
      childName: child.name,
      ready: consultRecords.length > 0,
      recordIds: consultRecords.map(r => r.id),
      recentGrowth: consultRecords.length ? `${child.name}은(는) 최근 ${topLabel} 관련 경험이 누적되고 있습니다. ${sample}` : '',
      strengths: consultRecords.length ? `${child.name}은(는) 자신의 경험과 감정을 표현하려는 모습이 관찰됩니다.` : '',
      supportNeeded: consultRecords.some(r => r.support) ? firstText(consultRecords.find(r => r.support)?.support) : '',
      homeLink: consultRecords.length ? '가정에서도 같은 상황을 짧은 말로 표현하고 기다려보는 경험을 이어가면 좋겠습니다.' : '',
    };
  });

  return {
    period: '최근 30일',
    readyCount: Object.values(byChild).filter(v => v.ready).length,
    byChild,
  };
};

const makeGrowthSummaries = (children, records) => {
  const byChild = {};
  children.forEach(child => {
    const childRecords = records.filter(r => r.childId === child.id && daysAgo(r.date) <= 30);
    const categoryCounts = countBy(childRecords, r => r.category);
    const devAreaCounts = countBy(childRecords.flatMap(r => toArray(r.devAreas)), area => area);
    const missingCategoryKeys = Object.keys(CATEGORIES).filter(key => !categoryCounts[key]);
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topLabel = CATEGORY_GUIDES[topCategory]?.label || '여러 영역';

    byChild[child.id] = {
      childId: child.id,
      childName: child.name,
      ready: childRecords.length > 0,
      recordIds: childRecords.map(r => r.id),
      categoryCounts,
      devAreaCounts,
      missingCategoryKeys,
      summary: childRecords.length
        ? `${child.name}은(는) 최근 1개월 동안 ${topLabel}을(를) 중심으로 경험이 누적되고 있습니다. 기록 ${childRecords.length}건이 성장 요약에 반영됩니다.`
        : '',
    };
  });

  return {
    period: '최근 1개월',
    readyCount: Object.values(byChild).filter(v => v.ready).length,
    byChild,
  };
};

const makeDraftCandidates = (records, classes) => {
  const cl = classes[0] || {};
  const todayRecords = records.filter(r => r.date === today());
  const weekRecords = records.filter(r => daysAgo(r.date) <= 7);
  const monthRecords = records.filter(r => daysAgo(r.date) <= 30);
  const consultRecords = monthRecords.filter(r => r.parent || r.recordType === 'consult');
  const developmentRecords = monthRecords.filter(r => toArray(r.devAreas).length > 0);
  const safetyRecords = monthRecords.filter(r => r.category === 'special' || r.recordType === 'special');
  const makeCandidate = (type, title, sourceRecords) => ({
    type,
    title,
    status: 'autoCandidate',
    classId: cl.id || null,
    className: cl.name || '',
    count: sourceRecords.length,
    ready: sourceRecords.length > 0,
    sourceRecordIds: sourceRecords.map(r => r.id),
    updatedAt: new Date().toISOString(),
    preview: sourceRecords.length
      ? sourceRecords.map(r => firstText(r.observation, r.parent, r.rawText)).filter(Boolean).slice(0, 3).join(' ')
      : '',
  });

  return {
    daily: makeCandidate('daily', '오늘 보육일지 자동 초안 후보', todayRecords),
    weekly: makeCandidate('weekly', '주간 놀이평가 자동 초안 후보', weekRecords),
    monthly: makeCandidate('monthly', '월간 놀이평가 자동 초안 후보', monthRecords),
    parent: makeCandidate('parent', '부모상담자료 자동 초안 후보', consultRecords),
    development: makeCandidate('development', '발달평가 자동 초안 후보', developmentRecords),
    safety: makeCandidate('safety', '안전·행사평가 자동 초안 후보', safetyRecords),
    teacher: {
      ...makeCandidate('teacher', '교사교육일지 기본 초안 후보', []),
      ready: true,
      count: 0,
      preview: '교육명과 핵심 내용만 보완하면 바로 쓸 수 있는 기본 초안입니다.',
    },
    review: makeCandidate('review', '원장 검토자료 자동 초안 후보', monthRecords),
    weekplan: makeCandidate('weekplan', '주간 계획안 자동 초안 후보', weekRecords),
    monthplan: makeCandidate('monthplan', '월간 계획안 자동 초안 후보', monthRecords),
  };
};

const makeRecordRecommendations = (checklist) => {
  const missing = checklist.missingCategoryKeys || [];
  return missing.map(key => ({
    key,
    label: CATEGORY_GUIDES[key]?.label || key,
    prompt: CATEGORY_GUIDES[key]?.prompt || '부족한 영역의 관찰 기록을 1건 추가해보세요.',
    example: `${CATEGORY_GUIDES[key]?.label || '해당 영역'} 상황에서 유아가 보인 말, 행동, 교사 지원을 한 문장으로 기록해보세요.`,
  }));
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
  const noticeDrafts = makeNoticeDrafts(children, records);
  const growthSummaries = makeGrowthSummaries(children, records);
  const draftCandidates = makeDraftCandidates(records, getClasses());

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
    {
      key: 'noticeDrafts',
      label: '알림장 자동 초안',
      ready: noticeDrafts.readyCount > 0,
      detail: noticeDrafts.readyCount ? `오늘 알림장 초안 ${noticeDrafts.readyCount}명분이 준비됐습니다.` : '오늘 기록이 생기면 아이별 알림장 초안이 준비됩니다.',
    },
    {
      key: 'growthSummary',
      label: '아이별 성장 요약',
      ready: growthSummaries.readyCount > 0,
      detail: growthSummaries.readyCount ? `아이별 최근 1개월 성장 요약 ${growthSummaries.readyCount}명분이 갱신됐습니다.` : '기록이 누적되면 성장 요약이 자동 갱신됩니다.',
    },
    {
      key: 'draftCandidates',
      label: '문서 초안 후보',
      ready: Object.values(draftCandidates).some(item => item.ready),
      detail: '보육일지, 놀이평가, 상담자료, 발달평가, 행사평가, 교사교육일지 후보를 문서 이력과 분리해 준비합니다.',
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
  const checklist = makeChecklist(children, sortedRecords);
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
    checklist,
    audit: makeAutomationAudit(sortedRecords, children),
    noticeDrafts: makeNoticeDrafts(children, sortedRecords),
    consultAccumulations: makeConsultAccumulations(children, sortedRecords),
    growthSummaries: makeGrowthSummaries(children, sortedRecords),
    draftCandidates: makeDraftCandidates(sortedRecords, classes),
    recommendations: makeRecordRecommendations(checklist),
  };
  storage.set(KEYS.AUTOMATION_STATE, state);
  return state;
}

export const getAutomationState = () => storage.get(KEYS.AUTOMATION_STATE) || rebuildAutomationState();

export const getAutomationLog = () => storage.get(KEYS.AUTOMATION_LOG) || [];

const pushAutomationLog = (event) => {
  const next = [
    {
      id: genId(),
      createdAt: new Date().toISOString(),
      changedLabels: AUTOMATION_CHANGE_LABELS,
      ...event,
    },
    ...getAutomationLog(),
  ].slice(0, 80);
  storage.set(KEYS.AUTOMATION_LOG, next);
  return next[0];
};

const makeAutomationLogEvent = (action, record, state) => {
  const actionLabel = action === 'create' ? '기록 저장' : action === 'update' ? '기록 수정' : '기록 삭제';
  const childName = record?.childName || '기록';
  return pushAutomationLog({
    action,
    actionLabel,
    recordId: record?.id || null,
    childId: record?.childId || null,
    childName,
    message: `${actionLabel}으로 ${childName}의 상담자료, 성장요약, 문서 초안 후보, 누락 점검이 다시 반영됐습니다.`,
    auditReadyCount: state?.audit?.readyCount || 0,
    auditTotalCount: state?.audit?.totalCount || 0,
    documentReadyCount: Object.values(state?.documents || {}).filter(item => item.ready).length,
    recommendationCount: state?.recommendations?.length || 0,
  });
};

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
  const state = rebuildAutomationState(nextRecords);
  const automationEvent = makeAutomationLogEvent('create', newRecord, state);
  return { ...newRecord, automationEvent };
};

export const updateRecord = (id, updates) => {
  const records = getRecords();
  let updatedRecord = null;
  const nextRecords = records.map(r => {
    if (r.id !== id) return r;
    const updated = { ...r, ...updates, updatedAt: new Date().toISOString() };
    updatedRecord = { ...updated, automation: makeRecordAutomationMeta(updated) };
    return updatedRecord;
  });
  saveRecords(nextRecords);
  const state = rebuildAutomationState(nextRecords);
  return makeAutomationLogEvent('update', updatedRecord, state);
};

export const deleteRecord = (id) => {
  const records = getRecords();
  const deletedRecord = records.find(r => r.id === id);
  const nextRecords = records.filter(r => r.id !== id);
  saveRecords(nextRecords);
  if (deletedRecord) moveToTrash('record', deletedRecord);
  const state = rebuildAutomationState(nextRecords);
  return makeAutomationLogEvent('delete', deletedRecord, state);
};

// ── 휴지통 (삭제 복구) ────────────────────────────────────────────────────────
// 기록·문서는 삭제 시 즉시 지우지 않고 휴지통에 30일 보관 후 자동 정리
const TRASH_RETENTION_DAYS = 30;

export const getTrash = () => {
  const items = storage.get(KEYS.TRASH) || [];
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 86400000;
  const valid = items.filter(t => new Date(t.deletedAt).getTime() > cutoff);
  if (valid.length !== items.length) storage.set(KEYS.TRASH, valid);
  return valid;
};

function moveToTrash(type, item) {
  const trash = getTrash();
  storage.set(KEYS.TRASH, [
    { trashId: genId(), type, item, deletedAt: new Date().toISOString() },
    ...trash,
  ].slice(0, 200)); // 휴지통 최대 200개
}

export const restoreFromTrash = (trashId) => {
  const trash = getTrash();
  const entry = trash.find(t => t.trashId === trashId);
  if (!entry) return { ok: false, error: '휴지통에서 항목을 찾을 수 없어요.' };

  if (entry.type === 'record') {
    const records = getRecords();
    if (!records.find(r => r.id === entry.item.id)) {
      const next = [entry.item, ...records];
      next.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
      saveRecords(next);
      rebuildAutomationState(next);
    }
  } else if (entry.type === 'document') {
    const documents = getDocuments();
    if (!documents.find(d => d.id === entry.item.id)) {
      saveDocuments([entry.item, ...documents]);
    }
  }
  storage.set(KEYS.TRASH, trash.filter(t => t.trashId !== trashId));
  return { ok: true, type: entry.type };
};

export const purgeTrashItem = (trashId) => {
  const trash = getTrash();
  const entry = trash.find(t => t.trashId === trashId);
  // 기록이 영구 삭제되면 첨부 사진도 정리 (실패해도 무시)
  if (entry?.type === 'record' && entry.item?.id) deletePhotosByRecord(entry.item.id).catch(() => {});
  storage.set(KEYS.TRASH, trash.filter(t => t.trashId !== trashId));
};

export const emptyTrash = () => {
  getTrash().forEach(t => {
    if (t.type === 'record' && t.item?.id) deletePhotosByRecord(t.item.id).catch(() => {});
  });
  storage.set(KEYS.TRASH, []);
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
    source: document.source || 'generated',
    sourceLabel: document.sourceLabel || '자동 생성 문서',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveDocuments([newDocument, ...documents]);
  pushAutomationLog({
    action: 'document',
    actionLabel: '문서 저장',
    recordId: null,
    childId: document.childId || null,
    childName: document.childName || document.className || '문서',
    changedLabels: ['문서함', '문서 이력', '자동 초안 후보'],
    message: `${document.title || '문서 초안'}이 문서함에 저장됐습니다.`,
    auditReadyCount: getAutomationState()?.audit?.readyCount || 0,
    auditTotalCount: getAutomationState()?.audit?.totalCount || 0,
    documentReadyCount: Object.values(getAutomationState()?.documents || {}).filter(item => item.ready).length,
    recommendationCount: getAutomationState()?.recommendations?.length || 0,
  });
  return newDocument;
};

export const updateDocumentDraft = (id, updates) => {
  const documents = getDocuments();
  saveDocuments(documents.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d));
};

export const deleteDocumentDraftToTrash = (id) => {
  const documents = getDocuments();
  const deleted = documents.find(d => d.id === id);
  saveDocuments(documents.filter(d => d.id !== id));
  if (deleted) moveToTrash('document', deleted);
};

export const deleteDocumentDraft = (id) => {
  saveDocuments(getDocuments().filter(d => d.id !== id));
};

const SAMPLE_TAG = 'saemwork-sample';

export function seedSampleData() {
  const now = new Date();
  const dateAgo = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const sampleClass = { id: `${SAMPLE_TAG}-class`, name: '햇살반', year: String(now.getFullYear()), age: '4', sample: true };
  const sampleChildren = [
    { id: `${SAMPLE_TAG}-child-hajun`, name: '하준', classId: sampleClass.id, sample: true },
    { id: `${SAMPLE_TAG}-child-yunjae`, name: '윤재', classId: sampleClass.id, sample: true },
    { id: `${SAMPLE_TAG}-child-seoa`, name: '서아', classId: sampleClass.id, sample: true },
  ];
  const sampleRecords = [
    ['hajun', 'peer', 0, '하준이는 친구와 캠핑놀이를 하며 순서를 기다렸다.', '또래와의 놀이 상황에서 친구와 역할을 나누고 차례를 기다리는 경험을 하였다.', '하준이가 친구와 함께 놀이하며 순서를 기다리는 모습을 보였습니다.', '차례를 기다리는 상황에서 교사가 짧은 언어 모델링을 제공한다.'],
    ['hajun', 'play', 1, '하준이가 블록으로 텐트를 만들고 친구에게 같이 캠핑하자고 말했다.', '블록을 활용해 캠핑 상황을 구성하고 친구에게 놀이를 제안하였다.', '캠핑놀이에 관심을 보이며 친구에게 함께 놀이하자고 표현했습니다.', '상상놀이가 이어질 수 있도록 캠핑 소품과 역할 카드를 제공한다.'],
    ['yunjae', 'nature', 0, '윤재가 장수풍뎅이 애벌레를 돋보기로 관찰하며 움직인다고 말했다.', '곤충의 움직임에 관심을 보이며 돋보기를 사용해 관찰하였다.', '윤재가 곤충의 움직임을 관찰하며 궁금한 점을 말로 표현했습니다.', '관찰한 내용을 그림이나 말로 다시 표현해볼 수 있도록 지원한다.'],
    ['yunjae', 'comm', 2, '윤재가 친구에게 내가 먼저 해볼게라고 말한 뒤 차례를 정했다.', '자신의 생각을 말로 표현하고 친구와 차례를 정하는 모습을 보였다.', '자신의 생각을 말로 표현하며 친구와 순서를 정해보았습니다.', '친구의 의견을 듣고 조율하는 상호작용을 반복 경험한다.'],
    ['seoa', 'habit', 0, '서아가 점심시간에 새로운 반찬 냄새를 맡고 작은 한입을 시도했다.', '새로운 음식에 관심을 보이며 냄새를 맡고 조금 맛보는 경험을 하였다.', '서아가 새로운 반찬을 작은 양으로 시도해보는 모습을 보였습니다.', '새로운 음식은 강요하지 않고 탐색과 작은 시도를 격려한다.'],
    ['seoa', 'special', 3, '서아가 등원 후 엄마를 찾으며 울었지만 그림책을 보며 안정되었다.', '등원 시 보호자와 헤어지는 상황에서 속상함을 표현하였고 교사의 지원으로 안정되었다.', '등원 직후 아쉬운 마음을 표현했지만 그림책을 보며 점차 안정되었습니다.', '안정 물건과 예측 가능한 등원 루틴을 제공한다.'],
  ].map(([childKey, category, days, rawText, observation, parent, support], index) => {
    const child = childKey === 'hajun' ? sampleChildren[0] : childKey === 'yunjae' ? sampleChildren[1] : sampleChildren[2];
    const base = {
      id: `${SAMPLE_TAG}-record-${index}`,
      childId: child.id,
      childName: child.name,
      date: dateAgo(days),
      rawText,
      recordType: category === 'special' ? 'special' : 'observe',
      category,
      devAreas: category === 'nature' ? ['자연탐구', '의사소통'] : category === 'habit' ? ['기본생활습관'] : ['사회관계', '의사소통'],
      tags: [CATEGORIES[category]?.label || '기록'],
      observation,
      parent,
      support,
      softened: observation,
      sample: true,
      createdAt: new Date(now.getTime() - index * 3600000).toISOString(),
    };
    return { ...base, automation: makeRecordAutomationMeta(base) };
  });
  const sampleDocs = [
    {
      id: `${SAMPLE_TAG}-doc-daily`,
      title: '샘플 보육일지 초안',
      badge: `${formatDateKo(today())} 기준 · 샘플 기록 반영`,
      type: 'daily',
      date: today(),
      classId: sampleClass.id,
      className: sampleClass.name,
      source: SAMPLE_TAG,
      sourceLabel: '샘플 데이터',
      sample: true,
      sections: [
        { title: '놀이 흐름 및 활동', text: '유아들은 캠핑놀이, 곤충 관찰, 점심 식사 경험을 중심으로 하루 일과에 참여하였다.' },
        { title: '유아 반응', text: '친구와 함께 놀이를 제안하고, 자연물을 관찰하며 궁금한 점을 말로 표현하는 모습이 나타났다.' },
        { title: '교사 지원', text: '교사는 차례 기다리기, 감정 표현, 탐구 확장을 위해 언어적 안내와 자료를 제공하였다.' },
        { title: '다음 지원계획', text: '캠핑놀이와 자연탐구 경험이 이어질 수 있도록 소품과 관찰 기록지를 제공한다.', accent: true },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const nextClasses = [...getClasses().filter(item => !item.sample), sampleClass];
  const nextChildren = [...getChildren().filter(item => !item.sample), ...sampleChildren];
  const nextRecords = [...sampleRecords, ...getRecords().filter(item => !item.sample)];
  const nextDocuments = [...sampleDocs, ...getDocuments().filter(item => !item.sample)];
  saveClasses(nextClasses);
  saveChildren(nextChildren);
  saveRecords(nextRecords);
  saveDocuments(nextDocuments);
  rebuildAutomationState(nextRecords, nextChildren, nextClasses);
  pushAutomationLog({
    action: 'sample',
    actionLabel: '샘플 데이터 추가',
    changedLabels: ['샘플 아이', '샘플 기록', '샘플 문서', '자동화 점검'],
    message: '샘플 아이 3명, 기록 6건, 문서 1건을 추가했습니다.',
  });
  return { children: sampleChildren.length, records: sampleRecords.length, documents: sampleDocs.length };
}

export function clearSampleData() {
  const nextClasses = getClasses().filter(item => !item.sample && !String(item.id || '').startsWith(SAMPLE_TAG));
  const nextChildren = getChildren().filter(item => !item.sample && !String(item.id || '').startsWith(SAMPLE_TAG));
  const nextRecords = getRecords().filter(item => !item.sample && !String(item.id || '').startsWith(SAMPLE_TAG));
  const nextDocuments = getDocuments().filter(item => !item.sample && !String(item.id || '').startsWith(SAMPLE_TAG));
  saveClasses(nextClasses);
  saveChildren(nextChildren);
  saveRecords(nextRecords);
  saveDocuments(nextDocuments);
  rebuildAutomationState(nextRecords, nextChildren, nextClasses);
  return true;
}

export function clearRecordsAndDocuments() {
  saveRecords([]);
  saveDocuments([]);
  storage.set(KEYS.AUTOMATION_LOG, []);
  rebuildAutomationState([], getChildren(), getClasses());
}

export function clearDocumentsOnly() {
  saveDocuments([]);
  pushAutomationLog({
    action: 'clearDocuments',
    actionLabel: '문서 이력 삭제',
    changedLabels: ['문서함', '문서 이력'],
    message: '문서 이력을 모두 삭제했습니다.',
  });
}

export const getFeedback = () => storage.get(KEYS.FEEDBACK) || [];

export const addFeedback = (feedback) => {
  const item = {
    ...feedback,
    id: genId(),
    createdAt: new Date().toISOString(),
  };
  storage.set(KEYS.FEEDBACK, [item, ...getFeedback()].slice(0, 100));
  return item;
};

export const deleteFeedback = (id) => {
  storage.set(KEYS.FEEDBACK, getFeedback().filter(item => item.id !== id));
};

export const getCopyHistory = () => storage.get(KEYS.COPY_HISTORY) || [];

export const addCopyHistory = ({ title, text, source }) => {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;
  const item = {
    id: genId(),
    title: title || '복사 문장',
    text: cleanText,
    source: source || 'record',
    createdAt: new Date().toISOString(),
  };
  const prev = getCopyHistory().filter(v => v.text !== cleanText);
  storage.set(KEYS.COPY_HISTORY, [item, ...prev].slice(0, 20));
  return item;
};

export const deleteCopyHistory = (id) => {
  storage.set(KEYS.COPY_HISTORY, getCopyHistory().filter(item => item.id !== id));
};

export const clearCopyHistory = () => {
  storage.set(KEYS.COPY_HISTORY, []);
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
function buildBackupPayload() {
  return {
    version: 2,
    appName: '쌤워크',
    userId: _getUid(),
    exportedAt: new Date().toISOString(),
    classes: getClasses(),
    children: getChildren(),
    records: getRecords(),
    documents: getDocuments(),
    settings: getSettings(),
    routines: getRoutines(),
    formTemplates: getFormTemplates(),
    automationState: getAutomationState(),
    automationLog: getAutomationLog(),
    copyHistory: getCopyHistory(),
    feedback: getFeedback(),
    // 문서 유형별 기본 엔진 설정(비민감 — legacy/modular 플래그)만 기기 간 동기화한다.
    // 검수/fallback 데이터는 개인정보 가능성으로 백업에 포함하지 않는다.
    documentEnginePrefs: getEnginePrefsForSync(),
  };
}

// 백업 내용을 JSON 문자열로 반환 (구글 드라이브 업로드 등에 사용)
export function getBackupJson() {
  return JSON.stringify(buildBackupPayload(), null, 2);
}

// 엔진 전환 설정 변경 시 즉시 드라이브 동기화를 예약한다(다른 기기로 전파).
// 자동 백업이 켜져 있고 구글 연결이 된 경우에만 동작한다.
export function triggerEnginePrefSync() {
  try {
    if (!getGoogleClientId()) return;
    if (!getSettings().driveAutoBackup) return;
    scheduleDriveBackup(getBackupJson);
  } catch {
    /* 무시 */
  }
}

export function exportBackup() {
  const uid = _getUid();
  const payload = buildBackupPayload();
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
    if (data.routines)  storage.set(KEYS.ROUTINES, data.routines);
    if (data.formTemplates) saveFormTemplates(data.formTemplates);
    if (data.automationLog) storage.set(KEYS.AUTOMATION_LOG, data.automationLog);
    if (data.copyHistory) storage.set(KEYS.COPY_HISTORY, data.copyHistory);
    if (data.feedback) storage.set(KEYS.FEEDBACK, data.feedback);
    if (data.documentEnginePrefs) applyEnginePrefsFromSync(data.documentEnginePrefs);
    rebuildAutomationState(data.records || getRecords(), data.children || getChildren(), data.classes || getClasses());

    return {
      ok: true,
      summary: {
        children:  (data.children  || []).length,
        records:   (data.records   || []).length,
        documents: (data.documents || []).length,
        routines:  (data.routines || []).length,
        forms:     (data.formTemplates || []).length,
        exportedAt: data.exportedAt,
      },
    };
  } catch (e) {
    return { ok: false, error: `파일 형식이 올바르지 않아요. (${e.message})` };
  }
}

// 백업 파일 검증·미리보기 (적용하지 않고 내용만 확인)
export function parseBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.appName)
      return { ok: false, error: '쌤워크 백업 파일이 아니에요.' };
    return {
      ok: true,
      data,
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

// id 기준 병합 — 없는 항목은 추가, 같은 id는 더 최신(createdAt) 항목 유지
function mergeById(current, incoming, dateKey = 'createdAt') {
  const map = new Map((current || []).map(item => [item.id, item]));
  let added = 0;
  for (const item of incoming || []) {
    if (!item || item.id == null) continue;
    const existing = map.get(item.id);
    if (!existing) { map.set(item.id, item); added += 1; continue; }
    const a = new Date(existing[dateKey] || existing.date || 0).getTime();
    const b = new Date(item[dateKey] || item.date || 0).getTime();
    if (b > a) map.set(item.id, item);
  }
  return { merged: [...map.values()], added };
}

// 병합 복구: 기존 데이터를 지우지 않고 백업 파일 내용을 합침 (두 기기 병행 사용용)
export function importBackupMerge(jsonString) {
  const parsed = parseBackup(jsonString);
  if (!parsed.ok) return parsed;
  const data = parsed.data;

  const classes  = mergeById(getClasses(),  data.classes);
  const children = mergeById(getChildren(), data.children);
  const records  = mergeById(getRecords(),  data.records);
  const docs     = mergeById(getDocuments(), data.documents);
  const routines = mergeById(getRoutines(), data.routines);
  const forms    = mergeById(getFormTemplates(), data.formTemplates);

  records.merged.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  docs.merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  saveClasses(classes.merged);
  saveChildren(children.merged);
  saveRecords(records.merged);
  saveDocuments(docs.merged);
  storage.set(KEYS.ROUTINES, routines.merged);
  saveFormTemplates(forms.merged);
  if (data.documentEnginePrefs) applyEnginePrefsFromSync(data.documentEnginePrefs);
  rebuildAutomationState(records.merged, children.merged, classes.merged);

  return {
    ok: true,
    summary: {
      addedChildren: children.added,
      addedRecords:  records.added,
      addedDocs:     docs.added,
      totalRecords:  records.merged.length,
    },
  };
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
