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
      '<a href="index.html" class="btn-texto" style="display:inline-flex;align-items:center;gap:4px">' +
      icono("chevron-left", 18) + "<span>Mis listas</span></a>" +
      '<h1 data-nombre-lista>Cargando…</h1>' +
      '<div class="tarjeta">' +
      '<p class="texto-suave">Los artículos, favoritos y plantillas de esta lista llegan en la ' +
      "siguiente fase. Por ahora puedes confirmar que la lista existe y que tienes acceso a ella.</p>" +
      "</div>" +
      "</div>" +
      '<nav class="nav-inferior" aria-label="Navegación de la lista">' +
      '<a href="lista.html?lista=' + encodeURIComponent(listaId) + '" class="activo">' + icono("list", 20) + "<span>Lista</span></a>" +
      '<a href="#" aria-disabled="true">' + icono("star", 20) + "<span>Favoritos</span></a>" +
      '<a href="#" aria-disabled="true">' + icono("layout-template", 20) + "<span>Plantillas</span></a>" +
      '<a href="#" aria-disabled="true">' + icono("users", 20) + "<span>Miembros</span></a>" +
      '<a href="index.html">' + icono("chevron-left", 20) + "<span>Mis listas</span></a>" +
      "</nav>";

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
      if (!usuario) mostrarSinSesion();
      else mostrarLista(usuario);
      montarPastillaConexion();
    });
  }
})();
