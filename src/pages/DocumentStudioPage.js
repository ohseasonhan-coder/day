import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Copy, Eye, FilePlus2, FileText, Printer, Save, Search, Trash2,
} from 'lucide-react';
import RichDocumentEditor from '../components/RichDocumentEditor';
import { useToast } from '../components/Toast';
import { isMaster } from '../utils/auth';
import { getRecords } from '../utils/storage';
import {
  FIELD_DEFINITIONS,
  createBlankRichDocument,
  createDocumentFromTemplate,
  deleteRichDocument,
  deleteRichTemplate,
  duplicateRichDocument,
  getDefaultFieldValues,
  getRichDocuments,
  listRichTemplates,
  renameRichDocument,
  renderRichDocumentHtml,
  saveRichDocument,
  saveRichTemplateFromDocument,
  setRichTemplatePublished,
} from '../utils/documentStudio';

const btn = (primary = false) => ({
  minHeight: 38,
  padding: '0 13px',
  borderRadius: 10,
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? 'var(--primary)' : 'var(--white)',
  color: primary ? 'white' : 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
});

const inputStyle = {
  height: 40,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--white)',
  color: 'var(--text-primary)',
  padding: '0 12px',
  fontSize: 14,
};

function EmptyList({ onNew }) {
  return (
    <div className="doc-studio-empty">
      <FileText size={34} color="var(--primary)" />
      <div style={{ fontSize: 17, fontWeight: 900 }}>아직 작성한 문서가 없습니다</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>빈 문서나 기본 서식으로 문서 작성을 시작하세요.</div>
      <button onClick={onNew} style={btn(true)}><FilePlus2 size={16} /> 새 빈 문서</button>
    </div>
  );
}

function FieldValuePanel({ values, selectedField, records, selectedRecordId, onRecordChange, manualValues, setManualValues }) {
  return (
    <aside className="doc-field-panel no-print">
      <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>자동 필드 값</div>
      <select value={selectedRecordId || ''} onChange={(event) => onRecordChange(event.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 10 }}>
        <option value="">최근 기록 기준</option>
        {records.slice(0, 50).map((record) => (
          <option key={record.id} value={record.id}>
            {(record.date || '').slice(0, 10)} · {record.childName || '원아'} · {(record.rawText || record.observation || '').slice(0, 18)}
          </option>
        ))}
      </select>
      {selectedField ? (
        <div className="doc-field-info">
          <div style={{ fontWeight: 900 }}>{selectedField.label}</div>
          <div>{selectedField.description}</div>
        </div>
      ) : (
        <div className="doc-field-info">문서 안의 필드 칩을 클릭하면 설명을 볼 수 있습니다.</div>
      )}
      {['weather', 'dailyRoutine', 'playEvaluation', 'teacherMemo', 'parentRequest', 'consultContent', 'checklist'].map((key) => {
        const field = FIELD_DEFINITIONS.find((item) => item.key === key);
        return (
          <label key={key} style={{ display: 'block', marginTop: 10 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 4 }}>{field.label}</span>
            <textarea
              value={manualValues[key] || ''}
              onChange={(event) => setManualValues((prev) => ({ ...prev, [key]: event.target.value }))}
              rows={key === 'checklist' ? 4 : 2}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 9, padding: 9, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5, background: 'var(--white)', color: 'var(--text-primary)' }}
            />
          </label>
        );
      })}
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        관찰내용·배움 읽기·지원 계획은 기존 B4 결과를 표시만 합니다. 문서 작성실이 새 문장을 생성하지는 않습니다.
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        {['childName', 'className', 'recordDate', 'observation', 'learningReading', 'supportAndNextPlan'].map((key) => {
          const field = FIELD_DEFINITIONS.find((item) => item.key === key);
          const value = values[key] || '';
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-tertiary)' }}>{field.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 72, overflow: 'auto' }}>{value || '값 없음'}</div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function DocumentStudioPage({ isDesktop, currentUser }) {
  const showToast = useToast();
  const admin = isMaster(currentUser);
  const [documents, setDocuments] = useState(() => getRichDocuments(currentUser?.userId));
  const [templates, setTemplates] = useState(() => listRichTemplates(currentUser, { includePrivate: admin }));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [preview, setPreview] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [saveState, setSaveState] = useState('저장됨');
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [manualValues, setManualValues] = useState({});
  const saveTimer = useRef(null);
  const records = getRecords().sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  const fieldValues = useMemo(() =>
    getDefaultFieldValues({ currentUser, recordId: selectedRecordId, manualValues }),
  [currentUser, selectedRecordId, manualValues]);

  const refresh = () => {
    setDocuments(getRichDocuments(currentUser?.userId));
    setTemplates(listRichTemplates(currentUser, { includePrivate: admin }));
  };

  const openDocument = (doc) => {
    setEditing(JSON.parse(JSON.stringify(doc)));
    setPreview(false);
    setPrintMode(false);
    setSaveState('저장됨');
  };

  const saveNow = (doc = editing) => {
    if (!doc) return null;
    const result = saveRichDocument(doc, currentUser);
    if (!result.ok) {
      setSaveState('저장 실패');
      showToast(result.error, 'error');
      return null;
    }
    setEditing(result.document);
    refresh();
    setSaveState('저장됨');
    return result.document;
  };

  const scheduleSave = (patch) => {
    setEditing((prev) => {
      const next = { ...prev, ...patch };
      setSaveState('저장 중...');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveNow(next), 650);
      return next;
    });
  };

  const createBlank = () => {
    const doc = createBlankRichDocument({ user: currentUser });
    const saved = saveRichDocument(doc, currentUser);
    if (saved.ok) {
      refresh();
      openDocument(saved.document);
      showToast('빈 문서를 만들었어요.', 'success');
    }
  };

  const createFromTemplate = (templateId) => {
    const made = createDocumentFromTemplate(templateId, currentUser);
    if (!made.ok) { showToast(made.error, 'error'); return; }
    const saved = saveRichDocument(made.document, currentUser);
    if (saved.ok) {
      refresh();
      openDocument(saved.document);
      showToast('서식 복제본으로 새 문서를 만들었어요.', 'success');
    }
  };

  const saveAsTemplate = () => {
    if (!editing) return;
    const result = saveRichTemplateFromDocument(editing, currentUser);
    if (!result.ok) { showToast(result.error, 'error'); return; }
    refresh();
    showToast('문서를 서식으로 저장했어요. 공개 전까지 관리자만 볼 수 있습니다.', 'success');
  };

  const filtered = documents.filter((doc) => {
    const q = query.trim().toLowerCase();
    return !q || doc.title.toLowerCase().includes(q);
  });

  if (!editing) {
    return (
      <div className="doc-studio-page">
        <div className="doc-studio-head">
          <div>
            <div className="doc-studio-title">문서 작성실</div>
            <div className="doc-studio-desc">빈 문서나 서식을 열어 워드프로세서처럼 직접 작성하고 저장합니다.</div>
          </div>
          <button onClick={createBlank} style={btn(true)}><FilePlus2 size={16} /> 새 빈 문서</button>
        </div>

        <div className="doc-list-tools">
          <div className="doc-search-box">
            <Search size={16} color="var(--text-tertiary)" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="문서 검색" />
          </div>
        </div>

        <section className="doc-studio-section">
          <div className="doc-section-title">문서 서식에서 시작</div>
          <div className="template-grid">
            {templates.map((template) => (
              <div key={template.templateId} className="template-card">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{template.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{template.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 7 }}>
                    {template.system ? '기본 서식' : template.published ? '공개 서식' : '비공개 서식'}
                  </div>
                </div>
                <button onClick={() => createFromTemplate(template.templateId)} style={btn(false)}>새 문서</button>
                {admin && !template.system && (
                  <>
                    <button onClick={() => { setRichTemplatePublished(template.templateId, !template.published, currentUser); refresh(); }} style={btn(false)}>{template.published ? '비공개' : '공개'}</button>
                    <button onClick={() => { if (window.confirm('이 서식을 보관 처리할까요?')) { deleteRichTemplate(template.templateId, currentUser); refresh(); } }} style={{ ...btn(false), color: '#DC2626' }}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="doc-studio-section">
          <div className="doc-section-title">내 문서</div>
          {filtered.length === 0 ? <EmptyList onNew={createBlank} /> : (
            <div className="rich-doc-list">
              {filtered.map((doc) => (
                <div key={doc.id} className="rich-doc-row">
                  <button onClick={() => openDocument(doc)} className="rich-doc-main">
                    <FileText size={18} color="var(--primary)" />
                    <span>
                      <strong>{doc.title}</strong>
                      <small>{new Date(doc.updatedAt || doc.createdAt).toLocaleString()} {doc.sourceTemplateTitle ? `· ${doc.sourceTemplateTitle}` : ''}</small>
                    </span>
                  </button>
                  <button onClick={() => {
                    const title = window.prompt('문서 제목', doc.title);
                    if (title) { renameRichDocument(doc.id, title, currentUser); refresh(); }
                  }} style={btn(false)}>제목</button>
                  <button onClick={() => { duplicateRichDocument(doc.id, currentUser); refresh(); }} style={btn(false)}><Copy size={14} /> 복제</button>
                  <button onClick={() => {
                    if (window.confirm('이 문서를 삭제할까요?')) { deleteRichDocument(doc.id, currentUser); refresh(); }
                  }} style={{ ...btn(false), color: '#DC2626' }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const renderedHtml = renderRichDocumentHtml(editing.content, fieldValues);

  return (
    <div className={`doc-studio-editor ${printMode ? 'document-studio-print' : ''}`}>
      <div className="doc-editor-top no-print">
        <button onClick={() => { saveNow(); setEditing(null); }} style={btn(false)}><ArrowLeft size={16} /> 목록</button>
        <input
          value={editing.title}
          onChange={(event) => scheduleSave({ title: event.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 180, fontWeight: 900 }}
          placeholder="문서 제목"
        />
        <span className="doc-save-state"><Save size={14} /> {saveState}</span>
        <button onClick={() => setPreview((value) => !value)} style={btn(false)}><Eye size={16} /> {preview ? '편집' : '미리보기'}</button>
        <button onClick={() => { setPrintMode(true); setPreview(true); setTimeout(() => window.print(), 80); }} style={btn(false)}><Printer size={16} /> 인쇄용</button>
        {admin && <button onClick={saveAsTemplate} style={btn(true)}>서식으로 저장</button>}
      </div>

      <div className="doc-editor-layout">
        <div className="doc-canvas-wrap">
          <div className="doc-a4-canvas">
            {preview ? (
              <div className="doc-preview-body" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            ) : (
              <RichDocumentEditor
                content={editing.content}
                onChange={(content) => scheduleSave({ content })}
                canInsertFields={admin}
                onFieldInfo={setSelectedField}
              />
            )}
          </div>
        </div>
        <FieldValuePanel
          values={fieldValues}
          selectedField={selectedField}
          records={records}
          selectedRecordId={selectedRecordId}
          onRecordChange={setSelectedRecordId}
          manualValues={manualValues}
          setManualValues={setManualValues}
        />
      </div>
    </div>
  );
}
