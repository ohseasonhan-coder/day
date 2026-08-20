// 사이트 관리(관리자 전용) — 공개 페이지 추가/편집/공개, 로그인·대시보드 문구 편집, 기본 색상 편집.
// 이 앱은 백엔드가 없으므로 "공개"는 이 기기(브라우저)에 로그인한 사람 기준이다.
// 문서 서식(DocTemplateStudio)과 같은 자리(설정 → 관리자 탭)에 나란히 놓인다 — 새 화면 이동 없음.
import React, { useState } from 'react';
import { isMaster } from '../utils/auth';
import { getSiteContent, setSiteContent } from '../utils/storage';
import {
  getSitePages, createBlankSitePage, saveSitePage, setSitePagePublished, deleteSitePage,
} from '../utils/sitePages';
import { getCustomFields, saveCustomField, deleteCustomField } from '../utils/customFields';
import { stripImageSrcForStorage, hydrateImageSrc } from '../utils/photoStore';
import RichDocumentEditor from './RichDocumentEditor';

const btn = (primary) => ({ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--primary)' : 'white', color: primary ? 'white' : 'var(--text-secondary)' });
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5 };

const CONTENT_SLOTS = [
  ['loginHeadline', '로그인 화면 제목', '쌤워크'],
  ['loginTagline', '로그인 화면 부제', '선생님은 기록만, 문서는 앱이.'],
  ['loginGoogleIntro', '로그인 화면 구글 안내문', '별도 회원가입 없이 구글 계정 하나로 로그인하고, 기록은 자동으로 본인 구글 드라이브에 백업돼요.'],
  ['dashboardTaglineSuffix', '대시보드 반 이름 뒤 문구', ' 업무 자동화'],
];

export default function SiteManager({ currentUser }) {
  const [pages, setPages] = useState(() => getSitePages());
  const [editingPage, setEditingPage] = useState(null); // null = 목록, 객체 = 편집 중
  const [siteContent, setSiteContentState] = useState(() => getSiteContent());
  const [customFields, setCustomFields] = useState(() => getCustomFields());
  const [newField, setNewField] = useState({ label: '', value: '' });
  const [msg, setMsg] = useState('');
  const refreshPages = () => setPages(getSitePages());
  const refreshCustomFields = () => setCustomFields(getCustomFields());
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };

  if (!isMaster(currentUser)) return null; // 진입 차단(저장 계층에서도 재검사)

  const openNew = () => setEditingPage(createBlankSitePage({}));
  const openEdit = async (p) => {
    const hydrated = await hydrateImageSrc(p.content); // IndexedDB에서 실제 이미지 불러오기
    setEditingPage({ ...p, content: hydrated });
  };
  const savePage = () => {
    const stripped = { ...editingPage, content: stripImageSrcForStorage(editingPage.content) }; // localStorage엔 참조만
    const r = saveSitePage(stripped, currentUser);
    if (!r.ok) { flash(r.error); return; }
    refreshPages();
    setEditingPage(null);
    flash('페이지를 저장했어요.');
  };
  const togglePublish = (p) => {
    const r = setSitePagePublished(p.id, !p.published, currentUser);
    if (!r.ok) { flash(r.error); return; }
    refreshPages();
  };
  const removePage = (p) => {
    if (!window.confirm(`"${p.title}" 페이지를 삭제할까요?`)) return;
    const r = deleteSitePage(p.id, currentUser);
    if (!r.ok) { flash(r.error); return; }
    refreshPages();
    flash('삭제했어요.');
  };

  const saveContentField = (key, value) => {
    const next = setSiteContent({ [key]: value });
    setSiteContentState(next);
  };
  const applyColor = (hex) => {
    document.documentElement.style.setProperty('--primary', hex);
    saveContentField('primaryColor', hex);
  };

  const addCustomField = () => {
    const r = saveCustomField(newField, currentUser);
    if (!r.ok) { flash(r.error); return; }
    setNewField({ label: '', value: '' });
    refreshCustomFields();
    flash('필드를 만들었어요.');
  };
  const removeCustomField = (f) => {
    if (!window.confirm(`"${f.label}" 필드를 삭제할까요? 이 필드를 쓰던 문서에는 더 이상 값이 채워지지 않아요.`)) return;
    deleteCustomField(f.id, currentUser);
    refreshCustomFields();
  };

  if (editingPage) {
    return (
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={editingPage.title} placeholder="페이지 제목"
            onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
            style={{ ...inputStyle, flex: 1, minWidth: 160, fontWeight: 800 }} />
          <button onClick={() => setEditingPage(null)} style={btn(false)}>취소</button>
          <button onClick={savePage} style={btn(true)}>저장</button>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <RichDocumentEditor
            content={editingPage.content}
            onChange={(content) => setEditingPage({ ...editingPage, content })}
            canInsertFields
            fieldScope="customOnly"
            photoOwnerId={`page_${editingPage.id}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>🌐 사이트 관리 (관리자 전용)</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        로그인 화면·대시보드 문구, 기본 색상, 안내용 공개 페이지를 코드 수정 없이 직접 편집해요.
        이 앱은 서버가 없어서 "공개"는 이 기기에 로그인한 사람 기준입니다(다른 기기·인터넷에는 노출되지 않아요).
      </div>
      {msg && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>{msg}</div>}

      {/* 공개 페이지 */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>📄 공개 페이지</div>
        <button onClick={openNew} style={{ ...btn(true), marginBottom: 8 }}>+ 새 페이지</button>
        {pages.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>아직 만든 페이지가 없어요.</div>
        ) : pages.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
            <strong style={{ flex: 1, minWidth: 100 }}>{p.title}</strong>
            <span style={{ color: p.published ? 'var(--primary)' : 'var(--text-tertiary)', fontWeight: 700 }}>{p.published ? '공개' : '비공개'}</span>
            <button onClick={() => openEdit(p)} style={btn(false)}>편집</button>
            <button onClick={() => togglePublish(p)} style={btn(p.published)}>{p.published ? '비공개로' : '공개로'}</button>
            <button onClick={() => removePage(p)} style={{ ...btn(false), color: '#DC2626' }}>삭제</button>
          </div>
        ))}
      </div>

      {/* 화면 문구 */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>✏️ 화면 문구</div>
        {CONTENT_SLOTS.map(([key, label, placeholder]) => (
          <label key={key} style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</span>
            <input
              defaultValue={siteContent[key] || ''}
              placeholder={placeholder}
              onBlur={(e) => saveContentField(key, e.target.value)}
              style={inputStyle}
            />
          </label>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>비워 두면 기존 기본 문구가 그대로 쓰여요. 입력 후 다른 곳을 클릭하면 바로 저장돼요.</div>
      </div>

      {/* 커스텀 필드 */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🏷️ 커스텀 필드</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          "원장님 이름", "전화번호"처럼 직접 이름과 값을 만들어 두면, 공개 페이지 편집기에서 필드로 삽입할 수 있어요.
        </div>
        {customFields.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
            <strong style={{ minWidth: 90 }}>{f.label}</strong>
            <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 100 }}>{f.value || '(비어 있음)'}</span>
            <button onClick={() => removeCustomField(f)} style={{ ...btn(false), color: '#DC2626' }}>삭제</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <input value={newField.label} placeholder="필드 이름 (예: 원장님 이름)"
            onChange={(e) => setNewField({ ...newField, label: e.target.value })}
            style={{ ...inputStyle, flex: 1, minWidth: 130 }} />
          <input value={newField.value} placeholder="값 (예: 홍길동)"
            onChange={(e) => setNewField({ ...newField, value: e.target.value })}
            style={{ ...inputStyle, flex: 1, minWidth: 130 }} />
          <button onClick={addCustomField} style={btn(true)}>+ 추가</button>
        </div>
      </div>

      {/* 디자인 */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🎨 디자인</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)' }}>기본 색상</span>
          <input type="color" value={siteContent.primaryColor || '#4F7FFF'} onChange={(e) => applyColor(e.target.value)} style={{ width: 44, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 6 }} />
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>버튼·강조 색상에 바로 적용돼요(새로고침해도 유지).</div>
      </div>
    </div>
  );
}
