// Badge de versión (tocar = forzar actualización) + registro del Service Worker.
(function () {
  function montarBadge() {
    var barra = document.querySelector(".barra-estado");
    if (!barra) {
      barra = document.createElement("div");
      barra.className = "barra-estado";
      document.body.appendChild(barra);
    }
    var badge = document.createElement("button");
    badge.type = "button";
    badge.className = "pastilla pastilla-version";
    badge.textContent = "v" + APP_VERSION;
    badge.title = "Tocar para forzar actualización";
    badge.setAttribute("aria-label", "Versión " + APP_VERSION + ", tocar para forzar actualización");
    badge.addEventListener("click", forzarActualizacion);
    barra.appendChild(badge);
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
    montarBadge();
  } else {
    document.addEventListener("DOMContentLoaded", montarBadge);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
