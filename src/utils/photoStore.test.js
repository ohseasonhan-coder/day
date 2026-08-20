// photoStore.js 회귀 — 여기서는 IndexedDB에 의존하지 않는 순수 변환 함수만 검증한다.
// 이 프로젝트의 Jest(jsdom) 환경에는 IndexedDB가 없어(fake-indexeddb 미설치),
// compressImage/savePhotos/getPhotoById/hydrateImageSrc의 실제 IndexedDB 왕복은
// 브라우저(dev 서버)에서 직접 확인한다(계획 문서의 검증 절차 참고).
import { stripImageSrcForStorage } from './photoStore';

describe('stripImageSrcForStorage', () => {
  test('photoId가 있는 이미지 노드의 src만 비운다(참조는 남김)', () => {
    const content = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'data:image/jpeg;base64,AAAA', photoId: 'p1', alt: '사진' } }],
    };
    const stripped = stripImageSrcForStorage(content);
    expect(stripped.content[0].attrs.src).toBe('');
    expect(stripped.content[0].attrs.photoId).toBe('p1');
    expect(stripped.content[0].attrs.alt).toBe('사진');
  });

  test('photoId가 없는 이미지(외부 URL 등)는 건드리지 않는다', () => {
    const content = { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/a.png' } }] };
    const stripped = stripImageSrcForStorage(content);
    expect(stripped.content[0].attrs.src).toBe('https://example.com/a.png');
  });

  test('표 안에 중첩된 이미지도 재귀적으로 처리한다', () => {
    const content = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [{
            type: 'tableCell',
            content: [{ type: 'image', attrs: { src: 'data:image/jpeg;base64,BBBB', photoId: 'p2' } }],
          }],
        }],
      }],
    };
    const stripped = stripImageSrcForStorage(content);
    expect(stripped.content[0].content[0].content[0].content[0].attrs.src).toBe('');
  });

  test('원본 객체를 변경하지 않는다(불변)', () => {
    const content = { type: 'doc', content: [{ type: 'image', attrs: { src: 'data:image/jpeg;base64,CCCC', photoId: 'p3' } }] };
    stripImageSrcForStorage(content);
    expect(content.content[0].attrs.src).toBe('data:image/jpeg;base64,CCCC');
  });

  test('빈 문서·null도 에러 없이 처리한다', () => {
    expect(() => stripImageSrcForStorage(null)).not.toThrow();
    expect(stripImageSrcForStorage(null)).toBeNull();
    expect(() => stripImageSrcForStorage({ type: 'doc', content: [{ type: 'paragraph' }] })).not.toThrow();
  });
});
