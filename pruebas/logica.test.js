// Pruebas de la lógica pura (js/catalogo-categorias.js + js/logica-articulos.js).
// Correr con: node --test pruebas/
// Carga los archivos tal cual los carga el navegador (scripts clásicos, un solo scope).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const ctx = vm.createContext({});
for (const f of ["js/catalogo-categorias.js", "js/logica-articulos.js"]) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), "utf8"), ctx, { filename: f });
}
// const de nivel superior no queda como propiedad del contexto: se leen evaluándolas.
const g = (expr) => vm.runInContext(expr, ctx);
const L = new Proxy({}, { get: (_, nombre) => g(nombre) });
// Los objetos creados dentro del vm tienen otro Object.prototype: se pasan por JSON para
// que deepStrictEqual compare solo el contenido.
const plano = (x) => JSON.parse(JSON.stringify(x));

test("catálogo: 14 categorías del usuario, todas con nombre", () => {
  const orden = g("CATEGORIAS_ORDEN_DEFECTO");
  assert.equal(orden.length, 14);
  assert.equal(orden[0], "especiales");
  assert.equal(orden[13], "farmacia");
  for (const id of orden) assert.ok(g("CATEGORIAS_NOMBRES")[id], id);
  assert.equal(g("UNIDADES_DEFECTO").length, 11);
});

test("normalizarNombre quita acentos, mayúsculas y espacios de más", () => {
  assert.equal(L.normalizarNombre("  Plátanos   Tabasco "), "platanos tabasco");
  assert.equal(L.normalizarNombre("Champiñones"), "champinones");
  assert.equal(L.normalizarNombre(null), "");
});

test("interpretarTextoRapido", () => {
  const casos = [
    ["leche", { nombre: "leche", cantidad: 1, unidad: "pieza" }],
    ["2 kg tomate", { nombre: "tomate", cantidad: 2, unidad: "kg" }],
    ["1 kg de tomate", { nombre: "tomate", cantidad: 1, unidad: "kg" }],
    ["3 limones", { nombre: "limones", cantidad: 3, unidad: "pieza" }],
    ["1.5 l leche", { nombre: "leche", cantidad: 1.5, unidad: "l" }],
    ["1,5 litros leche", { nombre: "leche", cantidad: 1.5, unidad: "l" }],
    ["1/2 kg queso", { nombre: "queso", cantidad: 0.5, unidad: "kg" }],
    ["2 Latas chipotle", { nombre: "chipotle", cantidad: 2, unidad: "lata" }],
    ["7up", { nombre: "7up", cantidad: 1, unidad: "pieza" }],
    ["2 kg", { nombre: "kg", cantidad: 2, unidad: "pieza" }], // sin nombre: la unidad es el nombre
    ["0 manzanas", { nombre: "0 manzanas", cantidad: 1, unidad: "pieza" }],
    ["  2   paquetes   tortillas ", { nombre: "tortillas", cantidad: 2, unidad: "paquete" }],
  ];
  for (const [entrada, esperado] of casos) {
    assert.deepEqual(plano(L.interpretarTextoRapido(entrada)), esperado, entrada);
  }
});

test("ordenCategoriasEfectivo: ids viejos fuera, faltantes al final, sin repetidos", () => {
  const defecto = g("CATEGORIAS_ORDEN_DEFECTO");
  // Lista creada en la Fase 1 con el catálogo provisional: casi todos los ids son viejos.
  const viejo = ["frutas_verduras", "panaderia", "lacteos", "farmacia", "otros"];
  const r = L.ordenCategoriasEfectivo(viejo);
  assert.equal(r.length, 14);
  assert.deepEqual(plano(r.slice(0, 2)), ["panaderia", "farmacia"]);
  assert.deepEqual(plano(L.ordenCategoriasEfectivo(undefined)), plano(defecto));
  // Realtime Database puede devolver un arreglo como objeto { "0": ..., "1": ... }.
  assert.deepEqual(plano(L.ordenCategoriasEfectivo({ 1: "frutas", 0: "limpieza" })).slice(0, 2), ["limpieza", "frutas"]);
  assert.deepEqual(plano(L.ordenCategoriasEfectivo(["frutas", "frutas"])).filter((x) => x === "frutas"), ["frutas"]);
});

test("agruparArticulos: orden de pasillos, orden de creación, filtros", () => {
  const arts = {
    "-b": { nombre: "Peras", categoria: "frutas", comprado: true },
    "-a": { nombre: "Plátanos", categoria: "frutas", comprado: false },
    "-c": { nombre: "Pinol", categoria: "limpieza", comprado: false },
    "-d": { nombre: "Raro", categoria: "id_inexistente", comprado: false },
    "-e": { nombre: "", categoria: "frutas" }, // sin nombre: se ignora
  };
  const todo = plano(L.agruparArticulos(arts, ["limpieza"]));
  assert.deepEqual(todo.map((g) => g.categoria), ["limpieza", "especiales", "frutas"]);
  assert.deepEqual(todo[2].articulos.map((a) => a.nombre), ["Peras", "Plátanos"]); // alfabético, no de llave
  assert.equal(todo[1].articulos[0].nombre, "Raro"); // categoría desconocida → Especiales
  const pendientes = plano(L.agruparArticulos(arts, [], { soloPendientes: true }));
  assert.equal(pendientes.find((g) => g.categoria === "frutas").articulos.length, 1);
  const filtrado = plano(L.agruparArticulos(arts, [], { filtro: "PLATANO" }));
  assert.equal(filtrado.length, 1);
  assert.equal(filtrado[0].articulos[0].nombre, "Plátanos");
});

test("totalesLista: solo pendientes con precio, en centavos exactos", () => {
  const r = plano(L.totalesLista({
    a: { nombre: "A", comprado: false, cantidad: 3, precio: 0.1 },  // 0.30
    b: { nombre: "B", comprado: false, cantidad: 1, precio: 0.2 },  // 0.20
    c: { nombre: "C", comprado: false, cantidad: 2.5, precio: 39.9 }, // 99.75
    d: { nombre: "D", comprado: false, precio: 12 },                 // sin cantidad = 1 → 12
    e: { nombre: "E", comprado: false },                             // sin precio
    f: { nombre: "F", comprado: true, cantidad: 10, precio: 100 },   // marcado: no cuenta
    g: { nombre: "G", comprado: false, cantidad: 2, precio: "" },    // precio vacío = sin precio
  }));
  assert.deepEqual(r, { pendientes: 6, marcados: 1, total: 112.25, sinPrecio: 2 });
  assert.equal(L.totalesLista({}).total, 0);
});

test("parsearNotaImportada con la nota real del usuario", () => {
  const texto = fs.readFileSync(path.join(__dirname, "nota-ejemplo.txt"), "utf8");
  const r = plano(L.parsearNotaImportada(texto));
  // Conteos por sección hechos a mano sobre la nota (Farmacia trae Tempra dos veces).
  const esperado = {
    especiales: 1, frutas_temporada: 6, frutas: 13, verduras: 23, carniceria: 7,
    salchichoneria: 7, refris: 8, condimentos_aceites: 12, abarrotes: 42,
    botanas_semillas: 4, panaderia: 7, limpieza: 16, personal: 17, farmacia: 8,
  };
  const conteo = {};
  for (const a of r.articulos) conteo[a.categoria] = (conteo[a.categoria] || 0) + 1;
  assert.deepEqual(conteo, esperado);
  assert.equal(r.articulos.length, 171);
  // Título, instrucción y nota de "especiales" se ignoran (y se muestran en la vista previa).
  assert.deepEqual(r.ignorados, [
    "Lista del súper",
    "\"no-marcado\" significa \"por comprar\", antes de ir al super hay que \"desmarcar\" lo que necesitemos comprar",
    "poner compras de única ocasión",
  ]);
  // Repetido en la misma sección: una vez. En secciones distintas: en ambas.
  assert.equal(r.articulos.filter((a) => a.nombre === "Tempra").length, 1);
  assert.deepEqual(r.articulos.filter((a) => a.nombre === "Bicarbonato").map((a) => a.categoria), ["limpieza", "farmacia"]);
  // Se conserva el orden y el texto tal cual (espacios de más colapsados).
  assert.deepEqual(r.articulos[0], { nombre: "Capacillos p cupcake", categoria: "especiales" });
  assert.ok(r.articulos.some((a) => a.nombre === "Lechuga"));
  assert.ok(r.articulos.some((a) => a.nombre === "Leche Entera 2 Santa Clara"));
});

test("parsearNotaImportada: otras viñetas, casillas y artículos antes de cualquier sección", () => {
  const r = plano(L.parsearNotaImportada("- Uno\n• Dos\n- [ ] Tres\n- [x] Cuatro\n☐ Cinco\nFrutas:\n1. Seis\n*\n" + "* " + "x".repeat(200)));
  assert.deepEqual(r.articulos.map((a) => a.nombre).slice(0, 6), ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis"]);
  assert.equal(r.articulos[0].categoria, "especiales");
  assert.equal(r.articulos[5].categoria, "frutas");
  assert.equal(r.articulos[6].nombre.length, 120); // recortado al límite de las reglas
});

test("separarRepetidos y buscarPorNombre", () => {
  const existentes = { "-1": { nombre: "Plátanos", categoria: "frutas" } };
  const r = plano(L.separarRepetidos([{ nombre: "platanos", categoria: "frutas" }, { nombre: "Plátanos", categoria: "especiales" }], existentes));
  assert.equal(r.repetidos.length, 1);
  assert.equal(r.aAgregar[0].categoria, "especiales");
  assert.equal(L.buscarPorNombre(existentes, " PLATANOS "), "-1");
  assert.equal(L.buscarPorNombre(existentes, "pera"), null);
  assert.equal(L.buscarPorNombre(existentes, ""), null);
});

test("textoCantidad", () => {
  assert.equal(L.textoCantidad(1, "pieza"), "");
  assert.equal(L.textoCantidad(undefined, undefined), "");
  assert.equal(L.textoCantidad(2, "pieza"), "2 piezas");
  assert.equal(L.textoCantidad(1, "lata"), "1 lata");
  assert.equal(L.textoCantidad(3, "lata"), "3 latas");
  assert.equal(L.textoCantidad(1.5, "kg"), "1.5 kg");
  assert.equal(L.textoCantidad(0.333333, "kg"), "0.33 kg");
  assert.equal(L.textoCantidad(2, "l"), "2 l");
});

test("cada pasillo tiene un ícono que existe en js/iconos.js", () => {
  const ctxIconos = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(raiz, "js/iconos.js"), "utf8"), ctxIconos);
  const iconos = vm.runInContext("ICONOS_LUCIDE", ctxIconos);
  const mapa = g("CATEGORIAS_ICONOS");
  for (const id of g("CATEGORIAS_ORDEN_DEFECTO")) {
    assert.ok(mapa[id], "sin ícono: " + id);
    assert.ok(iconos[mapa[id]], "ícono inexistente en iconos.js: " + mapa[id]);
  }
});

test("siguienteCantidad: paso por unidad, sin llegar a 0 ni pasar de 9999", () => {
  const S = (c, u, d) => L.siguienteCantidad(c, u, d);
  assert.equal(S(1, "pieza", 1), 2);
  assert.equal(S(2, "pieza", -1), 1);
  assert.equal(S(1, "pieza", -1), null);       // no baja de 1 pieza
  assert.equal(S(undefined, undefined, 1), 2); // sin cantidad/unidad = 1 pieza
  assert.equal(S(0.5, "kg", 1), 1);
  assert.equal(S(1, "kg", -1), 0.5);
  assert.equal(S(0.5, "kg", -1), null);
  assert.equal(S(2, "l", 1), 2.5);
  assert.equal(S(100, "g", 1), 200);
  assert.equal(S(100, "g", -1), null);
  assert.equal(S(250, "ml", 1), 300);          // fuera de paso: al múltiplo de arriba
  assert.equal(S(250, "ml", -1), 200);         // y al de abajo
  assert.equal(S(0.3, "kg", 1), 0.5);
  assert.equal(S(0.3, "kg", -1), null);        // abajo de 0.3 kg sería 0
  assert.equal(S(1.5, "pieza", 1), 2);
  assert.equal(S(9999, "pieza", 1), null);
  // Sin errores de punto flotante tras muchos toques.
  let c = 0.5;
  for (let i = 0; i < 7; i++) c = S(c, "kg", 1);
  assert.equal(c, 4);
});

test("etiquetaUnidad: explícita y en plural (solo pieza se abrevia)", () => {
  assert.equal(L.etiquetaUnidad(1, "pieza"), "pza");
  assert.equal(L.etiquetaUnidad(2, "pieza"), "pzas");
  assert.equal(L.etiquetaUnidad(1, undefined), "pza");
  assert.equal(L.etiquetaUnidad(3, "paquete"), "paquetes");
  assert.equal(L.etiquetaUnidad(2, "lata"), "latas");
  assert.equal(L.etiquetaUnidad(1, "caja"), "caja");
  assert.equal(L.etiquetaUnidad(1.5, "kg"), "kg");
  assert.equal(L.etiquetaUnidad(2, "docena"), "docenas");
  assert.equal(L.etiquetaUnidad(1, "botella"), "botella");
});

test("agruparArticulos: orden alfabético en español dentro de cada pasillo", () => {
  const nombres = ["zanahoria", "Ñame", "Nopales", "Ácido fólico", "Apio", "pan 10", "Pan 2", "nuez", "Elote", "apio"];
  const arts = {};
  nombres.forEach((n, i) => (arts["-" + String(9 - i)] = { nombre: n, categoria: "verduras", comprado: false }));
  const r = plano(L.agruparArticulos(arts, []))[0].articulos.map((a) => a.nombre);
  // Acentos y mayúsculas no cuentan; ñ va después de n; números por valor; "Apio"/"apio"
  // (mismo nombre) desempatan por llave y salen siempre igual.
  assert.deepEqual(r, ["Ácido fólico", "apio", "Apio", "Elote", "Nopales", "nuez", "Ñame", "Pan 2", "pan 10", "zanahoria"]);
});

test("editor de precios: soloSinPrecio, cantidadParaUnidad y contarSinPrecio", () => {
  const arts = {
    "-1": { nombre: "Leche", categoria: "refris", comprado: true, precio: 28.5 },
    "-2": { nombre: "Crema", categoria: "refris", comprado: true },
    "-3": { nombre: "Queso", categoria: "refris", comprado: false, precio: 0 }, // 0 sí es precio
    "-4": { nombre: "Pinol", categoria: "limpieza", comprado: false },
  };
  const r = plano(L.agruparArticulos(arts, [], { soloSinPrecio: true }));
  assert.deepEqual(r.map((g) => [g.categoria, g.articulos.map((a) => a.nombre)]), [["refris", ["Crema"]], ["limpieza", ["Pinol"]]]);
  assert.equal(L.contarSinPrecio(arts), 2);
  assert.equal(L.contarSinPrecio({}), 0);
  const C = (c, u) => L.cantidadParaUnidad(c, u);
  assert.equal(C(1, "g"), 100);       // 1 pza → 100 g, no 1 g
  assert.equal(C(1, "ml"), 100);
  assert.equal(C(250, "g"), 300);     // al múltiplo de 100 de arriba
  assert.equal(C(1, "kg"), 1);
  assert.equal(C(0.5, "pieza"), 1);   // 0.5 kg → 1 pza
  assert.equal(C(2, "pieza"), 2);
  assert.equal(C(1.2, "kg"), 1.5);
  assert.equal(C(undefined, "lata"), 1);
  assert.equal(C(20000, "pieza"), 9999);
});
