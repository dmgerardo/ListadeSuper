// Service Worker: cachea el "app shell" por versión. HTML = red primero (con
// ignoreSearch, para no duplicar entradas por ?v=N); CSS/JS = caché primero, pero SOLO
// dentro del caché de ESTA versión (así cada vN sirve exactamente sus propios archivos).
// IMPORTANTE: cada archivo .js/.css nuevo debe agregarse también aquí.
const APP_VERSION = "23";
const NOMBRE_CACHE = "app-shell-v" + APP_VERSION;

const ARCHIVOS_APP_SHELL = [
  "/",
  "/index.html",
  "/lista.html",
  "/usuarios.html",
  "/unirse.html",
  "/historial.html",
  "/manifest.json",
  "/css/estilos.css",
  "/js/tema.js",
  "/js/firebase-config.js",
  "/js/db.js",
  "/js/auth.js",
  "/js/roles.js",
  "/js/iconos.js",
  "/js/render-utils.js",
  "/js/catalogo-categorias.js",
  "/js/fotos.js",
  "/js/logica-articulos.js",
  "/js/vista-articulos.js",
  "/js/vista-miembros.js",
  "/js/coordinacion.js",
  "/js/vista-listas.js",
  "/js/vista-usuarios.js",
  "/js/pagina-usuarios.js",
  "/js/pagina-unirse.js",
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
      // cache: "reload" salta la caché HTTP del navegador: sin esto, addAll() puede guardar
      // en el caché de la versión nueva una copia vieja (Firebase sirve JS/CSS con max-age).
      return cache.addAll(
        ARCHIVOS_APP_SHELL.map(function (url) {
          return new Request(url, { cache: "reload" });
        })
      );
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
          // Clonar YA, antes de devolverla: si se clona dentro del .then() asíncrono, la
          // página ya consumió el cuerpo y clone() truena ("body is already used").
          if (respuesta.ok) {
            var copia = respuesta.clone();
            caches.open(NOMBRE_CACHE).then(function (cache) {
              cache.put(req, copia);
            });
          }
          return respuesta;
        })
        .catch(function () {
          return caches.match(req, { ignoreSearch: true });
        })
    );
    return;
  }

  // Un ?v=N de OTRA versión (p.ej. el HTML nuevo pidiendo ?v=7 mientras este SW todavía es
  // el v6) va directo a la red: con ignoreSearch se serviría el archivo viejo de este caché.
  var versionPedida = url.searchParams.get("v");
  if (versionPedida && versionPedida !== APP_VERSION) {
    ev.respondWith(fetch(req));
    return;
  }

  ev.respondWith(
    caches.open(NOMBRE_CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (enCache) {
        if (enCache) return enCache;
        return fetch(req).then(function (respuesta) {
          if (respuesta.ok) cache.put(req, respuesta.clone());
          return respuesta;
        });
      });
    })
  );
});
