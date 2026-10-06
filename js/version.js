// Estado de conexión + versión en la barra inferior (tocar = forzar actualización) y
// registro del Service Worker. Usa barraInferior() de render-utils.js (se carga antes).
(function () {
  function montarEstadoYVersion() {
    var ranura = ranuraBarra("estado");
    ranura.innerHTML =
      '<button type="button" class="item-barra item-estado">' +
      '<span class="punto-estado" aria-hidden="true"></span>' +
      '<span class="texto-version">v' + esc(APP_VERSION) + "</span>" +
      "</button>";
    var boton = ranura.firstChild;
    var punto = boton.querySelector(".punto-estado");
    boton.addEventListener("click", forzarActualizacion);

    function actualizar() {
      var enLinea = navigator.onLine;
      var estado = enLinea ? "En línea" : "Sin conexión";
      punto.classList.toggle("punto-estado-sin-conexion", !enLinea);
      boton.title = estado + " · v" + APP_VERSION + " · tocar para forzar actualización";
      boton.setAttribute("aria-label", estado + ". Versión " + APP_VERSION + ", tocar para forzar actualización");
    }
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    actualizar();
  }

  async function forzarActualizacion() {
    try {
      if ("serviceWorker" in navigator) {
        var registros = await navigator.serviceWorker.getRegistrations();
        for (var i = 0; i < registros.length; i++) await registros[i].unregister();
      }
      if (window.caches) {
        var nombres = await caches.keys();
        for (var j = 0; j < nombres.length; j++) await caches.delete(nombres[j]);
      }
    } catch (e) {}
    window.location.reload();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    montarEstadoYVersion();
  } else {
    document.addEventListener("DOMContentLoaded", montarEstadoYVersion);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
