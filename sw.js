const CACHE_NAME = "stark-cart-xr-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/stark-hud.css",
  "./icon.svg",
  "./manifest.json",
  "./js/app.js",
  "./js/cart-engine.js",
  "./js/curriculum.js",
  "./js/audio-engine.js",
  "./js/xr-scene.js",
  "./vendor/three.module.js",
  "./vendor/three.core.js",
  "./vendor/OrbitControls.js",
  "./audio/stage_00.mp3",
  "./audio/stage_01.mp3",
  "./audio/stage_02.mp3",
  "./audio/stage_03.mp3",
  "./audio/stage_04.mp3",
  "./audio/stage_05.mp3",
  "./audio/stage_06.mp3",
  "./audio/stage_07.mp3",
  "./audio/stage_08.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
