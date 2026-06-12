// ── 구글 드라이브 자동 백업 ─────────────────────────────────────────────────
// 사용자 본인의 구글 계정 드라이브에 백업 파일을 저장합니다.
// 개발자 서버를 거치지 않고 "브라우저 ↔ 내 구글 드라이브" 직접 통신만 사용합니다.
// drive.file 권한: 이 앱이 만든 파일만 접근 가능 (드라이브의 다른 파일은 볼 수 없음)

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
  return { fileId: json.id, at };
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
