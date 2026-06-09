// ── PDF 처리 유틸 ────────────────────────────────────────────────────────────
// pdf.js를 CDN에서 동적 로드 → npm 설치 없이 사용

const PDF_JS_VERSION = '3.11.174';
const PDF_JS_CDN     = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}`;

/** pdf.js 라이브러리 동적 로드 (처음 한 번만) */
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDF_JS_CDN}/pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        `${PDF_JS_CDN}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('pdf.js 로드 실패 — 인터넷 연결을 확인해주세요.'));
    document.head.appendChild(script);
  });
}

/**
 * PDF 파일의 1페이지를 고화질 이미지(base64 JPEG)로 변환
 * @param {File} file   PDF 파일
 * @param {number} scale 렌더 배율 (기본 2 = 2배 해상도)
 * @returns {Promise<{imageData:string, width:number, height:number, originalWidth:number, originalHeight:number}>}
 */
export async function renderPdfToImage(file, scale = 2) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  const v1 = page.getViewport({ scale: 1 });
  return {
    imageData: canvas.toDataURL('image/jpeg', 0.9),
    width:         viewport.width,
    height:        viewport.height,
    originalWidth:  v1.width,
    originalHeight: v1.height,
  };
}

/**
 * PDF 텍스트 항목에서 '입력 칸' 위치를 자동 감지
 *
 * 감지 규칙:
 *  1) "라벨:" 패턴 → 라벨 오른쪽에 입력 칸 위치 추정
 *  2) "___" / "(  )" 등 빈칸 표시 → 해당 위치, 앞 텍스트를 라벨로
 *
 * @param {File} file PDF 파일
 * @returns {Promise<Array<{label:string, xPct:number, yPct:number}>>}
 */
export async function detectFieldsFromPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport   = page.getViewport({ scale: 1 });
  const pageW = viewport.width;
  const pageH = viewport.height;

  const textContent = await page.getTextContent();
  const items = textContent.items;

  const results = [];
  const usedKeys = new Set();

  // transform[4]=tx (x 좌표), transform[5]=ty (y 좌표, 아래→위)
  const toXPct = (tx) => Math.max(0, Math.min(99, (tx / pageW) * 100));
  const toYPct = (ty) => Math.max(0, Math.min(99, ((pageH - ty) / pageH) * 100));

  const addField = (label, xPct, yPct) => {
    const key = `${Math.round(xPct / 3) * 3}-${Math.round(yPct / 2) * 2}`;
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    results.push({
      label: label.trim(),
      xPct: parseFloat(xPct.toFixed(1)),
      yPct: parseFloat(yPct.toFixed(1)),
    });
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const str  = (item.str || '').trim();
    if (!str) continue;

    const tx = item.transform[4];
    const ty = item.transform[5];

    // ── 규칙 1: "라벨 :" 패턴 ────────────────────────────────────────────
    const colonMatch = str.match(/^(.{1,20}?)[:：]\s*$/);
    if (colonMatch) {
      const label  = colonMatch[1].trim();
      // 입력 칸은 라벨 바로 오른쪽 (라벨 너비 + 약간의 여백)
      const fieldX = toXPct(tx + (item.width || 0) + pageW * 0.015);
      const fieldY = toYPct(ty);
      addField(label, fieldX, fieldY);
      continue;
    }

    // ── 규칙 2: 빈칸 표시 (___  /  (  ) 등) ─────────────────────────────
    if (/^[\s_\-─━]{3,}$/.test(str) || /^\(\s{2,}\)$/.test(str) || str === '○' || str === '□') {
      // 앞에 있는 텍스트를 라벨로 사용
      const prev = items
        .slice(Math.max(0, i - 4), i)
        .reverse()
        .find(it => {
          const s = (it.str || '').trim();
          return s.length > 0 && s.length <= 25 && !/^[\s_\-─━○□]+$/.test(s);
        });
      const label  = prev ? (prev.str || '').replace(/[:：\s]+$/, '').trim() : `칸 ${results.length + 1}`;
      const fieldX = toXPct(tx);
      const fieldY = toYPct(ty);
      addField(label, fieldX, fieldY);
    }
  }

  // y 오름차순(위→아래), 같은 y면 x 오름차순(왼→오른)
  results.sort((a, b) => a.yPct - b.yPct || a.xPct - b.xPct);

  return results;
}
