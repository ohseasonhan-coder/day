import React, { useState, useEffect } from 'react';
import { getNewsletters, addNewsletter, deleteNewsletter, getClasses } from '../utils/storage';
import { buildMonthlyNewsletter } from '../utils/planningDocs';
import { Newspaper, Trash2, Copy, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const TEMPLATES = {
  '행사 안내':   '이번 달에는 다음과 같은 행사가 예정되어 있습니다.\n\n【행사 일정】\n- 날짜: \n- 장소: \n- 준비물: \n\n원활한 행사 진행을 위해 협조 부탁드립니다.',
  '준비물 안내': '가정에서 다음 준비물을 보내주시면 감사하겠습니다.\n\n【준비물 목록】\n- \n- \n\n보내주실 날짜: \n문의: 담임교사',
  '건강 안내':   '최근 원내 건강 관련 안내사항을 전달드립니다.\n\n【건강 유의사항】\n\n아이들의 건강한 생활을 위해 가정에서도 관심 부탁드립니다.',
  '방학 안내':   '방학 기간 안내드립니다.\n\n【방학 일정】\n방학 시작: \n개학 일: \n\n방학 중 긴급 연락처: \n\n즐거운 방학 되세요!',
  '자유 작성':   '',
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function NewsletterPage({ isDesktop }) {
  const [newsletters, setNewsletters] = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  const [copied, setCopied]           = useState(false);
  const [form, setForm] = useState({ title: '', month: currentMonth(), content: '' });
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    setNewsletters(getNewsletters());
  }, []);

  const handleTemplateSelect = (name) => {
    setSelectedTemplate(name);
    setForm(p => ({ ...p, content: TEMPLATES[name] }));
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) {
      alert('제목과 본문을 입력해 주세요.');
      return;
    }
    addNewsletter({ title: form.title, month: form.month, content: form.content });
    setNewsletters(getNewsletters());
    setForm({ title: '', month: currentMonth(), content: '' });
    setSelectedTemplate('');
    setShowForm(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('삭제할까요?')) return;
    deleteNewsletter(id);
    setNewsletters(getNewsletters());
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const handlePrint = (nl) => {
    const win = window.open('', '_blank');
    win.document.write(`<div style="font-family:sans-serif;padding:40px;max-width:700px;margin:0 auto;"><h2>${nl.title}</h2><p style="color:#666;">${nl.month}</p><pre style="line-height:1.8;white-space:pre-wrap;font-family:inherit;">${nl.content}</pre></div>`);
    win.print();
  };

  const cardStyle = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: 'var(--shadow-sm)' };

  return (
    <div style={{ padding: isDesktop ? '32px 36px' : '20px 20px 0', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>📰 가정통신문</div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Newspaper size={15} /> 새 가정통신문
        </button>
      </div>

      {newsletters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)', fontSize: 15 }}>
          작성된 가정통신문이 없어요.
        </div>
      ) : (
        [...newsletters].reverse().map(nl => {
          const expanded = expandedId === nl.id;
          return (
            <div key={nl.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 12 : 0 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{nl.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {nl.month} · {new Date(nl.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => handleCopy(nl.content)} style={{ minWidth:64, minHeight:34, color: 'var(--text-secondary)', background:'var(--gray-100)', borderRadius:10, padding:'7px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:13, fontWeight:900 }}><Copy size={14} /> 복사</button>
                  <button onClick={() => handlePrint(nl)} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-light)', borderRadius: 7, padding: '4px 8px' }}>인쇄</button>
                  <button onClick={() => handleDelete(nl.id)} style={{ color: 'var(--text-tertiary)', padding: 4 }}><Trash2 size={15} /></button>
                  <button onClick={() => setExpandedId(expanded ? null : nl.id)} style={{ color: 'var(--text-secondary)', padding: 4 }}>
                    {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </button>
                </div>
              </div>
              {expanded && (
                <pre style={{ background: 'var(--gray-50)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-primary)', marginTop: 4 }}>
                  {nl.content}
                </pre>
              )}
            </div>
          );
        })
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>새 가정통신문</div>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>제목</label>
            <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="예: 5월 가정통신문"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>월</label>
            <input type="month" value={form.month} onChange={e => setForm(p => ({...p, month: e.target.value}))}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', background: 'var(--white)' }} />
            <button
              onClick={() => {
                const cl = getClasses()[0];
                const m = parseInt((form.month || '').split('-')[1] || `${new Date().getMonth() + 1}`, 10);
                setForm(p => ({ ...p, title: p.title || `${m}월 가정통신문`, content: buildMonthlyNewsletter({ className: cl?.name }) }));
                setSelectedTemplate('');
              }}
              style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14, boxShadow: '0 6px 18px rgba(79,127,255,0.28)' }}
            >
              <Sparkles size={16} /> 이달의 가정통신문 자동 만들기
            </button>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>또는 템플릿 선택</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
              {Object.keys(TEMPLATES).map(name => (
                <button key={name} onClick={() => handleTemplateSelect(name)} style={{
                  padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                  background: selectedTemplate === name ? 'var(--primary)' : 'var(--gray-100)',
                  color: selectedTemplate === name ? 'white' : 'var(--text-secondary)',
                }}>
                  {name}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>본문</label>
            <textarea value={form.content} onChange={e => setForm(p => ({...p, content: e.target.value}))} rows={10}
              placeholder="본문을 입력하거나 위에서 템플릿을 선택해 주세요."
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 20, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.7 }} />
            <button onClick={handleSubmit} style={{ width: '100%', background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '13px', fontWeight: 800, fontSize: 15 }}>
              저장
            </button>
          </div>
        </div>
      )}

      {/* Copy toast */}
      {copied && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#333', color: 'white', padding: '10px 22px', borderRadius: 100, fontSize: 13, fontWeight: 700, zIndex: 2000 }}>
          복사됐어요!
        </div>
      )}
    </div>
  );
}
