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

function renombrarLista(listaId, nuevoNombre) {
  return actualizar(refNodo("listas/" + listaId + "/info"), { nombre: nuevoNombre });
}

function _formularioLista(valoresIniciales, alGuardar) {
  var modal = abrirModal(
    '<h3>' + (valoresIniciales ? "Renombrar lista" : "Nueva lista") + "</h3>" +
      '<form data-form-lista>' +
      '<div class="campo">' +
      '<label for="campo-nombre-lista">Nombre</label>' +
      '<input id="campo-nombre-lista" name="nombre" type="text" maxlength="80" required ' +
      'value="' + esc(valoresIniciales ? valoresIniciales.nombre : "") + '" placeholder="Ej. Súper de la semana">' +
      "</div>" +
      '<div class="fila-botones">' +
      '<button type="button" class="btn-accion-icono" data-cancelar aria-label="Cancelar" title="Cancelar">' +
      icono("x", 20) +
      "</button>" +
      '<button type="submit" class="btn-accion-icono" aria-label="Guardar" title="Guardar">' +
      icono("save", 20) +
      "</button>" +
      "</div>" +
      "</form>",
    null
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

  function enviar() {
    var nombre = campoNombre.value.trim();
    if (!nombre) return;
    alGuardar(nombre);
    modal.cerrar();
  }
}

// montarVistaListas(contenedor, usuario): devuelve la función de limpieza.
function montarVistaListas(contenedor, usuario) {
  var detenerEscucha = null;
  var detenerEscuchasInfo = {};
  var infoPorLista = {};

  contenedor.innerHTML =
    '<div class="contenedor">' +
    '<p class="saludo">' + esc(usuario.displayName ? "Hola, " + usuario.displayName.split(" ")[0] : "Hola") + "</p>" +
    '<h1>Mis listas</h1>' +
    '<p class="subtitulo">Tus listas de compra compartidas</p>' +
    '<div data-lista-de-listas></div>' +
    "</div>";

  var zonaListas = contenedor.querySelector("[data-lista-de-listas]");

  function repintar() {
    programarRender("vista-listas", function () {
      var ids = Object.keys(infoPorLista);
      if (ids.length === 0) {
        zonaListas.innerHTML =
          '<div class="tarjeta tarjeta-vacia">' +
          '<span class="circulo-vacio" aria-hidden="true">' + icono("shopping-cart", 26) + "</span>" +
          '<p class="titulo-vacio">Todavía no tienes listas</p>' +
          "<p>Toca <strong>+</strong> abajo a la derecha para crear la primera.</p></div>";
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
            'aria-label="Renombrar lista" title="Renombrar lista">' +
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
    _formularioLista({ nombre: infoPorLista[id] && infoPorLista[id].nombre }, function (nuevoNombre) {
      renombrarLista(id, nuevoNombre)
        .then(function () {
          mostrarToast("Lista renombrada");
        })
        .catch(function () {
          mostrarToast("No se pudo renombrar la lista");
        });
    });
  });

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

  montarBotonAyuda(
    "<h3>Mis listas</h3>" +
      "<p>Aquí ves todas tus listas de compra compartidas. Toca el botón <strong>+</strong> " +
      "para crear una nueva, toca el nombre de una lista para abrirla, o el lápiz " +
      "junto a ella para renombrarla.</p>"
  );

  return function limpiar() {
    if (detenerEscucha) detenerEscucha();
    Object.keys(detenerEscuchasInfo).forEach(desuscribirInfo);
    vaciarRanura("principal");
  };
}
