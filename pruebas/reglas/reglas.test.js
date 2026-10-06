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

// alice = dueña de L1, bob = editor de L1, carol = sin relación con L1.
function semilla() {
  return {
    usuarios: { alice: { nombre: "Alice" } },
    listasDeUsuario: { alice: { L1: true }, bob: { L1: true } },
    listas: {
      L1: {
        info: { nombre: "Súper", moneda: "MXN", creadaPor: "alice", creada: 1 },
        miembros: { alice: { rol: "dueno" }, bob: { rol: "editor" } },
        articulos: {
          a1: { nombre: "Leche", categoria: "refris", comprado: true, compradoPor: "alice", agregadoPor: "alice", creado: 1 },
        },
      },
    },
  };
}

const bd = (uid) => (uid ? entorno.authenticatedContext(uid) : entorno.unauthenticatedContext()).database();
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

test("solo la dueña renombra la lista", async () => {
  await assertSucceeds(update(ref(bd("alice"), "listas/L1/info"), { nombre: "Súper semanal" }));
  await assertFails(update(ref(bd("bob"), "listas/L1/info"), { nombre: "Hackeada" }));
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
