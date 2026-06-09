const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/sw.js`;
      if (isLocalhost) {
        checkValidServiceWorker(swUrl);
      } else {
        registerValidSW(swUrl);
      }
    });
  }
}

function registerValidSW(swUrl) {
  navigator.serviceWorker.register(swUrl).then(reg => {
    reg.onupdatefound = () => {
      const installingWorker = reg.installing;
      if (!installingWorker) return;
      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New content available; please refresh.');
        }
      };
    };
  }).catch(err => console.error('SW registration failed:', err));
}

function checkValidServiceWorker(swUrl) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then(res => {
      if (res.status === 404 || res.headers.get('content-type')?.includes('javascript') === false) {
        navigator.serviceWorker.ready.then(reg => reg.unregister());
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => console.log('No internet. Running in offline mode.'));
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => reg.unregister()).catch(() => {});
  }
}
