const fs = require('fs');
const zlib = require('zlib');
const buf = fs.readFileSync('.tmp-spec.pdf');
// FlateDecode 스트림들을 찾아 압축 해제 → 텍스트 연산자(Tj, TJ)에서 글자 추출
const data = buf;
let out = [];
let idx = 0;
const needle = Buffer.from('stream');
while (true) {
  const sPos = data.indexOf(needle, idx);
  if (sPos < 0) break;
  let start = sPos + needle.length;
  if (data[start] === 0x0d) start++;
  if (data[start] === 0x0a) start++;
  const ePos = data.indexOf(Buffer.from('endstream'), start);
  if (ePos < 0) break;
  const chunk = data.slice(start, ePos);
  idx = ePos + 9;
  try {
    const inflated = zlib.inflateSync(chunk);
    out.push(inflated.toString('latin1'));
  } catch (e) { /* not flate */ }
}
const content = out.join('\n');
// PDF 텍스트 연산자에서 한글 추출: (..)Tj 와 [..]TJ, 그리고 <hex>
// 한글은 보통 ToUnicode 매핑이 필요해 단순 추출은 깨질 수 있음 → 일단 ASCII/괄호 텍스트만
const tjMatches = content.match(/\(((?:[^()\]|\.)*)\)\s*Tj/g) || [];
const tjArr = content.match(/\[((?:[^\][]|\.)*)\]\s*TJ/g) || [];
console.log('FlateDecode 스트림:', out.length, '개');
console.log('Tj:', tjMatches.length, 'TJ:', tjArr.length);
// 샘플 출력
fs.writeFileSync('.tmp-content.txt', content);
console.log('content 길이:', content.length);
console.log('--- BT/ET 블록 수:', (content.match(/BT/g)||[]).length);
