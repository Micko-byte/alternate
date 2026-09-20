// VAA ALTERNATE service worker: makes the app installable and quick to open on slow connections.
// Only our own static files are cached. Supabase, Paystack and OpenAI requests are never touched.
const CACHE = "alternate-v2";
const SHELL = ["/", "/manifest.webmanifest", "/brand/icon-192.png", "/brand/alternate-mark.png", "/brand/alternate-mark-white.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always try the network so people get the latest version; fall back to the saved app when offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Build files have hashed names and never change, so the saved copy is always right
  if (/^\/(assets|fonts|brand|onboarding|site)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            // A photo that hasn't been added yet comes back as the app page: never keep that
            if (response.ok && !(response.headers.get("content-type") ?? "").includes("text/html")) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
