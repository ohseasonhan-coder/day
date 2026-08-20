import {
  FIELD_KEYS,
  RICH_TEMPLATES_KEY,
  collectFieldKeys,
  createBlankRichDocument,
  createDocumentFromTemplate,
  duplicateRichDocument,
  emptyTiptapDoc,
  getRichDocuments,
  getRichDocumentsKey,
  listRichTemplates,
  renderRichDocumentHtml,
  saveRichDocument,
  saveRichTemplateFromDocument,
  validateRichDocumentContent,
} from './documentStudio';
import { saveChildren, saveFormTemplates, saveRecords, getFormTemplates } from './storage';
import { saveCustomField } from './customFields';

const MASTER = { userId: 'master', role: 'master', displayName: '관리자' };
const TEACHER = { userId: 'teacher1', displayName: '김교사' };

const setSession = (user) => localStorage.setItem('sw_session', JSON.stringify(user));
const text = (value) => ({ type: 'text', text: value });
const paragraph = (...content) => ({ type: 'paragraph', content });
const chip = (fieldKey) => ({ type: 'fieldChip', attrs: { fieldKey } });
const tableDoc = () => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('관찰일지')] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [paragraph(text('원아명'))] },
            { type: 'tableCell', content: [paragraph(chip('childName'))] },
          ],
        },
      ],
    },
    paragraph(text('중간 '), chip('observation'), text(' 문장')),
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('목록'))] }] },
  ],
});

beforeEach(() => {
  localStorage.clear();
  setSession(TEACHER);
});

describe('document studio rich document storage', () => {
  test('빈 문서를 생성·저장·재열기한다', () => {
    const doc = createBlankRichDocument({ user: TEACHER });
    expect(doc.content).toEqual(emptyTiptapDoc());
    const saved = saveRichDocument(doc, TEACHER);
    expect(saved.ok).toBe(true);
    const reopened = getRichDocuments(TEACHER.userId)[0];
    expect(reopened.id).toBe(doc.id);
    expect(reopened.title).toBe('새 문서');
    expect(localStorage.getItem(getRichDocumentsKey(TEACHER.userId))).toContain(doc.id);
  });

  test('문단·제목·목록·표와 텍스트 중간 및 표 셀 fieldChip JSON을 검증한다', () => {
    const content = tableDoc();
    expect(validateRichDocumentContent(content).ok).toBe(true);
    expect(collectFieldKeys(content)).toEqual(['childName', 'observation']);
    const saved = saveRichDocument({ ...createBlankRichDocument({ user: TEACHER }), content }, TEACHER);
    expect(saved.ok).toBe(true);
    expect(getRichDocuments(TEACHER.userId)[0].content).toEqual(content);
  });

  test('존재하지 않는 field key 저장을 차단한다', () => {
    const doc = createBlankRichDocument({ user: TEACHER });
    doc.content = { type: 'doc', content: [paragraph(chip('unknownField'))] };
    const result = saveRichDocument(doc, TEACHER);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('unknownField');
  });

  test('document JSON 직렬화·복원 구조를 유지한다', () => {
    const doc = createBlankRichDocument({ user: TEACHER });
    doc.content = tableDoc();
    const serialized = JSON.stringify(doc);
    const restored = JSON.parse(serialized);
    expect(restored.content).toEqual(doc.content);
    expect(collectFieldKeys(restored.content)).toEqual(['childName', 'observation']);
  });
});

describe('document studio templates and permissions', () => {
  test('초기 기본 서식 4개를 제공한다(자동 생성용 일일 보육일지 포함)', () => {
    const templates = listRichTemplates(TEACHER);
    expect(templates.map((tpl) => tpl.title)).toEqual(expect.arrayContaining(['관찰일지', '일일 보육일지', '부모 상담 기록', '교사 회의록']));
    expect(templates).toHaveLength(4);
  });

  test('일반 교사는 서식 저장을 할 수 없다', () => {
    const doc = createBlankRichDocument({ user: TEACHER });
    const result = saveRichTemplateFromDocument(doc, TEACHER);
    expect(result.ok).toBe(false);
  });

  test('관리자는 문서를 서식으로 저장하고 서식에서 새 문서를 만들 때 원본을 변경하지 않는다', () => {
    setSession(MASTER);
    const doc = createBlankRichDocument({ title: '회의 서식', user: MASTER });
    doc.content = tableDoc();
    const savedTemplate = saveRichTemplateFromDocument(doc, MASTER);
    expect(savedTemplate.ok).toBe(true);
    expect(localStorage.getItem(RICH_TEMPLATES_KEY)).toContain('회의 서식');

    const made = createDocumentFromTemplate(savedTemplate.template.templateId, MASTER);
    expect(made.ok).toBe(true);
    made.document.content.content.push(paragraph(text('복제본에만 추가')));
    expect(savedTemplate.template.content.content.map((node) => node.type)).not.toContain('paragraph-extra');
    expect(savedTemplate.template.content.content).not.toHaveLength(made.document.content.content.length);
  });

  test('실제 원아 이름·관찰 기록·생성 문장이 서식 데이터에 저장되지 않는다', () => {
    setSession(MASTER);
    saveChildren([{ id: 'c1', name: '하준' }]);
    saveRecords([{ id: 'r1', childId: 'c1', childName: '하준', rawText: '하준이가 친구와 블록을 쌓았다.', observation: '하준이는 친구와 블록을 쌓았다.' }]);
    const doc = createBlankRichDocument({ title: '개인정보 포함', user: MASTER });
    doc.content = { type: 'doc', content: [paragraph(text('하준이는 친구와 블록을 쌓았다.'))] };
    const result = saveRichTemplateFromDocument(doc, MASTER);
    expect(result.ok).toBe(false);

    const safe = createBlankRichDocument({ title: '안전한 서식', user: MASTER });
    safe.content = { type: 'doc', content: [paragraph(text('원아명: '), chip('childName'), text(' / 관찰내용: '), chip('observation'))] };
    const saved = saveRichTemplateFromDocument(safe, MASTER);
    expect(saved.ok).toBe(true);
    expect(localStorage.getItem(RICH_TEMPLATES_KEY)).not.toContain('하준이는 친구와 블록');
  });
});

describe('document studio field rendering and grid regression', () => {
  test('B4 결과 fieldChip을 렌더링한다', () => {
    const content = {
      type: 'doc',
      content: [
        paragraph(chip('observation')),
        paragraph(chip('learningReading')),
        paragraph(chip('supportAndNextPlan')),
      ],
    };
    const html = renderRichDocumentHtml(content, {
      observation: '관찰내용 문장',
      learningReading: '배움 읽기 문장',
      supportAndNextPlan: '지원 계획 문장',
    });
    expect(html).toContain('관찰내용 문장');
    expect(html).toContain('배움 읽기 문장');
    expect(html).toContain('지원 계획 문장');
  });

  test('기존 grid 서식 저장소는 변경 없이 유지된다', () => {
    saveFormTemplates([{ id: 'grid1', name: '기존 칸형 서식', fields: [] }]);
    expect(getFormTemplates()).toEqual([{ id: 'grid1', name: '기존 칸형 서식', fields: [] }]);
    expect(FIELD_KEYS).toContain('observation');
  });

  test('기본 필드 목록은 요청된 자동 필드를 포함한다', () => {
    expect(FIELD_KEYS).toEqual(expect.arrayContaining([
      'childName', 'childAge', 'className', 'teacherName', 'recordDate', 'weather',
      'observation', 'learningReading', 'supportAndNextPlan', 'dailyRoutine',
      'playEvaluation', 'parentNotice', 'teacherMemo', 'parentRequest',
      'consultContent', 'checklist',
    ]));
  });

  test('문서 복제가 원본 문서를 변경하지 않는다', () => {
    const doc = createBlankRichDocument({ title: '원본', user: TEACHER });
    saveRichDocument(doc, TEACHER);
    const dup = duplicateRichDocument(doc.id, TEACHER);
    expect(dup.ok).toBe(true);
    const docs = getRichDocuments(TEACHER.userId);
    expect(docs).toHaveLength(2);
    expect(docs.map((item) => item.title)).toEqual(expect.arrayContaining(['원본', '원본 복제본']));
  });
});

describe('관리자 커스텀 필드 통합', () => {
  test('커스텀 필드 key는 미등록 필드 검사를 통과한다', () => {
    const field = saveCustomField({ label: '원장님 이름', value: '홍길동' }, MASTER).field;
    const doc = { type: 'doc', content: [paragraph(chip(field.key))] };
    expect(validateRichDocumentContent(doc)).toMatchObject({ ok: true, errors: [] });
  });

  test('등록되지 않은 필드 key는 여전히 거부된다', () => {
    const doc = { type: 'doc', content: [paragraph(chip('doesNotExist'))] };
    expect(validateRichDocumentContent(doc).ok).toBe(false);
  });

  test('renderRichDocumentHtml이 fieldValues 없이도 커스텀 필드 값을 채운다', () => {
    const field = saveCustomField({ label: '전화번호', value: '02-1234-5678' }, MASTER).field;
    const doc = { type: 'doc', content: [paragraph(chip(field.key))] };
    const html = renderRichDocumentHtml(doc, {});
    expect(html).toContain('02-1234-5678');
  });

  test('fieldValues가 있으면 그쪽이 커스텀 필드 값보다 우선한다', () => {
    const field = saveCustomField({ label: '전화번호', value: '기본값' }, MASTER).field;
    const doc = { type: 'doc', content: [paragraph(chip(field.key))] };
    const html = renderRichDocumentHtml(doc, { [field.key]: '오버라이드값' });
    expect(html).toContain('오버라이드값');
    expect(html).not.toContain('기본값');
  });

  test('삽입 시점 라벨(fieldLabel)이 있으면 값이 없을 때 그 라벨로 표시된다', () => {
    const doc = { type: 'doc', content: [paragraph({ type: 'fieldChip', attrs: { fieldKey: 'ghost_key', fieldLabel: '삭제된 필드' } })] };
    const html = renderRichDocumentHtml(doc, {});
    expect(html).toContain('[삭제된 필드]');
  });
});

describe('이미지·링크 렌더링', () => {
  test('src가 있는 이미지 노드는 <img>로 렌더링된다', () => {
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: 'data:image/jpeg;base64,AAAA', alt: '사진' } }] };
    const html = renderRichDocumentHtml(doc, {});
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"');
    expect(html).toContain('alt="사진"');
  });

  test('src가 비어 있는(하이드레이션 전) 이미지 노드는 조용히 아무것도 렌더링하지 않는다', () => {
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: '', photoId: 'p1' } }] };
    expect(() => renderRichDocumentHtml(doc, {})).not.toThrow();
    expect(renderRichDocumentHtml(doc, {})).toBe('');
  });

  test('link 마크가 있는 텍스트는 <a href>로 렌더링된다', () => {
    const doc = { type: 'doc', content: [paragraph({ type: 'text', text: '자세히 보기', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] })] };
    const html = renderRichDocumentHtml(doc, {});
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">자세히 보기</a>');
  });
});
