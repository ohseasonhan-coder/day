// ── 구글 드라이브 자동 백업 ─────────────────────────────────────────────────
// 사용자 본인의 구글 계정 드라이브에 백업 파일을 저장합니다.
// 개발자 서버를 거치지 않고 "브라우저 ↔ 내 구글 드라이브" 직접 통신만 사용합니다.
// drive.file 권한: 이 앱이 만든 파일만 접근 가능 (드라이브의 다른 파일은 볼 수 없음)

// 데스크탑(Electron) 앱 여부 — 구글이 앱 내장 창에서의 OAuth 로그인을 차단하므로
// Electron에서는 구글 로그인·드라이브 백업 대신 안내를 표시한다
export const isElectron = () =>
  typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FILE_NAME = 'saemwork_backup.json';
const META_KEY = 'sw_drive_backup_meta';

export const getDriveMeta = () => {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
};
const setDriveMeta = (patch) => {
  try { localStorage.setItem(META_KEY, JSON.stringify({ ...getDriveMeta(), ...patch })); } catch {}
};

let accessToken = null;
let tokenExpiry = 0;

// 동기화 상태를 앱 상단 표시(알약)에 알린다. phase: 'syncing'|'synced'|'error'
export function emitSyncEvent(phase, at) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function')
      window.dispatchEvent(new CustomEvent('sw:sync', { detail: { phase, at } }));
  } catch {}
}

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('구글 인증 스크립트를 불러오지 못했어요.')));
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('구글 인증 스크립트를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}

// ── 구글 로그인 버튼 ─────────────────────────────────────────────────────────
// ID 토큰(JWT)의 페이로드를 브라우저 안에서만 해석 — 외부로 보내지 않음
function decodeJwtPayload(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(part).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
  return JSON.parse(json);
}

// 공식 "구글로 계속하기" 버튼을 container에 렌더링
export async function renderGoogleSignInButton(clientId, container, onProfile, onError) {
  await loadGsi();
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (resp) => {
      try {
        const p = decodeJwtPayload(resp.credential);
        onProfile({ sub: p.sub, email: p.email, name: p.name });
      } catch (e) {
        if (onError) onError(e);
      }
    },
  });
  window.google.accounts.id.renderButton(container, {
    theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 300, locale: 'ko',
  });
}

// 계정 선택 창을 강제로 띄워 다른 구글 계정으로 로그인 (버튼이 한 계정에 고정됐을 때)
export async function googleSignInWithAccountChooser(clientId) {
  await loadGsi();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (resp) => {
          if (resp.error) return done(reject, new Error(resp.error_description || resp.error));
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` },
            });
            if (!r.ok) throw new Error('프로필 조회에 실패했어요.');
            const p = await r.json();
            done(resolve, { sub: p.sub, email: p.email, name: p.name });
          } catch (e) {
            done(reject, e);
          }
        },
        error_callback: (err) => done(reject, new Error(err?.message || err?.type || '구글 인증에 실패했어요.')),
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      done(reject, e);
    }
  });
}

// 액세스 토큰 발급 — silent=true면 동의창 없이 조용히 시도 (자동 백업용)
export async function requestDriveToken(clientId, { silent = false } = {}) {
  if (!clientId) throw new Error('구글 클라이언트 ID가 설정되지 않았어요.');
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;
  await loadGsi();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return done(reject, new Error(resp.error_description || resp.error));
          accessToken = resp.access_token;
          tokenExpiry = Date.now() + Number(resp.expires_in || 3600) * 1000;
          done(resolve, accessToken);
        },
        error_callback: (err) => done(reject, new Error(err?.message || err?.type || '구글 인증에 실패했어요.')),
      });
      client.requestAccessToken(silent ? { prompt: '' } : {});
      if (silent) setTimeout(() => done(reject, new Error('구글 인증 시간 초과')), 10000);
    } catch (e) {
      done(reject, e);
    }
  });
}

// 백업 JSON 업로드 — 기존 파일이 있으면 덮어쓰고, 없으면 새로 만듭니다
export async function backupToDrive(clientId, jsonString, { silent = false } = {}) {
  emitSyncEvent('syncing');
  try {
  const token = await requestDriveToken(clientId, { silent });
  const boundary = 'sw_boundary_' + Date.now();
  const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonString + '\r\n' +
    `--${boundary}--`;

  const doUpload = (fileId) => fetch(
    fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: fileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const existingId = getDriveMeta().fileId || null;
  let res = await doUpload(existingId);
  // 드라이브에서 파일이 지워졌거나 접근 불가 → 새 파일로 생성
  if (existingId && (res.status === 404 || res.status === 403)) res = await doUpload(null);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`드라이브 업로드 실패 (${res.status}) ${text.slice(0, 100)}`);
  }
  const json = await res.json();
  const at = new Date().toISOString();
  setDriveMeta({ fileId: json.id, lastBackupAt: at });
  emitSyncEvent('synced', at);
  return { fileId: json.id, at };
  } catch (e) {
    emitSyncEvent('error');
    throw e;
  }
}

// ── 변경 시 자동 백업 스케줄러 ───────────────────────────────────────────────
// 데이터가 바뀔 때마다 호출 — 연속 변경은 30초 묶어서 1회만 업로드 (디바운스)
let backupTimer = null;
let latestGetJson = null;

export function scheduleDriveBackup(getJson, { delayMs = 30000 } = {}) {
  if (isElectron()) return; // 데스크탑 앱에서는 구글 인증이 차단됨
  latestGetJson = getJson;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    try {
      const clientId = (localStorage.getItem('sw_google_client_id') || '').trim();
      if (!clientId || !latestGetJson) return;
      await backupToDrive(clientId, latestGetJson(), { silent: true });
    } catch {
      // 조용히 실패 — 다음 변경이나 앱 시작 때 다시 시도됨
    }
  }, delayMs);
}

// 탭을 닫거나 화면을 벗어날 때, 예약된 백업이 있으면 바로 시도
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !backupTimer) return;
    clearTimeout(backupTimer);
    backupTimer = null;
    try {
      const clientId = (localStorage.getItem('sw_google_client_id') || '').trim();
      if (clientId && latestGetJson) backupToDrive(clientId, latestGetJson(), { silent: true }).catch(() => {});
    } catch {}
  });
}

// 드라이브에서 백업 파일 내려받기 (가장 최근 수정본)
export async function restoreFromDrive(clientId) {
  const token = await requestDriveToken(clientId, { silent: false });
  const params = new URLSearchParams({
    q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,modifiedTime,size)',
    pageSize: '5',
  });
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) throw new Error(`드라이브 조회 실패 (${listRes.status})`);
  const { files } = await listRes.json();
  if (!files || files.length === 0)
    throw new Error('드라이브에 백업 파일이 없어요. 먼저 "지금 드라이브에 백업"을 한 번 실행해 주세요.');

  const file = files[0];
  const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!dl.ok) throw new Error(`드라이브 다운로드 실패 (${dl.status})`);
  const json = await dl.text();
  setDriveMeta({ fileId: file.id });
  return { json, modifiedTime: file.modifiedTime };
}
