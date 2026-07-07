// 문서 서식 관리(관리자 전용) — 표·문단 기반 블록 편집기 MVP.
// 자유 편집기가 아니라 안정적인 블록 방식: 문단/표/줄바꿈/체크박스/안내문구/필드.
// 모든 저장·수정·삭제·공개 전환은 docTemplates.js가 권한(isMaster)을 다시 검사한다.
import React, { useState } from 'react';
import { isMaster } from '../utils/auth';
import {
  FIELD_DICTIONARY, FIELD_KEYS, listTemplatesForAdmin, saveTemplate, duplicateTemplate,
  setTemplatePublished, archiveTemplate, deleteTemplate, renderInstance, validateTemplate,
} from '../utils/docTemplates';
import { PRIVATE_SERVER_KEYS, getServerConfig, setServerConfig, privateServerAdapter } from '../utils/ai/llm/privateServerLLM';

const btn = (primary) => ({ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--primary)' : 'white', color: primary ? 'white' : 'var(--text-secondary)' });
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5 };
const newBlock = (type) => ({
  id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
  type,
  ...(type === 'table' ? { cols: 2, rows: [[{ text: '항목' }, { text: '' }]] } : {}),
  ...(type === 'field' ? { fieldKey: FIELD_KEYS[0] } : {}),
  ...(['paragraph', 'notice', 'checkbox'].includes(type) ? { text: '' } : {}),
});

function FieldPicker({ value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
      <option value="">(직접 텍스트)</option>
      {FIELD_KEYS.map((k) => <option key={k} value={k}>{`{{${k}}} — ${FIELD_DICTIONARY[k].label}`}</option>)}
    </select>
  );
}

function BlockEditor({ block, onChange, onRemove }) {
  const set = (patch) => onChange({ ...block, ...patch });
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--gray-50)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-tertiary)' }}>
          {{ paragraph: '문단', table: '표', linebreak: '줄바꿈', checkbox: '체크박스', notice: '안내 문구', field: '필드' }[block.type]}
        </span>
        <button onClick={onRemove} style={{ fontSize: 11, color: '#DC2626', background: 'none' }}>삭제</button>
      </div>
      {['paragraph', 'notice', 'checkbox'].includes(block.type) && (
        <textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={2}
          placeholder="내용 — {{childName}} 형태로 필드 삽입 가능" style={{ ...inputStyle, resize: 'vertical' }} />
      )}
      {block.type === 'field' && <FieldPicker value={block.fieldKey} onChange={(k) => set({ fieldKey: k || FIELD_KEYS[0] })} />}
      {block.type === 'table' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5 }}>열 수</span>
            <select value={block.cols} onChange={(e) => {
              const cols = Number(e.target.value);
              set({ cols, rows: block.rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] || { text: '' })) });
            }} style={{ ...inputStyle, width: 'auto' }}>
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={() => set({ rows: [...block.rows, Array.from({ length: block.cols }, () => ({ text: '' }))] })} style={btn(false)}>행 추가</button>
            <button onClick={() => block.rows.length > 1 && set({ rows: block.rows.slice(0, -1) })} style={btn(false)}>행 삭제</button>
          </div>
          {block.rows.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${block.cols}, 1fr)`, gap: 4, marginBottom: 4 }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <FieldPicker value={cell.fieldKey} onChange={(k) => {
                    const rows = block.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? (k ? { fieldKey: k } : { text: c.text || '' }) : c)) : r));
                    set({ rows });
                  }} />
                  {!cell.fieldKey && (
                    <input value={cell.text || ''} placeholder="셀 텍스트" onChange={(e) => {
                      const rows = block.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? { text: e.target.value } : c)) : r));
                      set({ rows });
                    }} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocTemplateStudio({ currentUser }) {
  const [list, setList] = useState(() => listTemplatesForAdmin(currentUser));
  const [editing, setEditing] = useState(null); // 편집 중 초안(저장 전 — 관리자만 봄)
  const [msg, setMsg] = useState('');
  const [server, setServer] = useState(getServerConfig());
  const [serverState, setServerState] = useState('');
  const refresh = () => setList(listTemplatesForAdmin(currentUser));
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  if (!isMaster(currentUser)) return null; // 진입 차단(저장 계층에서도 재검사)

  const act = (fn, ...args) => { const r = fn(...args, currentUser); flash(r.ok ? '완료했어요.' : r.error); refresh(); };
  const testServer = async () => {
    setServerState('확인 중…');
    const s = await privateServerAdapter.getStatus();
    setServerState(s.state === 'ready' ? '✅ 연결됨' : `❌ ${s.error || s.state}`);
  };

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>📄 문서 서식 관리 (관리자 전용)</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        표·문단 블록으로 서식을 만들고 공개하면, 선생님들이 문서 자동화에서 선택해 쓸 수 있어요.
        서식에는 필드 자리만 저장되고 원아 기록·생성 문서 내용은 저장되지 않아요.
      </div>
      {msg && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>{msg}</div>}

      {/* 7B 서버 설정(관리자만 — 교사 화면 미노출) */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🖥 개인 PC AI 서버(7B) 설정 — 선택</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input value={server.url} placeholder="비워 두면 같은 PC의 Ollama/LM Studio를 자동으로 찾아요"
            onChange={(e) => setServer({ ...server, url: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 220 }} />
          <input value={server.model} placeholder="모델명 예: qwen2.5:7b-instruct"
            onChange={(e) => setServer({ ...server, model: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
          <button onClick={() => { setServerConfig(server); flash('서버 설정을 저장했어요.'); }} style={btn(true)}>저장</button>
          <button onClick={testServer} style={btn(false)}>연결 확인</button>
          {serverState && <span style={{ fontSize: 12, alignSelf: 'center' }}>{serverState}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          주소를 비워 두면 이 PC의 로컬 AI 서버(Ollama·LM Studio)를 자동으로 찾아 연결해요(설정 불필요).
          다른 PC 주소는 관리자 본인 소유 서버만 입력하세요. 서버가 없거나 연결 실패 시 자동으로 규칙 엔진 결과를 사용해요. ({PRIVATE_SERVER_KEYS.URL})
        </div>
      </div>

      {!editing && (
        <div>
          <button onClick={() => setEditing({ title: '', description: '', documentType: 'observation', blocks: [newBlock('table')] })} style={btn(true)}>+ 새 서식 만들기</button>
          <div style={{ marginTop: 10 }}>
            {list.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>아직 서식이 없어요.</div>}
            {list.map((t) => (
              <div key={t.templateId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--gray-100)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 120 }}>
                  {t.title} <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>v{t.version} · {t.archived ? '보관됨' : t.published ? '공개' : '비공개(초안)'}</span>
                </span>
                <button onClick={() => setEditing(JSON.parse(JSON.stringify(t)))} style={btn(false)}>편집</button>
                <button onClick={() => act(duplicateTemplate, t.templateId)} style={btn(false)}>복제</button>
                {!t.archived && <button onClick={() => act(setTemplatePublished, t.templateId, !t.published)} style={btn(false)}>{t.published ? '비공개로' : '공개하기'}</button>}
                {!t.archived && <button onClick={() => act(archiveTemplate, t.templateId)} style={{ ...btn(false), color: '#B45309' }}>보관</button>}
                {t.archived && <button onClick={() => act(deleteTemplate, t.templateId)} style={{ ...btn(false), color: '#DC2626' }}>완전 삭제</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div>
          <input value={editing.title} placeholder="서식 제목 (예: 관찰일지 기본형)" onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
          <input value={editing.description} placeholder="서식 설명" onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {['paragraph', 'table', 'linebreak', 'checkbox', 'notice', 'field'].map((ty) => (
              <button key={ty} onClick={() => setEditing({ ...editing, blocks: [...editing.blocks, newBlock(ty)] })} style={btn(false)}>
                + {{ paragraph: '문단', table: '표', linebreak: '줄바꿈', checkbox: '체크박스', notice: '안내 문구', field: '필드' }[ty]}
              </button>
            ))}
          </div>
          {editing.blocks.map((b, i) => (
            <BlockEditor key={b.id} block={b}
              onChange={(nb) => setEditing({ ...editing, blocks: editing.blocks.map((x, j) => (j === i ? nb : x)) })}
              onRemove={() => setEditing({ ...editing, blocks: editing.blocks.filter((_, j) => j !== i) })} />
          ))}
          <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: 10, margin: '8px 0', whiteSpace: 'pre-wrap', fontSize: 12.5 }}>
            <div style={{ fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>미리보기(빈 값은 안내 문구로 표시)</div>
            {renderInstance(editing, {}).text || '(블록을 추가하세요)'}
          </div>
          {(() => { const v = validateTemplate(editing); return v.ok ? null : <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 6 }}>{v.errors.join(' / ')}</div>; })()}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { const r = saveTemplate(editing, currentUser); flash(r.ok ? '저장했어요. 공개 전까지는 선생님에게 보이지 않아요.' : r.error); if (r.ok) { setEditing(null); refresh(); } }} style={btn(true)}>서식 저장</button>
            <button onClick={() => setEditing(null)} style={btn(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
