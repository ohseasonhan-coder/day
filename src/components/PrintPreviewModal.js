import React from 'react';
import { X, Printer } from 'lucide-react';

// Props: { title, sections: [{title, content}], meta: {date, childName?, className?}, onClose }
export default function PrintPreviewModal({ title, sections, meta, onClose }) {
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('팝업이 차단되었어요. 팝업을 허용해 주세요.'); return; }
    w.document.write(`<html><head><title>${title || '문서'}</title>
<style>
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; margin: 20mm; font-size: 11pt; color: #222; }
  .doc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #333; }
  .doc-header-left { font-size: 10pt; color: #555; }
  .doc-header-right { font-size: 10pt; color: #555; }
  h1 { font-size: 18pt; font-weight: bold; margin: 0 0 12px 0; }
  .meta { color: #666; font-size: 10pt; margin-bottom: 20px; }
  .section { margin-bottom: 22px; break-inside: avoid; }
  .section-title { font-size: 12pt; font-weight: bold; background: #f0f0f0; padding: 6px 10px; margin-bottom: 8px; border-left: 3px solid #4F7FFF; }
  .section-body { line-height: 2; white-space: pre-wrap; font-size: 11pt; }
  .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #999; text-align: right; }
  @media print { @page { margin: 20mm; } }
</style></head><body>
<div class="doc-header">
  <div class="doc-header-left">쌤워크${meta?.className ? ' | ' + meta.className : ''}</div>
  <div class="doc-header-right">${meta?.date || ''}</div>
</div>
<h1>${title || ''}</h1>
<div class="meta">${meta?.date || ''}${meta?.childName ? ' | ' + meta.childName : ''}${meta?.className ? ' | ' + meta.className : ''}</div>
${(sections || []).map(s => `<div class="section"><div class="section-title">${s.title}</div><div class="section-body">${(s.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></div>`).join('')}
<div class="footer">쌤워크 앱으로 자동 생성됨</div>
<script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 1000); };<\/script>
</body></html>`);
    w.document.close();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 600,
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>인쇄 미리보기</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '8px 16px', fontWeight: 800, fontSize: 13 }}
            >
              <Printer size={15} /> 인쇄
            </button>
            <button onClick={onClose} style={{ padding: '8px', borderRadius: 8, background: 'var(--gray-100)', color: 'var(--text-secondary)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--gray-50)' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #333' }}>
              <div style={{ fontSize: 12, color: '#555' }}>쌤워크{meta?.className ? ' | ' + meta.className : ''}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{meta?.date || ''}</div>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{title}</h2>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>
              {meta?.date}{meta?.childName ? ' | ' + meta.childName : ''}{meta?.className ? ' | ' + meta.className : ''}
            </div>
            {(sections || []).map((s, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, background: '#f0f0f0', padding: '6px 10px', borderLeft: '3px solid var(--primary)', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, lineHeight: 2, whiteSpace: 'pre-wrap', color: '#333' }}>{s.content}</div>
              </div>
            ))}
            <div style={{ marginTop: 24, borderTop: '1px solid #ccc', paddingTop: 8, fontSize: 11, color: '#999', textAlign: 'right' }}>쌤워크 앱으로 자동 생성됨</div>
          </div>
        </div>
      </div>
    </div>
  );
}
