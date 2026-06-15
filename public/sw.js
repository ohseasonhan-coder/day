// 자가 제거 서비스 워커 — 과거 캐시 우선 SW가 옛 빌드를 붙잡는 문제를 해결한다.
// 설치되면 모든 캐시를 비우고, 자신을 등록 해제한 뒤, 열려 있는 페이지를 새로고침한다.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) {
      // 무시 — 다음 로드에서 일반 네트워크로 동작
    }
  })());
});

// fetch는 가로채지 않음 → 항상 네트워크에서 최신 파일을 받는다
