// Offline support for the installed app (PWA).
//
// • Everything the app needs — both pages, their scripts, icons and the WASM DSP
//   core — is precached on install, so the receiver and the monitor open with no
//   connection (useful in the field).
// • Pages are network-first so updates appear as soon as you're online.
// • Other same-origin files are served from cache and refreshed in the background.
// • Map tiles you have looked at are kept (up to a few thousand) so the MMN map
//   still shows streets in the field without signal.
// • CSV files shared from other Android apps (share target) are put in the
//   recordings inbox and the map opens them.
// Bump VERSION when the list changes.

import { addToInbox } from "../../src/storage/recordings.js";

const VERSION = "v4";
const CACHE_NAME = `radioreceiver-${VERSION}`;
const APP_STATIC_RESOURCES = [
  "./",
  "index.html",
  "main.js",
  "thesis-view.html",
  "monitor.js",
  "monitor.css",
  "map.html",
  "map.js",
  "map.css",
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

const TILE_CACHE = "webrx-tiles-v1";
const TILE_LIMIT = 4000;
const TILE_HOSTS = /(^|\.)tile\.openstreetmap\.org$|(^|\.)arcgisonline\.com$/;
let tilePuts = 0;

async function refreshCache() {
  const names = await we.caches.keys();
  await Promise.all(names.map((name) => (name !== CACHE_NAME && name !== TILE_CACHE ? we.caches.delete(name) : undefined)));
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

/** Cache-first for map tiles. Only CORS (non-opaque) responses are stored, so
 *  the cache can't eat the storage the recordings need. */
async function tile(request: Request, event: FetchEvent): Promise<Response> {
  const cache = await we.caches.open(TILE_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  let response: Response | undefined;
  try {
    response = await fetch(request.url, { mode: "cors", credentials: "omit" });
  } catch (_) {
    // Server without CORS headers (or offline): plain image request, not cached.
    return fetch(request).catch(() => Response.error());
  }
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(
      cache
        .put(request.url, copy)
        .then(() => (++tilePuts % 200 === 0 ? trimTiles(cache) : undefined))
        .catch(() => undefined)
    );
  }
  return response;
}

async function trimTiles(cache: Cache) {
  const keys = await cache.keys();
  const extra = keys.length - TILE_LIMIT;
  if (extra > 0) await Promise.all(keys.slice(0, extra + 200).map((k) => cache.delete(k)));
}

/** Web Share Target: CSV files shared from another app land here (POST). */
async function receiveShare(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const items: { name: string; text: string }[] = [];
    for (const f of form.getAll("files")) {
      if (typeof f !== "string") items.push({ name: f.name || "shared.csv", text: await f.text() });
    }
    const text = form.get("text");
    if (!items.length && typeof text === "string" && /[,;\t]/.test(text) && /\n/.test(text)) {
      const title = form.get("title");
      items.push({ name: typeof title === "string" && title ? title : "shared.csv", text });
    }
    if (items.length) await addToInbox(items);
  } catch (e) {
    console.warn("share target", e);
  }
  return Response.redirect(new URL("map.html?shared=1", we.registration.scope).href, 303);
}

we.addEventListener("install", (e: ExtendableEvent) => {
  e.waitUntil(precache().then(() => we.skipWaiting()));
});

we.addEventListener("activate", (e: ExtendableEvent) => {
  e.waitUntil(refreshCache());
});

we.addEventListener("fetch", (e: FetchEvent) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === "POST" && url.origin === we.location.origin && url.pathname.endsWith("/share-csv")) {
    e.respondWith(receiveShare(req));
    return;
  }
  if (req.method === "GET" && TILE_HOSTS.test(url.hostname)) {
    e.respondWith(tile(req, e));
    return;
  }
  if (req.method !== "GET" || url.origin !== we.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(staleWhileRevalidate(req, e));
  }
});
