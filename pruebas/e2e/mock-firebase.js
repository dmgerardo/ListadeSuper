// Mock en memoria del SDK compat de Firebase (Auth + Realtime Database) para las pruebas
// de Playwright: reemplaza a firebase-app-compat.js (los de auth/database se sirven vacíos).
// Implementa lo que usa la app: on/off/once/set/update/remove/push, update multi-ruta desde
// la raíz y ServerValue.TIMESTAMP. NO aplica database.rules.json (eso se prueba aparte con
// el emulador, en pruebas/reglas). window.__USUARIO_MOCK define la sesión; window.__mockBD
// expone la base y un contador de escrituras para verificar "una sola escritura".
(function () {
  // La base sobrevive a la navegación entre páginas (index.html → lista.html) guardándose en
  // sessionStorage, como si viviera en un servidor.
  var CLAVE = "__mockBD_arbol";
  var arbol = {};
  try {
    arbol = JSON.parse(sessionStorage.getItem(CLAVE) || "{}");
  } catch (e) {}
  function persistir() {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(arbol));
    } catch (e) {}
  }
  var oyentes = [];
  var escrituras = [];
  var contadorPush = 0;
  var TIMESTAMP = { ".sv": "timestamp" };

  function partes(ruta) {
    return String(ruta || "").split("/").filter(Boolean);
  }
  function clonar(v) {
    return v === undefined || v === null ? null : JSON.parse(JSON.stringify(v));
  }
  function leer(ruta) {
    var n = arbol;
    var p = partes(ruta);
    for (var i = 0; i < p.length; i++) {
      if (n === null || typeof n !== "object" || !(p[i] in n)) return null;
      n = n[p[i]];
    }
    return clonar(n);
  }
  function resolverServidor(v) {
    if (v && typeof v === "object") {
      if (v[".sv"] === "timestamp") return Date.now();
      var r = {};
      Object.keys(v).forEach(function (k) {
        var x = resolverServidor(v[k]);
        if (x !== null && x !== undefined) r[k] = x;
      });
      return Object.keys(r).length ? r : null;
    }
    return v === undefined ? null : v;
  }
  function escribir(ruta, valor) {
    var p = partes(ruta);
    valor = resolverServidor(clonar(valor));
    if (!p.length) {
      arbol = valor || {};
      return;
    }
    var n = arbol;
    for (var i = 0; i < p.length - 1; i++) {
      if (!n[p[i]] || typeof n[p[i]] !== "object") n[p[i]] = {};
      n = n[p[i]];
    }
    if (valor === null) delete n[p[p.length - 1]];
    else n[p[p.length - 1]] = valor;
    podar(arbol);
  }
  // Como en Firebase, un nodo que queda sin hijos deja de existir.
  function podar(n) {
    Object.keys(n).forEach(function (k) {
      if (n[k] && typeof n[k] === "object") {
        podar(n[k]);
        if (!Object.keys(n[k]).length) delete n[k];
      }
    });
  }
  function notificar() {
    persistir();
    oyentes.slice().forEach(function (o) {
      setTimeout(function () {
        if (oyentes.indexOf(o) !== -1) o.cb(instantanea(o.ruta));
      }, 0);
    });
  }
  function instantanea(ruta) {
    var v = leer(ruta);
    return { key: partes(ruta).pop() || null, val: function () { return clonar(v); }, exists: function () { return v !== null; } };
  }
  function unir(base, rel) {
    return partes(base).concat(partes(rel)).join("/");
  }
  // Llaves cronológicas como las de push(): ordenarlas como texto = orden de creación.
  function llavePush() {
    contadorPush++;
    return "-M" + Date.now().toString(36).padStart(9, "0") + String(contadorPush).padStart(6, "0");
  }

  function ref(ruta) {
    ruta = partes(ruta).join("/");
    return {
      key: partes(ruta).pop() || null,
      toString: function () { return "mock://" + ruta; },
      child: function (r) { return ref(unir(ruta, r)); },
      push: function () { return ref(unir(ruta, llavePush())); },
      on: function (ev, cb) {
        var o = { ruta: ruta, cb: cb };
        oyentes.push(o);
        setTimeout(function () { if (oyentes.indexOf(o) !== -1) cb(instantanea(ruta)); }, 5);
        return cb;
      },
      off: function (ev, cb) {
        oyentes = oyentes.filter(function (o) { return !(o.ruta === ruta && (!cb || o.cb === cb)); });
      },
      once: function () { return Promise.resolve(instantanea(ruta)); },
      set: function (v) {
        escrituras.push({ tipo: "set", ruta: ruta });
        escribir(ruta, v);
        notificar();
        return Promise.resolve();
      },
      update: function (cambios) {
        escrituras.push({ tipo: "update", ruta: ruta, rutas: Object.keys(cambios).length });
        Object.keys(cambios).forEach(function (k) { escribir(unir(ruta, k), cambios[k]); });
        notificar();
        return Promise.resolve();
      },
      remove: function () {
        escrituras.push({ tipo: "remove", ruta: ruta });
        escribir(ruta, null);
        notificar();
        return Promise.resolve();
      }
    };
  }

  var usuario = window.__USUARIO_MOCK || null;
  var oyentesAuth = [];
  var auth = {
    onAuthStateChanged: function (cb) { oyentesAuth.push(cb); setTimeout(function () { cb(usuario); }, 0); },
    getRedirectResult: function () { return Promise.resolve(null); },
    signOut: function () { usuario = null; oyentesAuth.forEach(function (cb) { cb(null); }); return Promise.resolve(); },
    signInWithPopup: function () { return Promise.reject(new Error("mock: sin login real")); },
    signInWithRedirect: function () { return Promise.reject(new Error("mock: sin login real")); }
  };
  var bd = { ref: function (r) { return ref(r || ""); } };

  window.__mockBD = {
    leer: leer,
    escrituras: escrituras,
    sembrar: function (datos) { arbol = clonar(datos) || {}; notificar(); }
  };
  window.firebase = {
    initializeApp: function () {},
    auth: Object.assign(function () { return auth; }, { GoogleAuthProvider: function () {} }),
    database: Object.assign(function () { return bd; }, { ServerValue: { TIMESTAMP: TIMESTAMP } })
  };
})();
