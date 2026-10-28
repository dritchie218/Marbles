// Marbles offline support.
// Network first: when online, players always get the latest version from the site.
// When offline (or the network is very slow), the copy saved on the device is used.
const CACHE = 'marbles-v1';
const FILES = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
const WAIT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const saved = async () => (await cache.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
  const net = fetch(req.url, { cache: 'no-cache' }).then(res => {
    if (res.ok && !res.redirected) {
      cache.put(req, res.clone());
      if (req.mode === 'navigate') cache.put('./index.html', res.clone()); // keep the offline fallback current
    }
    return res;
  });
  net.catch(() => {});
  const slow = new Promise(r => setTimeout(r, WAIT_MS)).then(saved).then(r => r || net);
  try {
    return await Promise.race([net, slow]);
  } catch (err) {
    return (await saved()) || Response.error();
  }
}
