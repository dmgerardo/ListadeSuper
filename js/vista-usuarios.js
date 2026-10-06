// Pantalla "Usuarios" (solo administradores): autorizar invitados, cambiar el rol y
// activar/desactivar cuentas. Escribe roles/{uid}; las reglas solo lo permiten a un
// administrador y nunca sobre sí mismo. El administrador raíz (ADMIN_RAIZ) no se edita aquí:
// su papel viene de las reglas, no de roles/.

var _ORDEN_ROLES = { invitado: 0, participante: 1, admin: 2 };

function montarVistaUsuarios(contenedor, usuario) {
  var usuarios = {};
  var roles = {};
  var detenerUsuarios = null;
  var detenerRoles = null;

  contenedor.innerHTML =
    '<div class="contenedor">' +
    '<a href="index.html" class="btn-texto enlace-con-icono enlace-regreso">' + icono("chevron-left", 18) + "<span>Mis listas</span></a>" +
    "<h1>Usuarios</h1>" +
    '<p class="subtitulo">Autoriza a quien se registra y decide qué puede hacer cada quien</p>' +
    '<div class="tarjeta texto-ayuda leyenda-roles">' +
    "<p><strong>Invitado</strong>: entra y usa las listas a las que lo invitan; no crea listas.</p>" +
    "<p><strong>Participante</strong>: además crea listas (y elimina las suyas).</p>" +
    "<p><strong>Administrador</strong>: además administra a los usuarios.</p>" +
    "<p><strong>Desactivado</strong>: no puede ver ni editar ninguna lista.</p>" +
    "</div>" +
    '<div data-usuarios aria-live="polite"></div>' +
    "</div>";
  var zona = contenedor.querySelector("[data-usuarios]");

  function filaUsuario(uid) {
    var u = usuarios[uid] || {};
    var r = roles[uid] || {};
    var esRaiz = u.email === ADMIN_RAIZ;
    var esYo = uid === usuario.uid;
    var rol = esRaiz ? "admin" : r.rol || "invitado";
    var activo = esRaiz || r.activo === true;
    var bloqueado = esRaiz || esYo;
    var foto = u.foto
      ? '<img class="foto-cuenta foto-usuario" src="' + esc(urlSegura(u.foto)) + '" alt="" width="44" height="44" referrerpolicy="no-referrer">'
      : '<span class="baldosa" aria-hidden="true">' + esc((u.nombre || u.email || "?").charAt(0).toUpperCase()) + "</span>";
    var nombre = esc(u.nombre || "(sin nombre)") + (esYo ? " (tú)" : "");
    return (
      '<li class="fila-usuario' + (activo ? "" : " inactivo") + (rol === "invitado" && activo ? " pendiente" : "") + '">' +
      foto +
      '<div class="datos-usuario"><span class="nombre-lista">' + nombre + "</span>" +
      '<span class="detalle-articulo">' + esc(u.email || "") + "</span>" +
      (esRaiz ? '<span class="pildora-rol pildora-rol-admin">Administrador raíz</span>' : "") +
      "</div>" +
      (bloqueado
        ? ""
        : '<div class="controles-usuario">' +
          '<select class="select-unidad" data-rol="' + esc(uid) + '" aria-label="' + esc("Rol de " + (u.nombre || u.email || uid)) + '">' +
          ["invitado", "participante", "admin"].map(function (v) {
            return '<option value="' + v + '"' + (v === rol ? " selected" : "") + ">" + ETIQUETAS_ROL[v] + "</option>";
          }).join("") +
          "</select>" +
          '<label class="interruptor"><input type="checkbox" data-activo="' + esc(uid) + '"' + (activo ? " checked" : "") +
          ' aria-label="' + esc("Cuenta activa: " + (u.nombre || u.email || uid)) + '"><span>Activa</span></label>' +
          "</div>") +
      "</li>"
    );
  }

  function pintar() {
    programarRender("vista-usuarios", function () {
      var uids = Object.keys(usuarios);
      Object.keys(roles).forEach(function (uid) {
        if (uids.indexOf(uid) === -1) uids.push(uid);
      });
      if (!uids.length) {
        zona.innerHTML = '<p class="vacio">Cargando…</p>';
        return;
      }
      // Primero quienes esperan autorización (invitados activos), luego por rol y nombre.
      uids.sort(function (a, b) {
        var ra = roles[a] || {}, rb = roles[b] || {};
        var pa = ra.rol === "invitado" && ra.activo ? 0 : 1, pb = rb.rol === "invitado" && rb.activo ? 0 : 1;
        if (pa !== pb) return pa - pb;
        var oa = _ORDEN_ROLES[ra.rol] || 0, ob = _ORDEN_ROLES[rb.rol] || 0;
        if (oa !== ob) return oa - ob;
        return compararPorNombre({ nombre: (usuarios[a] || {}).nombre || a, id: a }, { nombre: (usuarios[b] || {}).nombre || b, id: b });
      });
      var pendientes = uids.filter(function (uid) { return uid !== usuario.uid && (usuarios[uid] || {}).email !== ADMIN_RAIZ && (roles[uid] || {}).rol === "invitado" && (roles[uid] || {}).activo; }).length;
      zona.innerHTML =
        (pendientes ? '<p class="pista-busqueda"><strong>' + pendientes + "</strong> " + (pendientes === 1 ? "persona espera" : "personas esperan") + " autorización (arriba).</p>" : "") +
        '<ul class="lista-articulos lista-usuarios">' + uids.map(filaUsuario).join("") + "</ul>";
    });
  }

  function guardar(uid, cambios, etiqueta) {
    cambios.actualizado = firebase.database.ServerValue.TIMESTAMP;
    cambios.actualizadoPor = usuario.uid;
    // Usuarios de antes de los roles no tienen nodo: se crea completo.
    if (!roles[uid] || !roles[uid].rol) {
      cambios.rol = cambios.rol || "invitado";
      cambios.activo = cambios.activo === undefined ? true : cambios.activo;
    }
    actualizar(refNodo("roles/" + uid), cambios)
      .then(function () { mostrarToast(etiqueta); })
      .catch(function (e) {
        console.error(e);
        mostrarToast("No se pudo guardar el cambio");
        pintar(); // regresa el control a su valor real
      });
  }

  zona.addEventListener("change", function (ev) {
    var uid;
    var nombre = function (u) { return (usuarios[u] || {}).nombre || (usuarios[u] || {}).email || "Usuario"; };
    if ((uid = ev.target.dataset.rol)) {
      guardar(uid, { rol: ev.target.value }, nombre(uid) + ": " + ETIQUETAS_ROL[ev.target.value]);
    } else if ((uid = ev.target.dataset.activo)) {
      guardar(uid, { activo: ev.target.checked }, nombre(uid) + (ev.target.checked ? " activada" : " desactivada"));
    }
  });

  detenerUsuarios = escuchar(refNodo("usuarios"), function (v) {
    usuarios = v || {};
    pintar();
  });
  detenerRoles = escuchar(refNodo("roles"), function (v) {
    roles = v || {};
    pintar();
  });

  montarBotonAyuda(
    "<h3>Usuarios</h3><p>Quien entra por primera vez queda como <strong>Invitado</strong>: puede usar las " +
      "listas a las que lo inviten, pero no crear listas. Cámbialo a <strong>Participante</strong> para " +
      "autorizarlo. Quita <strong>Activa</strong> para bloquear una cuenta sin borrarla.</p>"
  );

  return function limpiar() {
    if (detenerUsuarios) detenerUsuarios();
    if (detenerRoles) detenerRoles();
  };
}
