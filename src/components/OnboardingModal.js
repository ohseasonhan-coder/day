import React, { useEffect, useState } from 'react';
import { setOnboardingDone } from '../utils/storage';
import { Zap } from 'lucide-react';

const SLIDES = [
  {
    emoji: '👋',
    title: '쌤워크에 오신 것을 환영해요',
    desc: '짧은 관찰 기록이 관찰일지, 상담자료, 보육일지로 자동 정리됩니다.',
    logo: true,
  },
  {
    emoji: '✍️',
    title: '기록은 짧게 남기면 됩니다',
    desc: '아이와 상황을 선택하고 관찰 내용을 적으면 카테고리, 발달영역, 태그가 자동으로 정리됩니다.',
  },
  {
    emoji: '📄',
    title: '문서 초안이 쌓입니다',
    desc: '보육일지, 발달평가, 부모상담자료 등 실무 문서를 기록 기반으로 생성할 수 있습니다.',
  },
  {
    emoji: '🧾',
    title: '우리 원 서식도 준비할 수 있어요',
    desc: 'PDF 양식을 등록하면 생성한 문서를 서식에 맞춰 인쇄하는 흐름으로 확장할 수 있습니다.',
  },
  {
    emoji: '🚀',
    title: '바로 시작해볼까요?',
    desc: '아이를 등록하고 첫 기록을 남기면 문서 자동화가 시작됩니다.',
    isLast: true,
  },
];

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
      </div>
    </div>
  );
}
