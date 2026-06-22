import React, { useEffect, useState } from 'react';
import { getSyncState } from '../utils/storage';
import { getDriveMeta } from '../utils/driveBackup';

// 마지막 동기화/백업 시각(ms) — 둘 중 최신
function lastSyncMs() {
  let a = 0, b = 0;
  try { const s = getSyncState().lastSyncedAt; if (s) a = new Date(s).getTime(); } catch {}
  try { const m = getDriveMeta().lastBackupAt; if (m) b = new Date(m).getTime(); } catch {}
  return Math.max(a, b);
}
function fmtTime(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

// 앱 상단에 항상 보이는 동기화 상태 표시. 완전 자동 동기화를 신뢰할 수 있게 "✓ 동기화됨"을 보여준다.
// window 'sw:sync' 이벤트(phase: syncing|synced|error|conflict)로 갱신된다.
export default function SyncStatusPill({ compact = false, onClick }) {
  const [phase, setPhase] = useState('idle');
  const [, setTick] = useState(0);

  useEffect(() => {
    let resetTimer = null;
    const onSync = (e) => {
      const p = e?.detail?.phase;
      if (!p) return;
      setPhase(p);
      setTick((t) => t + 1); // 시각 갱신
      if (p === 'synced') {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => setPhase('idle'), 4000); // 잠시 강조 후 평상 표시로
      }
    };
    window.addEventListener('sw:sync', onSync);
    return () => { window.removeEventListener('sw:sync', onSync); clearTimeout(resetTimer); };
  }, []);

  const ms = lastSyncMs();
  let icon = '☁';
  let text = '동기화 준비';
  let color = 'var(--text-tertiary)';

  if (phase === 'syncing') { icon = '⤴'; text = '동기화 중…'; color = 'var(--primary)'; }
  else if (phase === 'error') { icon = '⚠'; text = '동기화 실패'; color = 'var(--accent)'; }
  else if (phase === 'conflict') { icon = '⚠'; text = '확인 필요'; color = 'var(--accent)'; }
  else if (phase === 'synced') { icon = '✓'; text = `동기화됨 ${fmtTime(ms || Date.now())}`; color = '#2E7D32'; }
  else if (ms) { icon = '✓'; text = `동기화됨 ${fmtTime(ms)}`; color = '#2E7D32'; }

  if (compact) {
    // 모바일: 작은 원형 표시(탭하면 설정 동기화로)
    return (
      <button onClick={onClick} title={text} aria-label={text} style={{
        width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: 15, fontWeight: 900, flexShrink: 0,
      }}>{icon}</button>
    );
  }
  return (
    <button onClick={onClick} title="기기 간 동기화 설정 열기" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--gray-100)', color, padding: '8px 12px', borderRadius: 12,
      fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span> {text}
    </button>
  );
}
