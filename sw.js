// Service Worker: cachea el "app shell" por versión. HTML = red primero (con
// ignoreSearch, para no duplicar entradas por ?v=N); CSS/JS = caché primero, pero SOLO
// dentro del caché de ESTA versión (así cada vN sirve exactamente sus propios archivos).
// IMPORTANTE: cada archivo .js/.css nuevo debe agregarse también aquí.
const APP_VERSION = "6";
const NOMBRE_CACHE = "app-shell-v" + APP_VERSION;

const ARCHIVOS_APP_SHELL = [
  "/",
  "/index.html",
  "/lista.html",
  "/historial.html",
  "/manifest.json",
  "/css/estilos.css",
  "/js/tema.js",
  "/js/firebase-config.js",
  "/js/db.js",
  "/js/auth.js",
  "/js/iconos.js",
  "/js/render-utils.js",
  "/js/catalogo-categorias.js",
  "/js/vista-listas.js",
  "/js/pagina-inicio.js",
  "/js/pagina-lista.js",
  "/js/app-version.js",
  "/js/version.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(NOMBRE_CACHE).then(function (cache) {
      return cache.addAll(ARCHIVOS_APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres
          .filter(function (nombre) {
            return nombre !== NOMBRE_CACHE;
          })
          .map(function (nombre) {
            return caches.delete(nombre);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var esHtml = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/";

  if (esHtml) {
    ev.respondWith(
      fetch(req)
        .then(function (respuesta) {
          caches.open(NOMBRE_CACHE).then(function (cache) {
            cache.put(req, respuesta.clone());
          });
          return respuesta;
        })
        .catch(function () {
          return caches.match(req, { ignoreSearch: true });
        })
    );
    return;
  }

  ev.respondWith(
    caches.open(NOMBRE_CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (enCache) {
        if (enCache) return enCache;
        return fetch(req).then(function (respuesta) {
          cache.put(req, respuesta.clone());
          return respuesta;
        });
      });
    })
  );
});
