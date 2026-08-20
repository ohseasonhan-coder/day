// 5.5단계 회귀 — 관리자 전용 문서 서식 관리(권한·필드 사전·렌더링·AI 필드 경로·fallback).
import {
  DOC_FORMS_KEY, FIELD_DICTIONARY, validateTemplate, saveTemplate, duplicateTemplate,
  setTemplatePublished, archiveTemplate, deleteTemplate, listTemplatesForAdmin, listPublishedTemplates,
  renderInstance, buildAutoValues, generateAIFieldValues, extractTags, convertBlocksToTiptapContent,
} from './docTemplates';
import { createMockAdapter } from './ai/llm/mockLLM';
import { __resetAutoDetect } from './ai/llm/privateServerLLM';
import { SYNC_EXCLUDED_KEYS } from './storage';
import { saveCustomField } from './customFields';

const MASTER = { userId: 'master', role: 'master' };
const TEACHER = { userId: 't1', displayName: '김교사' };
const asUser = (u) => localStorage.setItem('sw_session', JSON.stringify(u));

const TPL = {
  title: '관찰일지 기본형', description: '표 기반', documentType: 'observation',
  blocks: [
    { id: 'b1', type: 'paragraph', text: '[문서 제목] 관찰일지' },
    { id: 'b2', type: 'table', cols: 2, rows: [
      [{ text: '원아명' }, { fieldKey: 'childName' }],
      [{ text: '관찰일' }, { fieldKey: 'recordDate' }],
      [{ text: '관찰내용' }, { fieldKey: 'observation' }],
      [{ text: '배움 읽기' }, { fieldKey: 'learningReading' }],
      [{ text: '지원 계획' }, { fieldKey: 'supportAndNextPlan' }],
    ] },
    { id: 'b3', type: 'checkbox', text: '가정 공유 완료' },
    { id: 'b4', type: 'field', fieldKey: 'teacherMemo' },
  ],
};
const INPUT = '지우가 "다시 할래"라며 무너진 블록 탑을 다시 차근차근 쌓았다.';
const GOOD_JSON = JSON.stringify({
  learningTheme: 'retry',
  learningReading: '원아 A는 탑이 무너진 뒤에도 다시 시도하며 방법을 이어 갔다.',
  supportAction: 'retry_material',
  supportAndNextPlan: '비슷한 시도를 이어 갈 수 있도록 크기와 형태가 다른 재료를 곁에 마련한다.',
});

beforeEach(() => localStorage.clear());

describe('관리자 권한 — 생성·복제·공개·보관(저장 계층에서 검사)', () => {
  test('관리자는 생성→공개→비공개→복제→보관→완전삭제 가능', () => {
    asUser(MASTER);
    const r = saveTemplate(TPL, MASTER);
    expect(r.ok).toBe(true);
    const id = r.template.templateId;
    expect(setTemplatePublished(id, true, MASTER).ok).toBe(true);
    expect(listPublishedTemplates()).toHaveLength(1);
    expect(setTemplatePublished(id, false, MASTER).ok).toBe(true);
    const dup = duplicateTemplate(id, MASTER);
    expect(dup.ok).toBe(true);
    expect(dup.template.title).toContain('복제');
    expect(deleteTemplate(id, MASTER).ok).toBe(false);       // 보관 전 완전삭제 금지
    expect(archiveTemplate(id, MASTER).ok).toBe(true);       // 보관 우선
    expect(deleteTemplate(id, MASTER).ok).toBe(true);        // 보관 후 삭제 가능
  });

  test('일반 교사는 저장·수정·삭제·공개·목록 접근 모두 차단', () => {
    asUser(MASTER);
    const { template } = saveTemplate(TPL, MASTER);
    asUser(TEACHER);
    expect(saveTemplate(TPL, TEACHER).ok).toBe(false);
    expect(setTemplatePublished(template.templateId, true, TEACHER).ok).toBe(false);
    expect(archiveTemplate(template.templateId, TEACHER).ok).toBe(false);
    expect(duplicateTemplate(template.templateId, TEACHER).ok).toBe(false);
    expect(listTemplatesForAdmin(TEACHER)).toEqual([]);      // 편집 화면 데이터 자체가 안 보임
  });

  test('비공개·보관 서식은 교사 목록에 나타나지 않음', () => {
    asUser(MASTER);
    const a = saveTemplate({ ...TPL, title: '초안' }, MASTER).template;           // 비공개(초안)
    const b = saveTemplate({ ...TPL, title: '공개본' }, MASTER).template;
    setTemplatePublished(b.templateId, true, MASTER);
    const c = saveTemplate({ ...TPL, title: '보관될 것' }, MASTER).template;
    setTemplatePublished(c.templateId, true, MASTER);
    archiveTemplate(c.templateId, MASTER);                                        // 보관 시 공개 해제
    const visible = listPublishedTemplates().map((t) => t.title);
    expect(visible).toEqual(['공개본']);
    expect(visible).not.toContain(a.title);
  });
});

describe('필드 사전과 태그 검증', () => {
  test('정의되지 않은 태그는 저장이 막힘', () => {
    asUser(MASTER);
    const bad = { ...TPL, blocks: [...TPL.blocks, { id: 'x', type: 'paragraph', text: '이상 태그 {{unknownField}}' }] };
    const v = validateTemplate(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('unknownField');
    expect(saveTemplate(bad, MASTER).ok).toBe(false);
  });
  test('필드 사전에 요구 속성이 정의됨', () => {
    ['childName', 'observation', 'learningReading', 'supportAndNextPlan', 'teacherMemo', 'checklist'].forEach((k) => {
      const d = FIELD_DICTIONARY[k];
      expect(d.label).toBeTruthy();
      expect(['auto', 'manual', 'ai']).toContain(d.valueType);
      expect(Array.isArray(d.docTypes)).toBe(true);
      expect(typeof d.pii).toBe('boolean');
      expect(['rule', 'private-server-7b', 'manual', 'none']).toContain(d.engine);
    });
    expect(FIELD_DICTIONARY.observation.engine).toBe('rule'); // 관찰내용은 규칙 엔진 고정
    expect(extractTags(TPL).sort()).toEqual(['childName', 'learningReading', 'observation', 'recordDate', 'supportAndNextPlan', 'teacherMemo'].sort());
  });
});

describe('렌더링 — 인스턴스 분리·자동 매핑·미입력 표시', () => {
  test('자동 입력 필드가 올바르게 매핑되고 원본 서식은 불변', () => {
    const auto = buildAutoValues({ childName: '지우', childAge: '4', className: '검증반', recordDate: '2026-07-03' });
    const before = JSON.stringify(TPL);
    const inst = renderInstance(TPL, { ...auto, observation: '관찰문장.', learningReading: '배움문장.', supportAndNextPlan: '지원문장.' });
    expect(JSON.stringify(TPL)).toBe(before);                 // 원본 불변
    expect(inst.templateVersion).toBe(TPL.version);
    expect(inst.text).toContain('원아명 : 지우');
    expect(inst.text).toContain('관찰일 : 2026-07-03');
    expect(inst.text).toContain('배움 읽기 : 배움문장.');
    expect(inst.text).toContain('☐ 가정 공유 완료');
  });
  test('미입력 필드는 안내 문구로 명확히 표시(빈 문서 아님)', () => {
    const inst = renderInstance(TPL, {});
    expect(inst.text).toContain('직접 입력');                  // teacherMemo 등 안내 문구
    expect(inst.text.length).toBeGreaterThan(30);
  });
});

describe('AI 생성 필드 경로 — 규칙/7B 분리·audit·fallback', () => {
  const base = { input: INPUT, childName: '지우', ruleObservation: INPUT, ruleSupport: '블록을 더 제공한다.' };

  test('7B 정상 응답: audit 통과분만 learningReading/support에 삽입, observation은 규칙 고정', async () => {
    const r = await generateAIFieldValues({ ...base, engine: 'private-server-7b', adapter: createMockAdapter({ response: GOOD_JSON }) });
    expect(r.engineUsed).toBe('private-server-7b');
    expect(r.values.observation).toBe(INPUT);                 // 7B가 관찰내용을 덮어쓰지 않음
    expect(r.values.learningReading).toContain('다시 시도');
    expect(r.values.supportAndNextPlan).toContain('재료');
  });

  test('7B가 사실 추가(또래) 시 audit 차단 → B안 값이 필드에 들어감', async () => {
    const bad = JSON.stringify({ ...JSON.parse(GOOD_JSON), learningReading: '원아 A는 친구와 협력하며 다시 시도했다.' });
    const r = await generateAIFieldValues({ ...base, engine: 'private-server-7b', adapter: createMockAdapter({ response: bad }) });
    expect(r.engineUsed).toBe('rule-b2');
    expect(r.fallbackReason).toMatch(/new_concrete_fact|fact_addition_peer/);
    expect(r.values.learningReading).toMatch(/방법|시도/);     // B2 배움 읽기
  });

  test('7B 서버 미설정/오류 → B안 fallback이 문서 필드에 들어감', async () => {
    // 자동 감지가 개발 PC의 실서버를 찾지 않도록 네트워크를 차단(오류 경로 검증)
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('refused'));
    __resetAutoDetect();
    try {
      const r = await generateAIFieldValues({ ...base, engine: 'private-server-7b' }); // 실제 어댑터, 서버 없음
      expect(r.engineUsed).toBe('rule-b2');
      expect(r.values.learningReading).toBeTruthy();
      expect(r.values.observation).toBe(INPUT);
    } finally {
      global.fetch = originalFetch;
      __resetAutoDetect();
    }
  });

  test('직접 입력 필드는 AI가 덮어쓰지 않음', async () => {
    const r = await generateAIFieldValues({ ...base, engine: 'private-server-7b', adapter: createMockAdapter({ response: GOOD_JSON }), manualValues: { learningReading: '교사가 직접 쓴 배움 읽기.' } });
    expect(r.values.learningReading).toBe('교사가 직접 쓴 배움 읽기.');
  });
});

describe('저장 분리', () => {
  test('서식 키는 일반 기록·계정 키와 분리되고 동기화 제외 목록에 있음', () => {
    asUser(MASTER);
    saveTemplate(TPL, MASTER);
    expect(localStorage.getItem(DOC_FORMS_KEY)).toBeTruthy();
    expect(localStorage.getItem('sw_master_records')).toBeNull(); // 기록 키 미사용
    expect(DOC_FORMS_KEY.startsWith('sw_shared_')).toBe(true);
    expect(SYNC_EXCLUDED_KEYS).toEqual(expect.arrayContaining([DOC_FORMS_KEY, 'sw_admin_llm_server_url', 'sw_admin_llm_server_model']));
  });
  test('서식 정의에 원아 기록·생성 전문이 저장되지 않음(필드 자리만)', () => {
    asUser(MASTER);
    saveTemplate(TPL, MASTER);
    const raw = localStorage.getItem(DOC_FORMS_KEY);
    expect(raw).not.toContain('{{'); // 태그는 셀 fieldKey로 저장(텍스트 태그 아님)
    expect(raw).not.toContain('다시 할래');
    expect(raw).not.toContain('쌓았다');
  });
});

const text = (t) => ({ type: 'text', text: t });
const paragraph = (...content) => ({ type: 'paragraph', content: content.filter(Boolean) });
const chip = (fieldKey) => ({ type: 'fieldChip', attrs: { fieldKey } });

describe('콘텐츠 기반(Tiptap) 서식 — 렌더링·태그·검증', () => {
  test('문단·필드칩이 평문으로 치환된다', () => {
    const tpl = { title: '워드형', content: { type: 'doc', content: [paragraph(text('원아명: '), chip('childName'))] } };
    const out = renderInstance(tpl, { childName: '지우' }).text;
    expect(out).toBe('원아명: 지우');
  });

  test('2열 표는 " : "로, 3열 이상 표는 " | "로 셀을 잇는다', () => {
    const twoCol = {
      title: 't2',
      content: { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
        { type: 'tableCell', content: [paragraph(text('원아명'))] },
        { type: 'tableCell', content: [paragraph(chip('childName'))] },
      ] }] }] },
    };
    expect(renderInstance(twoCol, { childName: '지우' }).text).toBe('원아명 : 지우');

    const threeCol = {
      title: 't3',
      content: { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
        { type: 'tableCell', content: [paragraph(text('원아명'))] },
        { type: 'tableCell', content: [paragraph(chip('childName'))] },
        { type: 'tableCell', content: [paragraph(chip('recordDate'))] },
      ] }] }] },
    };
    expect(renderInstance(threeCol, { childName: '지우', recordDate: '2026-08-20' }).text).toBe('원아명 | 지우 | 2026-08-20');
  });

  test('taskItem은 checked 여부에 따라 ☑/☐로, blockquote는 각 줄 앞에 ※를 붙인다(체크박스·안내문구의 새 편집기 대체)', () => {
    const tpl = {
      title: 't4',
      content: {
        type: 'doc',
        content: [
          { type: 'taskList', content: [
            { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('가정 공유 완료'))] },
            { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('사진 첨부'))] },
          ] },
          { type: 'blockquote', content: [paragraph(text('공휴일에는 등원하지 않아요.'))] },
        ],
      },
    };
    const out = renderInstance(tpl, {}).text;
    expect(out).toContain('☑ 가정 공유 완료');
    expect(out).toContain('☐ 사진 첨부');
    expect(out).toContain('※ 공휴일에는 등원하지 않아요.');
  });

  test('extractTags는 중복 없이 필드칩 키만 모으고, validateTemplate은 관리자 커스텀 필드 키도 허용한다', () => {
    asUser(MASTER);
    const field = saveCustomField({ label: '원장님 이름', value: '홍길동' }, MASTER).field;
    const tpl = {
      title: '커스텀 포함',
      content: { type: 'doc', content: [paragraph(chip('childName'), chip('childName'), chip(field.key))] },
    };
    expect(extractTags(tpl)).toEqual(['childName', field.key]);
    expect(validateTemplate(tpl).ok).toBe(true);

    const bad = { title: '미등록', content: { type: 'doc', content: [paragraph(chip('doesNotExist'))] } };
    const v = validateTemplate(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('doesNotExist');
  });
});

describe('레거시 blocks → content 변환기', () => {
  test('convertBlocksToTiptapContent로 변환한 뒤에도 renderInstance 결과에 같은 값들이 그대로 남는다', () => {
    const content = convertBlocksToTiptapContent(TPL.blocks);
    const converted = { ...TPL, content, blocks: undefined };
    const auto = buildAutoValues({ childName: '지우', recordDate: '2026-07-03' });
    const inst = renderInstance(converted, { ...auto, observation: '관찰문장.', learningReading: '배움문장.', supportAndNextPlan: '지원문장.' });
    expect(inst.text).toContain('지우');
    expect(inst.text).toContain('2026-07-03');
    expect(inst.text).toContain('배움문장.');
    expect(inst.text).toContain('가정 공유 완료'); // 체크박스 → taskItem 변환
    expect(inst.text).toContain('교사 메모');       // field 블록 → 라벨 heading 변환
  });
});
