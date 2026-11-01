// Consola de comandos: copiar el prompt para Claude, pegar comandos, vista previa renglón por
// renglón, ejecutar (UNA escritura, con registro de actividad) y Deshacer. Firebase simulado
// (mock-firebase.js). Uso: python3 pruebas/e2e/servidor.py &  y  node pruebas/e2e/comandos.js
const fs = require("fs");
const path = require("path");
let playwright;
try {
  playwright = require("playwright");
} catch (e) {
  playwright = require("/opt/node22/lib/node_modules/playwright");
}
const { chromium } = playwright;
const assert = require("assert/strict");

const BASE = process.env.BASE || "http://127.0.0.1:8767";
const CAPTURAS = process.env.CAPTURAS || path.join(__dirname, "capturas");
const mock = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
fs.mkdirSync(CAPTURAS, { recursive: true });
const pausa = (page, ms) => page.waitForTimeout(ms || 250);
const leerBD = (page, ruta) => page.evaluate((r) => window.__mockBD.leer(r), ruta);
const ultimoToast = (page) => page.$$eval(".toast span", (t) => (t.length ? t[t.length - 1].textContent : null));

async function correr(browser, ancho, modo) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: ancho, height: 860 }, hasTouch: ancho < 600, permissions: ["clipboard-read", "clipboard-write"] });
  const errores = [];
  ctx.on("weberror", (e) => errores.push("error de página: " + e.error().message));
  ctx.on("console", (m) => { if (m.type() === "error") errores.push("consola: " + m.text()); });
  await ctx.addInitScript((m) => {
    window.__USUARIO_MOCK = { uid: "u1", displayName: "Prueba", email: "dmgerardo@gmail.com", emailVerified: true, photoURL: "" };
    try { localStorage.setItem("preferenciaTema", m); } catch (e) {}
  }, modo);
  await ctx.route(/gstatic\.com\/firebasejs\//, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/gstatic\.com\/firebasejs\/.*app-compat/, (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
  const page = await ctx.newPage();
  const paso = (t) => console.log("  [" + ancho + "px " + modo + "] " + t);

  await page.goto(BASE + "/index.html");
  await pausa(page, 400);
  await page.click(".btn-accion-principal");
  await page.fill("#campo-nombre-lista", "Súper");
  await page.click('[data-form-lista] button[type="submit"]');
  await pausa(page, 300);
  await page.goto(BASE + "/" + (await page.getAttribute(".fila-tarjeta-enlace", "href")));
  await pausa(page, 400);
  const listaId = new URL(page.url()).searchParams.get("lista");
  const articulos = () => leerBD(page, "listas/" + listaId + "/articulos");
  const porNombre = async (n) => Object.entries(await articulos()).map(([id, a]) => ({ id, ...a })).find((a) => a.nombre === n);

  // Catálogo de partida (importado: todo entra "ya lo tengo"), y dos pendientes de la compra anterior.
  await page.click('[data-vista="todo"]');
  await page.click('[data-accion="importar"]');
  await page.fill("#texto-importar", "Refris\n* Leche\n* Huevo\nVerduras\n* Tomate\n* Cebolla\nAbarrotes\n* Aceite");
  await page.click("[data-importar]");
  await pausa(page, 400);
  await page.click('[aria-label="Marcar Huevo (poner en Comprar)"]');
  await page.click('[aria-label="Marcar Cebolla (poner en Comprar)"]');
  await pausa(page);
  assert.equal(await page.textContent("[data-contador-pendientes]"), "2");

  // 1. Abrir Comandos desde Artículos; el botón de copiar deja el prompt en el portapapeles.
  await page.click('[data-accion="comandos"]');
  await pausa(page);
  assert.match(await page.textContent(".caja-modal h3"), /Comandos/);
  await page.click("[data-copiar-prompt]");
  await pausa(page);
  assert.match(await page.textContent("[data-estado-prompt]"), /Prompt copiado/);
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  for (const s of ["COMPRAR | nombre | cantidad | unidad | pasillo", "CREAR | nombre", "LIMPIAR", "PREGÚNTAME", "lista «Súper»",
    "Leche | Refris | pieza | 1 | ya lo tengo", "Huevo | Refris | pieza | 1 | POR COMPRAR", "Cebolla | Verduras | pieza | 1 | POR COMPRAR", "Catálogo actual (5 artículos)"]) {
    assert.ok(prompt.includes(s), "el prompt debe incluir: " + s);
  }
  paso("prompt copiado al portapapeles con sintaxis, pasillos y catálogo");

  // 2. Pegar comandos con errores: la vista previa dice cuáles y por qué; no se ejecuta nada aún.
  const comandos = [
    "```", "# menú de la semana", "LIMPIAR",
    "COMPRAR | leche | 2 | l",
    "COMPRAR | Tomate | 1.5 | kg",
    "COMPRAR | Tomates verdes | 1",
    "CREAR | Chayote | 4 | pieza | Verduras | para el caldo",
    "COMPRAR | Chayote | 5",
    "CREAR | Sal | | | Abarrotes",
    "```"
  ].join("\n");
  await page.fill("#texto-comandos", comandos);
  await pausa(page);
  assert.equal(await page.$$eval(".lista-comandos li", (l) => l.length), 7);
  assert.equal(await page.$$eval(".comando-error", (l) => l.length), 1);
  assert.match(await page.textContent(".comando-error"), /«Tomates verdes» no existe; ¿quisiste decir «Tomate»\?/);
  assert.equal((await page.textContent("[data-ejecutar]")).trim(), "Ejecutar sin los 1 con problema");
  assert.equal(Object.keys(await articulos()).length, 5, "la vista previa no escribe");
  await page.screenshot({ path: path.join(CAPTURAS, "comandos-" + ancho + "-" + modo + ".png") });

  // 3. Corregir el renglón malo y ejecutar: UNA escritura con cambios + actividad.
  await page.fill("#texto-comandos", comandos.replace("COMPRAR | Tomates verdes | 1", "# sin tomates verdes"));
  await pausa(page);
  assert.equal(await page.$$eval(".comando-error", (l) => l.length), 0);
  assert.equal((await page.textContent("[data-ejecutar]")).trim(), "Ejecutar");
  const antes = await page.evaluate(() => window.__mockBD.escrituras.length);
  await page.click("[data-ejecutar]");
  await pausa(page, 400);
  assert.equal(await page.evaluate((n) => window.__mockBD.escrituras.length - n, antes), 1, "todo en UNA escritura");
  assert.match(await ultimoToast(page), /Comandos ejecutados: 2 limpiados · 3 por comprar · 2 creados/);
  const leche = await porNombre("Leche"), huevo = await porNombre("Huevo"), tomate = await porNombre("Tomate");
  const cebolla = await porNombre("Cebolla"), chayote = await porNombre("Chayote"), sal = await porNombre("Sal"), aceite = await porNombre("Aceite");
  assert.equal(leche.comprado, false); assert.equal(leche.cantidad, 2); assert.equal(leche.unidad, "l");
  assert.equal(tomate.comprado, false); assert.equal(tomate.cantidad, 1.5); assert.equal(tomate.unidad, "kg");
  assert.equal(huevo.comprado, true, "lo pendiente de antes quedó limpio"); assert.equal(huevo.compradoPor, "u1");
  assert.equal(cebolla.comprado, true);
  assert.equal(aceite.comprado, true);
  assert.equal(chayote.comprado, false); assert.equal(chayote.cantidad, 5); assert.equal(chayote.categoria, "verduras"); assert.equal(chayote.notas, "para el caldo");
  assert.equal(chayote.agregadoPor, "u1");
  assert.equal(sal.comprado, true); assert.equal(sal.categoria, "abarrotes");
  const act = Object.values(await leerBD(page, "listas/" + listaId + "/actividad")).map((e) => e.articulo + ":" + e.accion).sort();
  // Actividad: Huevo y Cebolla se pusieron por comprar al preparar la prueba ("desmarco") y los limpió el comando ("marco"); Leche y Tomate se desmarcaron.
  assert.deepEqual(act.filter((x) => /Huevo|Cebolla|Leche|Tomate/.test(x)), ["Cebolla:desmarco", "Cebolla:marco", "Huevo:desmarco", "Huevo:marco", "Leche:desmarco", "Tomate:desmarco"]);
  // Pasa a la vista Comprar y solo se ven los 4 pendientes (Leche, Tomate, Chayote... y nada más).
  assert.equal(await page.textContent("[data-contador-pendientes]"), "3");
  assert.deepEqual((await page.$$eval(".nombre-articulo", (n) => n.map((x) => x.textContent))).sort(), ["Chayote", "Leche", "Tomate"]);
  paso("ejecutar: limpia lo pendiente, compra, crea con pasillo y notas; UNA escritura; vista Comprar");

  // 4. Deshacer devuelve todo como estaba (y quita lo creado).
  await page.click(".toast button");
  await pausa(page, 400);
  const despues = await articulos();
  assert.equal(Object.keys(despues).length, 5, "lo creado se quita");
  const d = (n) => Object.values(despues).find((a) => a.nombre === n);
  assert.equal(d("Huevo").comprado, false); assert.equal(d("Cebolla").comprado, false);
  assert.equal(d("Leche").comprado, true); assert.equal(d("Leche").cantidad, 1); assert.equal(d("Leche").unidad, "pieza");
  assert.equal(d("Tomate").comprado, true);
  assert.equal(await page.textContent("[data-contador-pendientes]"), "2");
  paso("Deshacer restaura pendientes, cantidades y quita lo creado");

  // 5. Sin errores no hay botón apagado por nada; con todo mal, no se puede ejecutar.
  await page.click('[data-vista="todo"]');
  await page.click('[data-accion="comandos"]');
  await page.fill("#texto-comandos", "COMPRAR | Inexistente\nBAILAR");
  await pausa(page);
  assert.equal(await page.isDisabled("[data-ejecutar]"), true);
  assert.equal(await page.$$eval(".comando-error", (l) => l.length), 2);
  // Cancelar con texto pide confirmar (como en importar); seguir editando deja la hoja.
  await page.click("[data-cancelar]");
  await pausa(page);
  assert.match(await page.$$eval(".caja-modal h3", (h) => h[h.length - 1].textContent), /¿Guardar cambios\?/);
  await page.keyboard.press("Escape");
  await pausa(page);
  await page.fill("#texto-comandos", "");
  await page.click("[data-cancelar]");
  await pausa(page);
  assert.equal(await page.$(".fondo-modal"), null);
  paso("todo con error: Ejecutar deshabilitado; cancelar pide confirmar con texto");

  assert.deepEqual(errores, []);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  let fallo = null;
  try {
    for (const [ancho, modo] of [[390, "claro"], [320, "oscuro"], [1280, "claro"]]) {
      console.log("Comandos " + ancho + " px, modo " + modo);
      await correr(browser, ancho, modo);
    }
  } catch (e) {
    fallo = e;
  }
  await browser.close();
  if (fallo) {
    console.error("FALLÓ:", fallo.stack || fallo.message);
    process.exit(1);
  }
  console.log("Comandos: todo pasó. Capturas en " + CAPTURAS);
})();
