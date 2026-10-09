// Offline support for the installed app (PWA).
//
// • Everything the app needs — both pages, their scripts, icons and the WASM DSP
//   core — is precached on install, so the receiver and the monitor open with no
//   connection (useful in the field).
// • Pages are network-first so updates appear as soon as you're online.
// • Other same-origin files are served from cache and refreshed in the background.
// Bump VERSION when the list changes.

const VERSION = "v2";
const CACHE_NAME = `radioreceiver-${VERSION}`;
const APP_STATIC_RESOURCES = [
  "./",
  "index.html",
  "main.js",
  "thesis-view.html",
  "monitor.js",
  "webrx_dsp.wasm",
  "help.html",
  "help.js",
  "manifest.json",
  "favicon.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
];

let we = self as unknown as ServiceWorkerGlobalScope;

async function precache() {
  const cache = await we.caches.open(CACHE_NAME);
  // Add individually so one missing file doesn't abort the whole install.
  await Promise.all(
    APP_STATIC_RESOURCES.map((url) =>
      cache.add(new Request(url, { cache: "reload" })).catch((e) => console.warn("precache", url, e))
    )
  );
}

async function refreshCache() {
  const names = await we.caches.keys();
  await Promise.all(names.map((name) => (name !== CACHE_NAME ? we.caches.delete(name) : undefined)));
  await we.clients.claim();
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await we.caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match("index.html")) || Response.error();
  }
}

async function staleWhileRevalidate(request: Request, event: FetchEvent): Promise<Response> {
  const cache = await we.caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return (await update) || Response.error();
}

we.addEventListener("install", (e: ExtendableEvent) => {
  e.waitUntil(precache().then(() => we.skipWaiting()));
});

we.addEventListener("activate", (e: ExtendableEvent) => {
  e.waitUntil(refreshCache());
});

we.addEventListener("fetch", (e: FetchEvent) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== we.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(staleWhileRevalidate(req, e));
  }
});
