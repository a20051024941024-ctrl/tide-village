// 潮汐釣魚村 service worker：讓「加到主畫面」可以安裝，網路不穩時也能打開遊戲。
// 遊戲本身用「網路優先」：有網路就一定拿最新版，沒網路才用上次的備份。
const VERSION = 'tide-v12';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
const CDN = /^(https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\/)/;

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/models/')){
    // 3D 模型檔：快取優先（檔名改了才會重新下載）
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
  } else if (url.origin === location.origin){
    // 自己網站的檔案：網路優先
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else if (CDN.test(req.url)){
    // 3D 引擎、字型等固定版本的檔案：快取優先
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok || res.type === 'opaque'){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
  }
  // 其他（例如 PeerJS 連線伺服器）不經過快取
});
