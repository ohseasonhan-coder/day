// 문서 서식 관리(5.5단계 MVP) — 관리자 전용 블록 서식 + 공통 필드 사전 + 교사용 렌더링.
//
// 원칙:
//  - 생성·수정·삭제·복제·공개 전환은 관리자(isMaster)만 — UI 숨김이 아니라 저장 함수에서 권한 검사.
//  - 서식 정의는 일반 기록 데이터와 분리된 기기 공용 키(sw_shared_doc_forms)에 저장(백업·동기화 제외).
//  - 서식 정의에 원아 이름·관찰 원문·AI 생성 전문·교사 피드백 전문을 저장하지 않는다.
//  - 작성 문서는 "인스턴스"로만 만들며(renderInstance), 원본 서식을 절대 변경하지 않는다.
//  - 삭제 대신 보관(archived) 우선. 공개(published)된 서식만 일반 교사에게 보인다.
import { getCurrentUser, isMaster } from './auth';
import { generateObservationWithEngine } from './ai/llm/engineAdapter';
import { parseTargetSections } from './ai/targetQuality';

export const DOC_FORMS_KEY = 'sw_shared_doc_forms'; // 계정 키(sw_${uid}_*) 패턴과 충돌하지 않는 공용 키

// ── 공통 필드 사전 ─────────────────────────────────────────────────────────
// valueType: auto(자동 입력) | manual(직접 입력) | ai(AI 생성)
// engine: rule | private-server-7b | manual | none
export const FIELD_DICTIONARY = {
  // 기본 정보(자동)
  childName:   { label: '원아명',       valueType: 'auto',   docTypes: ['observation', 'notice', 'daily'], required: true,  placeholder: '', pii: true,  engine: 'none' },
  childAge:    { label: '연령',         valueType: 'auto',   docTypes: ['observation', 'notice', 'daily'], required: false, placeholder: '', pii: false, engine: 'none' },
  className:   { label: '반 이름',      valueType: 'auto',   docTypes: ['observation', 'notice', 'daily'], required: false, placeholder: '', pii: false, engine: 'none' },
  teacherName: { label: '교사명',       valueType: 'auto',   docTypes: ['observation', 'notice', 'daily'], required: false, placeholder: '', pii: true,  engine: 'none' },
  recordDate:  { label: '관찰일',       valueType: 'auto',   docTypes: ['observation', 'notice', 'daily'], required: true,  placeholder: '', pii: false, engine: 'none' },
  weather:     { label: '날씨',         valueType: 'manual', docTypes: ['daily'],                          required: false, placeholder: '예: 맑음', pii: false, engine: 'manual' },
  // 기록 생성(AI/규칙)
  observation:        { label: '관찰내용',           valueType: 'ai', docTypes: ['observation'], required: true,  placeholder: '', pii: true, engine: 'rule' },              // 사실 보존 — 7B가 덮어쓰지 않음
  learningReading:    { label: '배움 읽기',          valueType: 'ai', docTypes: ['observation'], required: false, placeholder: '', pii: true, engine: 'private-server-7b' }, // audit 통과분만, 실패 시 규칙 B안
  supportAndNextPlan: { label: '교사 지원 및 다음 계획', valueType: 'ai', docTypes: ['observation'], required: false, placeholder: '', pii: true, engine: 'private-server-7b' },
  dailyRoutine:   { label: '하루 일과',   valueType: 'manual', docTypes: ['daily'],  required: false, placeholder: '준비 중 — 직접 입력', pii: true, engine: 'manual' }, // 사전 등록만(기존 엔진 연결은 다음 단계)
  playEvaluation: { label: '놀이 평가',   valueType: 'manual', docTypes: ['daily'],  required: false, placeholder: '준비 중 — 직접 입력', pii: true, engine: 'manual' },
  parentNotice:   { label: '알림장',      valueType: 'manual', docTypes: ['notice'], required: false, placeholder: '준비 중 — 직접 입력', pii: true, engine: 'manual' },
  // 직접 입력
  teacherMemo:   { label: '교사 메모',    valueType: 'manual', docTypes: ['observation', 'notice', 'daily'], required: false, placeholder: '필요 시 직접 입력', pii: true, engine: 'manual' },
  parentRequest: { label: '가정 요청사항', valueType: 'manual', docTypes: ['notice', 'daily'],                required: false, placeholder: '필요 시 직접 입력', pii: true, engine: 'manual' },
  checklist:     { label: '체크리스트',   valueType: 'manual', docTypes: ['observation', 'notice', 'daily'], required: false, placeholder: '항목을 직접 입력', pii: false, engine: 'manual' },
};
export const FIELD_KEYS = Object.keys(FIELD_DICTIONARY);

// ── 저장/조회(권한 검사 포함) ──────────────────────────────────────────────
const readAll = () => { try { return JSON.parse(localStorage.getItem(DOC_FORMS_KEY)) || []; } catch { return []; } };
const writeAll = (list) => { try { localStorage.setItem(DOC_FORMS_KEY, JSON.stringify(list)); } catch {} };
const denied = () => ({ ok: false, error: '관리자만 사용할 수 있어요.' });
const canAdmin = (user) => isMaster(user || getCurrentUser());

// 서식에서 {{tag}} 추출
export function extractTags(template) {
  const texts = [];
  (template.blocks || []).forEach((b) => {
    if (b.type === 'paragraph' || b.type === 'notice' || b.type === 'checkbox') texts.push(b.text || '');
    if (b.type === 'field') texts.push(`{{${b.fieldKey || ''}}}`);
    if (b.type === 'table') (b.rows || []).forEach((row) => row.forEach((cell) => texts.push(cell.fieldKey ? `{{${cell.fieldKey}}}` : (cell.text || ''))));
  });
  return Array.from(new Set(texts.join('\n').match(/\{\{([a-zA-Z]+)\}\}/g) || [])).map((t) => t.slice(2, -2));
}

// 정의되지 않은 태그 검사 — 저장 차단용
export function validateTemplate(template) {
  const errors = [];
  if (!String(template.title || '').trim()) errors.push('서식 제목이 필요해요.');
  if (!(template.blocks || []).length) errors.push('블록이 최소 1개 필요해요.');
  const unknown = extractTags(template).filter((k) => !FIELD_DICTIONARY[k]);
  if (unknown.length) errors.push(`정의되지 않은 필드 태그: ${unknown.map((k) => `{{${k}}}`).join(', ')}`);
  return { ok: errors.length === 0, errors };
}

// 관리자: 저장(신규/수정). 초안(draft)도 저장 가능하지만 공개 전엔 교사에게 안 보임.
export function saveTemplate(template, user) {
  if (!canAdmin(user)) return denied();
  const v = validateTemplate(template);
  if (!v.ok) return { ok: false, error: v.errors.join(' / ') };
  const list = readAll();
  const now = new Date().toISOString();
  const uid = (user || getCurrentUser())?.userId || 'master';
  if (template.templateId) {
    const i = list.findIndex((t) => t.templateId === template.templateId);
    if (i < 0) return { ok: false, error: '서식을 찾을 수 없어요.' };
    list[i] = { ...list[i], ...template, updatedAt: now, version: (list[i].version || 1) + 1 };
    writeAll(list);
    return { ok: true, template: list[i] };
  }
  const t = {
    templateId: `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: '', description: '', documentType: 'observation', blocks: [], fieldMappings: {},
    published: false, archived: false, createdBy: uid, createdAt: now, updatedAt: now, version: 1,
    ...template,
  };
  writeAll([t, ...list]);
  return { ok: true, template: t };
}

export function duplicateTemplate(templateId, user) {
  if (!canAdmin(user)) return denied();
  const src = readAll().find((t) => t.templateId === templateId);
  if (!src) return { ok: false, error: '서식을 찾을 수 없어요.' };
  return saveTemplate({ ...src, templateId: undefined, title: `${src.title} (복제)`, published: false, version: 1 }, user);
}

export function setTemplatePublished(templateId, published, user) {
  if (!canAdmin(user)) return denied();
  const list = readAll();
  const i = list.findIndex((t) => t.templateId === templateId);
  if (i < 0) return { ok: false, error: '서식을 찾을 수 없어요.' };
  list[i] = { ...list[i], published: !!published, updatedAt: new Date().toISOString() };
  writeAll(list);
  return { ok: true, template: list[i] };
}

// 삭제 대신 보관 우선. hard=true는 보관된 서식만 완전 삭제.
export function archiveTemplate(templateId, user) {
  if (!canAdmin(user)) return denied();
  const list = readAll();
  const i = list.findIndex((t) => t.templateId === templateId);
  if (i < 0) return { ok: false, error: '서식을 찾을 수 없어요.' };
  list[i] = { ...list[i], archived: true, published: false, updatedAt: new Date().toISOString() };
  writeAll(list);
  return { ok: true };
}
export function deleteTemplate(templateId, user) {
  if (!canAdmin(user)) return denied();
  const list = readAll();
  const t = list.find((x) => x.templateId === templateId);
  if (!t) return { ok: false, error: '서식을 찾을 수 없어요.' };
  if (!t.archived) return { ok: false, error: '먼저 보관 처리한 뒤 삭제할 수 있어요.' };
  writeAll(list.filter((x) => x.templateId !== templateId));
  return { ok: true };
}

// 관리자: 전체 목록(초안·비공개·보관 포함) / 교사: 공개본만
export function listTemplatesForAdmin(user) {
  if (!canAdmin(user)) return [];
  return readAll();
}
export function listPublishedTemplates() {
  return readAll().filter((t) => t.published && !t.archived);
}

// ── 렌더링(인스턴스) — 원본 서식 불변 ─────────────────────────────────────
// values: { fieldKey: string } — 채워진 값. 미입력 필드는 안내 문구/빈칸 처리.
const fieldText = (key, values) => {
  const def = FIELD_DICTIONARY[key];
  const v = values[key];
  if (v != null && String(v).trim()) return String(v).trim();
  if (!def) return `{{${key}}}`;
  return def.placeholder || `(${def.label} — 직접 입력 필요)`;
};
const fillText = (text, values) => String(text || '').replace(/\{\{([a-zA-Z]+)\}\}/g, (_, k) => fieldText(k, values));

// 서식 + 값 → 문서 인스턴스(복사용 텍스트 포함). 원본은 절대 수정하지 않는다.
export function renderInstance(template, values = {}) {
  const lines = [];
  (template.blocks || []).forEach((b) => {
    if (b.type === 'paragraph') lines.push(fillText(b.text, values));
    else if (b.type === 'notice') lines.push(`※ ${fillText(b.text, values)}`);
    else if (b.type === 'checkbox') lines.push(`☐ ${fillText(b.text, values)}`);
    else if (b.type === 'linebreak') lines.push('');
    else if (b.type === 'field') lines.push(`[${FIELD_DICTIONARY[b.fieldKey]?.label || b.fieldKey}]\n${fieldText(b.fieldKey, values)}`);
    else if (b.type === 'table') {
      (b.rows || []).forEach((row) => {
        const cells = row.map((cell) => (cell.fieldKey ? fieldText(cell.fieldKey, values) : fillText(cell.text, values)));
        lines.push(cells.join(' : '));
      });
    }
  });
  return {
    instanceId: `doc_${Date.now().toString(36)}`,
    templateId: template.templateId,
    templateVersion: template.version,
    createdAt: new Date().toISOString(),
    text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}

// ── 자동 입력 필드 채우기 ─────────────────────────────────────────────────
export function buildAutoValues({ childName = '', childAge = '', className = '', teacherName = '', recordDate = '' } = {}) {
  return {
    childName, childAge: childAge ? `만 ${childAge}세` : '', className, teacherName,
    recordDate: recordDate || new Date().toISOString().slice(0, 10),
  };
}

// ── AI 생성 필드 채우기 — 필드별 생성 경로 분리 ────────────────────────────
//  observation        : 사실 보존 규칙 엔진 결과만(7B가 새로 쓰거나 덮어쓰지 않음)
//  learningReading    : 규칙 B안 또는 private-server-7b C안 — audit 통과분만, 실패·미연결 시 B안
//  supportAndNextPlan : 위와 동일. 입력에 없는 지원을 과거형으로 단정하지 않음(audit이 차단)
//  manualValues에 이미 값이 있는 필드(직접 입력)는 절대 덮어쓰지 않는다.
// 반환: { values, engineUsed, fallbackReason? } — 프롬프트·전문 출력은 저장하지 않음.
export async function generateAIFieldValues({
  input = '', childName = '', ruleObservation = '', ruleSupport = '',
  engine = 'rule-b2', manualValues = {}, adapter = null,
} = {}) {
  const r = await generateObservationWithEngine({
    input, childName, observation: ruleObservation, support: ruleSupport, engine, adapter,
  });
  const sections = parseTargetSections(r.copyReady); // C안 통과 시 LLM, 아니면 규칙 B안 섹션
  const values = {};
  const put = (key, v) => { if (manualValues[key] == null || !String(manualValues[key]).trim()) values[key] = v; };
  put('observation', ruleObservation);            // 항상 규칙 결과(엔진 결과와 무관)
  put('learningReading', sections.learning || '');
  put('supportAndNextPlan', sections.support || '');
  return { values: { ...values, ...manualValues }, engineUsed: r.engineUsed, fallbackReason: r.fallbackReason };
}
