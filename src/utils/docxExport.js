// ── Word(.docx) 내보내기 ─────────────────────────────────────────────────────
// 100% 브라우저 안에서 생성 — 외부 서버 없음. 한글(HWP)·MS워드에서 바로 열립니다.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

const FONT = '맑은 고딕';

function titleParagraph(text) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 40, color: '1A1A2E' })],
  });
}

function badgeParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [new TextRun({ text, font: FONT, size: 20, color: '666688' })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '4F7FFF', space: 4 } },
    children: [new TextRun({ text, font: FONT, bold: true, size: 26, color: '2F5FE0' })],
  });
}

function bodyParagraphs(text) {
  const lines = String(text || '').split('\n');
  return lines.map(line => new Paragraph({
    spacing: { after: 100, line: 340 },
    children: [new TextRun({ text: line || ' ', font: FONT, size: 22, color: '222222' })],
  }));
}

// doc shape: { title, badge, sections: [{ title, text }] }
export async function exportDocx(doc) {
  const children = [
    titleParagraph(doc.title || '문서'),
  ];
  if (doc.badge) children.push(badgeParagraph(doc.badge));

  (doc.sections || []).forEach(section => {
    children.push(sectionHeading(section.title || ''));
    children.push(...bodyParagraphs(section.text));
  });

  children.push(new Paragraph({
    spacing: { before: 480 },
    children: [new TextRun({ text: '— 쌤워크로 작성된 초안입니다. 기관 상황에 맞게 최종 검토해 주세요.', font: FONT, size: 18, color: '999999' })],
  }));

  const file = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } }, // 2cm
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(file);
  const safeName = String(doc.title || '문서').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
