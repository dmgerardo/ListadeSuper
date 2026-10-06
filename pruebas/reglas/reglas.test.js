// Pruebas de database.rules.json contra el Emulador de Realtime Database.
// Correr desde pruebas/reglas: npm install && npm test  (ver pruebas/README.md).
// Cada prueba arranca de una base limpia con la misma semilla.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { ref, get, set, update, remove } = require("firebase/database");

let entorno;
const L1 = "L1";

// alice = participante, dueña de L1; bob = INVITADO (sin autorizar) y editor de L1;
// carol y dave = participantes sin relación con L1; eve = invitada sin relación;
// zoe = participante DESACTIVADA, editora de L1; adminA = administrador por rol.
// "raiz" = la cuenta de ADMIN_RAIZ (dmgerardo@gmail.com, correo verificado).
const ROLES = {
  alice: { rol: "participante", activo: true },
  bob: { rol: "invitado", activo: true },
  carol: { rol: "participante", activo: true },
  dave: { rol: "participante", activo: true },
  eve: { rol: "invitado", activo: true },
  zoe: { rol: "participante", activo: false },
  adminA: { rol: "admin", activo: true },
};
const AHORA = Date.now();
function semilla() {
  return {
    roles: ROLES,
    usuarios: { alice: { nombre: "Alice" }, bob: { nombre: "Bob" } },
    listasDeUsuario: { alice: { L1: true }, bob: { L1: true } },
    listas: {
      L1: {
        info: { nombre: "Súper", moneda: "MXN", creadaPor: "alice", creada: 1 },
        miembros: { alice: { rol: "dueno" }, bob: { rol: "editor" }, zoe: { rol: "editor" } },
        actividad: {
          viejo: { uid: "alice", nombre: "Alice", accion: "marco", articuloId: "a1", articulo: "Leche", ts: AHORA - 25 * 3600 * 1000 },
          reciente: { uid: "alice", nombre: "Alice", accion: "marco", articuloId: "a1", articulo: "Leche", ts: AHORA - 60 * 1000 },
        },
        articulos: {
          a1: { nombre: "Leche", categoria: "refris", comprado: true, compradoPor: "alice", agregadoPor: "alice", creado: 1 },
        },
      },
    },
  };
}

const bd = (uid) => (uid ? entorno.authenticatedContext(uid) : entorno.unauthenticatedContext()).database();
const bdRaiz = (verificado = true) => entorno.authenticatedContext("raiz", { email: "dmgerardo@gmail.com", email_verified: verificado }).database();
const CODIGO = "c".repeat(22);
const invitacion = (extra) => Object.assign({ listaId: "L1", listaNombre: "Súper", creadaPor: "bob", creadaPorNombre: "Bob", creada: AHORA, expira: AHORA + 6 * 24 * 3600 * 1000 }, extra);
async function sembrar(ruta, valor) {
  await entorno.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), ruta), valor));
}
// Unirse = UNA escritura multi-ruta: miembro + marcar invitación usada + índice propio.
const unirse = (uid, codigo = CODIGO, lista = "L1", marcar = true) => {
  const c = {};
  c["listas/" + lista + "/miembros/" + uid] = { rol: "editor", nombre: uid, codigo };
  if (marcar) c["invitaciones/" + codigo + "/usadaPor"] = uid;
  c["listasDeUsuario/" + uid + "/" + lista] = true;
  return update(ref(bd(uid)), c);
};
// withSecurityRulesDisabled no devuelve el valor del callback: se captura aquí.
async function leerSinReglas(ruta) {
  let valor;
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    valor = (await get(ref(ctx.database(), ruta))).val();
  });
  return valor;
}
const articulo = (extra) => Object.assign({ nombre: "Pan", categoria: "panaderia", comprado: false, cantidad: 1, unidad: "pieza", agregadoPor: "bob", creado: 2 }, extra);

test.before(async () => {
  const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000").split(":");
  entorno = await initializeTestEnvironment({
    projectId: "demo-pilo-compras",
    database: {
      host,
      port: Number(port),
      rules: fs.readFileSync(path.join(__dirname, "..", "..", "database.rules.json"), "utf8"),
    },
  });
});

test.beforeEach(async () => {
  await entorno.clearDatabase();
  await entorno.withSecurityRulesDisabled((ctx) => set(ref(ctx.database()), semilla()));
});

test.after(async () => {
  if (entorno) await entorno.cleanup();
});

// ===== Fase 1: listas, miembros, perfil =====

test("crear lista nueva: info + miembro dueño + índice en UNA escritura multi-ruta", async () => {
  await assertSucceeds(update(ref(bd("dave")), {
    "listas/L2/info": { nombre: "Farmacia", moneda: "MXN", creadaPor: "dave", creada: 5 },
    "listas/L2/miembros/dave": { rol: "dueno", nombre: "Dave" },
    "listasDeUsuario/dave/L2": true,
  }));
});

test("no se puede crear una lista a nombre de otro", async () => {
  await assertFails(update(ref(bd("dave")), {
    "listas/L2/info": { nombre: "X", moneda: "MXN", creadaPor: "alice", creada: 5 },
    "listas/L2/miembros/dave": { rol: "dueno" },
  }));
});

test("no-miembro no lee la lista ni sus artículos; sin sesión tampoco", async () => {
  await assertFails(get(ref(bd("carol"), "listas/L1")));
  await assertFails(get(ref(bd("carol"), "listas/L1/articulos")));
  await assertFails(get(ref(bd(null), "listas/L1/info")));
  await assertSucceeds(get(ref(bd("bob"), "listas/L1")));
});

test("no-miembro no se puede auto-agregar como dueño ni como editor sin invitación", async () => {
  await assertFails(set(ref(bd("carol"), "listas/L1/miembros/carol"), { rol: "dueno" }));
  await assertFails(set(ref(bd("carol"), "listas/L1/miembros/carol"), { rol: "editor", codigo: "inventado" }));
});

test("renombrar: dueño y editores sí (ver 'editor renombra…'); no-miembro no; nombre ≤ 80", async () => {
  await assertSucceeds(update(ref(bd("alice"), "listas/L1/info"), { nombre: "Súper semanal" }));
  await assertFails(update(ref(bd("carol"), "listas/L1/info"), { nombre: "Ajena" }));
  await assertFails(update(ref(bd("alice"), "listas/L1/info"), { nombre: "x".repeat(81) }));
});

test("perfil y 'Mis listas' son privados de cada usuario", async () => {
  await assertSucceeds(get(ref(bd("alice"), "usuarios/alice")));
  await assertFails(get(ref(bd("bob"), "usuarios/alice")));
  await assertFails(get(ref(bd("bob"), "listasDeUsuario/alice")));
  await assertFails(set(ref(bd("carol"), "listasDeUsuario/bob/L9"), true));
});

// ===== Fase 2: artículos =====

test("miembro (editor) agrega un artículo válido", async () => {
  await assertSucceeds(set(ref(bd("bob"), "listas/L1/articulos/a2"), articulo()));
  await assertSucceeds(set(ref(bd("bob"), "listas/L1/articulos/a3"), articulo({ precio: 25.5, notas: "integral" })));
});

test("no-miembro no escribe artículos", async () => {
  await assertFails(set(ref(bd("carol"), "listas/L1/articulos/a2"), articulo({ agregadoPor: "carol" })));
  await assertFails(update(ref(bd("carol"), "listas/L1/articulos/a1"), { comprado: false }));
  await assertFails(remove(ref(bd("carol"), "listas/L1/articulos/a1")));
});

test("validación de campos del artículo", async () => {
  const casos = {
    "precio texto": { precio: "25" },
    "precio negativo": { precio: -1 },
    "cantidad 0": { cantidad: 0 },
    "cantidad texto": { cantidad: "2" },
    "nombre vacío": { nombre: "" },
    "nombre de 121": { nombre: "x".repeat(121) },
    "comprado no booleano": { comprado: "si" },
    "campo desconocido": { color: "rojo" },
    "notas de 201": { notas: "x".repeat(201) },
    "agregadoPor no texto": { agregadoPor: 5 },
  };
  for (const [caso, extra] of Object.entries(casos)) {
    await assertFails(set(ref(bd("bob"), "listas/L1/articulos/x"), articulo(extra))).catch((e) => {
      throw new Error("debió fallar: " + caso + " — " + e.message);
    });
  }
  // Sin categoría (campo obligatorio).
  const sinCategoria = articulo();
  delete sinCategoria.categoria;
  await assertFails(set(ref(bd("bob"), "listas/L1/articulos/x"), sinCategoria));
  // Exactamente en el límite sí pasa.
  await assertSucceeds(set(ref(bd("bob"), "listas/L1/articulos/x"), articulo({ nombre: "x".repeat(120), notas: "y".repeat(200), cantidad: 9999, precio: 0 })));
});

test("marcar y desmarcar campo por campo", async () => {
  await assertSucceeds(update(ref(bd("bob"), "listas/L1/articulos/a1"), { comprado: false, compradoPor: null }));
  await assertSucceeds(update(ref(bd("bob"), "listas/L1/articulos/a1"), { comprado: true, compradoPor: "bob" }));
  await assertFails(update(ref(bd("bob"), "listas/L1/articulos/a1"), { compradoPor: 7 }));
});

test("editar otro campo de un artículo que marcó otra persona no choca con compradoPor", async () => {
  // a1 tiene compradoPor: "alice"; bob solo cambia la cantidad.
  await assertSucceeds(update(ref(bd("bob"), "listas/L1/articulos/a1"), { cantidad: 2, unidad: "l" }));
  const valor = await leerSinReglas("listas/L1/articulos/a1");
  assert.equal(valor.compradoPor, "alice");
  assert.equal(valor.agregadoPor, "alice");
});

test("no se puede dejar un artículo sin nombre ni quitarle la categoría con un update", async () => {
  await assertFails(update(ref(bd("bob"), "listas/L1/articulos/a1"), { nombre: null }));
  await assertFails(update(ref(bd("bob"), "listas/L1/articulos/a1"), { categoria: null }));
});

// agregadoPor/compradoPor NO se atan a auth.uid a propósito: el Deshacer de un borrado
// restaura el artículo tal cual (con la autoría de otra persona), y cualquier miembro ya
// puede borrar y recrear artículos, así que atarlos no protegería nada real.
test("eliminar artículo (miembro) y Deshacer restaurándolo completo", async () => {
  const valor = await leerSinReglas("listas/L1/articulos/a1");
  await assertSucceeds(remove(ref(bd("bob"), "listas/L1/articulos/a1")));
  await assertSucceeds(set(ref(bd("bob"), "listas/L1/articulos/a1"), valor));
});

test("importar 171 artículos = UNA escritura multi-ruta que pasa las reglas", async () => {
  const cambios = {};
  for (let i = 0; i < 171; i++) {
    cambios["listas/L1/articulos/imp" + String(i).padStart(3, "0")] = articulo({ nombre: "Artículo " + i, comprado: true, compradoPor: "bob", agregadoPor: "bob" });
  }
  await assertSucceeds(update(ref(bd("bob")), cambios));
  const valor = await leerSinReglas("listas/L1/articulos");
  assert.equal(Object.keys(valor).length, 172);
});

test("marcar todo = UNA escritura multi-ruta; si un artículo es inválido, no se aplica nada", async () => {
  await entorno.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), "listas/L1/articulos/a2"), articulo()));
  await assertFails(update(ref(bd("bob")), {
    "listas/L1/articulos/a1/comprado": true,
    "listas/L1/articulos/a2/comprado": "si",
  }));
  const valor = await leerSinReglas("listas/L1/articulos/a2/comprado");
  assert.equal(valor, false); // atómico: nada cambió
});

// ===== Roles de la aplicación =====

test("un usuario nuevo solo se da de alta como invitado activo, y no puede subirse de rol", async () => {
  await assertFails(set(ref(bd("nuevo"), "roles/nuevo"), { rol: "participante", activo: true }));
  await assertFails(set(ref(bd("nuevo"), "roles/nuevo"), { rol: "admin", activo: true }));
  await assertFails(set(ref(bd("nuevo"), "roles/nuevo"), { rol: "invitado", activo: false }));
  await assertSucceeds(set(ref(bd("nuevo"), "roles/nuevo"), { rol: "invitado", activo: true }));
  await assertFails(update(ref(bd("nuevo"), "roles/nuevo"), { rol: "participante" }));
  await assertFails(update(ref(bd("bob"), "roles/bob"), { rol: "participante" }));
  await assertSucceeds(get(ref(bd("bob"), "roles/bob")));
  await assertFails(get(ref(bd("bob"), "roles/alice")));
  await assertFails(get(ref(bd("alice"), "roles")));
});

test("el administrador raíz (correo verificado) y los administradores por rol gestionan a los demás", async () => {
  await assertSucceeds(get(ref(bdRaiz(), "roles")));
  await assertSucceeds(get(ref(bdRaiz(), "usuarios")));
  await assertSucceeds(update(ref(bdRaiz(), "roles/bob"), { rol: "participante", actualizadoPor: "raiz", actualizado: AHORA }));
  await assertSucceeds(update(ref(bdRaiz(), "roles/carol"), { rol: "admin" })); // nombrar más administradores
  await assertSucceeds(update(ref(bd("adminA"), "roles/eve"), { activo: false }));
  await assertSucceeds(get(ref(bd("adminA"), "usuarios")));
  await assertFails(update(ref(bd("adminA"), "roles/adminA"), { activo: false }), "un admin no se cambia a sí mismo");
  await assertFails(update(ref(bd("alice"), "roles/bob"), { rol: "participante" }), "un participante no administra");
  await assertFails(get(ref(bd("alice"), "usuarios")));
  await assertFails(update(ref(bdRaiz(), "roles/bob"), { rol: "jefe" }), "rol inválido");
  await assertFails(set(ref(bdRaiz(), "roles/bob"), null), "no se borra un rol (se desactiva)");
  // Correo NO verificado: no es administrador.
  await assertFails(update(ref(bdRaiz(false), "roles/bob"), { rol: "participante" }));
  await assertFails(get(ref(bdRaiz(false), "roles")));
});

test("crear lista: participante y admin sí; invitado, desactivado y sin rol no", async () => {
  const crear = (uid, id) => update(ref(bd(uid)), {
    ["listas/" + id + "/info"]: { nombre: "X", moneda: "MXN", creadaPor: uid, creada: 5 },
    ["listas/" + id + "/miembros/" + uid]: { rol: "dueno", nombre: uid },
    ["listasDeUsuario/" + uid + "/" + id]: true,
  });
  await assertSucceeds(crear("carol", "Lc"));
  await assertSucceeds(crear("adminA", "La"));
  await assertSucceeds(update(ref(bdRaiz()), {
    "listas/Lr/info": { nombre: "X", moneda: "MXN", creadaPor: "raiz", creada: 5 },
    "listas/Lr/miembros/raiz": { rol: "dueno" },
  }));
  await assertFails(crear("bob", "Lb"), "invitado sin autorizar");
  await assertFails(crear("zoe", "Lz"), "desactivada");
  await assertFails(crear("sinrol", "Ls"), "sin nodo de rol");
});

test("desactivado: no lee ni escribe sus listas", async () => {
  await assertFails(get(ref(bd("zoe"), "listas/L1")));
  await assertFails(update(ref(bd("zoe"), "listas/L1/articulos/a1"), { comprado: false }));
  // Reactivado, vuelve a tener acceso.
  await sembrar("roles/zoe/activo", true);
  await assertSucceeds(get(ref(bd("zoe"), "listas/L1")));
});

test("invitado (sin autorizar) sí edita las listas a las que lo invitaron", async () => {
  await assertSucceeds(get(ref(bd("bob"), "listas/L1")));
  await assertSucceeds(update(ref(bd("bob"), "listas/L1/articulos/a1"), { comprado: false, compradoPor: null }));
});

// ===== Duplicar una lista =====

const listaNueva = (uid, id, articulos) => {
  const c = {
    ["listas/" + id + "/info"]: { nombre: "Copia", moneda: "MXN", creadaPor: uid, creada: 5 },
    ["listas/" + id + "/miembros/" + uid]: { rol: "dueno", nombre: uid },
    ["listasDeUsuario/" + uid + "/" + id]: true,
  };
  Object.entries(articulos).forEach(([k, v]) => (c["listas/" + id + "/articulos/" + k] = v));
  return c;
};

test("duplicar: crear la lista con sus artículos en UNA escritura (participante)", async () => {
  await assertSucceeds(update(ref(bd("carol")), listaNueva("carol", "Ld", { x1: articulo({ agregadoPor: "carol" }), x2: articulo({ nombre: "Leche", comprado: true, compradoPor: "carol" }) })));
  assert.equal(Object.keys(await leerSinReglas("listas/Ld/articulos") || {}).length, 2);
});

test("duplicar: un invitado no puede (no crea listas); artículos inválidos rechazan todo", async () => {
  await assertFails(update(ref(bd("bob")), listaNueva("bob", "Lb", { x1: articulo() })));
  await assertFails(update(ref(bd("carol")), listaNueva("carol", "Le", { x1: articulo({ precio: "caro" }) })));
  assert.equal(await leerSinReglas("listas/Le"), null, "atómico: no queda lista a medias");
});

test("duplicar: no sirve para meter artículos en una lista existente ajena", async () => {
  // L1 existe (de alice): carol no es miembro; el permiso de 'lista nueva' no aplica.
  await assertFails(update(ref(bd("carol")), {
    "listas/L1/articulos/intruso": articulo({ agregadoPor: "carol" }),
    "listas/L1/miembros/carol": { rol: "dueno" },
  }));
  // Ni en una lista nueva a nombre de otro.
  await assertFails(update(ref(bd("carol")), {
    "listas/Lx/info": { nombre: "X", moneda: "MXN", creadaPor: "alice", creada: 5 },
    "listas/Lx/miembros/alice": { rol: "dueno" },
    "listas/Lx/articulos/a": articulo(),
  }));
});

// ===== Editores: todo menos eliminar la lista =====

test("favorito: booleano, lo cambia cualquier miembro y se quita con null; no-miembro no", async () => {
  await assertSucceeds(update(ref(bd("bob")), { "listas/L1/articulos/a1/favorito": true }));
  await assertSucceeds(update(ref(bd("alice")), { "listas/L1/articulos/a1/favorito": null }));
  await assertFails(update(ref(bd("bob")), { "listas/L1/articulos/a1/favorito": "si" }));
  await assertFails(update(ref(bd("carol")), { "listas/L1/articulos/a1/favorito": true }));
});

test("pasillos personalizados: editor y dueño renombran/crean/eliminan; no-miembro y desactivado no; validación", async () => {
  const base = "listas/L1/info/";
  // Primera personalización (bob = editor): categorias + orden en UNA escritura multi-ruta.
  await assertSucceeds(update(ref(bd("bob")), {
    [base + "categorias/especiales/nombre"]: "Especiales",
    [base + "categorias/frutas/nombre"]: "Fruta fresca",
    [base + "categorias/c_mascotas1/nombre"]: "Mascotas",
    [base + "ordenCategorias"]: ["especiales", "frutas", "c_mascotas1"],
  }));
  // El dueño renombra uno y elimina otro (null).
  await assertSucceeds(update(ref(bd("alice")), { [base + "categorias/frutas/nombre"]: "Frutas", [base + "categorias/c_mascotas1"]: null }));
  // No-miembro y desactivada: no.
  await assertFails(update(ref(bd("carol")), { [base + "categorias/c_x1/nombre"]: "Intruso" }));
  await assertFails(update(ref(bd("zoe")), { [base + "categorias/c_x1/nombre"]: "Desactivada" }));
  // Validación: id con mayúsculas/espacios, nombre vacío o de más de 40, campo ajeno.
  await assertFails(update(ref(bd("bob")), { [base + "categorias/Mal Id/nombre"]: "x" }));
  await assertFails(update(ref(bd("bob")), { [base + "categorias/c_x1/nombre"]: "" }));
  await assertFails(update(ref(bd("bob")), { [base + "categorias/c_x1/nombre"]: "x".repeat(41) }));
  await assertFails(update(ref(bd("bob")), { [base + "categorias/c_x1/nombre"]: "Ok", [base + "categorias/c_x1/color"]: "rojo" }));
  // Las lecturas siguen siendo solo de miembros.
  await assertSucceeds(get(ref(bd("bob"), base + "categorias")));
  await assertFails(get(ref(bd("carol"), base + "categorias")));
});

test("duplicar con pasillos personalizados: info.categorias viaja en la misma escritura de la lista nueva", async () => {
  await assertSucceeds(update(ref(bd("carol")), {
    "listas/L9/info": { nombre: "Copia", moneda: "MXN", creadaPor: "carol", creada: AHORA, ordenCategorias: ["especiales", "c_m1"],
      categorias: { especiales: { nombre: "Especiales" }, c_m1: { nombre: "Mascotas" } } },
    "listas/L9/miembros/carol": { rol: "dueno" },
    "listasDeUsuario/carol/L9": true,
    "listas/L9/articulos/n1": articulo({ nombre: "Croquetas", categoria: "c_m1", agregadoPor: "carol" }),
  }));
});

test("editor renombra la lista pero no cambia su autor ni la elimina", async () => {
  await assertSucceeds(update(ref(bd("bob"), "listas/L1/info"), { nombre: "Súper semanal" }));
  await assertFails(update(ref(bd("bob"), "listas/L1/info"), { creadaPor: "bob" }));
  await assertFails(remove(ref(bd("bob"), "listas/L1")));
});

test("editor quita a otro editor (y su índice) pero no al dueño", async () => {
  await sembrar("roles/zoe/activo", true);
  await sembrar("listasDeUsuario/zoe/L1", true);
  await assertSucceeds(update(ref(bd("bob")), { "listas/L1/miembros/zoe": null, "listasDeUsuario/zoe/L1": null }));
  await assertFails(remove(ref(bd("bob"), "listas/L1/miembros/alice")));
  await assertFails(set(ref(bd("bob"), "listas/L1/miembros/carol"), { rol: "editor" }), "un editor no agrega miembros sin invitación");
});

test("salirse: cualquier miembro menos el dueño", async () => {
  await assertSucceeds(update(ref(bd("bob")), { "listas/L1/miembros/bob": null, "listasDeUsuario/bob/L1": null }));
  await assertFails(remove(ref(bd("alice"), "listas/L1/miembros/alice")));
});

test("dueño elimina la lista completa y el índice de todos los miembros, en una escritura", async () => {
  await assertSucceeds(update(ref(bd("alice")), { "listas/L1": null, "listasDeUsuario/alice/L1": null, "listasDeUsuario/bob/L1": null }));
  assert.equal(await leerSinReglas("listas/L1"), null);
});

test("el dueño no puede nombrar otro dueño", async () => {
  await assertFails(update(ref(bd("alice"), "listas/L1/miembros/bob"), { rol: "dueno" }));
  await assertSucceeds(set(ref(bd("alice"), "listas/L1/miembros/carol"), { rol: "editor" }));
});

// ===== Invitaciones: un solo uso, 7 días =====

test("crear invitación: dueño o editor de la lista, máximo 7 días", async () => {
  await assertSucceeds(set(ref(bd("bob"), "invitaciones/" + CODIGO), invitacion()));
  await assertSucceeds(set(ref(bd("alice"), "invitaciones/" + "a".repeat(22)), invitacion({ creadaPor: "alice", creadaPorNombre: "Alice" })));
  await assertFails(set(ref(bd("carol"), "invitaciones/" + "b".repeat(22)), invitacion({ creadaPor: "carol" })), "no es miembro");
  await assertFails(set(ref(bd("bob"), "invitaciones/" + "d".repeat(22)), invitacion({ expira: AHORA + 8 * 24 * 3600 * 1000 })), "más de 7 días");
  await assertFails(set(ref(bd("bob"), "invitaciones/" + "e".repeat(22)), invitacion({ creadaPor: "alice" })), "a nombre de otro");
  await assertFails(set(ref(bd("bob"), "invitaciones/corto"), invitacion()), "código corto (< 128 bits)");
});

test("unirse con invitación: una vez, vigente, de esa lista y marcándola como usada", async () => {
  await sembrar("invitaciones/" + CODIGO, invitacion());
  await assertFails(unirse("eve", CODIGO, "L1", false), "sin marcar la invitación como usada");
  await assertSucceeds(unirse("eve")); // eve es invitada (sin autorizar): sí puede unirse
  assert.equal(await leerSinReglas("invitaciones/" + CODIGO + "/usadaPor"), "eve");
  await assertSucceeds(get(ref(bd("eve"), "listas/L1")));
  await assertFails(unirse("dave"), "ya fue usada");
});

test("unirse falla con invitación vencida, de otra lista, inexistente, de lista borrada, o desactivado", async () => {
  await sembrar("invitaciones/" + CODIGO, invitacion({ expira: AHORA - 1000 }));
  await assertFails(unirse("eve"), "vencida");
  await sembrar("invitaciones/" + CODIGO, invitacion());
  await sembrar("listas/L2/info", { nombre: "Otra", moneda: "MXN", creadaPor: "carol" });
  await assertFails(unirse("eve", CODIGO, "L2"), "invitación de otra lista");
  await assertFails(unirse("eve", "z".repeat(22)), "no existe");
  await sembrar("roles/eve/activo", false);
  await assertFails(unirse("eve"), "desactivada");
  await sembrar("roles/eve/activo", true);
  await sembrar("listas/L1/info", null);
  await assertFails(unirse("eve"), "lista eliminada");
});

test("la invitación usada no se puede reasignar ni alterar; la borra su autor o el dueño", async () => {
  await sembrar("invitaciones/" + CODIGO, invitacion({ usadaPor: "eve" }));
  await assertFails(update(ref(bd("dave"), "invitaciones/" + CODIGO), { usadaPor: "dave" }));
  await sembrar("invitaciones/" + CODIGO + "/usadaPor", null);
  await assertFails(update(ref(bd("dave"), "invitaciones/" + CODIGO), { usadaPor: "dave", expira: AHORA + 99 }), "no se puede alargar");
  await assertFails(remove(ref(bd("dave"), "invitaciones/" + CODIGO)));
  await assertSucceeds(remove(ref(bd("bob"), "invitaciones/" + CODIGO)));
});

// ===== Coordinación: actividad temporal y presencia =====

test("actividad: cada quien registra solo sus eventos; solo se borran los de más de 23 h", async () => {
  const ev = (uid, extra) => Object.assign({ uid, nombre: uid, accion: "marco", articuloId: "a1", articulo: "Leche", ts: { ".sv": "timestamp" } }, extra);
  await assertSucceeds(set(ref(bd("bob"), "listas/L1/actividad/e1"), ev("bob")));
  await assertFails(set(ref(bd("bob"), "listas/L1/actividad/e2"), ev("alice")), "a nombre de otro");
  await assertFails(set(ref(bd("bob"), "listas/L1/actividad/e3"), ev("bob", { accion: "borro" })), "acción inválida");
  await assertFails(set(ref(bd("carol"), "listas/L1/actividad/e4"), ev("carol")), "no miembro");
  await assertFails(update(ref(bd("bob"), "listas/L1/actividad/reciente"), { articulo: "Otra" }), "no se edita");
  await assertFails(remove(ref(bd("bob"), "listas/L1/actividad/reciente")), "reciente no se borra");
  await assertSucceeds(remove(ref(bd("bob"), "listas/L1/actividad/viejo")));
  // Marcar + registrar en UNA escritura multi-ruta.
  await assertSucceeds(update(ref(bd("bob")), {
    "listas/L1/articulos/a1/comprado": true,
    "listas/L1/articulos/a1/compradoPor": "bob",
    "listas/L1/actividad/e5": ev("bob"),
  }));
});

test("presencia: solo la propia, y solo miembros activos", async () => {
  await assertSucceeds(set(ref(bd("bob"), "listas/L1/presencia/bob"), { nombre: "Bob", visto: AHORA }));
  await assertFails(set(ref(bd("bob"), "listas/L1/presencia/alice"), { nombre: "Alice", visto: AHORA }));
  await assertFails(set(ref(bd("carol"), "listas/L1/presencia/carol"), { nombre: "Carol", visto: AHORA }));
  await assertSucceeds(remove(ref(bd("bob"), "listas/L1/presencia/bob")));
});
