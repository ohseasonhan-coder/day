// ── 기기 간 동기화 (1차) ──────────────────────────────────────────────────────
// 같은 사용자 계정으로 PC/모바일에서 기록을 이어 쓰기 위한 "안전한 백업/복원 기반 동기화".
// 실시간 동기화가 아니며, 기존 Google Drive 백업 구조(driveBackup.js)를 그대로 활용한다.
// 데이터는 사용자 본인의 Google Drive에만 저장되고 외부 서버를 거치지 않는다.
import { restoreFromDrive, backupToDrive } from './driveBackup';
import {
  getBackupJson, parseBackup, importBackup,
  saveLocalSafetyBackup, getDataUpdatedAt,
  getSyncState, setSyncState,
} from './storage';

// 원격 payload에서 데이터 변경 시각을 꺼낸다(구버전 백업은 exportedAt로 대체).
function remoteDataAtOf(remote) {
  return (remote && (remote.dataUpdatedAt || remote.exportedAt)) || null;
}

// ── 순수 함수: 어떤 동기화 동작을 할지 결정 ───────────────────────────────────
// 입력: remote(파싱된 payload | null), localDataAt(ISO|null), lastSyncedDataAt(ISO|null)
// 반환 action: 'push' | 'pull' | 'conflict' | 'in-sync'
export function decideSyncAction({ remote, localDataAt, lastSyncedDataAt }) {
  if (!remote) return { action: 'push', reason: 'no-remote' };

  const remoteAt = remoteDataAtOf(remote);
  const localAt = localDataAt || null;
  const baseAt = lastSyncedDataAt || null;

  // 마지막 동기화 이후 각각 바뀌었는지(기준이 없으면 둘 다 바뀐 것으로 간주)
  const localChanged = !baseAt || (!!localAt && localAt > baseAt);
  const remoteChanged = !baseAt || (!!remoteAt && remoteAt > baseAt);

  if (remoteAt && localAt && remoteAt === localAt) return { action: 'in-sync', reason: 'equal', remoteAt, localAt };

  // 양쪽 모두 마지막 동기화 이후 변경됨 → 자동 덮어쓰기 금지(사용자 선택)
  if (remoteChanged && localChanged) return { action: 'conflict', reason: 'both-changed', remoteAt, localAt };
  if (remoteChanged && !localChanged) return { action: 'pull', reason: 'remote-newer', remoteAt, localAt };
  if (localChanged && !remoteChanged) return { action: 'push', reason: 'local-newer', remoteAt, localAt };
  return { action: 'in-sync', reason: 'no-change', remoteAt, localAt };
}

// ── Drive 최신 상태 확인 ──────────────────────────────────────────────────────
// 네트워크 호출 1회. 실패해도 throw하지 않고 { ok:false, error }로 돌려준다.
export async function checkDriveStatus(clientId) {
  try {
    const { json, modifiedTime } = await restoreFromDrive(clientId);
    const parsed = parseBackup(json);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const st = getSyncState();
    const decision = decideSyncAction({
      remote: parsed.data,
      localDataAt: getDataUpdatedAt(),
      lastSyncedDataAt: st.lastSyncedDataAt,
    });
    return {
      ok: true,
      ...decision,
      remote: parsed.data,
      remoteSummary: parsed.summary,
      remoteDeviceName: parsed.data.deviceName || null,
      modifiedTime: modifiedTime || null,
      _json: json,
    };
  } catch (e) {
    return { ok: false, error: e.message || 'Drive 최신 데이터를 확인하지 못했어요.' };
  }
}

// ── Drive에서 가져오기(복원) — 복원 전 로컬 안전 백업 1회 ─────────────────────
export async function pullFromDrive(clientId, { json } = {}) {
  try {
    let raw = json;
    let modifiedTime = null;
    if (!raw) { const r = await restoreFromDrive(clientId); raw = r.json; modifiedTime = r.modifiedTime; }
    // 되돌리기 대비: 현재 데이터를 먼저 안전 보관
    saveLocalSafetyBackup();
    const res = importBackup(raw);
    if (!res.ok) return res; // 실패 시 기존 데이터 유지(importBackup은 파싱 실패 시 쓰지 않음)
    const parsed = parseBackup(raw);
    setSyncState({
      lastSyncedAt: new Date().toISOString(),
      lastSyncedDataAt: parsed.ok ? remoteDataAtOf(parsed.data) : getDataUpdatedAt(),
    });
    return { ok: true, summary: res.summary, modifiedTime };
  } catch (e) {
    return { ok: false, error: e.message || 'Drive 데이터를 가져오지 못했어요.' };
  }
}

// ── 현재 데이터를 Drive에 백업(업로드) ────────────────────────────────────────
// silent=true면 동의창 없이 조용히 시도(앱 시작 자동 동기화용).
export async function pushToDrive(clientId, { silent = false } = {}) {
  try {
    const json = getBackupJson();
    await backupToDrive(clientId, json, { silent });
    const st = getSyncState();
    setSyncState({
      lastSyncedAt: new Date().toISOString(),
      lastSyncedDataAt: getDataUpdatedAt(),
      syncVersion: (st.syncVersion || 0) + 1,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Drive에 백업하지 못했어요.' };
  }
}

// ── 앱 시작 시 보수적 자동 확인(1회) ──────────────────────────────────────────
// - 자동 동기화가 켜져 있고 온라인일 때만
// - 원격이 명백히 최신이면 자동 pull, 충돌이면 자동 적용하지 않고 상태만 반환
export async function autoSyncOnStart(clientId, { enabled }) {
  if (!enabled || !clientId) return { ok: false, skipped: true, reason: 'disabled' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, skipped: true, reason: 'offline' };
  }
  const status = await checkDriveStatus(clientId);
  if (!status.ok) return status;
  if (status.action === 'pull') {
    // 원격이 명확히 최신 + 로컬 그대로 → 자동 가져오기
    const pulled = await pullFromDrive(clientId, { json: status._json });
    return { ok: pulled.ok, applied: pulled.ok ? 'pull' : null, action: status.action, error: pulled.error };
  }
  if (status.action === 'push') {
    // 로컬이 최신 + 원격 그대로(또는 원격 없음) → 조용히 자동 백업(데이터 손실 없음)
    const pushed = await pushToDrive(clientId, { silent: true });
    return { ok: pushed.ok, applied: pushed.ok ? 'push' : null, action: status.action, error: pushed.error };
  }
  // conflict/in-sync는 자동으로 데이터를 바꾸지 않는다(상태만 알림 — 설정 화면에서 선택)
  return { ok: true, applied: null, action: status.action };
}
