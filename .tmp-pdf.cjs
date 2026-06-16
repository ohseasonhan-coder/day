// pdf.js로 PDF 텍스트 추출 (npm에 없으면 동적 설치 불가하니 pdf-parse 시도)
const fs = require('fs');
const path = "C:\Users\한승훈\Downloads\한그루 _ 4차 표준보육과정 영역별목표와 내용.pdf";
const buf = fs.readFileSync(path);
console.log('파일 크기:', buf.length, 'bytes');
// PDF에서 텍스트 스트림 대략 추출 시도 (간단 파싱)
const s = buf.toString('latin1');
const matches = s.match(/\/Type\s*\/Page[^s]/g);
console.log('페이지 수 추정:', matches ? matches.length : '?');
