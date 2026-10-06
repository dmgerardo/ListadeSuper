// Se carga en <head>, antes del primer paint, para evitar el parpadeo de tema.
// La preferencia guardada puede ser "sistema", pero el atributo data-modo del documento
// siempre trae el valor YA RESUELTO (claro u oscuro).
(function () {
  function resolverModo(preferencia) {
    if (preferencia === "claro" || preferencia === "oscuro") return preferencia;
    var prefiereOscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefiereOscuro ? "oscuro" : "claro";
  }

  function preferenciaGuardada() {
    try {
      return localStorage.getItem("preferenciaTema") || "sistema";
    } catch (e) {
      return "sistema";
    }
  }

  function aplicarModo() {
    var pref = preferenciaGuardada();
    document.documentElement.setAttribute("data-modo", resolverModo(pref));
  }

  aplicarModo();

  // Si la preferencia es "sistema", reaccionar a cambios del sistema operativo en vivo.
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (preferenciaGuardada() === "sistema") aplicarModo();
    });
  }

  // Expuesto para que la pantalla de preferencias cambie el tema sin recargar.
  window.establecerPreferenciaTema = function (preferencia) {
    try {
      localStorage.setItem("preferenciaTema", preferencia);
    } catch (e) {}
    aplicarModo();
  };

  window.obtenerPreferenciaTema = preferenciaGuardada;
})();
