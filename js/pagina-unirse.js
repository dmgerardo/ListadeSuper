// Arranque de unirse.html?codigo=XXXX: aceptar una invitación a una lista.
// Unirse = UNA escritura multi-ruta: miembros/{yo} (editor, con el código) + marcar la
// invitación como usada por mí + listasDeUsuario/{yo}/{lista}. Las reglas exigen las tres
// juntas (un solo uso). Un Invitado (cuenta aún sin autorizar) también puede unirse.
(function () {
  var app = document.getElementById("app");
  var codigo = new URLSearchParams(window.location.search).get("codigo") || "";
  var detenerRol = null;

  function tarjeta(icono_, titulo, texto, boton) {
    app.innerHTML =
      '<div class="contenedor"><div class="tarjeta tarjeta-vacia tarjeta-unirse">' +
      '<span class="circulo-vacio" aria-hidden="true">' + icono(icono_, 28) + "</span>" +
      '<p class="titulo-vacio">' + titulo + "</p>" +
      (texto ? "<p>" + texto + "</p>" : "") +
      (boton || "") +
      "</div></div>";
  }

  function irALista(listaId) {
    window.location.href = "lista.html?lista=" + encodeURIComponent(listaId);
  }

  function mostrarInvitacion(usuario) {
    if (!/^[A-Za-z0-9_-]{22,64}$/.test(codigo)) {
      tarjeta("x", "Liga no válida", "Pide a quien te invitó que te mande una liga nueva.", '<a class="btn" href="index.html">Ir a Mis listas</a>');
      return;
    }
    tarjeta("users", "Revisando la invitación…", "");
    refNodo("invitaciones/" + codigo).once("value").then(function (snap) {
      var inv = snap.val();
      if (!inv) {
        tarjeta("x", "Esta invitación ya no existe", "Pide a quien te invitó una liga nueva.", '<a class="btn" href="index.html">Ir a Mis listas</a>');
        return;
      }
      var abrir = '<button type="button" class="btn" data-abrir>Abrir la lista</button>';
      return refNodo("listasDeUsuario/" + usuario.uid + "/" + inv.listaId).once("value").then(function (yaMiembro) {
        if (yaMiembro.val() === true || inv.usadaPor === usuario.uid) {
          tarjeta("check", "Ya estás en “" + esc(inv.listaNombre) + "”", "", abrir);
        } else if (inv.usadaPor) {
          tarjeta("x", "Esta invitación ya se usó", "Cada liga sirve para una persona. Pide a " + esc(inv.creadaPorNombre || "quien te invitó") + " una nueva.", '<a class="btn" href="index.html">Ir a Mis listas</a>');
          return;
        } else if (inv.expira < Date.now()) {
          tarjeta("x", "Esta invitación ya venció", "Las ligas duran 7 días. Pide a " + esc(inv.creadaPorNombre || "quien te invitó") + " una nueva.", '<a class="btn" href="index.html">Ir a Mis listas</a>');
          return;
        } else {
          tarjeta("users", esc(inv.creadaPorNombre || "Alguien") + " te invitó a “" + esc(inv.listaNombre) + "”",
            "Podrás ver y editar la lista con las demás personas, en tiempo real.",
            '<button type="button" class="btn" data-unirme>' + icono("check", 18) + "<span>Unirme a la lista</span></button>");
        }
        var b;
        if ((b = app.querySelector("[data-abrir]"))) b.addEventListener("click", function () { irALista(inv.listaId); });
        if ((b = app.querySelector("[data-unirme]"))) {
          b.addEventListener("click", function () {
            b.disabled = true;
            var cambios = {};
            cambios["listas/" + inv.listaId + "/miembros/" + usuario.uid] = {
              rol: "editor",
              nombre: String(usuario.displayName || usuario.email || "").slice(0, 120),
              email: String(usuario.email || "").slice(0, 200),
              desde: firebase.database.ServerValue.TIMESTAMP,
              codigo: codigo
            };
            cambios["invitaciones/" + codigo + "/usadaPor"] = usuario.uid;
            cambios["listasDeUsuario/" + usuario.uid + "/" + inv.listaId] = true;
            actualizarMultiple(cambios).then(function () {
              irALista(inv.listaId);
            }).catch(function (e) {
              console.error(e);
              b.disabled = false;
              mostrarToast("No se pudo unir a la lista. Pide una liga nueva.", { duracionMs: 8000 });
            });
          });
        }
      });
    }).catch(function (e) {
      console.error(e);
      tarjeta("x", "No se pudo leer la invitación", "Revisa tu conexión e inténtalo otra vez.", '<a class="btn" href="">Reintentar</a>');
    });
  }

  function mostrarSinSesion() {
    tarjeta("users", "Te invitaron a una lista", "Inicia sesión con tu cuenta de Google para unirte.",
      '<button type="button" class="btn-google" data-google>' + icono("user", 20) + "<span>Continuar con Google</span></button>");
    app.querySelector("[data-google]").addEventListener("click", function (ev) {
      var boton = ev.currentTarget; // se guarda antes del .catch (currentTarget se vuelve null)
      boton.disabled = true;
      iniciarSesionConGoogle().catch(function (error) {
        console.error(error);
        mostrarToast("No se pudo iniciar sesión. Intenta de nuevo.");
        boton.disabled = false;
      });
    });
  }

  requerirSesion(function (usuario) {
    if (detenerRol) { detenerRol(); detenerRol = null; }
    if (!usuario) {
      montarMenuCuenta(null);
      mostrarSinSesion();
      return;
    }
    var mostrado = false;
    detenerRol = montarCuentaConRol(usuario, function (rol) {
      if (rol.sinNodo) return;
      if (!rol.activo) {
        app.innerHTML = htmlCuentaDesactivada();
        return;
      }
      if (!mostrado) {
        mostrado = true;
        mostrarInvitacion(usuario);
      }
    });
  });
})();
