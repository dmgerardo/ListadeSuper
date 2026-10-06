// Pantalla "Mis listas": crear, abrir y renombrar listas de compra del usuario.

function _idNuevaLista() {
  return refNodo("listas").push().key;
}

function crearLista(usuario, nombre) {
  var id = _idNuevaLista();
  var cambios = {};
  cambios["listas/" + id + "/info"] = {
    nombre: nombre,
    moneda: "MXN",
    creadaPor: usuario.uid,
    creada: firebase.database.ServerValue.TIMESTAMP,
    ordenCategorias: CATEGORIAS_ORDEN_DEFECTO
  };
  cambios["listas/" + id + "/miembros/" + usuario.uid] = {
    rol: "dueno",
    nombre: usuario.displayName || "",
    email: usuario.email || "",
    desde: firebase.database.ServerValue.TIMESTAMP
  };
  cambios["listasDeUsuario/" + usuario.uid + "/" + id] = true;
  // Escritura multi-ruta: info + miembros/{uid} dueño se crean juntos para cumplir la
  // regla de database.rules.json que exige que "la lista no exista todavía".
  return actualizarMultiple(cambios).then(function () {
    return id;
  });
}

// eliminarLista(listaId): solo el dueño (lo exigen las reglas). UNA escritura multi-ruta que
// borra la lista completa y la quita del índice "Mis listas" de cada miembro.
function eliminarLista(listaId) {
  return refNodo("listas/" + listaId + "/miembros").once("value").then(function (snap) {
    var cambios = {};
    cambios["listas/" + listaId] = null;
    Object.keys(snap.val() || {}).forEach(function (uid) {
      cambios["listasDeUsuario/" + uid + "/" + listaId] = null;
    });
    return actualizarMultiple(cambios);
  });
}

function renombrarLista(listaId, nuevoNombre) {
  return actualizar(refNodo("listas/" + listaId + "/info"), { nombre: nuevoNombre });
}

function _formularioLista(valoresIniciales, alGuardar, alEliminar) {
  var modal = abrirModal(
    '<h3>' + (valoresIniciales ? "Renombrar lista" : "Nueva lista") + "</h3>" +
      '<form data-form-lista>' +
      '<div class="campo">' +
      '<label for="campo-nombre-lista">Nombre</label>' +
      '<input id="campo-nombre-lista" name="nombre" type="text" maxlength="80" required ' +
      'value="' + esc(valoresIniciales ? valoresIniciales.nombre : "") + '" placeholder="Ej. Súper de la semana">' +
      "</div>" +
      '<div class="fila-botones">' +
      (alEliminar
        ? '<button type="button" class="btn-accion-icono btn-accion-peligro" data-eliminar-lista aria-label="Eliminar lista" title="Eliminar lista">' +
          icono("trash-2", 20) + "</button>" + '<span class="separador-flexible"></span>'
        : "") +
      '<button type="button" class="btn-accion-icono" data-cancelar aria-label="Cancelar" title="Cancelar">' +
      icono("x", 20) +
      "</button>" +
      '<button type="submit" class="btn-accion-icono" aria-label="Guardar" title="Guardar">' +
      icono("save", 20) +
      "</button>" +
      "</div>" +
      "</form>",
    null,
    { hayCambios: function () { return hayCambios(); }, guardar: function () { enviar(); } }
  );
  var form = modal.elemento.querySelector("[data-form-lista]");
  var campoNombre = modal.elemento.querySelector("#campo-nombre-lista");
  var valorOriginal = valoresIniciales ? valoresIniciales.nombre : "";

  function hayCambios() {
    return campoNombre.value.trim() !== valorOriginal;
  }

  modal.elemento.querySelector("[data-cancelar]").addEventListener("click", function () {
    confirmarCierreConCambios(hayCambios, modal.cerrar, enviar);
  });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    enviar();
  });
  var botonEliminar = modal.elemento.querySelector("[data-eliminar-lista]");
  if (botonEliminar) {
    botonEliminar.addEventListener("click", function () {
      modal.cerrar("manual");
      alEliminar();
    });
  }

  function enviar() {
    var nombre = campoNombre.value.trim();
    if (!nombre) return;
    alGuardar(nombre);
    modal.cerrar();
  }
}

// montarVistaListas(contenedor, usuario): devuelve la función de limpieza.
// Confirmación de borrado de una lista (no hay Deshacer: restaurar una lista con todos sus
// miembros chocaría con las reglas de alta; por eso se pide confirmar).
function _confirmarEliminarLista(nombre, alConfirmar) {
  var modal = abrirModal(
    "<h3>¿Eliminar “" + esc(nombre || "esta lista") + "”?</h3>" +
      '<p class="texto-suave">Se borra para todos sus miembros, con todos sus artículos. No se puede deshacer.</p>' +
      '<div class="fila-botones">' +
      '<button type="button" class="btn btn-secundario" data-cancelar>Cancelar</button>' +
      '<button type="button" class="btn btn-peligro" data-confirmar>' + icono("trash-2", 18) + "<span>Eliminar</span></button>" +
      "</div>",
    null
  );
  modal.elemento.querySelector("[data-cancelar]").addEventListener("click", function () { modal.cerrar("manual"); });
  modal.elemento.querySelector("[data-confirmar]").addEventListener("click", function () {
    modal.cerrar("manual");
    alConfirmar();
  });
}

function montarVistaListas(contenedor, usuario) {
  var detenerEscucha = null;
  var detenerEscuchasInfo = {};
  var infoPorLista = {};
  var rol = null;
  var detenerRol = null;
  var detenerPendientes = null;

  contenedor.innerHTML =
    '<div class="contenedor">' +
    '<p class="saludo">' + esc(usuario.displayName ? "Hola, " + usuario.displayName.split(" ")[0] : "Hola") + "</p>" +
    '<h1>Mis listas</h1>' +
    '<p class="subtitulo">Tus listas de compra compartidas</p>' +
    '<div data-avisos-rol></div>' +
    '<div data-lista-de-listas></div>' +
    "</div>";

  var zonaListas = contenedor.querySelector("[data-lista-de-listas]");
  var zonaAvisos = contenedor.querySelector("[data-avisos-rol]");

  function repintar() {
    programarRender("vista-listas", function () {
      var ids = Object.keys(infoPorLista);
      if (ids.length === 0) {
        zonaListas.innerHTML =
          '<div class="tarjeta tarjeta-vacia">' +
          '<span class="circulo-vacio" aria-hidden="true">' + icono("shopping-cart", 26) + "</span>" +
          '<p class="titulo-vacio">Todavía no tienes listas</p>' +
          (rol && !rol.puedeCrear
            ? "<p>Cuando alguien te invite a una lista, aparecerá aquí.</p></div>"
            : "<p>Toca <strong>+</strong> abajo a la derecha para crear la primera.</p></div>");
        return;
      }
      ids.sort(function (a, b) {
        return (infoPorLista[b].creada || 0) - (infoPorLista[a].creada || 0);
      });
      zonaListas.innerHTML = ids
        .map(function (id) {
          var info = infoPorLista[id];
          return (
            '<div class="tarjeta fila-tarjeta">' +
            '<a href="lista.html?lista=' + encodeURIComponent(id) + '" data-abrir="' + esc(id) + '" ' +
            'class="fila-tarjeta-enlace">' +
            '<span class="baldosa" aria-hidden="true">' + icono("shopping-cart", 22) + "</span>" +
            '<span class="nombre-lista">' + esc(info.nombre || "(sin nombre)") + "</span>" +
            "</a>" +
            '<button type="button" class="btn-accion-icono" data-renombrar="' + esc(id) + '" ' +
            'aria-label="' + (info.creadaPor === usuario.uid ? "Renombrar o eliminar lista" : "Renombrar lista") + '" title="Renombrar lista">' +
            icono("pencil", 18) +
            "</button>" +
            "</div>"
          );
        })
        .join("");
    });
  }

  function suscribirInfo(id) {
    if (detenerEscuchasInfo[id]) return;
    detenerEscuchasInfo[id] = escuchar(refNodo("listas/" + id + "/info"), function (info) {
      infoPorLista[id] = info;
      repintar();
    });
  }

  function desuscribirInfo(id) {
    if (detenerEscuchasInfo[id]) {
      detenerEscuchasInfo[id]();
      delete detenerEscuchasInfo[id];
    }
    delete infoPorLista[id];
  }

  detenerEscucha = escuchar(refNodo("listasDeUsuario/" + usuario.uid), function (indice) {
    var idsActuales = Object.keys(indice);
    var idsPrevios = Object.keys(detenerEscuchasInfo);
    idsPrevios
      .filter(function (id) {
        return idsActuales.indexOf(id) === -1;
      })
      .forEach(desuscribirInfo);
    idsActuales.forEach(suscribirInfo);
    if (idsActuales.length === 0) repintar();
  });

  zonaListas.addEventListener("click", function (ev) {
    var botonRenombrar = ev.target.closest("[data-renombrar]");
    if (!botonRenombrar) return;
    ev.preventDefault();
    var id = botonRenombrar.dataset.renombrar;
    var info = infoPorLista[id] || {};
    var esDueno = info.creadaPor === usuario.uid;
    _formularioLista({ nombre: info.nombre }, function (nuevoNombre) {
      renombrarLista(id, nuevoNombre)
        .then(function () {
          mostrarToast("Lista renombrada");
        })
        .catch(function () {
          mostrarToast("No se pudo renombrar la lista");
        });
    }, esDueno ? function () {
      _confirmarEliminarLista(info.nombre, function () {
        eliminarLista(id)
          .then(function () { mostrarToast("Lista eliminada"); })
          .catch(function (e) {
            console.error(e);
            mostrarToast("No se pudo eliminar la lista");
          });
      });
    } : null);
  });

  function montarBotonNuevaLista() {
    montarAccionPrincipal("plus", "Nueva lista", function () {
      _formularioLista(null, function (nombre) {
        crearLista(usuario, nombre)
          .then(function () {
            mostrarToast("Lista creada");
          })
          .catch(function () {
            mostrarToast("No se pudo crear la lista");
          });
      });
    });
  }

  // Avisos según el rol: invitado (sin "+"), y al administrador cuántos esperan autorización.
  // Se pintan juntos desde el último estado de ambos (el rol propio y, si es admin, todos los
  // roles), porque cualquiera de los dos puede llegar o cambiar primero.
  var rolesTodos = {};
  function pintarAvisosRol() {
    var html = "";
    if (rol && rol.activo && !rol.puedeCrear) {
      html += '<div class="tarjeta aviso-rol">' +
        '<span class="baldosa" aria-hidden="true">' + icono("user", 22) + "</span>" +
        "<p><strong>Tu cuenta espera autorización</strong> para crear listas. Mientras, puedes usar " +
        "las listas a las que te inviten.</p></div>";
    }
    var n = rol && rol.esAdmin ? Object.keys(rolesTodos).filter(function (uid) {
      return uid !== usuario.uid && rolesTodos[uid] && rolesTodos[uid].rol === "invitado" && rolesTodos[uid].activo === true;
    }).length : 0;
    if (n) {
      html += '<a class="tarjeta aviso-rol aviso-pendientes" href="usuarios.html">' +
        '<span class="baldosa" aria-hidden="true">' + icono("users", 22) + "</span>" +
        "<p><strong>" + n + (n === 1 ? " persona espera" : " personas esperan") + "</strong> autorización para crear listas.</p>" +
        icono("chevron-left", 18).replace("<svg", '<svg class="icono-girado"') + "</a>";
    }
    zonaAvisos.innerHTML = html;
  }

  function pintarPendientes(roles) {
    rolesTodos = roles || {};
    pintarAvisosRol();
  }

  detenerRol = montarCuentaConRol(usuario, function (nuevo) {
    if (nuevo.sinNodo) return; // aún no llega el rol del servidor
    rol = nuevo;
    if (!rol.activo) {
      // Cuenta desactivada: las reglas ya le niegan las listas; se le explica por qué.
      contenedor.innerHTML = htmlCuentaDesactivada();
      vaciarRanura("principal");
      return;
    }
    if (rol.puedeCrear) montarBotonNuevaLista();
    else vaciarRanura("principal");
    pintarAvisosRol();
    if (rol.esAdmin && !detenerPendientes) detenerPendientes = escuchar(refNodo("roles"), pintarPendientes);
    if (!rol.esAdmin && detenerPendientes) {
      detenerPendientes();
      detenerPendientes = null;
    }
    repintar();
  });

  montarBotonAyuda(
    "<h3>Mis listas</h3>" +
      "<p>Aquí ves todas tus listas de compra compartidas. Toca el botón <strong>+</strong> " +
      "para crear una nueva, toca el nombre de una lista para abrirla, o el lápiz " +
      "junto a ella para renombrarla.</p>"
  );

  return function limpiar() {
    if (detenerRol) detenerRol();
    if (detenerPendientes) detenerPendientes();
    if (detenerEscucha) detenerEscucha();
    Object.keys(detenerEscuchasInfo).forEach(desuscribirInfo);
    vaciarRanura("principal");
  };
}
