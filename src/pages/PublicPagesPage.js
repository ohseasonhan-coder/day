// 공개 페이지 열람 — 관리자가 "사이트 관리"에서 만든 안내 페이지를 목록에서 골라 본다.
// 이 앱은 서버가 없어서 "공개"는 이 기기(브라우저)에 로그인한 사람 기준이다.
import React, { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { listPublishedSitePages } from '../utils/sitePages';
import { renderRichDocumentHtml } from '../utils/documentStudio';

export default function PublicPagesPage() {
  const [pages] = useState(() => listPublishedSitePages());
  const [open, setOpen] = useState(null);

  if (open) {
    return (
      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        <button onClick={() => setOpen(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', background: 'none', marginBottom: 14 }}>
          <ArrowLeft size={16} /> 목록
        </button>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>{open.title}</div>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px', lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: renderRichDocumentHtml(open.content, {}) }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>공개 페이지</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14 }}>관리자가 만들어 둔 안내 페이지예요.</div>
      {pages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>아직 공개된 페이지가 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pages.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)} style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
              background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14,
              padding: '14px 16px', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)',
            }}>
              <FileText size={18} color="var(--primary)" />
              {p.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
