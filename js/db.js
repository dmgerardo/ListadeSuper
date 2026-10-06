// Capa de acceso a Realtime Database: lecturas con caché offline y escrituras campo por
// campo. Requiere que firebase-config.js y el SDK compat de Firebase ya estén cargados.

// firebase.initializeApp() ya se llamó en firebase-config.js (antes de auth.js).
var _bd = null;
function _baseDatos() {
  if (!_bd) _bd = firebase.database();
  return _bd;
}

// refNodo(ruta): referencia a un nodo, p.ej. refNodo("listas/" + id + "/info").
function refNodo(ruta) {
  return _baseDatos().ref(ruta);
}

function _claveCache(ref) {
  return "cache:" + ref.toString();
}

function _leerCache(clave) {
  try {
    var raw = localStorage.getItem(clave);
    return raw === null ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function _escribirCache(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {}
}

// escuchar(ref, cb): se suscribe en tiempo real. Nunca entrega null (entrega {} si el nodo
// no existe). Entrega primero el valor cacheado en localStorage (si hay) mientras llega la
// respuesta real del servidor. Devuelve una función para dejar de escuchar.
function escuchar(ref, cb) {
  var clave = _claveCache(ref);
  var cacheado = _leerCache(clave);
  cb(cacheado !== null ? cacheado : {});
  var manejador = ref.on(
    "value",
    function (snap) {
      var valor = snap.val();
      if (valor === null) valor = {};
      _escribirCache(clave, valor);
      cb(valor);
    },
    function () {
      // Sin permiso o sin conexión: nos quedamos con lo cacheado, ya entregado arriba.
    }
  );
  return function detener() {
    ref.off("value", manejador);
  };
}

// obtenerConCache(ref, timeoutMs=5000): lectura de una vez. Si el servidor no responde a
// tiempo (o falla, p.ej. sin conexión), resuelve con lo cacheado ({} si no hay nada).
function obtenerConCache(ref, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  var clave = _claveCache(ref);
  return new Promise(function (resolve) {
    var resuelto = false;
    var temporizador = setTimeout(function () {
      if (resuelto) return;
      resuelto = true;
      resolve(_leerCache(clave) || {});
    }, timeoutMs);
    ref
      .once("value")
      .then(function (snap) {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(temporizador);
        var valor = snap.val();
        if (valor === null) valor = {};
        _escribirCache(clave, valor);
        resolve(valor);
      })
      .catch(function () {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(temporizador);
        resolve(_leerCache(clave) || {});
      });
  });
}

// agregar(ref, datos): push de un nodo hijo nuevo. Devuelve una promesa con su key.
function agregar(ref, datos) {
  var nuevaRef = ref.push();
  return nuevaRef.set(datos).then(function () {
    return nuevaRef.key;
  });
}

// actualizar(ref, cambios): escritura campo por campo (nunca reescribe el nodo entero).
function actualizar(ref, cambios) {
  return ref.update(cambios);
}

// eliminar(ref): borra el nodo.
function eliminar(ref) {
  return ref.remove();
}

// actualizarMultiple(cambiosPorRuta): UNA sola escritura atómica multi-ruta desde la raíz,
// p.ej. { "listas/x/info": {...}, "listas/x/miembros/uid": {...} }.
function actualizarMultiple(cambiosPorRuta) {
  return _baseDatos().ref().update(cambiosPorRuta);
}

// programarRender(clave, fn): agrupa varias peticiones de repintado de la misma vista en
// un solo frame, para no redibujar de más cuando llegan varios eventos "value" juntos.
var _renderesProgramados = new Map();
function programarRender(clave, fn) {
  if (_renderesProgramados.has(clave)) return;
  _renderesProgramados.set(clave, fn);
  requestAnimationFrame(function () {
    var funcionFinal = _renderesProgramados.get(clave);
    _renderesProgramados.delete(clave);
    funcionFinal();
  });
}
