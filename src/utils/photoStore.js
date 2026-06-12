// ── 사진 저장소 (IndexedDB) ──────────────────────────────────────────────────
// 사진은 용량이 커서 localStorage(약 5MB 한도)가 아닌 IndexedDB(수백 MB)에 따로 저장한다.
// 100% 기기 안에만 저장 — 백업 JSON·드라이브 백업에는 포함되지 않는다.

const DB_NAME = 'sw_photos';
const STORE = 'photos';
const MAX_DIM = 1280;     // 긴 변 기준 리사이즈
const JPEG_QUALITY = 0.8;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('recordId', 'recordId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('사진 저장소를 열 수 없어요.'));
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

// 파일 → 리사이즈·압축된 dataURL (긴 변 1280px, JPEG 80%)
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요.')); };
    img.src = url;
  });
}

// 기록에 사진들 저장 → 저장된 id 배열 반환
export async function savePhotos(recordId, dataUrls) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const ids = [];
    dataUrls.forEach((dataUrl, i) => {
      const id = `${recordId}-p${Date.now()}-${i}`;
      ids.push(id);
      store.put({ id, recordId, dataUrl, createdAt: new Date().toISOString() });
    });
    store.transaction.oncomplete = () => { db.close(); resolve(ids); };
    store.transaction.onerror = () => { db.close(); reject(store.transaction.error); };
  });
}

export async function getPhotosByRecord(recordId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const idx = tx(db, 'readonly').index('recordId');
    const req = idx.getAll(recordId);
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deletePhoto(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    store.delete(id);
    store.transaction.oncomplete = () => { db.close(); resolve(); };
    store.transaction.onerror = () => { db.close(); reject(store.transaction.error); };
  });
}

export async function deletePhotosByRecord(recordId) {
  const photos = await getPhotosByRecord(recordId);
  if (photos.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    photos.forEach(p => store.delete(p.id));
    store.transaction.oncomplete = () => { db.close(); resolve(); };
    store.transaction.onerror = () => { db.close(); reject(store.transaction.error); };
  });
}
