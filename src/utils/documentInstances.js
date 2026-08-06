// 문서 인스턴스(자동 생성 문서 초안) — 서식(Template)과 실제 작성 문서(Instance)를 분리한다.
//
//  Template  : sw_shared_rich_doc_templates + BUILTIN (documentStudio.js) — 실제 원아 이름/기록/발화/
//              B4 전문/교사 메모/fieldValues 저장 금지(validateTemplatePrivacy로 검증).
//  Instance  : sw_${uid}_doc_instances — 특정 기록에서 생성된 실제 값(fieldValues)·필드 상태(fieldStates)·
//              상태값·sourceRecordId·templateId 저장. 서식 원본은 절대 수정하지 않는다(내용 복제).
//
//  자동 생성 흐름: 기록 저장 → B4/audit 확인 → 활성 규칙 조회 → 서식 복제 → 자동 필드 채움 → 문서함 초안.
//  중복 방지: templateId + sourceRecordId 조합이 이미 있으면 기존 초안 반환(idempotent).
//  갱신 정책: draft는 교사가 수정하지 않은 자동 필드만(명시적 "다시 반영" 시), final은 자동 갱신 금지.
import { getRecords, getChildren, getClasses, genId, today } from './storage';
import { isMaster, getCurrentUser } from './auth';
import { listRichTemplates, collectFieldKeys, FIELD_MAP } from './documentStudio';

export const INSTANCES_SUFFIX = 'doc_instances';
export const AUTO_RULES_KEY = 'sw_shared_doc_auto_rules'; // 관리자 전용(기기 공용)

export const AUTO_TRIGGERS = ['observationRecordSaved', 'dailyRecordSaved', 'consultationRecordSaved'];

const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();

function currentUid() {
  try { return JSON.parse(localStorage.getItem('sw_session') || 'null')?.userId || 'default'; }
  catch { return 'default'; }
}
export function getInstancesKey(userId = currentUid()) { return `sw_${userId}_${INSTANCES_SUFFIX}`; }
const readJson = (key, fb) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fb : v; } catch { return fb; } };
const writeJson = (key, v) => localStorage.setItem(key, JSON.stringify(v));

// ── 자동 생성 규칙(관리자 전용) ─────────────────────────────────────────────
// 초기 연결: 관찰 기록→관찰일지 / 하루 기록→일일 보육일지 / 상담 기록→부모 상담 기록
export const DEFAULT_AUTO_RULES = {
  builtin_observation: {
    enabled: true, trigger: 'observationRecordSaved', sourceRecordType: 'observationRecord',
    documentType: 'observationJournal', requires: { recordSaved: true, b4AuditPassed: true }, createMode: 'draft',
  },
  builtin_daily: {
    enabled: true, trigger: 'dailyRecordSaved', sourceRecordType: 'dailyRecord',
    documentType: 'dailyJournal', requires: { recordSaved: true, b4AuditPassed: false }, createMode: 'draft',
  },
  builtin_consult: {
    enabled: true, trigger: 'consultationRecordSaved', sourceRecordType: 'consultationRecord',
    documentType: 'consultationRecord', requires: { recordSaved: true, b4AuditPassed: false }, createMode: 'draft',
  },
};

export function getAutoRules() {
  return { ...clone(DEFAULT_AUTO_RULES), ...readJson(AUTO_RULES_KEY, {}) };
}
export function getAutoRule(templateId) { return getAutoRules()[templateId] || null; }

// 관리자만 규칙 설정·활성/비활성 가능(일반 교사 차단)
export function setAutoRule(templateId, patch, user = getCurrentUser()) {
  if (!isMaster(user)) return { ok: false, error: '관리자만 자동 생성 규칙을 변경할 수 있습니다.' };
  if (patch?.trigger && !AUTO_TRIGGERS.includes(patch.trigger)) return { ok: false, error: '지원하지 않는 trigger입니다.' };
  const stored = readJson(AUTO_RULES_KEY, {});
  // DEFAULT_AUTO_RULES[templateId]가 없는 서식(내장 회의록·모든 커스텀 서식)도 연결할 수 있어야 하므로
  // clone(undefined)로 JSON.parse가 터지지 않도록 존재 여부를 먼저 확인한다.
  const base = stored[templateId] || (DEFAULT_AUTO_RULES[templateId] ? clone(DEFAULT_AUTO_RULES[templateId]) : null) || {
    enabled: false, trigger: AUTO_TRIGGERS[0], sourceRecordType: 'observationRecord',
    documentType: 'observationJournal', requires: { recordSaved: true, b4AuditPassed: true }, createMode: 'draft',
  };
  stored[templateId] = { ...base, ...patch };
  writeJson(AUTO_RULES_KEY, stored);
  return { ok: true, rule: stored[templateId] };
}

function templatesForTrigger(trigger) {
  const rules = getAutoRules();
  const templates = listRichTemplates(null); // 기본 서식 + 공개 서식
  return Object.entries(rules)
    .filter(([, rule]) => rule.enabled && rule.trigger === trigger)
    .map(([templateId, rule]) => ({ rule, template: templates.find((t) => t.templateId === templateId) }))
    .filter((x) => x.template);
}

// ── 인스턴스 저장소 ────────────────────────────────────────────────────────
export function getInstances(user) {
  const uid = user?.userId || currentUid();
  return readJson(getInstancesKey(uid), []);
}
export function getInstance(id, user) { return getInstances(user).find((x) => x.id === id) || null; }
export function findInstanceBySource(templateId, sourceRecordId, user) {
  return getInstances(user).find((x) => x.templateId === templateId && x.sourceRecordId === sourceRecordId) || null;
}
function writeInstances(list, user) {
  writeJson(getInstancesKey(user?.userId || currentUid()), list);
}
export function saveInstance(instance, user) {
  const list = getInstances(user);
  const item = { ...instance, updatedAt: nowIso() };
  writeInstances([item, ...list.filter((x) => x.id !== item.id)], user);
  return item;
}

// ── B4 audit 판정: 통과분만 자동 채움. fallback은 채우되 "확인 필요" 표시 ─────
export function auditStatusOf(record) {
  const audit = record?.copyReadyAudit;
  if (!record?.copyReady || !audit) return 'missing';
  if (audit.fallbackApplied || audit.severity === 'major') return 'fallback';
  return 'passed';
}

function parseCopySections(copyReady) {
  const t = String(copyReady || '');
  const grab = (label) => {
    const m = t.match(new RegExp(`\\[${label}\\]\\n([\\s\\S]*?)(\\n\\n\\[|$)`));
    return m ? m[1].trim() : '';
  };
  return { observation: grab('관찰내용'), learning: grab('배움 읽기'), support: grab('교사 지원 및 다음 계획') };
}

// 기록+맥락 → 자동 필드 값/상태. 근거가 없으면 억지로 채우지 않고 empty(내용 확인 필요)로 남긴다.
export function buildFieldPayload({ template, record = {}, sourceRecordType, context = {}, user }) {
  const child = getChildren().find((c) => c.id === record.childId || c.name === record.childName);
  const klass = getClasses()[0] || {};
  const b4Status = auditStatusOf(record);
  const sections = parseCopySections(record.copyReady);

  const raw = {
    childName: record.childName || child?.name || '',
    childAge: (child?.age || context.classAge || klass.age) ? `만 ${child?.age || context.classAge || klass.age}세` : '',
    className: context.className || klass.name || '',
    teacherName: user?.displayName || '',
    recordDate: record.date || today(),
    observation: sections.observation || record.observation || '',
    learningReading: sections.learning || '',
    supportAndNextPlan: sections.support || '',
    dailyRoutine: record.dailyRoutine || '',
    playEvaluation: record.playEvaluation || '',
    parentNotice: record.parent || '',
    consultContent: sourceRecordType === 'consultationRecord' ? (record.rawText || '') : (record.consultContent || ''),
    parentRequest: record.parentRequest || '',
    teacherMemo: '', weather: '', checklist: '',
  };

  const keys = [...new Set(collectFieldKeys(template.content))];
  const values = {};
  const states = {};
  keys.forEach((key) => {
    const def = FIELD_MAP[key] || { type: 'manual' };
    const value = raw[key] ?? '';
    const isB4 = def.type === 'b4';
    const mode = def.type === 'manual' ? 'manual' : 'auto';
    let status = 'filled';
    let source = def.type === 'b4' ? 'b4' : def.type === 'auto' ? 'record' : 'manual';
    if (mode === 'manual') { status = value ? 'filled' : 'empty'; }
    else if (!String(value).trim()) { status = 'empty'; }               // 근거 부족 → 채우지 않고 확인 필요
    else if (isB4 && b4Status !== 'passed') { status = 'needs_review'; } // fallback → 채우되 확인 필요 표시
    values[key] = value;
    states[key] = { fieldKey: key, mode, status, source, editedByTeacher: false, needsRefresh: false };
  });
  return { values, states, b4AuditStatus: b4Status };
}

function instanceTitle(template, record, values) {
  const who = values.childName || values.className || '';
  const date = (values.recordDate || today()).slice(0, 10);
  return [date, who, template.title].filter(Boolean).join(' · ');
}

// ── 서식 복제본 + 자동 채움으로 인스턴스 생성(idempotent) ────────────────────
export function createInstanceFromRecord({ templateId, record, sourceRecordType, rule, user = getCurrentUser(), context = {} }) {
  const existing = findInstanceBySource(templateId, record.id, user);
  if (existing) return { ok: true, existing: true, instance: existing }; // 중복 생성 방지
  const template = listRichTemplates(user, { includePrivate: isMaster(user) }).find((t) => t.templateId === templateId);
  if (!template) return { ok: false, error: '서식을 찾을 수 없습니다.' };

  const { values, states, b4AuditStatus } = buildFieldPayload({ template, record, sourceRecordType, context, user });
  const now = nowIso();
  const instance = {
    id: `inst_${genId()}`,
    templateId,
    templateTitle: template.title,
    sourceRecordId: record.id,
    sourceRecordType,
    documentType: rule?.documentType || 'document',
    status: rule?.createMode === 'final' ? 'final' : 'draft',
    autoCreated: true,
    title: instanceTitle(template, record, values),
    content: clone(template.content),        // 서식 복제 — 원본 불변
    fieldValues: values,
    fieldStates: states,
    sourceChanged: false,
    createdAt: now,
    updatedAt: now,
    ownerId: user?.userId || currentUid(),
    sourceSnapshot: { recordVersion: record.updatedAt || record.createdAt || 1, b4AuditStatus },
  };
  saveInstance(instance, user);
  return { ok: true, existing: false, instance };
}

// ── 기록 저장 훅 ───────────────────────────────────────────────────────────
const RECORD_TYPE_TRIGGER = { observe: 'observationRecordSaved', consult: 'consultationRecordSaved' };

export function onRecordSaved({ record, recordType, user = getCurrentUser(), context = {} } = {}) {
  const trigger = RECORD_TYPE_TRIGGER[recordType];
  if (!trigger || !record?.id) return { created: [], existing: [] };
  const out = { created: [], existing: [] };
  templatesForTrigger(trigger).forEach(({ rule, template }) => {
    const res = createInstanceFromRecord({
      templateId: template.templateId, record, rule, user, context,
      sourceRecordType: rule.sourceRecordType,
    });
    if (res.ok) (res.existing ? out.existing : out.created).push(res.instance);
  });
  return out;
}

// 하루 마감(일일 보육일지) — 같은 날짜 재마감 시에도 중복 생성 없음(sourceRecordId 고정)
export function onDailyJournalSaved({ date = today(), className = '', journalText = '', playEvaluation = '', user = getCurrentUser(), context = {} } = {}) {
  const record = {
    id: `daily_${date}`,
    date,
    dailyRoutine: journalText,
    playEvaluation,
    childName: '',
  };
  const out = { created: [], existing: [] };
  templatesForTrigger('dailyRecordSaved').forEach(({ rule, template }) => {
    const res = createInstanceFromRecord({
      templateId: template.templateId, record, rule, user,
      context: { ...context, className },
      sourceRecordType: 'dailyRecord',
    });
    if (res.ok) (res.existing ? out.existing : out.created).push(res.instance);
  });
  return out;
}

// ── 교사 수정·갱신 정책 ────────────────────────────────────────────────────
export function updateFieldValue(instanceId, fieldKey, value, user = getCurrentUser()) {
  const inst = getInstance(instanceId, user);
  if (!inst) return { ok: false, error: '문서를 찾을 수 없습니다.' };
  const state = inst.fieldStates[fieldKey] || { fieldKey, mode: 'manual', source: 'manual' };
  const next = {
    ...inst,
    fieldValues: { ...inst.fieldValues, [fieldKey]: value },
    fieldStates: {
      ...inst.fieldStates,
      [fieldKey]: { ...state, status: String(value).trim() ? 'filled' : 'empty', editedByTeacher: true, needsRefresh: false },
    },
  };
  return { ok: true, instance: saveInstance(next, user) };
}

// 원본 기록/B4 결과 변경 시: draft는 미수정 자동 필드에 needsRefresh 표시, final은 변경 사실만 표시
export function markSourceRecordChanged(sourceRecordId, user = getCurrentUser()) {
  const list = getInstances(user);
  let touched = 0;
  const next = list.map((inst) => {
    if (inst.sourceRecordId !== sourceRecordId) return inst;
    touched += 1;
    if (inst.status === 'final') return { ...inst, sourceChanged: true, updatedAt: nowIso() }; // 자동 갱신 금지
    const fieldStates = { ...inst.fieldStates };
    Object.keys(fieldStates).forEach((key) => {
      const s = fieldStates[key];
      if (s.mode === 'auto' && !s.editedByTeacher) fieldStates[key] = { ...s, needsRefresh: true };
    });
    return { ...inst, fieldStates, sourceChanged: true, updatedAt: nowIso() };
  });
  if (touched) writeInstances(next, user);
  return { ok: true, touched };
}

// "자동 값 다시 반영" — draft 전용, 교사가 수정한 필드는 절대 덮지 않는다(문서 통째 덮어쓰기 금지)
export function refreshAutoFields(instanceId, user = getCurrentUser()) {
  const inst = getInstance(instanceId, user);
  if (!inst) return { ok: false, error: '문서를 찾을 수 없습니다.' };
  if (inst.status === 'final') return { ok: false, error: '완료된 문서는 자동 갱신되지 않습니다. 새 초안을 만들어 주세요.' };
  const record = inst.sourceRecordType === 'dailyRecord'
    ? null // 하루 기록은 재마감 시 새 값이 오므로 여기서는 미지원
    : getRecords().find((r) => r.id === inst.sourceRecordId);
  if (!record) return { ok: false, error: '원본 기록을 찾을 수 없습니다.' };
  const template = { content: inst.content };
  const { values, states, b4AuditStatus } = buildFieldPayload({
    template, record, sourceRecordType: inst.sourceRecordType, user,
  });
  const fieldValues = { ...inst.fieldValues };
  const fieldStates = { ...inst.fieldStates };
  let refreshed = 0;
  Object.keys(fieldStates).forEach((key) => {
    const s = fieldStates[key];
    if (s.mode !== 'auto' || s.editedByTeacher) return; // 수정된 자동 필드는 보호
    fieldValues[key] = values[key];
    fieldStates[key] = { ...states[key], editedByTeacher: false, needsRefresh: false };
    refreshed += 1;
  });
  const next = saveInstance({
    ...inst, fieldValues, fieldStates, sourceChanged: false,
    sourceSnapshot: { ...inst.sourceSnapshot, recordVersion: record.updatedAt || record.createdAt || 1, b4AuditStatus },
  }, user);
  return { ok: true, refreshed, instance: next };
}

export function setInstanceStatus(instanceId, status, user = getCurrentUser()) {
  if (!['draft', 'final', 'archived'].includes(status)) return { ok: false, error: '지원하지 않는 상태입니다.' };
  const inst = getInstance(instanceId, user);
  if (!inst) return { ok: false, error: '문서를 찾을 수 없습니다.' };
  return { ok: true, instance: saveInstance({ ...inst, status }, user) };
}
export function deleteInstance(instanceId, user = getCurrentUser()) {
  writeInstances(getInstances(user).filter((x) => x.id !== instanceId), user);
  return { ok: true };
}

// ── 문서함 그룹 ────────────────────────────────────────────────────────────
export function instanceNeedsAttention(inst) {
  return Object.values(inst.fieldStates || {}).some((s) => s.status === 'needs_review' || s.needsRefresh)
    || inst.sourceChanged
    || inst.sourceSnapshot?.b4AuditStatus === 'fallback';
}

export function groupInstancesForInbox(user = getCurrentUser()) {
  const list = getInstances(user).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const t = today();
  const active = list.filter((x) => x.status !== 'archived');
  return {
    autoToday: active.filter((x) => x.autoCreated && String(x.createdAt).slice(0, 10) === t),
    needsReview: active.filter((x) => x.status !== 'final' && instanceNeedsAttention(x)),
    drafting: active.filter((x) => x.status === 'draft'),
    done: active.filter((x) => x.status === 'final'),
    manual: active.filter((x) => !x.autoCreated),
    archived: list.filter((x) => x.status === 'archived'),
  };
}
