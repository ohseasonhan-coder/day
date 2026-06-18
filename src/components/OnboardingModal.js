import React, { useEffect, useState } from 'react';
import { setOnboardingDone } from '../utils/storage';
import { Zap } from 'lucide-react';

// 첫 사용자에게 핵심 사용 흐름을 3단계로 짧게 안내한다.
export const ONBOARDING_SLIDES = [
  {
    emoji: '👶',
    title: '1. 원아를 등록해요',
    desc: '설정에서 원아를 등록하면 기록을 아이별로 모아볼 수 있어요.',
    logo: true,
  },
  {
    emoji: '✍️',
    title: '2. 오늘의 모습을 한두 문장으로 적어요',
    desc: '있었던 상황을 짧게 적으면 카테고리·발달영역·태그가 자동으로 정리돼요.',
  },
  {
    emoji: '📋',
    title: '3. 문장을 복사해 사용해요',
    desc: '관찰일지·알림장·보육일지 평가 문장을 카드에서 복사해 바로 쓸 수 있어요.\n아이 기록은 이 기기와 내 구글 드라이브에만 저장되고, 외부 서버로 가지 않아요.',
    isLast: true,
  },
];
const SLIDES = ONBOARDING_SLIDES;

export default function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleDone = () => {
    setOnboardingDone();
    onDone();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10, 20, 50, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: 'var(--white)', borderRadius: 24, width: '100%', maxWidth: 400,
        padding: '32px 28px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 7, marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 8, height: 8, borderRadius: 100,
              background: i === step ? 'var(--primary)' : 'var(--gray-200)',
              transition: 'all 0.25s',
            }} />
          ))}
        </div>

        {slide.logo && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="white" fill="white" />
            </div>
            <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.7px' }}>쌤워크</span>
          </div>
        )}

        <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>{slide.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 12, textAlign: 'center', letterSpacing: '-0.3px' }}>
          {slide.title}
        </div>
        <div style={{
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8,
          textAlign: 'center', marginBottom: 32, whiteSpace: 'pre-line',
        }}>
          {slide.desc}
        </div>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, padding: '13px', borderRadius: 14,
                border: '1.5px solid var(--border)', background: 'var(--white)',
                fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
              }}
            >
              이전
            </button>
          )}
          {slide.isLast ? (
            <button
              onClick={handleDone}
              style={{
                flex: 1, padding: '13px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: 'white', fontSize: 15, fontWeight: 900,
                boxShadow: '0 6px 20px rgba(79,127,255,0.35)',
              }}
            >
              시작하기
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                flex: step === 0 ? '1 1 100%' : 1,
                padding: '13px', borderRadius: 14, border: 'none',
                background: 'var(--primary)', color: 'white',
                fontSize: 14, fontWeight: 800,
                boxShadow: '0 4px 14px rgba(79,127,255,0.3)',
              }}
            >
              다음
            </button>
          )}
        </div>

        <button
          onClick={handleDone}
          style={{ marginTop: 14, padding: '8px', background: 'transparent', border: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)' }}
        >
          다시 보지 않기
        </button>
      </div>
    </div>
  );
}
