// Arranque de usuarios.html (solo administradores). Sin <script> inline por la CSP.
(function () {
  var app = document.getElementById("app");
  var limpiar = null;
  var detenerRol = null;

  function soloAdmins() {
    app.innerHTML = '<div class="contenedor vacio"><p>Esta pantalla es solo para administradores.</p>' +
      '<a class="btn" href="index.html">Ir a Mis listas</a></div>';
  }

  requerirSesion(function (usuario) {
    if (limpiar) { limpiar(); limpiar = null; }
    if (detenerRol) { detenerRol(); detenerRol = null; }
    if (!usuario) {
      montarMenuCuenta(null);
      app.innerHTML = '<div class="contenedor vacio"><p>Necesitas iniciar sesión.</p><a class="btn" href="index.html">Ir a Mis listas</a></div>';
      return;
    }
    detenerRol = montarCuentaConRol(usuario, function (rol) {
      if (rol.sinNodo) return;
      if (rol.esAdmin && !limpiar) limpiar = montarVistaUsuarios(app, usuario);
      if (!rol.esAdmin) {
        if (limpiar) { limpiar(); limpiar = null; }
        soloAdmins();
      }
    });
  });
})();
