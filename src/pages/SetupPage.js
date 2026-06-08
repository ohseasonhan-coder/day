import React, { useState } from 'react';
import { saveClasses, saveChildren, saveApiKey, genId } from '../utils/storage';
import { ChevronRight, Plus, Trash2, BookOpen } from 'lucide-react';

const S = {
  container: {
    minHeight: '100vh', padding: '40px 24px 48px',
    background: 'linear-gradient(160deg, #EBF0FF 0%, #F8FAFE 40%)',
    display: 'flex', flexDirection: 'column',
  },
  logo: { fontSize: 32, fontWeight: 800, color: 'var(--primary)', marginBottom: 8, letterSpacing: '-1px' },
  tagline: { color: 'var(--text-secondary)', fontSize: 15, marginBottom: 40 },
  card: {
    background: 'white', borderRadius: 20, padding: 24,
    boxShadow: 'var(--shadow-md)', marginBottom: 16,
  },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' },
  input: {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid var(--border)', fontSize: 15, outline: 'none',
    transition: 'border-color 0.15s',
    background: 'var(--gray-50)',
    color: 'var(--text-primary)',
  },
  row: { display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' },
  btn: {
    padding: '14px 20px', borderRadius: 14, fontWeight: 600, fontSize: 15,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
  },
  step: { fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4, letterSpacing: '0.5px' },
  sectionTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' },
  desc: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.7 },
};

export default function SetupPage({ onComplete }) {
  const [step, setStep] = useState(1); // 1: class info, 2: children, 3: api key
  const [className, setClassName] = useState('');
  const [classAge, setClassAge] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [childInput, setChildInput] = useState('');
  const [children, setChildren] = useState([]);
  const [apiKey, setApiKey] = useState('');

  const addChild = () => {
    const names = childInput.split(/[,\n\s]+/).map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    setChildren(prev => [...prev, ...names.map(name => ({ id: genId(), name }))]);
    setChildInput('');
  };

  const removeChild = (id) => setChildren(prev => prev.filter(c => c.id !== id));

  const handleNext = () => {
    if (step === 1) {
      if (!className.trim()) return alert('반 이름을 입력해주세요');
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      // Save everything
      const classId = genId();
      saveClasses([{ id: classId, name: className, age: classAge, year }]);
      saveChildren(children.map(c => ({ ...c, classId })));
      if (apiKey.trim()) saveApiKey(apiKey.trim());
      onComplete();
    }
  };

  return (
    <div style={S.container}>
      <div style={S.logo}>쌤워크</div>
      <div style={S.tagline}>선생님은 기록만, 문서는 앱이.</div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: s <= step ? 'var(--primary)' : 'var(--gray-200)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div style={S.card} className="slide-up">
          <div style={S.step}>1단계</div>
          <div style={S.sectionTitle}>우리 반을 설정해요</div>
          <div style={S.desc}>한 번만 설정하면 계속 사용할 수 있어요</div>

          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>학년도</div>
            <input style={S.input} value={year} onChange={e => setYear(e.target.value)} placeholder="2026" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>반 이름</div>
            <input style={S.input} value={className} onChange={e => setClassName(e.target.value)} placeholder="예: 햇살반, 별빛반" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={S.label}>연령</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['0', '1', '2', '3', '4', '5'].map(age => (
                <button
                  key={age}
                  onClick={() => setClassAge(age)}
                  style={{
                    ...S.btn, flex: 1, padding: '10px 4px', fontSize: 14,
                    background: classAge === age ? 'var(--primary)' : 'var(--gray-100)',
                    color: classAge === age ? 'white' : 'var(--text-secondary)',
                    borderRadius: 10,
                  }}
                >
                  {age}세
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={S.card} className="slide-up">
          <div style={S.step}>2단계</div>
          <div style={S.sectionTitle}>아이들을 등록해요</div>
          <div style={S.desc}>이름을 쉼표나 줄바꿈으로 구분해서 입력하면 한 번에 추가돼요. 나중에도 추가할 수 있어요.</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <textarea
              style={{ ...S.input, resize: 'none', height: 80, flex: 1 }}
              value={childInput}
              onChange={e => setChildInput(e.target.value)}
              placeholder="하준, 윤재, 서연&#10;이름을 입력하세요"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addChild())}
            />
            <button onClick={addChild} style={{
              ...S.btn, background: 'var(--primary)', color: 'white',
              padding: '0 16px', alignSelf: 'stretch', borderRadius: 12,
            }}>
              <Plus size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {children.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--primary-light)', color: 'var(--primary)',
                padding: '6px 12px', borderRadius: 'var(--radius-full)',
                fontSize: 14, fontWeight: 500,
              }}>
                {c.name}
                <button onClick={() => removeChild(c.id)} style={{ color: 'var(--primary)', opacity: 0.6, lineHeight: 1 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          {children.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '20px 0' }}>
              아직 등록된 아이가 없어요
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={S.card} className="slide-up">
          <div style={S.step}>3단계</div>
          <div style={S.sectionTitle}>AI 설정</div>
          <div style={S.desc}>
            Anthropic API 키를 입력하면 AI가 기록을 자동으로 분류하고 문서를 생성합니다.<br />
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 500 }}>
              console.anthropic.com
            </a>에서 무료로 발급받을 수 있어요.
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={S.label}>API 키</div>
            <input
              style={S.input}
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            키는 기기에만 저장되며 외부로 전송되지 않습니다. 나중에 설정에서 입력할 수도 있어요.
          </div>

          <div style={{ marginTop: 20, padding: 16, background: 'var(--primary-light)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              <BookOpen size={16} /> API 키 없이도 사용 가능
            </div>
            <div style={{ fontSize: 13, color: 'var(--primary)', opacity: 0.8, lineHeight: 1.6 }}>
              API 키 없이도 기록 저장, 조회, 문서 복사 기능을 사용할 수 있습니다. AI 자동 분류와 문서 생성만 제한됩니다.
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleNext}
        style={{
          ...S.btn,
          background: 'var(--primary)', color: 'white',
          fontSize: 16, padding: '16px',
          boxShadow: '0 4px 16px rgba(79,127,255,0.35)',
          marginTop: 'auto',
        }}
      >
        {step === 3 ? '시작하기' : '다음'}
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
