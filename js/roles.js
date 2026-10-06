// Roles de la aplicación (administrador / participante / invitado) y si la cuenta está
// activa. La autoridad son las reglas (database.rules.json, generadas por
// scripts/generar-reglas.py): esto solo decide qué mostrar.
//
// - El administrador RAÍZ es la cuenta de ADMIN_RAIZ con correo verificado: no depende de
//   roles/{uid}, así que nadie puede quitárselo. Debe coincidir con ADMIN_RAIZ del generador
//   de reglas (lo verifica pruebas/logica.test.js).
// - Una cuenta nueva se da de alta como "invitado" activo (asegurarRol, desde auth.js): entra
//   y usa las listas a las que la inviten, pero no crea listas hasta que un administrador la
//   autorice como participante.

const ADMIN_RAIZ = "dmgerardo@gmail.com";

const ETIQUETAS_ROL = {
  admin: "Administrador",
  participante: "Participante",
  invitado: "Invitado"
};

// rolEfectivo(nodoRol, email, emailVerificado) → { rol, activo, esAdmin, esRaiz, puedeCrear,
// sinNodo }. nodoRol: el valor de roles/{uid} ({} si aún no existe o aún no llega: sinNodo
// avisa para no mostrar "desactivada" por un instante mientras carga).
function rolEfectivo(nodoRol, email, emailVerificado) {
  var esRaiz = email === ADMIN_RAIZ && emailVerificado === true;
  var nodo = nodoRol && typeof nodoRol === "object" ? nodoRol : {};
  var rol = esRaiz ? "admin" : (ETIQUETAS_ROL[nodo.rol] ? nodo.rol : "invitado");
  var activo = esRaiz || nodo.activo === true;
  return {
    rol: rol,
    activo: activo,
    esRaiz: esRaiz,
    esAdmin: activo && rol === "admin",
    puedeCrear: activo && (rol === "admin" || rol === "participante"),
    sinNodo: !esRaiz && !nodo.rol
  };
}

// asegurarRol(usuario): crea roles/{uid} como invitado activo si no existe (primer ingreso).
// El administrador raíz no lo necesita (su papel viene del correo en las reglas); crearle un
// nodo "invitado" lo haría aparecer como "pendiente de autorización".
function asegurarRol(usuario) {
  if (rolEfectivo({}, usuario.email, usuario.emailVerified).esRaiz) return Promise.resolve();
  var ref = refNodo("roles/" + usuario.uid);
  return ref.once("value").then(function (snap) {
    if (snap.exists()) return;
    return ref.set({ rol: "invitado", activo: true });
  });
}

// escucharRol(usuario, cb): cb(rolEfectivo) ahora y en cada cambio (p. ej. cuando el
// administrador autoriza o desactiva la cuenta, se refleja sin recargar). Devuelve detener().
function escucharRol(usuario, cb) {
  return escuchar(refNodo("roles/" + usuario.uid), function (nodo) {
    cb(rolEfectivo(nodo, usuario.email, usuario.emailVerified));
  });
}

// montarCuentaConRol(usuario, alCambiar): monta la hoja "Mi cuenta" con el rol y la vuelve a
// montar si el rol cambia; alCambiar(rol) opcional. Devuelve detener().
function montarCuentaConRol(usuario, alCambiar) {
  montarMenuCuenta(usuario);
  return escucharRol(usuario, function (rol) {
    montarMenuCuenta(usuario, rol);
    if (alCambiar) alCambiar(rol);
  });
}

// htmlCuentaDesactivada(): lo que ve una cuenta desactivada (las reglas ya le niegan todo).
function htmlCuentaDesactivada() {
  return (
    '<div class="contenedor"><div class="tarjeta tarjeta-vacia">' +
    '<span class="circulo-vacio" aria-hidden="true">' + icono("user", 26) + "</span>" +
    '<p class="titulo-vacio">Tu cuenta está desactivada</p>' +
    "<p>Pide al administrador de la aplicación que la vuelva a activar.</p>" +
    "</div></div>"
  );
}
