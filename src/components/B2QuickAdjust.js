import React, { useState } from 'react';
import { B2_ADJUSTMENTS } from '../utils/ai/b2/config';
import { adjustB2 } from '../utils/ai/b2/engine';
import { adjustB3 } from '../utils/ai/b3/engine';
import { adjustB4 } from '../utils/ai/b4/engine';

export default function B2QuickAdjust({ result, input, childName, onApply }) {
  const [busy, setBusy] = useState('');
  if (!result?.b2?.enabled) return null;

  const questions = result.b4?.questions || result.b3?.questions || result.b2.questions || [];

  const apply = (mode) => {
    setBusy(mode);
    const adjust = result?.b4?.enabled ? adjustB4 : (result?.b3?.enabled ? adjustB3 : adjustB2);
    const adjusted = adjust({
      input,
      childName,
      observation: result.observation,
      fallbackCopyReady: result.b2CopyReady || result.copyReady,
      mode,
    });
    onApply(adjusted);
    setBusy('');
  };

  return (
    <div style={{ margin: '-4px 0 12px', padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--gray-50)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 7 }}>빠른 문장 조정</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {B2_ADJUSTMENTS.map(([key, label]) => (
          <button key={key} disabled={!!busy} onClick={() => apply(key)} title={`${label} 조정`}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700 }}>
            {busy === key ? '정리 중...' : label}
          </button>
        ))}
      </div>
      {questions.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          기록을 보완하려면: {questions.join(' · ')}
        </div>
      )}
    </div>
  );
}
