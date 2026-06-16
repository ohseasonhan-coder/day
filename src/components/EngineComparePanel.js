import React, { useState } from 'react';
import { getComparisonView } from '../utils/ai/engineComparison';
import { recordEngineChoice } from '../utils/ai/userCorrectionLearning';

// 개발자/검수 전용: legacy ↔ modular 문장 엔진 비교 패널.
// enabled가 false면 아무것도 렌더링하지 않는다(일반 사용자 화면 영향 없음).
// 자동 대체하지 않고 추천만 표시하며, 사용자가 직접 선택/수정한다.
const SCORE_KEYS = [
  ['totalScore', '총점'],
  ['factPreservation', '사실보존'],
  ['naturalness', '자연스러움'],
  ['safety', '안전성'],
  ['documentFit', '문서적합'],
];

function ScoreRow({ scores }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {SCORE_KEYS.map(([k, label]) => (
        <span key={k} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--gray-100)', borderRadius: 6, padding: '2px 6px' }}>
          {label} {scores[k]}
        </span>
      ))}
    </div>
  );
}

function EngineColumn({ side, data, recommended, chosen, onChoose }) {
  const isReco = recommended === side.engineKey;
  const isChosen = chosen === side.engineKey;
  return (
    <div style={{
      flex: 1, minWidth: 240, border: `2px solid ${isChosen ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 10, padding: 12, background: 'var(--white)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>{side.label}</strong>
        {isReco && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 6, padding: '2px 6px' }}>👍 추천</span>}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{data.text || '(생성된 문장 없음)'}</div>
      <ScoreRow scores={data.scores} />
      <button
        onClick={onChoose}
        style={{
          marginTop: 8, width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: isChosen ? 'var(--primary)' : 'var(--gray-100)', color: isChosen ? 'var(--white)' : 'var(--text-primary)',
        }}
      >
        {isChosen ? '✓ 선택됨' : '이 결과 선택'}
      </button>
    </div>
  );
}

export default function EngineComparePanel({ enabled = false }) {
  const [childName, setChildName] = useState('');
  const [rawText, setRawText] = useState('');
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState({});

  if (!enabled) return null;

  const runCompare = async () => {
    if (!rawText.trim()) return;
    setBusy(true);
    try {
      const result = await getComparisonView({ enabled: true, childName: childName.trim(), rawText: rawText.trim(), classAge: '4' });
      setView(result);
      setChosen({});
    } finally {
      setBusy(false);
    }
  };

  const choose = (r, engineKey) => {
    setChosen((prev) => ({ ...prev, [r.key]: engineKey }));
    recordEngineChoice({
      docType: r.key,
      chosenEngine: engineKey,
      legacyText: r.legacy.text,
      modularText: r.modular.text,
      input: rawText.trim(),
    });
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
        검수용 도구입니다. 기존 출력(legacy)과 새 문장 엔진(modular)을 5종 문서로 비교합니다.
        점수가 높은 쪽이 추천되며, 자동 적용되지 않습니다. 일반 사용자 화면에는 영향을 주지 않습니다.
      </p>
      <input
        value={childName}
        onChange={(e) => setChildName(e.target.value)}
        placeholder="아이 이름 (선택)"
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginBottom: 8 }}
      />
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder='관찰 메모를 입력하세요. 예) 윤재가 블록을 쌓다가 "더 높게 만들래!"라고 말했고, 교사가 도와주었다.'
        rows={4}
        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
      />
      <button
        onClick={runCompare}
        disabled={busy || !rawText.trim()}
        style={{
          marginTop: 8, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: busy || !rawText.trim() ? 'var(--gray-300)' : 'var(--primary)', color: 'var(--white)',
        }}
      >
        {busy ? '비교 중…' : '엔진 비교 생성'}
      </button>

      {view?.results && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {view.results.map((r) => (
            <div key={r.key}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{r.label}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <EngineColumn
                  side={{ engineKey: 'legacy', label: '기존(legacy)' }}
                  data={r.legacy}
                  recommended={r.recommended}
                  chosen={chosen[r.key]}
                  onChoose={() => choose(r, 'legacy')}
                />
                <EngineColumn
                  side={{ engineKey: 'modular', label: '새 엔진(modular)' }}
                  data={r.modular}
                  recommended={r.recommended}
                  chosen={chosen[r.key]}
                  onChoose={() => choose(r, 'modular')}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
