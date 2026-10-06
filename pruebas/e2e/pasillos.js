// Pasillos personalizados (renombrar / crear / eliminar vacíos) y tabulador como viñeta al
// importar, en el navegador con la CSP real y Firebase simulado.
// Uso: python3 pruebas/e2e/servidor.py &   y luego   node pruebas/e2e/pasillos.js
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
// El mock guarda los arreglos como objetos {0:…}; Firebase real los devuelve como arreglo.
const orden = (i) => (Array.isArray(i.ordenCategorias) ? i.ordenCategorias : Object.keys(i.ordenCategorias).sort((a, b) => a - b).map((k) => i.ordenCategorias[k]));
const ultimoToast = (page) => page.$$eval(".toast span", (t) => (t.length ? t[t.length - 1].textContent : null));

async function correr(browser, ancho, modo) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: ancho, height: 860 }, hasTouch: ancho < 600 });
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
  await page.fill("#campo-nombre-lista", "Pasillos");
  await page.click('[data-form-lista] button[type="submit"]');
  await pausa(page, 300);
  await page.goto(BASE + "/" + (await page.getAttribute(".fila-tarjeta-enlace", "href")));
  await pausa(page, 400);
  const listaId = new URL(page.url()).searchParams.get("lista");
  const info = () => leerBD(page, "listas/" + listaId + "/info");
  const nombresPasillos = () => page.$$eval(".titulo-pasillo", (h) => h.map((x) => [...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim()));

  // 1. Hoja Pasillos: 14 por defecto; Especiales no se puede eliminar.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  await page.click('[data-accion="pasillos"]');
  await pausa(page);
  assert.equal((await page.$$("[data-pasillo]")).length, 14);
  assert.ok(await page.isDisabled('[data-quitar-pasillo="especiales"]'), "Especiales no se elimina");
  paso("hoja Pasillos: 14 por defecto, Especiales protegido");

  // 2. Crear "Mascotas": una escritura; aparece en la hoja; queda en el nodo info.categorias.
  await page.fill("#pasillo-nuevo", "Mascotas");
  await page.click("[data-form-pasillo] button[type=submit]");
  await pausa(page, 400);
  assert.match(await page.textContent("[data-aviso-texto]"), /Mascotas.*creado/);
  let i = await info();
  const idMascotas = Object.keys(i.categorias).find((k) => i.categorias[k].nombre === "Mascotas");
  assert.match(idMascotas, /^c_[a-z0-9]+$/);
  assert.equal(Object.keys(i.categorias).length, 15, "la primera personalización escribe los 14 + el nuevo");
  assert.equal(orden(i)[orden(i).length - 1], idMascotas);
  assert.equal((await page.$$("[data-pasillo]")).length, 15);
  // Repetido (sin acentos ni mayúsculas) se rechaza.
  await page.fill("#pasillo-nuevo", "PANADERIA");
  await page.click("[data-form-pasillo] button[type=submit]");
  assert.match(await page.textContent("[data-error]"), /Ya existe un pasillo llamado Panadería/);
  await page.fill("#pasillo-nuevo", "");
  paso("crear pasillo OK; repetido rechazado");

  // 3. Renombrar Frutas → "Fruta fresca" (change = salir del campo).
  const campoFrutas = '[data-pasillo="frutas"]';
  await page.fill(campoFrutas, "Fruta fresca");
  await page.press(campoFrutas, "Enter");
  await pausa(page, 400);
  i = await info();
  assert.equal(i.categorias.frutas.nombre, "Fruta fresca");
  // Vacío: se revierte y avisa.
  await page.fill(campoFrutas, "  ");
  await page.press(campoFrutas, "Enter");
  await pausa(page);
  assert.equal(await page.inputValue(campoFrutas), "Fruta fresca");
  assert.match(await page.textContent("[data-error]"), /Escribe un nombre/);
  paso("renombrar OK; nombre vacío se revierte");

  // 4. Importar con tabuladores, usando el pasillo nuevo y el renombrado.
  await page.click("[data-cerrar]");
  await pausa(page);
  await page.click('[data-accion="importar"]');
  const texto = "Mascotas\n\tCroquetas\n\tArena para gato\nFruta fresca\n\t• Fresas\n\tKiwi\nRenglón suelto";
  await page.fill("#texto-importar", texto);
  await pausa(page);
  const previa = await page.textContent("[data-vista-previa]");
  assert.match(previa, /4<\/strong> artículos nuevos|4 artículos nuevos/);
  assert.match(previa, /Mascotas: 2/);
  assert.match(previa, /Fruta fresca: 2/);
  assert.match(previa, /Renglón suelto/); // sin tabulador ni viñeta: ignorado
  await page.screenshot({ path: path.join(CAPTURAS, "pasillos-importar-" + ancho + "-" + modo + ".png") });
  await page.click("[data-importar]");
  await pausa(page, 400);
  const arts = Object.values(await leerBD(page, "listas/" + listaId + "/articulos"));
  assert.deepEqual(arts.map((a) => a.nombre + "@" + a.categoria).sort(), [
    "Arena para gato@" + idMascotas, "Croquetas@" + idMascotas, "Fresas@frutas", "Kiwi@frutas"
  ].sort());
  assert.deepEqual(await nombresPasillos(), ["Fruta fresca 2", "Mascotas 2"].map((x) => x.replace(/ \d+$/, "")));
  await page.screenshot({ path: path.join(CAPTURAS, "pasillos-lista-" + ancho + "-" + modo + ".png") });
  paso("importar con tabulador: 4 artículos en pasillos renombrado y nuevo");

  // 5. Mascotas tiene artículos: no se puede eliminar. "Farmacia" está vacío: sí, con Deshacer.
  await page.click('[data-accion="pasillos"]');
  await pausa(page);
  assert.ok(await page.isDisabled('[data-quitar-pasillo="' + idMascotas + '"]'), "con artículos no se elimina");
  assert.ok(!(await page.isDisabled('[data-quitar-pasillo="farmacia"]')));
  await page.screenshot({ path: path.join(CAPTURAS, "pasillos-hoja-" + ancho + "-" + modo + ".png") });
  await page.click('[data-quitar-pasillo="farmacia"]');
  await pausa(page, 400);
  i = await info();
  assert.ok(!i.categorias.farmacia, "farmacia eliminada");
  assert.ok(!orden(i).includes("farmacia"));
  assert.equal((await page.$$("[data-pasillo]")).length, 14);
  assert.match(await page.textContent("[data-aviso-texto]"), /Pasillo «Farmacia» eliminado/);
  await page.click("[data-deshacer-pasillo]");
  await pausa(page, 400);
  i = await info();
  assert.equal(i.categorias.farmacia.nombre, "Farmacia", "Deshacer restaura el pasillo");
  assert.equal(orden(i)[13], "farmacia", "y en su posición");
  paso("eliminar vacío con Deshacer; con artículos bloqueado");

  // 6. El selector del formulario de artículo usa los pasillos de la lista.
  await page.click("[data-cerrar]");
  await pausa(page);
  await page.click(".nombre-articulo");
  await pausa(page);
  const opciones = await page.$$eval("#art-categoria option", (o) => o.map((x) => x.textContent));
  assert.ok(opciones.includes("Mascotas") && opciones.includes("Fruta fresca") && !opciones.includes("Frutas"));
  await page.click("[data-cancelar]");
  await pausa(page);

  // 7. Duplicar la lista conserva los pasillos personalizados.
  await page.goto(BASE + "/index.html");
  await pausa(page, 400);
  await page.click(".btn-accion-principal");
  await page.fill("#campo-nombre-lista", "Copia");
  await page.selectOption("[data-form-lista] select", listaId);
  await page.click('[data-form-lista] button[type="submit"]');
  await pausa(page, 500);
  const todas = await leerBD(page, "listas");
  const copiaId = Object.keys(todas).find((k) => todas[k].info.nombre === "Copia");
  assert.ok(copiaId, "lista copia creada");
  assert.equal(todas[copiaId].info.categorias[idMascotas].nombre, "Mascotas");
  assert.equal(todas[copiaId].info.categorias.frutas.nombre, "Fruta fresca");
  assert.ok(Object.values(todas[copiaId].articulos).some((a) => a.categoria === idMascotas));
  paso("duplicar conserva pasillos y artículos");

  assert.deepEqual(errores, []);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  let fallo = null;
  try {
    for (const [ancho, modo] of [[390, "claro"], [390, "oscuro"], [320, "claro"], [1280, "oscuro"]]) {
      console.log("Pasillos " + ancho + " px, modo " + modo);
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
  console.log("Pasillos: todo pasó. Capturas en " + CAPTURAS);
})();
