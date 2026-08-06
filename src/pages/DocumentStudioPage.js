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
  FIELD_MAP,
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
import {
  AUTO_TRIGGERS, getAutoRules, setAutoRule, groupInstancesForInbox, getInstance,
  updateFieldValue, refreshAutoFields, setInstanceStatus, instanceNeedsAttention,
} from '../utils/documentInstances';

const DOC_TYPE_LABELS = {
  observationJournal: '관찰일지', dailyJournal: '일일 보육일지',
  consultationRecord: '부모 상담 기록', document: '문서',
};
const TRIGGER_LABELS = {
  observationRecordSaved: '관찰 기록 저장 시', dailyRecordSaved: '하루 기록 저장 시',
  consultationRecordSaved: '상담 기록 저장 시',
};
const TRIGGER_TO_SOURCE = {
  observationRecordSaved: 'observationRecord', dailyRecordSaved: 'dailyRecord', consultationRecordSaved: 'consultationRecord',
};
const TRIGGER_TO_DOC_TYPE = {
  observationRecordSaved: 'observationJournal', dailyRecordSaved: 'dailyJournal', consultationRecordSaved: 'consultationRecord',
};
const INBOX_TABS = [
  ['autoToday', '오늘 자동 생성됨'], ['needsReview', '확인 필요'], ['drafting', '작성 중'],
  ['done', '완료'], ['manual', '서식에서 직접 생성'], ['archived', '보관됨'],
];

function fieldFillSummary(inst) {
  const states = Object.values(inst.fieldStates || {});
  const filled = states.filter((s) => s.status === 'filled').length;
  const review = states.filter((s) => s.status === 'needs_review' || s.status === 'empty' || s.needsRefresh).length;
  return { filled, review, total: states.length };
}

// 자동 생성 문서(인스턴스) 작업 화면 — 서식 원본은 건드리지 않고 이 문서의 값만 다룬다.
function InstanceWorkspace({ instance, currentUser, onBack, onChanged, showToast }) {
  const [inst, setInst] = useState(instance);
  const [printMode, setPrintMode] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const reload = () => { const next = getInstance(inst.id, currentUser); if (next) setInst(next); onChanged(); };
  const sourceRecord = getRecords().find((r) => r.id === inst.sourceRecordId);

  const onField = (key, value) => {
    const r = updateFieldValue(inst.id, key, value, currentUser);
    if (r.ok) { setInst(r.instance); onChanged(); }
  };
  const onRefresh = () => {
    const r = refreshAutoFields(inst.id, currentUser);
    if (!r.ok) { showToast(r.error, 'error'); return; }
    showToast(`자동 값 ${r.refreshed}개를 다시 반영했어요. 수정한 필드는 그대로 보호됩니다.`, 'success');
    reload();
  };
  const onStatus = (status) => {
    const r = setInstanceStatus(inst.id, status, currentUser);
    if (r.ok) { setInst(r.instance); onChanged(); showToast(status === 'final' ? '완료 처리했어요.' : status === 'archived' ? '보관 처리했어요.' : '초안으로 되돌렸어요.', 'success'); }
  };

  const statusBadge = (s) => {
    if (s.needsRefresh) return ['갱신 필요', '#B45309'];
    if (s.status === 'needs_review') return ['확인 필요', '#B45309'];
    if (s.status === 'empty') return ['내용 확인 필요', '#DC2626'];
    if (s.editedByTeacher) return ['수정됨', 'var(--primary)'];
    return ['자동 채움', 'var(--text-tertiary)'];
  };

  return (
    <div className={`doc-studio-editor ${printMode ? 'document-studio-print' : ''}`}>
      <div className="doc-editor-top no-print">
        <button onClick={onBack} style={btn(false)}><ArrowLeft size={16} /> 목록</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>{inst.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {DOC_TYPE_LABELS[inst.documentType] || inst.documentType} · {inst.status === 'final' ? '완료' : '초안'}
            {inst.sourceChanged ? ' · 원본 기록이 변경됨' : ''}
          </div>
        </div>
        {inst.status !== 'final' && <button onClick={onRefresh} style={btn(false)}>자동 값 다시 반영</button>}
        {inst.status === 'final'
          ? <button onClick={() => onStatus('draft')} style={btn(false)}>초안으로</button>
          : <button onClick={() => onStatus('final')} style={btn(true)}>완료 처리</button>}
        <button onClick={() => { setPrintMode(true); setTimeout(() => window.print(), 80); }} style={btn(false)}><Printer size={16} /> 인쇄용</button>
        <button onClick={() => onStatus('archived')} style={{ ...btn(false), color: '#B45309' }}>보관</button>
      </div>

      <div className="doc-editor-layout">
        <div className="doc-canvas-wrap">
          <div className="doc-a4-canvas">
            <div className="doc-preview-body" dangerouslySetInnerHTML={{ __html: renderRichDocumentHtml(inst.content, inst.fieldValues) }} />
          </div>
        </div>
        <aside className="doc-field-panel no-print">
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>문서 필드</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.5 }}>
            자동 값은 기록과 B4 결과에서 채워졌어요. 직접 수정하면 그 필드는 자동 갱신으로 덮어쓰지 않습니다.
          </div>
          {inst.sourceRecordId && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => setShowSource((v) => !v)} style={{ ...btn(false), width: '100%' }}>
                {showSource ? '원본 기록 닫기' : '원본 기록 보기'}
              </button>
              {showSource && (
                <div style={{ marginTop: 6, padding: 9, borderRadius: 9, background: 'var(--gray-50)', fontSize: 12, lineHeight: 1.55 }}>
                  {sourceRecord
                    ? <><b>{(sourceRecord.date || '').slice(0, 10)} · {sourceRecord.childName || ''}</b><br />{String(sourceRecord.rawText || '').slice(0, 160)}</>
                    : `원본: ${inst.sourceRecordId} (하루 기록 등 요약 원본)`}
                </div>
              )}
            </div>
          )}
          {Object.keys(inst.fieldStates || {}).map((key) => {
            const s = inst.fieldStates[key];
            const def = FIELD_MAP[key] || { label: key };
            const [label, color] = statusBadge(s);
            return (
              <label key={key} style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 800, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{def.label}{s.mode === 'auto' ? '' : ' (직접 입력)'}</span>
                  <span style={{ color }}>{label}</span>
                </span>
                <textarea
                  value={inst.fieldValues[key] || ''}
                  onChange={(e) => onField(key, e.target.value)}
                  rows={['observation', 'learningReading', 'supportAndNextPlan', 'dailyRoutine', 'consultContent'].includes(key) ? 3 : 1}
                  disabled={inst.status === 'final'}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 9, padding: 9, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5, background: inst.status === 'final' ? 'var(--gray-50)' : 'var(--white)', color: 'var(--text-primary)' }}
                />
              </label>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

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
  const [inboxTab, setInboxTab] = useState('autoToday');
  const [instanceOpen, setInstanceOpen] = useState(null); // 자동 생성 문서(인스턴스) 작업 화면
  const [inboxVersion, setInboxVersion] = useState(0);
  const [connectTrigger, setConnectTrigger] = useState({}); // 서식별로 아직 연결 전 선택한 trigger
  const saveTimer = useRef(null);
  const inbox = useMemo(() => groupInstancesForInbox(currentUser), [currentUser, inboxVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoRules = useMemo(() => getAutoRules(), [inboxVersion]); // eslint-disable-line react-hooks/exhaustive-deps
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

  if (instanceOpen) {
    return (
      <InstanceWorkspace
        instance={instanceOpen}
        currentUser={currentUser}
        onBack={() => { setInstanceOpen(null); setInboxVersion((v) => v + 1); }}
        onChanged={() => setInboxVersion((v) => v + 1)}
        showToast={showToast}
      />
    );
  }

  if (!editing) {
    const inboxList = inbox[inboxTab] || [];
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
          <div className="doc-section-title">문서함 — 기록에서 자동 생성된 문서</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {INBOX_TABS.map(([key, label]) => (
              <button key={key} onClick={() => setInboxTab(key)}
                style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, border: `1.5px solid ${inboxTab === key ? 'var(--primary)' : 'var(--border)'}`, background: inboxTab === key ? 'var(--primary-light)' : 'var(--white)', color: inboxTab === key ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {label} {(inbox[key] || []).length ? `(${inbox[key].length})` : ''}
              </button>
            ))}
          </div>
          {inboxList.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '6px 2px' }}>
              이 구분에 문서가 없어요. 기록을 저장하면 활성 서식에 따라 초안이 자동으로 만들어져요.
            </div>
          ) : (
            <div className="rich-doc-list">
              {inboxList.map((inst) => {
                const fill = fieldFillSummary(inst);
                return (
                  <div key={inst.id} className="rich-doc-row">
                    <button onClick={() => setInstanceOpen(inst)} className="rich-doc-main">
                      <FileText size={18} color={instanceNeedsAttention(inst) && inst.status !== 'final' ? '#B45309' : 'var(--primary)'} />
                      <span>
                        <strong>{inst.title}</strong>
                        <small>
                          {DOC_TYPE_LABELS[inst.documentType] || inst.documentType}
                          {' · '}{new Date(inst.createdAt).toLocaleDateString()}
                          {' · '}{inst.status === 'final' ? '완료' : '초안'}
                          {' · 자동 채움 '}{fill.filled}/{fill.total}{fill.review ? ` (확인 ${fill.review})` : ''}
                          {inst.sourceChanged ? ' · 원본 변경됨' : ''}
                        </small>
                      </span>
                    </button>
                    <button onClick={() => setInstanceOpen(inst)} style={btn(false)}>문서 열기</button>
                  </div>
                );
              })}
            </div>
          )}
          {admin && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, marginBottom: 6 }}>자동 생성 규칙 (관리자)</div>
              {Object.entries(autoRules).map(([templateId, rule]) => {
                const tpl = templates.find((t) => t.templateId === templateId);
                if (!tpl) return null;
                return (
                  <div key={templateId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: 110 }}>{tpl.title}</strong>
                    <span style={{ color: 'var(--text-tertiary)' }}>{TRIGGER_LABELS[rule.trigger] || rule.trigger} → {DOC_TYPE_LABELS[rule.documentType] || rule.documentType} 초안</span>
                    <button
                      onClick={() => { const r = setAutoRule(templateId, { enabled: !rule.enabled }, currentUser); if (!r.ok) showToast(r.error, 'error'); setInboxVersion((v) => v + 1); }}
                      style={{ ...btn(rule.enabled), marginLeft: 'auto', minHeight: 30 }}>
                      {rule.enabled ? '활성' : '비활성'}
                    </button>
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>지원 trigger: {AUTO_TRIGGERS.map((t) => TRIGGER_LABELS[t]).join(' / ')}</div>

              {templates.filter((t) => !autoRules[t.templateId]).length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>서식을 자동 생성에 연결</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    내가 만든 서식을 골라 언제 자동으로 채워질지 정하면, 그 다음부터는 선택 없이 기록을 저장할 때마다 자동으로 문서가 만들어져요.
                  </div>
                  {templates.filter((t) => !autoRules[t.templateId]).map((tpl) => (
                    <div key={tpl.templateId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
                      <strong style={{ minWidth: 110 }}>{tpl.title}</strong>
                      <select
                        value={connectTrigger[tpl.templateId] || AUTO_TRIGGERS[0]}
                        onChange={(e) => setConnectTrigger((prev) => ({ ...prev, [tpl.templateId]: e.target.value }))}
                        style={{ ...inputStyle, height: 30, width: 'auto' }}>
                        {AUTO_TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          const trigger = connectTrigger[tpl.templateId] || AUTO_TRIGGERS[0];
                          if (!tpl.system && !tpl.published) setRichTemplatePublished(tpl.templateId, true, currentUser);
                          const r = setAutoRule(tpl.templateId, {
                            enabled: true, trigger, sourceRecordType: TRIGGER_TO_SOURCE[trigger],
                            documentType: TRIGGER_TO_DOC_TYPE[trigger], requires: { recordSaved: true, b4AuditPassed: false }, createMode: 'draft',
                          }, currentUser);
                          if (!r.ok) { showToast(r.error, 'error'); return; }
                          showToast(`"${tpl.title}" 서식을 자동 생성에 연결했어요.`, 'success');
                          refresh();
                          setInboxVersion((v) => v + 1);
                        }}
                        style={{ ...btn(true), marginLeft: 'auto', minHeight: 30 }}>
                        자동 생성 켜기
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

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
