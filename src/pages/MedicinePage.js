import React, { useState, useEffect } from 'react';
import { getChildren, getMedicines, addMedicine, updateMedicine, deleteMedicine, today } from '../utils/storage';
import { Pill, Check, Trash2, Copy, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';

const TIMING_OPTIONS = ['점심 전', '점심 후', '오후 간식 후'];

export default function MedicinePage({ isDesktop }) {
  const [children, setChildren] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ childId: '', medicine: '', dose: '', timing: [], reason: '' });
  const [smsModal, setSmsModal] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    setChildren(getChildren());
    setMedicines(getMedicines());
  }, []);

  const todayMeds = medicines.filter(m => m.date === selectedDate);
  const completedCount = todayMeds.filter(m => m.administered).length;

  const handleSubmit = () => {
    if (!form.childId || !form.medicine || !form.dose || form.timing.length === 0) {
      alert('아이, 약 이름, 용량, 투약 시간을 모두 입력해 주세요.');
      return;
    }
    addMedicine({ ...form, date: selectedDate, administered: false, adminTime: null, note: '' });
    setMedicines(getMedicines());
    setForm({ childId: '', medicine: '', dose: '', timing: [], reason: '' });
    setShowForm(false);
  };

  const handleToggleAdminister = (id) => {
    const med = medicines.find(m => m.id === id);
    if (!med) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    updateMedicine(id, { administered: !med.administered, adminTime: !med.administered ? timeStr : null });
    setMedicines(getMedicines());
  };

  const handleDelete = (id) => {
    if (!window.confirm('삭제할까요?')) return;
    deleteMedicine(id);
    setMedicines(getMedicines());
  };

  const handleSmsModal = (med) => {
    const child = children.find(c => c.id === med.childId);
    if (!med.administered || !child) return;
    const text = `안녕하세요, ${child.name} 부모님. ${med.adminTime}에 ${med.medicine} ${med.dose}를 투약 완료하였습니다. 특이사항 없이 잘 지내고 있습니다.`;
    setSmsModal(text);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast('복사했어요! 📋', 'success'));
  };

  const toggleTiming = (t) => {
    setForm(prev => ({
      ...prev,
      timing: prev.timing.includes(t) ? prev.timing.filter(x => x !== t) : [...prev.timing, t]
    }));
  };

  const cardStyle = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: 'var(--shadow-sm)' };

  return (
    <div style={{ padding: isDesktop ? '32px 36px' : '20px 20px 0', maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>💊 투약 관리</div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pill size={15} /> 투약 의뢰 등록
        </button>
      </div>

      {/* Date Selector */}
      <div style={{ marginBottom: 20 }}>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--white)' }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ ...cardStyle, marginBottom: 0, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)' }}>{todayMeds.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>오늘 총 의뢰</div>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#4CAF50' }}>{completedCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>투약 완료</div>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: todayMeds.length - completedCount > 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{todayMeds.length - completedCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>대기 중</div>
        </div>
      </div>

      {/* Medicine List */}
      {todayMeds.length === 0 ? (
        <EmptyState emoji="💊" title="오늘 투약 의뢰가 없어요" desc="투약이 필요한 아이가 있으면 등록해주세요" actionLabel="투약 의뢰 등록" onAction={() => setShowForm(true)} />
      ) : (
        todayMeds.map(med => {
          const child = children.find(c => c.id === med.childId);
          return (
            <div key={med.id} style={{ ...cardStyle, borderLeft: `4px solid ${med.administered ? '#4CAF50' : 'var(--primary)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>
                    {child?.name?.[0] || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{child?.name || '(삭제된 아이)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{med.timing?.join(', ')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {med.administered && (
                    <button onClick={() => handleSmsModal(med)} style={{ fontSize: 11, background: '#E8F5E9', color: '#388E3C', borderRadius: 8, padding: '5px 8px', fontWeight: 700 }}>문자 생성</button>
                  )}
                  <button onClick={() => handleDelete(med.id)} style={{ color: 'var(--text-tertiary)', padding: 4 }}><Trash2 size={15} /></button>
                </div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
                <span style={{ fontWeight: 800 }}>{med.medicine}</span> <span style={{ color: 'var(--text-secondary)' }}>{med.dose}</span>
                {med.reason && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>({med.reason})</span>}
              </div>
              <button
                onClick={() => handleToggleAdminister(med.id)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 14,
                  background: med.administered ? '#E8F5E9' : 'var(--primary)',
                  color: med.administered ? '#388E3C' : 'white',
                  border: med.administered ? '1.5px solid #4CAF50' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <Check size={15} />
                {med.administered ? `투약 완료 (${med.adminTime})` : '✅ 투약 완료 처리'}
              </button>
            </div>
          );
        })
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>투약 의뢰 등록</div>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>아이 선택</label>
            <select value={form.childId} onChange={e => setForm(p => ({...p, childId: e.target.value}))}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 14, background: 'var(--white)' }}>
              <option value="">-- 선택 --</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>약 이름</label>
            <input value={form.medicine} onChange={e => setForm(p => ({...p, medicine: e.target.value}))} placeholder="예: 타이레놀 시럽"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>용량</label>
            <input value={form.dose} onChange={e => setForm(p => ({...p, dose: e.target.value}))} placeholder="예: 5ml, 1정"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>투약 시간</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {TIMING_OPTIONS.map(t => (
                <button key={t} onClick={() => toggleTiming(t)} style={{
                  padding: '8px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
                  background: form.timing.includes(t) ? 'var(--primary)' : 'var(--gray-100)',
                  color: form.timing.includes(t) ? 'white' : 'var(--text-secondary)',
                }}>
                  {t}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>투약 이유 (선택)</label>
            <input value={form.reason} onChange={e => setForm(p => ({...p, reason: e.target.value}))} placeholder="예: 발열, 기침"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }} />
            <button onClick={handleSubmit} style={{ width: '100%', background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '13px', fontWeight: 800, fontSize: 15 }}>
              저장
            </button>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--white)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>📱 부모 알림 문자</div>
              <button onClick={() => setSmsModal(null)}><X size={20} /></button>
            </div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 14 }}>
              {smsModal}
            </div>
            <button onClick={() => handleCopy(smsModal)} style={{ width: '100%', background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '12px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Copy size={15} /> 복사하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
