// Arranque de lista.html. Vive aparte del HTML por la misma razón que pagina-inicio.js:
// la CSP de firebase.json no permite scripts inline.
(function () {
  var app = document.getElementById("app");
  var params = new URLSearchParams(window.location.search);
  var listaId = params.get("lista");
  var limpiarVista = null;

  function mostrarSinSesion() {
    app.innerHTML = '<div class="contenedor vacio"><p>Necesitas iniciar sesión.</p>' +
      '<a class="btn" href="index.html">Ir a Mis listas</a></div>';
  }

  function mostrarSinId() {
    app.innerHTML = '<div class="contenedor vacio"><p>Esta liga no indica qué lista abrir.</p>' +
      '<a class="btn" href="index.html">Ir a Mis listas</a></div>';
  }

  function mostrarLista(usuario) {
    montarPestanas(
      '<a href="' + esc("lista.html?lista=" + encodeURIComponent(listaId)) + '" class="item-barra activo" aria-current="page" aria-label="Lista" title="Lista">' + icono("list", 22) + "</a>" +
        '<a href="#" class="item-barra" aria-disabled="true" data-nombre="Favoritos" aria-label="Favoritos (próximamente)" title="Favoritos (próximamente)">' + icono("star", 22) + "</a>" +
        '<a href="#" class="item-barra" aria-disabled="true" data-nombre="Plantillas" aria-label="Plantillas (próximamente)" title="Plantillas (próximamente)">' + icono("layout-template", 22) + "</a>" +
        '<a href="#" class="item-barra" aria-disabled="true" data-nombre="Miembros" aria-label="Miembros (próximamente)" title="Miembros (próximamente)">' + icono("users", 22) + "</a>"
    );
    montarMenuCuenta(usuario);
    limpiarVista = montarVistaArticulos(app, listaId, usuario);
  }

  if (!listaId) {
    mostrarSinId();
  } else {
    requerirSesion(function (usuario) {
      if (limpiarVista) {
        limpiarVista();
        limpiarVista = null;
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
