// Miembros de una lista: fila con avatares y quién está en la lista ahora (presencia), y la
// hoja "Miembros" para invitar con una liga (un solo uso, 7 días), quitar miembros y salirse.
// Reglas (database.rules.json): dueño y editores invitan; el dueño quita a cualquiera; un
// editor quita a quien no sea el dueño; cualquiera se sale menos el dueño.

var _DIAS_INVITACION = 7;

// Código de invitación: 128 bits aleatorios en base64url (22 caracteres), como pide el
// documento base; las reglas rechazan códigos de menos de 22.
function generarCodigoInvitacion() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  var bin = "";
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function _iniciales(nombre) {
  var partes = String(nombre || "?").trim().split(/\s+/);
  return ((partes[0] || "?").charAt(0) + (partes[1] ? partes[1].charAt(0) : "")).toUpperCase();
}

function _avatar(m, clase) {
  return m && m.foto
    ? '<img class="avatar ' + (clase || "") + '" src="' + esc(urlSegura(m.foto)) + '" alt="" referrerpolicy="no-referrer">'
    : '<span class="avatar ' + (clase || "") + '" aria-hidden="true">' + esc(_iniciales(m && m.nombre)) + "</span>";
}

// montarMiembrosLista(fila, listaId, usuario, obtenerInfo) → { limpiar, nombreDe(uid), presentes() }
// fila: contenedor donde va la fila de avatares. obtenerInfo(): info actual de la lista.
function montarMiembrosLista(fila, listaId, usuario, obtenerInfo) {
  var miembros = {};
  var presencia = {};
  var modal = null; // hoja "Miembros" abierta
  var base = "listas/" + listaId;

  // ===== Presencia: "estoy en la lista ahora" =====
  var refPresencia = refNodo(base + "/presencia/" + usuario.uid);
  var refConectado = firebase.database().ref(".info/connected");
  var datosPresencia = { nombre: usuario.displayName || usuario.email || "Alguien", visto: firebase.database.ServerValue.TIMESTAMP };
  if (usuario.photoURL) datosPresencia.foto = usuario.photoURL;
  function anunciarme() {
    // onDisconnect primero: si se cae la conexión, el servidor me quita aunque no avise.
    refPresencia.onDisconnect().remove().then(function () {
      return refPresencia.set(datosPresencia);
    }).catch(function () {});
  }
  function alConectar(snap) {
    if (snap.val() === true && document.visibilityState !== "hidden") anunciarme();
  }
  refConectado.on("value", alConectar);
  // En el iPhone la app en segundo plano puede seguir "conectada": al ocultarse, me quito.
  function alCambiarVisibilidad() {
    if (document.visibilityState === "hidden") refPresencia.remove().catch(function () {});
    else anunciarme();
  }
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  // ===== Pintado =====
  function miRol() {
    return (miembros[usuario.uid] || {}).rol;
  }
  function presentesOtros() {
    return Object.keys(presencia).filter(function (uid) { return uid !== usuario.uid && presencia[uid]; });
  }
  function nombreDe(uid) {
    if (uid === usuario.uid) return "Tú";
    var m = miembros[uid] || presencia[uid] || {};
    return m.nombre ? String(m.nombre).split(" ")[0] : "Alguien";
  }

  function pintarFila() {
    var uids = Object.keys(miembros);
    if (!uids.length) {
      fila.innerHTML = "";
      return;
    }
    var otros = presentesOtros();
    var avatares = uids.slice(0, 5).map(function (uid) {
      var m = Object.assign({}, miembros[uid], presencia[uid] && presencia[uid].foto ? { foto: presencia[uid].foto } : {});
      return '<span class="avatar-envoltura' + (presencia[uid] ? " presente" : "") + '">' + _avatar(m) + "</span>";
    }).join("");
    var texto = otros.length
      ? '<span class="texto-presencia"><span class="punto-presencia" aria-hidden="true"></span>' +
        esc(otros.map(nombreDe).join(", ")) + (otros.length === 1 ? " está" : " están") + " en la lista ahora</span>"
      : '<span class="texto-suave">' + uids.length + (uids.length === 1 ? " miembro" : " miembros") + "</span>";
    fila.innerHTML =
      '<div class="avatares" aria-hidden="true">' + avatares + "</div>" +
      '<div class="resumen-miembros" aria-live="polite">' + texto + "</div>" +
      '<button type="button" class="btn-chip" data-abrir-miembros>' + icono("users", 18) + "<span>Miembros</span></button>";
    if (modal) pintarHoja();
  }

  function puedoQuitar(uid) {
    var m = miembros[uid] || {};
    if (uid === usuario.uid) return false;
    if (miRol() === "dueno") return true;
    return miRol() === "editor" && m.rol !== "dueno";
  }

  function pintarHoja() {
    var zona = modal.elemento.querySelector("[data-lista-miembros]");
    var uids = Object.keys(miembros).sort(function (a, b) {
      var pa = (miembros[a] || {}).rol === "dueno" ? 0 : 1, pb = (miembros[b] || {}).rol === "dueno" ? 0 : 1;
      return pa - pb || compararPorNombre({ nombre: (miembros[a] || {}).nombre || a, id: a }, { nombre: (miembros[b] || {}).nombre || b, id: b });
    });
    zona.innerHTML = uids.map(function (uid) {
      var m = miembros[uid] || {};
      var nombre = (m.nombre || m.email || "Miembro") + (uid === usuario.uid ? " (tú)" : "");
      return (
        '<li class="fila-usuario">' +
        '<span class="avatar-envoltura' + (presencia[uid] ? " presente" : "") + '">' + _avatar(m, "avatar-grande") + "</span>" +
        '<div class="datos-usuario"><span class="nombre-lista">' + esc(nombre) + "</span>" +
        '<span class="detalle-articulo">' + (presencia[uid] ? "En la lista ahora" : esc(m.email || "")) + "</span></div>" +
        '<span class="pildora-rol' + (m.rol === "dueno" ? " pildora-rol-admin" : "") + '">' + (m.rol === "dueno" ? "Dueño" : "Editor") + "</span>" +
        (puedoQuitar(uid)
          ? '<button type="button" class="btn-accion-icono btn-accion-peligro" data-quitar="' + esc(uid) + '" aria-label="' + esc("Quitar a " + nombre) + '" title="Quitar de la lista">' + icono("trash-2", 18) + "</button>"
          : "") +
        "</li>"
      );
    }).join("");
    var pie = modal.elemento.querySelector("[data-pie-miembros]");
    pie.innerHTML = miRol() === "dueno"
      ? '<p class="texto-suave">Eres el dueño. Para eliminar la lista, hazlo desde <strong>Mis listas</strong> (lápiz).</p>'
      : '<button type="button" class="btn btn-secundario" data-salir-lista>' + icono("log-out", 18) + "<span>Salir de esta lista</span></button>";
  }

  // ===== Hoja "Miembros" =====
  function abrirHoja() {
    modal = abrirModal(
      "<h3>Miembros</h3>" +
        '<div class="tarjeta tarjeta-invitar">' +
        '<p class="nombre-lista">' + icono("share-2", 18) + " Invita a alguien</p>" +
        '<p class="texto-suave">La liga vence en ' + _DIAS_INVITACION + " días y sirve para una persona. Quien la abra con su cuenta de Google podrá editar la lista.</p>" +
        '<div data-zona-liga><button type="button" class="btn btn-ancho-completo" data-crear-liga>' + icono("plus", 18) + "<span>Crear liga de invitación</span></button></div>" +
        "</div>" +
        '<p class="etiqueta-seccion">En esta lista</p>' +
        '<ul class="lista-articulos lista-usuarios" data-lista-miembros></ul>' +
        '<div class="fila-botones" data-pie-miembros></div>' +
        '<div class="fila-botones"><button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button></div>',
      function () { modal = null; }
    );
    pintarHoja();
    modal.elemento.addEventListener("click", alTocarHoja);
  }

  function crearLiga(zonaLiga) {
    var info = obtenerInfo() || {};
    var codigo = generarCodigoInvitacion();
    var url = window.location.origin + "/unirse.html?codigo=" + encodeURIComponent(codigo);
    // expira un poco antes de 7 días: el reloj del teléfono puede ir adelantado y las reglas
    // rechazan más de 7 días (+1 min) contra la hora del servidor.
    var invitacion = {
      listaId: listaId,
      listaNombre: String(info.nombre || "Lista").slice(0, 80),
      creadaPor: usuario.uid,
      creadaPorNombre: String(usuario.displayName || usuario.email || "").slice(0, 120),
      creada: firebase.database.ServerValue.TIMESTAMP,
      expira: Date.now() + _DIAS_INVITACION * 24 * 3600 * 1000 - 10 * 60 * 1000
    };
    zonaLiga.innerHTML = '<p class="texto-suave">Creando liga…</p>';
    refNodo("invitaciones/" + codigo).set(invitacion).then(function () {
      zonaLiga.innerHTML =
        '<div class="campo-liga">' +
        '<input type="text" readonly value="' + esc(url) + '" aria-label="Liga de invitación" data-liga>' +
        '<button type="button" class="btn-accion-icono" data-copiar-liga aria-label="Copiar liga" title="Copiar liga">' + icono("copy", 20) + "</button>" +
        "</div>" +
        (navigator.share
          ? '<button type="button" class="btn btn-ancho-completo" data-compartir-liga>' + icono("share-2", 18) + "<span>Compartir invitación</span></button>"
          : "") +
        '<button type="button" class="btn-texto" data-crear-liga>Crear otra liga</button>';
    }).catch(function (e) {
      console.error(e);
      zonaLiga.innerHTML = '<button type="button" class="btn btn-ancho-completo" data-crear-liga>Reintentar</button>';
      mostrarToast("No se pudo crear la invitación");
    });
  }

  function quitar(uid, esSalida) {
    var cambios = {};
    cambios[base + "/miembros/" + uid] = null;
    cambios["listasDeUsuario/" + uid + "/" + listaId] = null;
    if (esSalida) cambios[base + "/presencia/" + uid] = null;
    return actualizarMultiple(cambios);
  }

  function alTocarHoja(ev) {
    var t;
    if ((t = ev.target.closest("[data-crear-liga]"))) {
      crearLiga(modal.elemento.querySelector("[data-zona-liga]"));
    } else if ((t = ev.target.closest("[data-copiar-liga]"))) {
      var campo = modal.elemento.querySelector("[data-liga]");
      var copiar = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(campo.value)
        : Promise.reject(new Error("sin portapapeles"));
      copiar.then(function () { mostrarToast("Liga copiada"); }).catch(function () {
        campo.select(); // que la persona la copie a mano
        mostrarToast("Selecciónala y cópiala");
      });
    } else if ((t = ev.target.closest("[data-compartir-liga]"))) {
      var info = obtenerInfo() || {};
      navigator.share({
        title: "Lista " + (info.nombre || ""),
        text: (usuario.displayName || "Te") + " te invita a la lista “" + (info.nombre || "") + "” en ListadeCompras",
        url: modal.elemento.querySelector("[data-liga]").value
      }).catch(function () {}); // cancelar el menú de compartir no es un error
    } else if ((t = ev.target.closest("[data-quitar]"))) {
      var uid = t.dataset.quitar;
      var nombre = (miembros[uid] || {}).nombre || "este miembro";
      quitar(uid, false)
        .then(function () { mostrarToast(nombre + " ya no está en la lista"); })
        .catch(function (e) { console.error(e); mostrarToast("No se pudo quitar"); });
    } else if (ev.target.closest("[data-salir-lista]")) {
      quitar(usuario.uid, true)
        .then(function () { window.location.href = "index.html"; })
        .catch(function (e) { console.error(e); mostrarToast("No se pudo salir de la lista"); });
    } else if (ev.target.closest("[data-cerrar]")) {
      modal.cerrar("manual");
    }
  }

  function alTocarFila(ev) {
    if (ev.target.closest("[data-abrir-miembros]")) abrirHoja();
  }
  fila.addEventListener("click", alTocarFila);

  var detenerMiembros = escuchar(refNodo(base + "/miembros"), function (v) {
    miembros = v || {};
    pintarFila();
  });
  var detenerPresencia = escuchar(refNodo(base + "/presencia"), function (v) {
    presencia = v || {};
    pintarFila();
  });

  return {
    nombreDe: nombreDe,
    presentes: presentesOtros,
    limpiar: function () {
      detenerMiembros();
      detenerPresencia();
      refConectado.off("value", alConectar);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      refPresencia.onDisconnect().cancel().catch(function () {});
      refPresencia.remove().catch(function () {});
      fila.removeEventListener("click", alTocarFila);
      if (modal) modal.cerrar("programatico");
    }
  };
}
