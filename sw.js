// Service worker : garde l'application, le texte et les récitations téléchargées
// dans le stockage interne de l'application (pas dans les fichiers du téléphone).
const SHELL = "quran-shell-v4";
const TEXT = "quran-text-v1";
const AUDIO = "quran-audio-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const AUDIO_HOSTS = ["everyayah.com", "cdn.islamic.network"];
const TEXT_HOSTS = ["api.alquran.cloud", "api.quran.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k.startsWith("quran-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Application : réseau d'abord (pour recevoir les mises à jour), sinon la copie gardée
  if (url.origin === self.location.origin){
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok){ const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return r;
      }).catch(async () =>
        (await caches.match(req, { ignoreSearch: true })) || (await caches.match("./index.html")))
    );
    return;
  }

  // Récitations : la version téléchargée d'abord, sinon internet
  if (AUDIO_HOSTS.includes(url.hostname)){
    e.respondWith((async () => {
      const c = await caches.open(AUDIO);
      return (await c.match(req.url)) || fetch(req);
    })());
    return;
  }

  // Texte du Coran et polices : copie gardée, mise à jour en arrière-plan
  if (TEXT_HOSTS.includes(url.hostname)){
    e.respondWith((async () => {
      const c = await caches.open(TEXT);
      const cached = await c.match(req.url);
      const net = fetch(req).then(r => {
        if (r.ok || r.type === "opaque") c.put(req.url, r.clone());
        return r;
      });
      if (cached){ e.waitUntil(net.catch(() => {})); return cached; }
      return net;
    })());
  }
});
