/* SupDiver offline shell. The build replaces the version placeholder. */
const CACHE_NAME = "supdiver-offline-__BUILD_ID__";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const manifestResponse = await fetch("/offline-assets.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("Offline asset manifest unavailable");
    const assets = await manifestResponse.json();
    // Do not activate a half-cached worker: a partial app cannot reliably save records.
    await cache.addAll([
      "/auth",
      OFFLINE_URL,
      "/images/user-cave-photo-hero-preview.jpg",
      "/images/supdiver-wave-mark.svg",
      ...assets,
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("supdiver-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && (url.pathname === "/auth" || url.pathname === OFFLINE_URL)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(url.pathname)) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/images/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
