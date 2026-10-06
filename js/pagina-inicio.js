// Arranque de index.html: pantalla de bienvenida (sin sesión) o "Mis listas" (con sesión).
// Vive en un archivo aparte (y no inline en el HTML) porque la CSP de firebase.json no
// permite scripts inline.
(function () {
  var app = document.getElementById("app");
  var limpiarVistaActual = null;

  function mostrarBienvenida() {
    app.innerHTML =
      '<div class="pantalla-bienvenida">' +
      "<h1>ListadeCompras</h1>" +
      '<p class="texto-suave">Listas de compra compartidas, en tiempo real, con tu familia o tu equipo.</p>' +
      '<button type="button" class="btn-google" id="boton-google">' +
      '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.6-6.6C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.7 6c1.8-5.4 6.9-9.7 13.7-9.7z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.3 19.2A14.5 14.5 0 0 0 9.5 24c0 1.7.3 3.3.8 4.8l-7.7 6A24 24 0 0 1 0 24c0-3.9.9-7.6 2.6-10.8z"/><path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.3-5.6l-7.4-5.7c-2 1.4-4.7 2.2-7.9 2.2-6.8 0-12-4.3-13.7-9.7l-7.7 6C6.5 42.6 14.6 48 24 48z"/></svg>' +
      "<span>Continuar con Google</span>" +
      "</button>" +
      "</div>";
    document.getElementById("boton-google").addEventListener("click", function (ev) {
      var boton = ev.currentTarget; // currentTarget es null fuera del despacho síncrono
      boton.disabled = true;        // del evento: hay que guardarlo antes del await/catch.
      iniciarSesionConGoogle().catch(function (error) {
        console.error("Error de login:", error);
        mostrarToast("No se pudo iniciar sesión. Intenta de nuevo.");
        boton.disabled = false;
      });
    });
  }

  function mostrarApp(usuario) {
    app.innerHTML = '<div data-contenedor-vista></div>';
    var contenedorVista = app.querySelector("[data-contenedor-vista]");

    var barra = document.querySelector(".barra-estado");
    if (!barra) {
      barra = document.createElement("div");
      barra.className = "barra-estado";
      document.body.appendChild(barra);
    }
    var cuentaPrevia = barra.querySelector(".menu-cuenta");
    if (cuentaPrevia) cuentaPrevia.remove();
    var cuenta = document.createElement("div");
    cuenta.className = "menu-cuenta pastilla";
    cuenta.innerHTML =
      '<img class="foto-cuenta" src="' + urlSegura(usuario.photoURL || "") + '" alt="" width="20" height="20">' +
      '<button type="button" class="btn-accion-icono" id="boton-salir" aria-label="Cerrar sesión" title="Cerrar sesión" style="width:28px;height:28px">' +
      icono("log-out", 16) +
      "</button>";
    barra.insertBefore(cuenta, barra.firstChild);
    document.getElementById("boton-salir").addEventListener("click", function () {
      cerrarSesion();
    });

    limpiarVistaActual = montarVistaListas(contenedorVista, usuario);
  }

  requerirSesion(function (usuario) {
    if (limpiarVistaActual) {
      limpiarVistaActual();
      limpiarVistaActual = null;
    }
    document.querySelectorAll(".btn-fab-ayuda, .contenedor-toasts").forEach(function (el) {
      el.remove();
    });
    if (!usuario) {
      var cuentaPrevia = document.querySelector(".menu-cuenta");
      if (cuentaPrevia) cuentaPrevia.remove();
    }
    if (usuario) mostrarApp(usuario);
    else mostrarBienvenida();
    montarPastillaConexion();
  });
})();
