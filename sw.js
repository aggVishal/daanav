// Daanav service worker: lets the app open without internet.
// Your own files: fresh from the network when online, cached copy when offline.
// Library and fonts: cached after the first load.
// Requests to Firebase (sign-in and your data) are never cached here.
const CACHE = "daanav-fb-v15";
const SHELL = ["./", "index.html", "styles.css", "app.js", "figures.js", "exdata.js", "config.js", "manifest.webmanifest",
  "icons/icon-180.png", "icons/icon-192.png",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Network first, so a new upload shows up straight away
    e.respondWith(
      fetch(req, { cache: "no-cache" }).then(res => {   // always ask the server for the newest version
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || caches.match("index.html")))
    );
    return;
  }

  if ((url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    // Cache first: these files never change at a pinned version
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
