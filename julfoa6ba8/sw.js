// OD Band – Burdayım: cache the heavy, rarely-changing files (models, textures, libs) so repeat visits start fast.
// Bump CACHE when a model/texture is replaced under the same file name.
const CACHE = 'od-assets-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url); if (u.origin !== location.origin || !/\/(models|lib|assets)\//.test(u.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok && r.status === 200) c.put(req, r.clone()); return r; }));
});
