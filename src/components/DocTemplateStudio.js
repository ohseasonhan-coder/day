// 문서 서식 관리(관리자 전용) — RichDocumentEditor(Tiptap) 기반 워드/한글 느낌 WYSIWYG 편집기.
// 서식은 Tiptap JSON(content)으로 저장되며, docTemplates.js가 이를 평문(복사용 텍스트)으로 렌더링한다.
// 예전(blocks 기반) 서식은 편집 시 convertBlocksToTiptapContent로 1회 변환되어 새 편집기에서 열린다.
// 모든 저장·수정·삭제·공개 전환은 docTemplates.js가 권한(isMaster)을 다시 검사한다.
import React, { useMemo, useState } from 'react';
import { isMaster } from '../utils/auth';
import {
  FIELD_DICTIONARY, FIELD_KEYS, listTemplatesForAdmin, saveTemplate, duplicateTemplate,
  setTemplatePublished, archiveTemplate, deleteTemplate, renderInstance, validateTemplate,
  convertBlocksToTiptapContent,
} from '../utils/docTemplates';
import { emptyTiptapDoc } from '../utils/documentStudio';
import { PRIVATE_SERVER_KEYS, getServerConfig, setServerConfig, privateServerAdapter } from '../utils/ai/llm/privateServerLLM';
import {
  GEMINI_KEYS, getGeminiConfig, setGeminiConfig, geminiAdapter, isGeminiVisionEnabled, setGeminiVisionEnabled,
} from '../utils/ai/llm/geminiLLM';
import { B2_LLM_ENGINES, getB2SentenceEngine, setB2SentenceEngine } from '../utils/ai/b2/config';
import RichDocumentEditor from './RichDocumentEditor';

const ENGINE_LABELS = {
  'rule-b2': '규칙 엔진(기본, 외부 전송 없음)',
  'local-7b': '로컬 7B(같은 PC)',
  'private-server-7b': '개인 PC 서버(7B)',
  'private-server-14b': '개인 PC 서버(14B)',
  auto: '자동(개인 PC 서버 감지)',
  gemini: 'Gemini API(외부·인터넷 전송)',
};

const btn = (primary) => ({ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--primary)' : 'white', color: primary ? 'white' : 'var(--text-secondary)' });
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5 };

export default function DocTemplateStudio({ currentUser }) {
  const [list, setList] = useState(() => listTemplatesForAdmin(currentUser));
  const [editing, setEditing] = useState(null); // 편집 중 초안(저장 전 — 관리자만 봄)
  const [msg, setMsg] = useState('');
  const [server, setServer] = useState(getServerConfig());
  const [serverState, setServerState] = useState('');
  const [gemini, setGemini] = useState(getGeminiConfig());
  const [geminiState, setGeminiState] = useState('');
  const [visionEnabled, setVisionEnabled] = useState(isGeminiVisionEnabled());
  const [sentenceEngine, setSentenceEngineState] = useState(getB2SentenceEngine());
  // RichDocumentEditor의 "/" 슬래시 메뉴가 마운트 시점에 이 배열을 캡처하므로 참조가 안정적이어야 한다(useMemo).
  const docFieldOptions = useMemo(() => FIELD_KEYS.map((k) => ({ key: k, label: FIELD_DICTIONARY[k].label })), []);
  const refresh = () => setList(listTemplatesForAdmin(currentUser));
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  if (!isMaster(currentUser)) return null; // 진입 차단(저장 계층에서도 재검사)

  const act = (fn, ...args) => { const r = fn(...args, currentUser); flash(r.ok ? '완료했어요.' : r.error); refresh(); };
  const testServer = async () => {
    setServerState('확인 중…');
    const s = await privateServerAdapter.getStatus();
    setServerState(s.state === 'ready' ? '✅ 연결됨' : `❌ ${s.error || s.state}`);
  };
  const testGemini = async () => {
    setGeminiState('확인 중…');
    const s = await geminiAdapter.getStatus();
    setGeminiState(s.state === 'ready' ? '✅ 연결됨' : `❌ ${s.error || s.state}`);
  };

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>📄 문서 서식 관리 (관리자 전용)</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        워드·한글처럼 자유롭게 서식을 만들고 공개하면, 선생님들이 문서 자동화에서 선택해 쓸 수 있어요.
        본문 중 "/"를 입력하면 필드를 바로 골라 넣을 수 있어요. 서식에는 필드 자리만 저장되고 원아 기록·생성 문서 내용은 저장되지 않아요.
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

      {/* Gemini API 설정(관리자만 — 교사 화면 미노출). 이 경로는 인터넷을 통해 Google 서버로 전송됩니다. */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🔮 Gemini API 설정 — 선택(외부 전송)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="password" value={gemini.apiKey} placeholder="Gemini API 키"
            onChange={(e) => setGemini({ ...gemini, apiKey: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 220 }} />
          <input value={gemini.model} placeholder="모델명 예: gemini-2.5-flash"
            onChange={(e) => setGemini({ ...gemini, model: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
          <button onClick={() => {
            setGeminiConfig(gemini);
            setSentenceEngineState(getB2SentenceEngine());
            flash(gemini.apiKey ? 'Gemini 설정을 저장했어요. 이제 별도 선택 없이 자동으로 AI가 작성해요.' : 'Gemini 설정을 저장했어요.');
          }} style={btn(true)}>저장</button>
          <button onClick={testGemini} style={btn(false)}>연결 확인</button>
          {geminiState && <span style={{ fontSize: 12, alignSelf: 'center' }}>{geminiState}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
          키를 저장하면 별도 선택 없이 자동으로 Gemini가 배움 읽기·교사 지원 문장을 작성해요(관찰내용은 항상 규칙 결과 그대로).
          대상 원아·다른 원아 이름은 비식별화한 제한된 정보만 보내고, 응답이 안전 검수를 통과하지 못하거나 키가 없으면
          자동으로 규칙 엔진 결과를 사용해요. ({GEMINI_KEYS.API_KEY})
        </div>
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}>직접 엔진 선택(선택 사항 — 보통은 몰라도 돼요)</summary>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <select value={sentenceEngine} onChange={(e) => { const next = setB2SentenceEngine(e.target.value); setSentenceEngineState(next); flash('엔진을 변경했어요.'); }} style={{ ...inputStyle, width: 'auto' }}>
              {B2_LLM_ENGINES.map((id) => <option key={id} value={id}>{ENGINE_LABELS[id] || id}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>규칙 엔진을 선택하면 키가 있어도 AI를 쓰지 않아요.</span>
          </div>
        </details>
        {gemini.apiKey && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>📸 사진 분석(Gemini Vision) 허용</span>
              <button onClick={() => {
                const next = !visionEnabled;
                setVisionEnabled(next);
                setGeminiVisionEnabled(next);
                flash(next ? '사진 분석을 켰어요. 이제 사진 기록에서 AI 초안 버튼이 보여요.' : '사진 분석을 껐어요.');
              }} style={{
                width: 44, height: 24, borderRadius: 12,
                background: visionEnabled ? 'var(--primary)' : 'var(--gray-300)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  width: 18, height: 18, background: 'var(--white)', borderRadius: '50%',
                  position: 'absolute', top: 3, left: visionEnabled ? 23 : 3, transition: 'left 0.2s',
                }} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.6 }}>
              "사진 기록" 화면에서 선생님이 초안 생성을 누르면, 첨부한 사진 원본(이름을 가린 텍스트와 달리
              얼굴 등 실제 모습이 그대로 보일 수 있어요)이 Google 서버로 전송돼 활동 설명 문장을 만드는 데만
              쓰이고 저장되지 않아요. 이 토글을 켜지 않으면 "사진 기록"에서 AI 초안 버튼이 보이지 않아요.
              ({GEMINI_KEYS.VISION_ENABLED})
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <div>
          <button onClick={() => setEditing({ title: '', description: '', documentType: 'observation', content: emptyTiptapDoc() })} style={btn(true)}>+ 새 서식 만들기</button>
          <div style={{ marginTop: 10 }}>
            {list.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>아직 서식이 없어요.</div>}
            {list.map((t) => (
              <div key={t.templateId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--gray-100)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 120 }}>
                  {t.title} <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>v{t.version} · {t.archived ? '보관됨' : t.published ? '공개' : '비공개(초안)'}</span>
                </span>
                <button onClick={() => {
                  const clone = JSON.parse(JSON.stringify(t));
                  setEditing(clone.content ? clone : { ...clone, content: convertBlocksToTiptapContent(clone.blocks || []), blocks: undefined });
                }} style={btn(false)}>편집</button>
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
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
            <RichDocumentEditor
              content={editing.content}
              onChange={(content) => setEditing({ ...editing, content })}
              canInsertFields
              baseFields={docFieldOptions}
            />
          </div>
          <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: 10, margin: '8px 0', whiteSpace: 'pre-wrap', fontSize: 12.5 }}>
            <div style={{ fontWeight: 800, fontSize: 11.5, marginBottom: 4 }}>미리보기(빈 값은 안내 문구로 표시)</div>
            {renderInstance(editing, {}).text || '(내용을 입력하세요)'}
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
