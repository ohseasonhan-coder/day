// 사진 기록 — 여러 장의 사진을 한 번에 올려 원아별로 배정하고, Gemini Vision(관리자 opt-in)으로
// 활동 초안 문장을 만든 뒤, 기존 오늘기록과 동일한 파이프라인(processRecord→addRecord→savePhotos→
// onRecordSaved)으로 저장한다. 어떤 사진이 어느 원아인지는 항상 교사가 직접 고른다(AI가 얼굴로
// 원아를 추정하지 않음). Gemini가 사진 분석에 쓰이지 않도록(opt-in 미설정) 되어 있어도 화면 자체는
// 수동 입력 기록 도구로 계속 쓸 수 있다.
import React, { useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { getChildren, getClasses, addRecord, today, getSettings } from '../utils/storage';
import { processRecord } from '../utils/ai';
import { compressImage, savePhotos } from '../utils/photoStore';
import { onRecordSaved } from '../utils/documentInstances';
import { getGeminiConfig, isGeminiVisionEnabled } from '../utils/ai/llm/geminiLLM';
import { generatePhotoObservationDraft } from '../utils/ai/llm/photoObservation';
import { Camera, Save, Sparkles, X } from 'lucide-react';

const MAX_BATCH_PHOTOS = 12;
const AVATAR_COLORS = ['#4F7FFF', '#6C63FF', '#FF8C42', '#00B4D8', '#4CAF50', '#E91E9A', '#FF5722', '#607D8B'];
const getAvatarColor = (name) => (name ? AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] : AVATAR_COLORS[0]);

const RECORD_PRESETS = [
  { key: 'observe', label: '관찰기록', emoji: '👀' },
  { key: 'notice', label: '알림장', emoji: '📢' },
  { key: 'consult', label: '상담메모', emoji: '💬' },
  { key: 'special', label: '안전/특이사항', emoji: '🚨' },
];

const newCard = (dataUrl) => ({
  id: `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  dataUrl, childId: null, recordType: 'observe', draftText: '', status: 'idle', error: '', saved: false,
});

function StepSection({ step, label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step}</div>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function PhotoCard({ card, allChildren, onChange, onRemove, onSave }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 14, background: 'var(--white)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={card.dataUrl} alt="첨부 사진" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 12, border: '1.5px solid var(--border)' }} />
          <button onClick={onRemove} style={{
            position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
            background: 'var(--gray-800)', color: 'white', fontSize: 11, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={12} />
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {allChildren.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>등록된 원아가 없어요. 설정에서 먼저 원아를 등록해 주세요.</div>
          ) : (
            <div className="avatar-scroll" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
                {allChildren.map((child) => {
                  const color = getAvatarColor(child.name);
                  const isSelected = card.childId === child.id;
                  return (
                    <button key={child.id} onClick={() => onChange({ childId: child.id })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 44 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isSelected ? color : `${color}18`,
                        border: `2px solid ${isSelected ? color : 'transparent'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 900, color: isSelected ? 'white' : color,
                      }}>{child.name[0]}</div>
                      <span style={{ fontSize: 10, fontWeight: isSelected ? 800 : 500, color: isSelected ? color : 'var(--text-tertiary)', maxWidth: 44, textAlign: 'center', wordBreak: 'keep-all' }}>{child.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RECORD_PRESETS.map((p) => {
              const isActive = card.recordType === p.key;
              return (
                <button key={p.key} onClick={() => onChange({ recordType: p.key })} style={{
                  padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                  background: isActive ? 'var(--primary)' : 'var(--gray-100)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                }}>
                  {p.emoji} {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <textarea
        value={card.draftText}
        onChange={(e) => onChange({ draftText: e.target.value })}
        placeholder={card.status === 'loading' ? 'AI가 사진을 분석하고 있어요…' : '사진 속 활동을 적거나, 위 버튼으로 AI 초안을 만들어 보세요.'}
        rows={3}
        disabled={card.status === 'loading'}
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }}
      />
      {card.status === 'error' && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>⚠️ {card.error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onSave} disabled={card.saved} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 100,
          fontSize: 12.5, fontWeight: 800, color: 'white',
          background: card.saved ? 'var(--gray-400)' : 'var(--primary)',
        }}>
          <Save size={13} /> {card.saved ? '저장됨 ✓' : '기록으로 저장'}
        </button>
      </div>
    </div>
  );
}

export default function PhotoRecordPage() {
  const showToast = useToast();
  const [allChildren] = useState(() => getChildren());
  const [classes] = useState(() => getClasses());
  const cl = classes[0];
  const [cards, setCards] = useState([]);
  const fileInputRef = useRef(null);
  const geminiVisionOn = isGeminiVisionEnabled() && !!getGeminiConfig().apiKey;

  const updateCard = (id, patch) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCard = (id) => setCards((prev) => prev.filter((c) => c.id !== id));

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_BATCH_PHOTOS - cards.length;
    if (room <= 0) { showToast(`사진은 한 번에 최대 ${MAX_BATCH_PHOTOS}장까지 올릴 수 있어요.`, 'error'); return; }
    try {
      const compressed = await Promise.all(files.slice(0, room).map((f) => compressImage(f)));
      setCards((prev) => [...prev, ...compressed.map(newCard)]);
    } catch {
      showToast('사진을 불러오지 못했어요. 다른 사진으로 시도해 주세요.', 'error');
    }
  };

  const assignedCards = cards.filter((c) => c.childId);

  const runBatchAI = async () => {
    if (!geminiVisionOn || !assignedCards.length) return;
    const ok = window.confirm(`${assignedCards.length}장의 사진을 Google 서버로 보내 초안을 만들까요? 사진 원본이 전송되며 저장되지 않아요.`);
    if (!ok) return;
    for (const card of assignedCards) {
      updateCard(card.id, { status: 'loading', error: '' });
      // eslint-disable-next-line no-await-in-loop
      const res = await generatePhotoObservationDraft({ imageDataUrl: card.dataUrl, classroomContext: { classAge: cl?.age } });
      if (res.error) {
        updateCard(card.id, {
          status: 'error',
          error: res.error === 'vision-not-enabled' || res.error === 'gemini-not-configured'
            ? '관리자가 사진 분석을 아직 켜지 않았어요.'
            : '초안을 만들지 못했어요. 직접 적어 주세요.',
        });
      } else {
        updateCard(card.id, { status: 'done', draftText: res.text });
      }
    }
  };

  const saveCard = async (card) => {
    const child = allChildren.find((c) => c.id === card.childId);
    if (!child) { showToast('원아를 먼저 선택해 주세요.', 'error'); return; }
    if (!card.draftText.trim()) { showToast('내용을 입력하거나 AI 초안을 먼저 만들어 주세요.', 'error'); return; }
    try {
      const rawText = card.draftText.trim();
      const res = await processRecord({ childName: child.name, rawText, classAge: cl?.age, recordType: card.recordType, tone: getSettings().tone });
      const newRecord = addRecord({ childId: child.id, childName: child.name, date: today(), rawText, recordType: card.recordType, photoCount: 1, ...res });
      const [photoId] = await savePhotos(newRecord.id, [card.dataUrl]);
      try {
        onRecordSaved({
          record: newRecord, recordType: card.recordType, context: { className: cl?.name, classAge: cl?.age },
          photos: [{ id: photoId, dataUrl: card.dataUrl }],
        });
      } catch {}
      updateCard(card.id, { saved: true });
      showToast('기록으로 저장했어요.');
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'error');
    }
  };

  return (
    <div>
      <StepSection step={1} label="사진을 올려주세요">
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleAddPhotos} style={{ display: 'none' }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
            color: 'var(--text-secondary)', background: 'var(--gray-100)', borderRadius: 100,
            padding: '9px 16px', border: '1.5px solid var(--border)',
          }}
        >
          <Camera size={15} /> 사진 선택 ({cards.length}/{MAX_BATCH_PHOTOS})
        </button>
        {!geminiVisionOn && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            관리자가 "사진 분석"을 아직 켜지 않았어요. 사진을 올리고 직접 내용을 적어 저장할 수는 있어요.
          </div>
        )}
      </StepSection>

      {cards.length > 0 && (
        <StepSection step={2} label="원아를 배정하고 초안을 만들어요">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              onClick={runBatchAI}
              disabled={!geminiVisionOn || !assignedCards.length}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 100,
                fontSize: 13, fontWeight: 800, color: 'white', background: 'var(--primary)',
                opacity: (!geminiVisionOn || !assignedCards.length) ? 0.45 : 1,
              }}
            >
              <Sparkles size={14} /> AI로 초안 만들기 ({assignedCards.length}장)
            </button>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {cards.map((card) => (
              <PhotoCard
                key={card.id}
                card={card}
                allChildren={allChildren}
                onChange={(patch) => updateCard(card.id, patch)}
                onRemove={() => removeCard(card.id)}
                onSave={() => saveCard(card)}
              />
            ))}
          </div>
        </StepSection>
      )}
    </div>
  );
}
