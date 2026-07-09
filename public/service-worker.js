// Service worker do OneVox PWA — atualizacao automatica e leve.
// Estrategia:
//  - HTML / navegacao: network-first (ao abrir online, sempre a versao nova).
//  - Assets com hash de conteudo (/_expo/..., *.<hash>.js/css): cache-first
//    (imutaveis -> carregam instantaneo; deploy novo = hash novo = baixa so o que mudou).
//  - Bump do CACHE_VERSION limpa caches antigos no activate.
const CACHE_VERSION = "v3";
const CACHE_NAME = `onevox-${CACHE_VERSION}`;
const PRECACHE = ["/manifest.json", "/favicon.png", "/pwa-icon-192.png", "/pwa-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isImmutableAsset(url) {
  if (url.pathname.startsWith("/_expo/")) return true;
  // arquivos versionados por hash de conteudo (ex.: entry.a1b2c3d4.js)
  return /\.[0-9a-f]{8,}\.(js|css|woff2?|ttf|png|jpe?g|svg|webp)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Assets imutaveis: cache-first (rapido e leve).
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // HTML / navegacao / demais GETs: network-first (sempre a versao nova online).
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || (request.mode === "navigate" ? caches.match("/") : undefined)),
      ),
  );
});
