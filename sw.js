/* 通关 Passage service worker */
const CACHE = "passage-v11-396acb70ec";
const SHELL = ["./", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("passage-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
function tag(res) { return res ? (res.headers.get("etag") || res.headers.get("last-modified") || "") : ""; }
async function refreshPage(request) {
  const cache = await caches.open(CACHE);
  const old = await cache.match("./");
  const res = await fetch(request, { cache: "no-store" });
  if (!res || !res.ok) return;
  await cache.put("./", res.clone());
  if (old && tag(res) && tag(res) !== tag(old)) {
    const wins = await self.clients.matchAll({ type: "window" });
    wins.forEach((w) => w.postMessage({ type: "updated" }));
  }
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match("./");
      if (hit) { e.waitUntil(refreshPage(req).catch(() => {})); return hit; }
      try {
        const res = await fetch(req);
        if (res && res.ok) await cache.put("./", res.clone());
        return res;
      } catch (err) {
        return new Response("<meta charset=utf-8><p style='font:16px system-ui;padding:24px'>没有网络，也还没有离线副本。联网打开一次通关，以后没网也能用。</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
