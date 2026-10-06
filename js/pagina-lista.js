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
    // Las pestañas de la barra (Por comprar / Toda la lista) las monta montarVistaArticulos,
    // que es quien sabe qué vista está activa.
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
