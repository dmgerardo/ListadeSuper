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
    // Como Firebase: un oyente "value" solo se llama si SU valor cambió (si no, p. ej. el de
    // .info/connected se dispararía con cada escritura y la presencia se re-anunciaría en ciclo).
    oyentes.slice().forEach(function (o) {
      setTimeout(function () {
        if (oyentes.indexOf(o) === -1) return;
        var snap = instantanea(o.ruta, o.filtro);
        var firma = JSON.stringify(snap.val());
        if (firma === o.ultimo) return;
        o.ultimo = firma;
        o.cb(snap);
      }, 0);
    });
  }
  // filtro: { hijo, hasta, ultimos } para orderByChild(hijo).endAt(hasta).limitToLast(ultimos).
  function filtrar(v, filtro) {
    if (!filtro || !v || typeof v !== "object") return v;
    var claves = Object.keys(v).filter(function (k) {
      var x = v[k] && v[k][filtro.hijo];
      return filtro.hasta === undefined || (typeof x === "number" && x <= filtro.hasta);
    });
    claves.sort(function (a, b) { return ((v[a] || {})[filtro.hijo] || 0) - ((v[b] || {})[filtro.hijo] || 0); });
    if (filtro.ultimos) claves = claves.slice(-filtro.ultimos);
    var r = {};
    claves.forEach(function (k) { r[k] = v[k]; });
    return claves.length ? r : null;
  }
  function instantanea(ruta, filtro) {
    // .info/connected: el mock siempre está "conectado".
    var v = ruta === ".info/connected" ? true : filtrar(leer(ruta), filtro);
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

  // Consulta mínima: orderByChild(hijo) + endAt(valor) + limitToLast(n) (lo que usa la app).
  function consulta(ruta, filtro) {
    return {
      toString: function () { return "mock://" + ruta; },
      endAt: function (v) { return consulta(ruta, Object.assign({}, filtro, { hasta: v })); },
      limitToLast: function (n) { return consulta(ruta, Object.assign({}, filtro, { ultimos: n })); },
      on: function (ev, cb) {
        var o = { ruta: ruta, cb: cb, filtro: filtro };
        oyentes.push(o);
        setTimeout(function () {
          if (oyentes.indexOf(o) === -1) return;
          var snap = instantanea(ruta, filtro);
          o.ultimo = JSON.stringify(snap.val());
          cb(snap);
        }, 5);
        return cb;
      },
      off: function (ev, cb) {
        oyentes = oyentes.filter(function (o) { return !(o.ruta === ruta && (!cb || o.cb === cb)); });
      },
      once: function () { return Promise.resolve(instantanea(ruta, filtro)); }
    };
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
        setTimeout(function () {
          if (oyentes.indexOf(o) === -1) return;
          var snap = instantanea(ruta);
          o.ultimo = JSON.stringify(snap.val());
          cb(snap);
        }, 5);
        return cb;
      },
      off: function (ev, cb) {
        oyentes = oyentes.filter(function (o) { return !(o.ruta === ruta && (!cb || o.cb === cb)); });
      },
      once: function () { return Promise.resolve(instantanea(ruta)); },
      orderByChild: function (hijo) { return consulta(ruta, { hijo: hijo }); },
      onDisconnect: function () {
        return {
          remove: function () { return Promise.resolve(); },
          set: function () { return Promise.resolve(); },
          cancel: function () { return Promise.resolve(); }
        };
      },
      // transaction(fn): fn(valorActual) → nuevo valor, o undefined para cancelar.
      transaction: function (fn) {
        var nuevo = fn(leer(ruta));
        if (nuevo === undefined) return Promise.resolve({ committed: false, snapshot: instantanea(ruta) });
        escrituras.push({ tipo: "transaction", ruta: ruta });
        escribir(ruta, nuevo);
        notificar();
        return Promise.resolve({ committed: true, snapshot: instantanea(ruta) });
      },
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
  try {
    var otro = sessionStorage.getItem("__usuarioMock");
    if (otro) usuario = JSON.parse(otro);
  } catch (e) {}
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
    // Simula que OTRA persona escribe (multi-ruta), para probar avisos en vivo.
    escribirComoOtro: function (cambios) {
      Object.keys(cambios).forEach(function (k) { escribir(k, cambios[k]); });
      notificar();
    },
    sembrar: function (datos) { arbol = clonar(datos) || {}; notificar(); }
  };
  window.firebase = {
    initializeApp: function () {},
    auth: Object.assign(function () { return auth; }, { GoogleAuthProvider: function () {} }),
    database: Object.assign(function () { return bd; }, { ServerValue: { TIMESTAMP: TIMESTAMP } })
  };
})();
