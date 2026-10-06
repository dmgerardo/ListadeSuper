// Login/logout con Google. Identidad = auth.uid verificado por Firebase; no hay usuarios
// anónimos ni contraseñas propias (ver §4 de AGENTS.md).

function _esStandalone() {
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true
  );
}

// iniciarSesionConGoogle(): popup normal; si está bloqueado o la app corre instalada como
// PWA, usa redirect (necesario porque muchos navegadores bloquean popups en standalone).
function iniciarSesionConGoogle() {
  var proveedor = new firebase.auth.GoogleAuthProvider();
  if (_esStandalone()) {
    return firebase.auth().signInWithRedirect(proveedor);
  }
  return firebase.auth().signInWithPopup(proveedor).catch(function (error) {
    if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") {
      return firebase.auth().signInWithRedirect(proveedor);
    }
    throw error;
  });
}

// cerrarSesion(): además borra la caché local de listas para no dejar datos en un
// dispositivo compartido (ver §4 del documento base).
function cerrarSesion() {
  return firebase.auth().signOut().then(function () {
    try {
      Object.keys(localStorage)
        .filter(function (k) {
          return k.indexOf("cache:") === 0;
        })
        .forEach(function (k) {
          localStorage.removeItem(k);
        });
    } catch (e) {}
  });
}

// Crea usuarios/{uid} en el primer login; en logins siguientes solo actualiza los datos
// de perfil que pueden cambiar (nombre, correo, foto), sin tocar "creado".
function _crearOActualizarPerfil(usuario) {
  var ref = refNodo("usuarios/" + usuario.uid);
  return ref.once("value").then(function (snap) {
    var cambios = {
      nombre: usuario.displayName || "",
      email: usuario.email || "",
      foto: usuario.photoURL || ""
    };
    if (!snap.exists()) cambios.creado = firebase.database.ServerValue.TIMESTAMP;
    return ref.update(cambios);
  });
}

// requerirSesion(cb): espera a onAuthStateChanged. cb(null) si no hay sesión (mostrar
// pantalla de bienvenida); cb(usuario) con sesión activa, ya con el perfil al corriente.
function requerirSesion(cb) {
  firebase.auth().onAuthStateChanged(function (usuario) {
    if (!usuario) {
      cb(null);
      return;
    }
    _crearOActualizarPerfil(usuario)
      .catch(function () {})
      .then(function () {
        cb(usuario);
      });
  });
}

// Completa el flujo de signInWithRedirect al cargar la página (necesario en Safari/iOS y
// en la PWA instalada, donde el popup no es viable). Si falla, solo lo registramos: el
// usuario vuelve a ver el botón "Continuar con Google".
firebase.auth().getRedirectResult().catch(function (error) {
  console.error("Error de login (redirect):", error);
});
