// Arranque de lista.html. Vive aparte del HTML por la misma razón que pagina-inicio.js:
// la CSP de firebase.json no permite scripts inline.
(function () {
  var app = document.getElementById("app");
  var params = new URLSearchParams(window.location.search);
  var listaId = params.get("lista");
  var detenerEscucha = null;

  function mostrarSinSesion() {
    app.innerHTML = '<div class="contenedor vacio"><p>Necesitas iniciar sesión.</p>' +
      '<a class="btn" href="index.html">Ir a Mis listas</a></div>';
  }

  function mostrarSinId() {
    app.innerHTML = '<div class="contenedor vacio"><p>Esta liga no indica qué lista abrir.</p>' +
      '<a class="btn" href="index.html">Ir a Mis listas</a></div>';
  }

  function mostrarLista(usuario) {
    app.innerHTML =
      '<div class="contenedor">' +
      '<a href="index.html" class="btn-texto enlace-con-icono">' +
      icono("chevron-left", 18) + "<span>Mis listas</span></a>" +
      '<h1 data-nombre-lista>Cargando…</h1>' +
      '<div class="tarjeta">' +
      '<p class="texto-suave">Los artículos, favoritos y plantillas de esta lista llegan en la ' +
      "siguiente fase. Por ahora puedes confirmar que la lista existe y que tienes acceso a ella.</p>" +
      "</div>" +
      "</div>";

    var enlaceLista = "lista.html?lista=" + encodeURIComponent(listaId);
    montarPestanas(
      '<a href="' + esc(enlaceLista) + '" class="item-barra activo" aria-current="page" aria-label="Lista" title="Lista">' + icono("list", 22) + "</a>" +
        '<a href="#" class="item-barra" aria-disabled="true" aria-label="Favoritos (próximamente)" title="Favoritos (próximamente)">' + icono("star", 22) + "</a>" +
        '<a href="#" class="item-barra" aria-disabled="true" aria-label="Plantillas (próximamente)" title="Plantillas (próximamente)">' + icono("layout-template", 22) + "</a>" +
        '<a href="#" class="item-barra" aria-disabled="true" aria-label="Miembros (próximamente)" title="Miembros (próximamente)">' + icono("users", 22) + "</a>"
    );
    montarMenuCuenta(usuario);

    var tituloEl = app.querySelector("[data-nombre-lista]");
    detenerEscucha = escuchar(refNodo("listas/" + listaId + "/info"), function (info) {
      if (!info || !info.nombre) {
        tituloEl.textContent = "Sin acceso a esta lista";
        return;
      }
      tituloEl.textContent = info.nombre;
    });

    montarBotonAyuda(
      "<h3>Esta lista</h3><p>Aquí verás los artículos agrupados por pasillo, tus favoritos y " +
        "las plantillas de esta lista. Esa parte llega en la siguiente fase del proyecto.</p>"
    );
  }

  if (!listaId) {
    mostrarSinId();
  } else {
    requerirSesion(function (usuario) {
      if (detenerEscucha) {
        detenerEscucha();
        detenerEscucha = null;
      }
      if (!usuario) {
        vaciarRanura("pestanas");
        vaciarRanura("ayuda");
        montarMenuCuenta(null);
        mostrarSinSesion();
      } else mostrarLista(usuario);
    });
  }
})();
