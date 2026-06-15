// ── Word(.docx) 양식 항목 추출 ────────────────────────────────────────────────
// .docx는 ZIP+XML 구조라 브라우저에서 표·문단의 텍스트를 그대로 읽을 수 있다.
// 표 양식은 각 셀이, 문단 양식은 각 줄이 한 항목 후보가 된다.
// JSZip은 pdf.js처럼 CDN에서 동적 로드 (외부로 데이터 전송 없음 — 코드만 받음)

const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function loadJsZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${JSZIP_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.JSZip));
      existing.addEventListener('error', () => reject(new Error('압축 해제 라이브러리를 불러오지 못했어요.')));
      return;
    }
    const s = document.createElement('script');
    s.src = JSZIP_CDN;
    s.async = true;
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('압축 해제 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}

function unescapeXml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

// document.xml → 셀/문단 경계를 줄바꿈으로 보존한 텍스트
function docxXmlToText(xml) {
  // 표 셀(</w:tc>)과 문단(</w:p>) 끝을 줄바꿈으로 표시
  const withBreaks = xml.replace(/<\/w:tc>/g, '\n').replace(/<\/w:p>/g, '\n');
  const lines = [];
  for (const chunk of withBreaks.split('\n')) {
    // <w:t> 또는 <w:t 속성>만 매칭 — <w:tbl>·<w:tr>·<w:tc>는 제외 ('<w:t' 다음이 '>'나 공백일 때만)
    const runs = [...chunk.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => unescapeXml(m[1]));
    const line = runs.join('').trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

// .docx 파일 → 양식 항목 텍스트(줄 단위). 호출부에서 parseFormText로 칸 변환.
export async function extractDocxText(file) {
  const JSZip = await loadJsZip();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('워드 문서 구조를 읽을 수 없어요. 올바른 .docx 파일인지 확인해 주세요.');
  const xml = await docFile.async('string');
  return docxXmlToText(xml);
}

// 파일명·MIME으로 직접 읽기 가능한 형식인지 판별
export function classifyFormFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.hwpx')) return 'hwpx';   // 추후 지원 여지
  if (name.endsWith('.hwp')) return 'hwp';     // 직접 불가
  if (name.endsWith('.doc')) return 'doc';     // 직접 불가
  if (name.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g)$/.test(name)) return 'image';
  return 'unknown';
}
