import React, { useState, useEffect } from 'react';
import { getChildren, getClasses, getAccidents, addAccident, deleteAccident, updateAccident, today } from '../utils/storage';
import { AlertTriangle, FileText, Trash2, Copy, X, Check } from 'lucide-react';

function generateAccidentReport(accident, child, cl) {
  return `사고·상해 보고서

원 명: ${cl?.name || ''}
반 명: ${cl ? `${cl.age}세반` : ''}
원아명: ${child?.name || ''}
발생일시: ${accident.date} ${accident.time}
발생장소: ${accident.location}

【사고 경위】
${accident.situation}

【상해 부위 및 상태】
${accident.injury}

【처치 내용】
${accident.treatment}

【부모 통보 여부】
${accident.parentNotified ? '통보 완료' : '미통보'}

작성일: ${new Date().toLocaleDateString('ko-KR')}
담당 교사: ___________`.trim();
}

function generateParentSms(accident, child) {
  return `안녕하세요, ${child?.name || ''} 부모님. ${accident.date} ${accident.time}경 ${accident.location}에서 ${accident.injury} 상황이 있었습니다. ${accident.treatment} 처치를 하였으며 현재는 안정적입니다. 자세한 내용은 귀가 시 알려드리겠습니다.`;
}

export default function AccidentPage({ isDesktop }) {
  const [children, setChildren] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [accidents, setAccidents] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [reportModal, setReportModal] = useState(null);
  const [smsModal, setSmsModal]   = useState(null);
  const [copied, setCopied]       = useState(false);
  const [form, setForm] = useState({ childId: '', date: today(), time: '', location: '', situation: '', injury: '', treatment: '' });

  useEffect(() => {
    setChildren(getChildren());
    setClasses(getClasses());
    setAccidents(getAccidents());
  }, []);

  const handleSubmit = () => {
    if (!form.childId || !form.date || !form.time || !form.location || !form.situation || !form.injury || !form.treatment) {
      alert('모든 필드를 입력해 주세요.');
      return;
    }
    addAccident({ ...form, parentNotified: false, reportGenerated: false });
    setAccidents(getAccidents());
    setForm({ childId: '', date: today(), time: '', location: '', situation: '', injury: '', treatment: '' });
    setShowForm(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('삭제할까요?')) return;
    deleteAccident(id);
    setAccidents(getAccidents());
  };

  const handleToggleParent = (id) => {
    const acc = accidents.find(a => a.id === id);
    if (!acc) return;
    updateAccident(id, { parentNotified: !acc.parentNotified });
    setAccidents(getAccidents());
  };

  const handleReport = (acc) => {
    const child = children.find(c => c.id === acc.childId);
    const cl    = classes[0];
    setReportModal(generateAccidentReport(acc, child, cl));
  };

  const handleSms = (acc) => {
    const child = children.find(c => c.id === acc.childId);
    setSmsModal(generateParentSms(acc, child));
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const handlePrint = (text) => {
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:sans-serif;line-height:1.7;padding:30px;font-size:14px;">${text}</pre>`);
    win.print();
  };

  const cardStyle = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: 'var(--shadow-sm)' };
  const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', background: 'var(--white)' };

  return (
    <div style={{ padding: isDesktop ? '32px 36px' : '20px 20px 0', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>🚨 사고·상해 기록</div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} /> 새 사고 기록
        </button>
      </div>

      {accidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)', fontSize: 15 }}>사고·상해 기록이 없어요.</div>
      ) : (
        [...accidents].reverse().map(acc => {
          const child = children.find(c => c.id === acc.childId);
          return (
            <div key={acc.id} style={{ ...cardStyle, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 2 }}>{child?.name || '(삭제된 아이)'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{acc.date} {acc.time} · {acc.location}</div>
                </div>
                <button onClick={() => handleDelete(acc.id)} style={{ color: 'var(--text-tertiary)', padding: 4 }}><Trash2 size={15} /></button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.6 }}>
                <strong>상해:</strong> {acc.injury}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                <strong>처치:</strong> {acc.treatment}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => handleReport(acc)} style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <FileText size={13} /> 보고서 생성
                </button>
                <button onClick={() => handleSms(acc)} style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background: '#FFF3E0', color: '#E65100', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  📱 부모 문자
                </button>
                <button onClick={() => handleToggleParent(acc.id)} style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background: acc.parentNotified ? '#E8F5E9' : 'var(--gray-100)', color: acc.parentNotified ? '#388E3C' : 'var(--text-secondary)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Check size={13} /> {acc.parentNotified ? '통보 완료' : '부모 통보'}
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>새 사고 기록</div>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>아이 선택</label>
            <select value={form.childId} onChange={e => setForm(p => ({...p, childId: e.target.value}))} style={inputStyle}>
              <option value="">-- 선택 --</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>날짜</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>시간</label>
                <input type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} style={inputStyle} />
              </div>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>발생 장소</label>
            <input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} placeholder="예: 교실, 바깥놀이터" style={inputStyle} />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>상황 (어떻게 발생했는지)</label>
            <textarea value={form.situation} onChange={e => setForm(p => ({...p, situation: e.target.value}))} rows={3} placeholder="사고 발생 상황을 자세히 기록해 주세요."
              style={{ ...inputStyle, resize: 'vertical' }} />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>상해 부위 및 상태</label>
            <input value={form.injury} onChange={e => setForm(p => ({...p, injury: e.target.value}))} placeholder="예: 오른쪽 무릎 찰과상" style={inputStyle} />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>처치 내용</label>
            <input value={form.treatment} onChange={e => setForm(p => ({...p, treatment: e.target.value}))} placeholder="예: 소독 후 밴드 처치" style={inputStyle} />
            <button onClick={handleSubmit} style={{ width: '100%', background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '13px', fontWeight: 800, fontSize: 15, marginTop: 4 }}>
              저장
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>📄 사고·상해 보고서</div>
              <button onClick={() => setReportModal(null)}><X size={20} /></button>
            </div>
            <pre style={{ background: 'var(--gray-50)', borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginBottom: 14 }}>{reportModal}</pre>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => handleCopy(reportModal)} style={{ padding: '11px', borderRadius: 10, background: copied ? '#4CAF50' : 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Copy size={14} /> {copied ? '복사됐어요!' : '복사하기'}
              </button>
              <button onClick={() => handlePrint(reportModal)} style={{ padding: '11px', borderRadius: 10, background: 'var(--gray-800)', color: 'white', fontWeight: 800, fontSize: 14 }}>
                🖨️ 인쇄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>📱 부모 안내 문자</div>
              <button onClick={() => setSmsModal(null)}><X size={20} /></button>
            </div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 14 }}>{smsModal}</div>
            <button onClick={() => handleCopy(smsModal)} style={{ width: '100%', background: copied ? '#4CAF50' : 'var(--primary)', color: 'white', borderRadius: 10, padding: '12px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Copy size={15} /> {copied ? '복사됐어요!' : '복사하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
