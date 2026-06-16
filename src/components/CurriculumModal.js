import React, { useState } from 'react';
import { CURRICULUM_AGES, getCurriculum } from '../utils/standardCurriculum';
import { BookOpen, X, Copy, Check, CornerDownLeft } from 'lucide-react';
import { useToast } from './Toast';

const AREA_COLORS = {
  '신체운동·건강': '#4CAF50',
  '의사소통':     '#4F7FFF',
  '사회관계':     '#9C27B0',
  '예술경험':     '#E91E9A',
  '자연탐구':     '#FF8C42',
};

// 표준보육과정(2024 개정) 참고 모달. onInsert가 있으면 문장을 기록에 삽입할 수 있다.
export default function CurriculumModal({ isOpen, onClose, onInsert, defaultAgeKey = 'age35' }) {
  const showToast = useToast();
  const [ageKey, setAgeKey] = useState(defaultAgeKey);
  const [area, setArea] = useState('신체운동·건강');
  const [copied, setCopied] = useState('');

  if (!isOpen) return null;

  const data = getCurriculum(ageKey);
  const areaData = data[area];
  const color = AREA_COLORS[area] || 'var(--primary)';

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(''), 1200);
    showToast('복사했어요 📋', 'success');
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(10,20,50,0.55)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 620, maxHeight: '88vh', background: 'var(--white)',
        borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="var(--primary)" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{ageKey === 'age35' ? '누리과정' : '표준보육과정'} 참고</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ageKey === 'age35' ? '2019 개정 누리과정' : '2024 개정 표준보육과정'} · 영역별 목표와 내용</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* 연령 선택 */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px 8px', flexWrap: 'wrap' }}>
          {CURRICULUM_AGES.map(a => (
            <button key={a.key} onClick={() => setAgeKey(a.key)} style={{
              padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 800,
              background: ageKey === a.key ? 'var(--gray-800)' : 'var(--gray-100)',
              color: ageKey === a.key ? 'white' : 'var(--text-secondary)',
            }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* 영역 선택 */}
        <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px', overflowX: 'auto' }}>
          {Object.keys(data).map(ar => (
            <button key={ar} onClick={() => setArea(ar)} style={{
              padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
              background: area === ar ? `${AREA_COLORS[ar]}1a` : 'transparent',
              color: area === ar ? AREA_COLORS[ar] : 'var(--text-tertiary)',
              border: `1.5px solid ${area === ar ? AREA_COLORS[ar] : 'var(--border)'}`,
            }}>
              {ar}
            </button>
          ))}
        </div>

        {/* 내용 */}
        <div style={{ overflowY: 'auto', padding: '4px 20px 24px', flex: 1 }}>
          {/* 목표 */}
          {areaData?.goal && (
            <div style={{ background: `${color}10`, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color, marginBottom: 6 }}>🎯 목표</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, fontWeight: 700, marginBottom: 6 }}>{areaData.goal[0]}</div>
              {areaData.goal.slice(1).map((g, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{i + 1}) {g}</div>
              ))}
            </div>
          )}

          {/* 내용범주 + 내용 */}
          {areaData?.categories?.map(cat => (
            <div key={cat.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>{cat.name}</span>
              </div>
              {cat.items.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>{item}</span>
                  {onInsert && (
                    <button onClick={() => { onInsert(item); showToast('기록에 넣었어요 ✏️', 'success'); }} title="기록에 삽입"
                      style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CornerDownLeft size={14} />
                    </button>
                  )}
                  <button onClick={() => handleCopy(item)} title="복사"
                    style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'var(--gray-100)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {copied === item ? <Check size={14} color="var(--cat-play)" /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>
          ))}

          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
            출처: 2024 개정 표준보육과정 (교육부고시 제2024-23호)<br />· 0~1세 · 2세 · 3~5세 공통 5개 영역
          </div>
        </div>
      </div>
    </div>
  );
}
