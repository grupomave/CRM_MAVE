// Service worker básico (prompt.md seção 3.10) — só cache de assets
// estáticos (JS/CSS/fontes/imagens do Next.js). Não cacheia páginas nem
// chamadas à API/Supabase de propósito: os dados são sensíveis e mudam o
// tempo todo, então servir uma versão antiga offline seria pior do que não
// servir nada. Sincronização offline completa fica fora desta fase.

const CACHE_NAME = "mave-crm-static-v1";

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (!isStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});
