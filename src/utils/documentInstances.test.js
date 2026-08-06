// 문서 인스턴스 자동 생성 — Template/Instance 분리·자동 채움·중복 방지·갱신 정책·권한·개인정보 회귀.
import {
  onRecordSaved, onDailyJournalSaved, createInstanceFromRecord, getInstances, getInstance,
  updateFieldValue, markSourceRecordChanged, refreshAutoFields, setInstanceStatus,
  groupInstancesForInbox, setAutoRule, getAutoRules, auditStatusOf, getInstancesKey,
} from './documentInstances';
import { BUILTIN_RICH_TEMPLATES, RICH_TEMPLATES_KEY, validateTemplatePrivacy, listRichTemplates } from './documentStudio';

const TEACHER = { userId: 't1', displayName: '김교사' };
const MASTER = { userId: 'master', role: 'master', displayName: '관리자' };
const asUser = (u) => localStorage.setItem('sw_session', JSON.stringify(u));

const RECORD = {
  id: 'rec_1', childId: 'c1', childName: '지우', date: '2026-07-08', recordType: 'observe',
  rawText: '지우가 "다시 할래"라며 무너진 블록 탑을 다시 쌓았다.',
  observation: '지우가 "다시 할래"라며 무너진 블록 탑을 다시 쌓았다.',
  support: '받침이 넓은 블록을 더해 준다.',
  copyReady: '[관찰내용]\n지우가 "다시 할래"라며 무너진 블록 탑을 다시 쌓았다.\n\n[배움 읽기]\n지우는 시도를 이어 가며 스스로 방법을 찾아가는 끈기를 보였다.\n\n[교사 지원 및 다음 계획]\n받침이 넓은 블록을 더해 시도가 이어지게 돕는다.',
  copyReadyAudit: { ok: true, severity: 'none', warnings: [], fallbackApplied: false },
  createdAt: '2026-07-08T09:00:00.000Z',
};

function seed(user = TEACHER) {
  localStorage.clear();
  asUser(user);
  const uid = user.userId;
  localStorage.setItem(`sw_${uid}_records`, JSON.stringify([RECORD]));
  localStorage.setItem(`sw_${uid}_children`, JSON.stringify([{ id: 'c1', name: '지우', age: '4' }]));
  localStorage.setItem(`sw_${uid}_classes`, JSON.stringify([{ id: 'k1', name: '검증반', age: '4' }]));
}

beforeEach(() => seed());

describe('기록 저장 → 문서 초안 자동 생성', () => {
  test('관찰 기록 저장 시 관찰일지 초안이 자동 생성된다(B4 통과 값 채움)', () => {
    const out = onRecordSaved({ record: RECORD, recordType: 'observe', user: TEACHER, context: { className: '검증반', classAge: '4' } });
    expect(out.created).toHaveLength(1);
    const inst = out.created[0];
    expect(inst.templateId).toBe('builtin_observation');
    expect(inst.documentType).toBe('observationJournal');
    expect(inst.status).toBe('draft');
    expect(inst.sourceRecordId).toBe('rec_1');
    expect(inst.fieldValues.childName).toBe('지우');
    expect(inst.fieldValues.observation).toContain('"다시 할래"');       // 발화 보존
    expect(inst.fieldValues.learningReading).toContain('끈기');          // B4 결과 자동 채움
    expect(inst.fieldStates.observation).toMatchObject({ mode: 'auto', status: 'filled', source: 'b4', editedByTeacher: false, needsRefresh: false });
    expect(inst.sourceSnapshot.b4AuditStatus).toBe('passed');
  });

  test('상담 기록 저장 시 부모 상담 기록 초안이 생성된다(상담 내용=원문)', () => {
    const consult = { ...RECORD, id: 'rec_c1', recordType: 'consult', rawText: '어머니와 등원 적응에 대해 이야기 나눔.' };
    const out = onRecordSaved({ record: consult, recordType: 'consult', user: TEACHER });
    expect(out.created).toHaveLength(1);
    expect(out.created[0].templateId).toBe('builtin_consult');
    expect(out.created[0].fieldValues.consultContent).toContain('등원 적응');
  });

  test('하루 기록 저장 시 일일 보육일지 초안이 생성되고, 같은 날짜 재마감은 중복 없음', () => {
    const first = onDailyJournalSaved({ date: '2026-07-08', className: '검증반', journalText: '오전 실내놀이\n블록·역할놀이 진행', playEvaluation: '놀이 흐름이 안정적이었음', user: TEACHER });
    expect(first.created).toHaveLength(1);
    expect(first.created[0].templateId).toBe('builtin_daily');
    expect(first.created[0].fieldValues.dailyRoutine).toContain('실내놀이');
    const again = onDailyJournalSaved({ date: '2026-07-08', className: '검증반', journalText: '다른 내용', user: TEACHER });
    expect(again.created).toHaveLength(0);
    expect(again.existing).toHaveLength(1);                              // 기존 초안 반환
  });

  test('같은 기록을 반복 저장해도 중복 문서가 생기지 않는다(idempotent)', () => {
    onRecordSaved({ record: RECORD, recordType: 'observe', user: TEACHER });
    const second = onRecordSaved({ record: RECORD, recordType: 'observe', user: TEACHER });
    expect(second.created).toHaveLength(0);
    expect(second.existing).toHaveLength(1);
    expect(getInstances(TEACHER).filter((x) => x.sourceRecordId === 'rec_1')).toHaveLength(1);
  });
});

describe('B4 audit·근거 부족 처리', () => {
  test('fallback 상태면 값은 채우되 "확인 필요"로 표시된다', () => {
    const rec = { ...RECORD, id: 'rec_fb', copyReadyAudit: { ok: false, severity: 'minor', warnings: [], fallbackApplied: true } };
    const { instance } = createInstanceFromRecord({ templateId: 'builtin_observation', record: rec, sourceRecordType: 'observationRecord', user: TEACHER });
    expect(auditStatusOf(rec)).toBe('fallback');
    expect(instance.fieldStates.learningReading.status).toBe('needs_review');
    expect(instance.sourceSnapshot.b4AuditStatus).toBe('fallback');
  });

  test('근거가 없으면 억지로 채우지 않고 "내용 확인 필요(empty)"로 남긴다', () => {
    const rec = { id: 'rec_sparse', childName: '지우', date: '2026-07-08' }; // copyReady 없음
    const { instance } = createInstanceFromRecord({ templateId: 'builtin_observation', record: rec, sourceRecordType: 'observationRecord', user: TEACHER });
    expect(instance.sourceSnapshot.b4AuditStatus).toBe('missing');
    expect(instance.fieldValues.learningReading).toBe('');
    expect(instance.fieldStates.learningReading.status).toBe('empty');
  });
});

describe('갱신 정책 — 필드별 보호', () => {
  const create = () => onRecordSaved({ record: RECORD, recordType: 'observe', user: TEACHER }).created[0];

  test('교사가 수정한 필드는 자동 갱신으로 덮어써지지 않는다', () => {
    const inst = create();
    updateFieldValue(inst.id, 'learningReading', '교사가 직접 다듬은 배움 읽기.', TEACHER);
    // 원본 기록 변경 → 미수정 자동 필드만 갱신 대상 표시
    markSourceRecordChanged('rec_1', TEACHER);
    let now = getInstance(inst.id, TEACHER);
    expect(now.fieldStates.learningReading.editedByTeacher).toBe(true);
    expect(now.fieldStates.learningReading.needsRefresh).toBe(false);    // 수정 필드 보호
    expect(now.fieldStates.observation.needsRefresh).toBe(true);         // 미수정 자동 필드만
    expect(now.sourceChanged).toBe(true);
    // 기록이 실제로 바뀐 상태에서 "자동 값 다시 반영"
    const updated = { ...RECORD, observation: '지우가 블록을 더 높이 쌓아 올렸다.', copyReady: RECORD.copyReady.replace('무너진 블록 탑을 다시 쌓았다', '블록을 더 높이 쌓아 올렸다') };
    localStorage.setItem('sw_t1_records', JSON.stringify([updated]));
    const r = refreshAutoFields(inst.id, TEACHER);
    expect(r.ok).toBe(true);
    now = getInstance(inst.id, TEACHER);
    expect(now.fieldValues.learningReading).toBe('교사가 직접 다듬은 배움 읽기.'); // 그대로 보호
    expect(now.fieldValues.observation).toContain('더 높이 쌓아');                 // 미수정 필드만 갱신
    expect(now.fieldStates.observation.needsRefresh).toBe(false);
    expect(now.sourceChanged).toBe(false);
  });

  test('완료(final) 문서는 자동 갱신이 금지되고 변경 사실만 표시된다', () => {
    const inst = create();
    setInstanceStatus(inst.id, 'final', TEACHER);
    markSourceRecordChanged('rec_1', TEACHER);
    const now = getInstance(inst.id, TEACHER);
    expect(now.sourceChanged).toBe(true);
    expect(now.fieldStates.observation.needsRefresh).toBe(false);        // final은 필드 표시도 없음
    expect(refreshAutoFields(inst.id, TEACHER).ok).toBe(false);          // 명시적 갱신도 금지
  });
});

describe('Template/Instance 분리·개인정보', () => {
  test('인스턴스를 만들어도 Template 저장소·원본에 실제 값이 저장되지 않는다', () => {
    const before = JSON.stringify(BUILTIN_RICH_TEMPLATES.find((t) => t.templateId === 'builtin_observation'));
    onRecordSaved({ record: RECORD, recordType: 'observe', user: TEACHER });
    // 커스텀 서식 저장소에 실제 기록 값 없음
    expect(String(localStorage.getItem(RICH_TEMPLATES_KEY) || '')).not.toContain('다시 할래');
    // 내장 서식 원본 불변
    const after = JSON.stringify(BUILTIN_RICH_TEMPLATES.find((t) => t.templateId === 'builtin_observation'));
    expect(after).toBe(before);
    // 서식 개인정보 검증 통과(실기록이 저장소에 있는 상태에서)
    const tpl = listRichTemplates(TEACHER).find((t) => t.templateId === 'builtin_observation');
    expect(validateTemplatePrivacy(tpl.content).ok).toBe(true);
    // 인스턴스에는 실제 값이 저장됨(허용)
    const raw = localStorage.getItem(getInstancesKey('t1'));
    expect(raw).toContain('다시 할래');
  });

  test('인스턴스 내용을 수정해도 Template 원본은 변하지 않는다(복제 분리)', () => {
    const inst = onRecordSaved({ record: RECORD, recordType: 'observe', user: TEACHER }).created[0];
    inst.content.content.push({ type: 'paragraph', content: [{ type: 'text', text: '교사 추가 문단' }] });
    const tpl = listRichTemplates(TEACHER).find((t) => t.templateId === 'builtin_observation');
    expect(JSON.stringify(tpl.content)).not.toContain('교사 추가 문단');
  });
});

describe('권한', () => {
  test('일반 교사는 자동 생성 규칙을 수정할 수 없고 관리자는 가능하다', () => {
    expect(setAutoRule('builtin_observation', { enabled: false }, TEACHER).ok).toBe(false);
    expect(getAutoRules().builtin_observation.enabled).toBe(true);       // 변경 안 됨
    seed(MASTER);
    expect(setAutoRule('builtin_observation', { enabled: false }, MASTER).ok).toBe(true);
    expect(getAutoRules().builtin_observation.enabled).toBe(false);
    // 비활성 규칙은 문서를 만들지 않음
    const out = onRecordSaved({ record: RECORD, recordType: 'observe', user: MASTER });
    expect(out.created).toHaveLength(0);
  });

  // 회귀: DEFAULT_AUTO_RULES에 항목이 없는 서식(내장 회의록, 관리자가 새로 만든 모든 커스텀 서식)을
  // 연결하면 clone(undefined) → JSON.parse(undefined)에서 죽던 버그. 문서 작성실에서 "자동 생성 켜기"를
  // 누르면 이 경로를 그대로 탄다.
  test('기본 규칙이 없는 서식(예: 교사 회의록)도 자동 생성에 새로 연결할 수 있다', () => {
    seed(MASTER);
    expect(getAutoRules().builtin_meeting).toBeUndefined();
    const r = setAutoRule('builtin_meeting', {
      enabled: true, trigger: 'observationRecordSaved', sourceRecordType: 'observationRecord',
      documentType: 'observationJournal', requires: { recordSaved: true, b4AuditPassed: false }, createMode: 'draft',
    }, MASTER);
    expect(r.ok).toBe(true);
    expect(getAutoRules().builtin_meeting).toMatchObject({ enabled: true, trigger: 'observationRecordSaved' });
  });
});

describe('문서함 그룹', () => {
  test('오늘 자동 생성/작성 중/완료/확인 필요/보관 구분이 동작한다', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const rec = { ...RECORD, id: 'rec_today', date: todayStr };
    localStorage.setItem('sw_t1_records', JSON.stringify([rec]));
    const inst = onRecordSaved({ record: rec, recordType: 'observe', user: TEACHER }).created[0];
    let box = groupInstancesForInbox(TEACHER);
    expect(box.autoToday.map((x) => x.id)).toContain(inst.id);
    expect(box.drafting.map((x) => x.id)).toContain(inst.id);
    markSourceRecordChanged('rec_today', TEACHER);
    box = groupInstancesForInbox(TEACHER);
    expect(box.needsReview.map((x) => x.id)).toContain(inst.id);         // 확인 필요
    setInstanceStatus(inst.id, 'final', TEACHER);
    box = groupInstancesForInbox(TEACHER);
    expect(box.done.map((x) => x.id)).toContain(inst.id);
    setInstanceStatus(inst.id, 'archived', TEACHER);
    box = groupInstancesForInbox(TEACHER);
    expect(box.archived.map((x) => x.id)).toContain(inst.id);
    expect(box.drafting.map((x) => x.id)).not.toContain(inst.id);
  });
});
