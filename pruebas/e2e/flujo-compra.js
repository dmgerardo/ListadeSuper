// Flujo completo de la Fase 2 en el navegador, contra la app servida con la CSP real
// (pruebas/e2e/servidor.py) y Firebase simulado (mock-firebase.js).
// Uso: python3 pruebas/e2e/servidor.py &   y luego   node pruebas/e2e/flujo-compra.js
// Variables opcionales: BASE (http://127.0.0.1:8767), CAPTURAS (carpeta para las capturas).
const fs = require("fs");
const path = require("path");
let playwright;
try {
  playwright = require("playwright");
} catch (e) {
  playwright = require("/opt/node22/lib/node_modules/playwright"); // instalación global de la sesión en la nube
}
const { chromium } = playwright;
const assert = require("assert/strict");

const BASE = process.env.BASE || "http://127.0.0.1:8767";
const CAPTURAS = process.env.CAPTURAS || path.join(__dirname, "capturas");
const mock = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
const nota = fs.readFileSync(path.join(__dirname, "..", "nota-ejemplo.txt"), "utf8");
fs.mkdirSync(CAPTURAS, { recursive: true });

async function nuevoContexto(browser, opciones) {
  const ctx = await browser.newContext(Object.assign({ serviceWorkers: "block" }, opciones));
  const errores = [];
  ctx.on("weberror", (e) => errores.push("error de página: " + e.error().message));
  ctx.on("console", (m) => {
    // Sin excepciones: las fuentes de Google se cargan de verdad, así que una violación de
    // CSP al pedirlas (o cualquier recurso que falle) cuenta como error.
    if (m.type() === "error") errores.push("consola: " + m.text());
  });
  await ctx.addInitScript((modo) => {
    // El flujo principal corre como el administrador raíz (puede crear listas). Los casos de
    // invitado / otro usuario cambian el usuario con sessionStorage "__usuarioMock".
    window.__USUARIO_MOCK = { uid: "u1", displayName: "Prueba", email: "dmgerardo@gmail.com", emailVerified: true, photoURL: "" };
    // modo null = no tocar la preferencia guardada (para probar que persiste al recargar).
    if (modo) {
      try {
        localStorage.setItem("preferenciaTema", modo);
      } catch (e) {}
    }
  }, opciones.modo === undefined ? "claro" : opciones.modo);
  await ctx.route(/gstatic\.com\/firebasejs\//, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/gstatic\.com\/firebasejs\/.*app-compat/, (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
  return { ctx, errores };
}

const pausa = (page, ms) => page.waitForTimeout(ms || 250);
const ultimoToast = (page) => page.$$eval(".toast span", (t) => (t.length ? t[t.length - 1].textContent : null));
const nombresVisibles = (page) => page.$$eval(".nombre-articulo", (n) => n.map((x) => x.textContent));
const leerBD = (page, ruta) => page.evaluate((r) => window.__mockBD.leer(r), ruta);

async function flujo(browser, ancho, modo) {
  const etiqueta = ancho + "px " + modo;
  const { ctx, errores } = await nuevoContexto(browser, { viewport: { width: ancho, height: 860 }, modo, hasTouch: ancho < 600 });
  const page = await ctx.newPage();
  const paso = (t) => console.log("  [" + etiqueta + "] " + t);

  // 1. Crear una lista desde "Mis listas" y abrirla (la base empieza vacía).
  await page.goto(BASE + "/index.html");
  await pausa(page, 400);
  await page.click(".btn-accion-principal");
  await page.fill("#campo-nombre-lista", "Súper de la semana");
  await page.click('[data-form-lista] button[type="submit"]');
  await pausa(page, 300);
  await page.screenshot({ path: path.join(CAPTURAS, "mis-listas-" + ancho + "-" + modo + ".png") });
  const enlace = await page.getAttribute(".fila-tarjeta-enlace", "href");
  await page.goto(BASE + "/" + enlace);
  await pausa(page, 400);
  assert.equal(await page.textContent("[data-nombre-lista]"), "Súper de la semana");
  const listaId = new URL(BASE + "/" + enlace).searchParams.get("lista");
  paso("lista creada y abierta: " + listaId);

  // 2. Lista vacía → importar la nota real del usuario.
  assert.ok(await page.isVisible(".tarjeta-vacia [data-accion=importar]"), "estado vacío con botón Importar");
  await page.click(".tarjeta-vacia [data-accion=importar]");
  await page.fill("#texto-importar", nota);
  await pausa(page);
  const previa = await page.textContent("[data-vista-previa]");
  assert.match(previa, /171 artículos nuevos/);
  assert.match(previa, /Lista del súper/); // renglón ignorado visible en la vista previa
  await page.screenshot({ path: path.join(CAPTURAS, "importar-previa-" + ancho + "-" + modo + ".png") });
  const escriturasAntes = await page.evaluate(() => window.__mockBD.escrituras.length);
  await page.click("[data-importar]");
  await pausa(page, 400);
  const escriturasImport = await page.evaluate((n) => window.__mockBD.escrituras.slice(n), escriturasAntes);
  assert.equal(escriturasImport.length, 1, "importar = UNA escritura");
  assert.equal(escriturasImport[0].rutas, 171);
  assert.equal(await ultimoToast(page), "171 artículos importados");
  const arts = await leerBD(page, "listas/" + listaId + "/articulos");
  assert.equal(Object.keys(arts).length, 171);
  assert.ok(Object.values(arts).every((a) => a.comprado === true), "todo entra marcado");
  // Tras importar se pasa a "Toda la lista": 171 filas en 14 pasillos, en el orden de la nota.
  assert.equal(await page.getAttribute('[data-vista="todo"]', "aria-selected"), "true");
  assert.equal((await nombresVisibles(page)).length, 171);
  const pasillos = await page.$$eval(".titulo-pasillo", (h) => h.map((x) => [...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim()));
  assert.deepEqual(pasillos.slice(0, 4), ["Especiales", "Frutas de temporada", "Frutas", "Verduras"]);
  assert.equal(pasillos.length, 14);
  const frutas = await page.$$eval(".grupo-pasillo:nth-child(3) .nombre-articulo", (n) => n.slice(0, 3).map((x) => x.textContent));
  assert.deepEqual(frutas, ["Fresas", "Kiwi", "Limones"]); // alfabético dentro del pasillo
  paso("importación: 1 escritura, 171 artículos, 14 pasillos en orden, alfabético adentro");

  // 3. "Por comprar" vacía.
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  assert.match(await page.textContent("[data-articulos]"), /Nada por comprar/);

  // 4. En "Toda la lista", desmarcar dos artículos tocando su casilla.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  await page.click('[aria-label="Desmarcar Plátanos (poner por comprar)"]');
  await page.click('[aria-label="Desmarcar Leche Entera 2 Santa Clara (poner por comprar)"]');
  await pausa(page);
  assert.equal(await page.textContent("[data-contador-pendientes]"), "2");

  // 5. Campo rápido: búsqueda, alta con cantidad, existente pendiente, existente marcado.
  await page.fill("[data-campo-rapido]", "lech");
  await pausa(page);
  assert.deepEqual((await nombresVisibles(page)).sort(), ["Leche Deslactosada 3 de las grises alpura", "Leche Entera 2 Santa Clara", "Lechuga"]);
  // (X) borra todo lo escrito de un toque y deja el foco en el campo.
  assert.equal(await page.isVisible("[data-limpiar-busqueda]"), true, "(X) visible con texto");
  await page.click("[data-limpiar-busqueda]");
  await pausa(page);
  assert.equal(await page.inputValue("[data-campo-rapido]"), "");
  assert.equal(await page.isVisible("[data-limpiar-busqueda]"), false, "(X) oculto sin texto");
  assert.ok(await page.evaluate(() => document.activeElement.matches("[data-campo-rapido]")));
  assert.equal((await nombresVisibles(page)).length, 171, "sin filtro: vuelve la lista completa");
  await page.fill("[data-campo-rapido]", "2 kg tomate");
  await page.press("[data-campo-rapido]", "Enter");
  await pausa(page);
  // Artículo nuevo: abre el formulario con lo escrito y SIN pasillo elegido (no se asume Especiales).
  assert.ok(await page.isVisible("[data-form-articulo]"), "Enter con un artículo nuevo abre el formulario");
  assert.equal(await page.inputValue("#art-nombre"), "tomate");
  assert.equal(await page.$("#art-cantidad"), null, "el formulario ya no tiene campo de cantidad");
  // Orden pedido: nombre / pasillo / unidad + precio / notas (caja de 3 renglones).
  assert.deepEqual(await page.$$eval("[data-form-articulo] input:not([type=hidden]), [data-form-articulo] select, [data-form-articulo] textarea", (c) => c.map((x) => x.id)),
    ["art-nombre", "art-categoria", "art-unidad", "art-precio", "art-notas"]);
  assert.equal(await page.getAttribute("#art-notas", "rows"), "3");
  assert.equal(await page.inputValue("#art-unidad"), "kg");
  assert.equal(await page.inputValue("#art-categoria"), "", "sin pasillo por defecto");
  await page.click('[data-form-articulo] button[type="submit"]');
  assert.match(await page.textContent("[data-error]"), /Elige el pasillo/);
  await page.selectOption("#art-categoria", "especiales");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page);
  assert.equal(await ultimoToast(page), "Guardado ✓");
  assert.equal(await page.inputValue("[data-campo-rapido]"), "", "el campo se limpia");
  await page.fill("[data-campo-rapido]", "PLATANOS");
  await page.press("[data-campo-rapido]", "Enter");
  await pausa(page);
  assert.equal(await ultimoToast(page), "Plátanos ya está por comprar");
  await page.fill("[data-campo-rapido]", "mangos");
  await page.press("[data-campo-rapido]", "Enter");
  await pausa(page);
  assert.equal(await ultimoToast(page), "Mangos está por comprar");
  assert.equal(await page.textContent("[data-contador-pendientes]"), "4");
  const total = Object.keys(await leerBD(page, "listas/" + listaId + "/articulos")).length;
  assert.equal(total, 172, "Plátanos/Mangos no se duplicaron; solo se agregó tomate");
  // "+" en el título de un pasillo: formulario con ESE pasillo ya elegido.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  await page.click('[data-agregar-pasillo="panaderia"]');
  await pausa(page);
  assert.equal(await page.inputValue("#art-categoria"), "panaderia");
  assert.equal(await page.inputValue("#art-nombre"), "");
  await page.fill("#art-nombre", "Pan de caja prueba");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page);
  const todosArts = await leerBD(page, "listas/" + listaId + "/articulos");
  const idPan = Object.keys(todosArts).find((k) => todosArts[k].nombre === "Pan de caja prueba");
  assert.equal(todosArts[idPan].categoria, "panaderia");
  assert.equal(todosArts[idPan].comprado, false);
  // Se quita para no alterar los conteos de los pasos siguientes (172 artículos).
  await page.evaluate(([l, k]) => window.__mockBD.escribirComoOtro({ ["listas/" + l + "/articulos/" + k]: null }), [listaId, idPan]);
  await pausa(page);
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  paso("campo rápido: buscar, alta '2 kg tomate', sin duplicar existentes");

  // Favoritos: estrella por renglón y filtro (en Por comprar y en Toda la lista).
  await page.click('[aria-label="Marcar como favorito: Mangos"]');
  await pausa(page);
  assert.equal((Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === "Mangos")).favorito, true);
  await page.click('[data-accion="solo-favoritos"]');
  await pausa(page);
  assert.deepEqual(await nombresVisibles(page), ["Mangos"], "el filtro deja solo los favoritos");
  assert.match(await page.textContent('[data-accion="solo-favoritos"]'), /Favoritos \(1\)/);
  await page.click('[data-vista="todo"]');
  await pausa(page);
  assert.deepEqual(await nombresVisibles(page), ["Mangos"], "el filtro vale también en Toda la lista");
  await page.click('[aria-label="Quitar de favoritos: Mangos"]');
  await pausa(page);
  assert.match(await page.textContent(".tarjeta-vacia"), /Aún no tienes favoritos/);
  assert.equal((Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === "Mangos")).favorito, undefined, "quitar borra el campo");
  await page.click('[data-accion="solo-favoritos"]');
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  paso("favoritos: estrella, filtro en ambas vistas, estado vacío, quitar borra el campo");

  // 5b. "+" con el campo vacío abre el formulario completo.
  await page.click('[aria-label="Agregar artículo"]');
  await pausa(page);
  assert.match(await page.textContent(".caja-modal h3"), /Nuevo artículo/);
  await page.keyboard.press("Escape");
  await pausa(page);

  // 6. "Por comprar": solo los 4, por pasillo.
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  assert.deepEqual(await nombresVisibles(page), ["tomate", "Mangos", "Plátanos", "Leche Entera 2 Santa Clara"]);
  assert.match(await page.textContent(".fila-articulo:first-child .detalle-articulo"), /2 kg/);

  // 7. Editar tomate: pasillo Verduras y precio 25,50 (coma decimal) → subtotal y total.
  await page.click('[aria-label="Editar tomate"]');
  await page.selectOption("#art-categoria", "verduras");
  await page.fill("#art-precio", "25,50");
  await pausa(page, 350); // que termine la animación de entrada del modal
  const toastEncima = await page.evaluate(() => {
    const t = document.querySelector(".toast");
    if (!t) return false;
    const r = t.getBoundingClientRect();
    const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!arriba && !!arriba.closest(".toast");
  });
  assert.equal(toastEncima, false, "un toast no debe quedar encima del formulario abierto");
  await page.screenshot({ path: path.join(CAPTURAS, "formulario-" + ancho + "-" + modo + ".png") });
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page);
  assert.equal(await ultimoToast(page), "Guardado ✓");
  const tomate = Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === "tomate");
  assert.deepEqual([tomate.categoria, tomate.precio, tomate.cantidad, tomate.unidad], ["verduras", 25.5, 2, "kg"]);
  // Tarjeta de resumen (datos de totalesLista): 4 por comprar de 172, $51.00, 3 sin precio.
  assert.equal(await page.textContent("[data-resumen] .resumen-numero"), "4 de 172");
  assert.equal(await page.textContent("[data-resumen] .resumen-monto"), "$51.00");
  assert.equal(await page.textContent("[data-resumen] .resumen-nota"), "3 sin precio");
  assert.equal(await page.getAttribute("[data-resumen]", "aria-live"), "polite");
  assert.deepEqual(await nombresVisibles(page), ["Mangos", "Plátanos", "tomate", "Leche Entera 2 Santa Clara"]);
  paso("edición: pasillo + precio con coma; total $51.00 (2 kg × $25.50)");

  // 7b. Contador (−)/(+) en "Toda la lista": cambia SOLO la cantidad, con paso por unidad.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  assert.equal(await page.$$eval(".control-cantidad", (c) => c.length), 172, "contador en cada renglón de Toda la lista");
  const valor = (nombre) => page.$eval(`.control-cantidad[aria-label="Cantidad de ${nombre}"] .valor-cantidad`, (v) => v.innerText.replace(/\s+/g, " ").trim());
  const art = async (nombre) => Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === nombre);
  assert.equal(await valor("Plátanos"), "1 pza");
  assert.equal(await page.isDisabled('[aria-label="Quitar 1 pza a Plátanos"]'), true, "(−) deshabilitado en 1 pza");
  await page.click('[aria-label="Agregar 1 pza a Plátanos"]');
  await page.click('[aria-label="Agregar 1 pza a Plátanos"]');
  await pausa(page);
  assert.equal(await valor("Plátanos"), "3 pzas");
  assert.equal((await art("Plátanos")).cantidad, 3);
  assert.equal((await art("Plátanos")).comprado, false, "(+) no cambia marcado/desmarcado");
  await page.click('[aria-label="Quitar 1 pza a Plátanos"]');
  await pausa(page);
  assert.equal((await art("Plátanos")).cantidad, 2);
  // kg de medio en medio; el subtotal del renglón se recalcula.
  assert.equal(await valor("tomate"), "2 kg");
  await page.click('[aria-label="Quitar 0.5 kg a tomate"]');
  await pausa(page);
  assert.equal((await art("tomate")).cantidad, 1.5);
  assert.match(await page.textContent('.fila-articulo:has([aria-label="Cantidad de tomate"]) .precio-detalle'), /\$38\.25/);
  await page.click('[aria-label="Agregar 0.5 kg a tomate"]');
  await pausa(page);
  assert.equal((await art("tomate")).cantidad, 2);
  // Un artículo MARCADO también acepta (+) y sigue marcado.
  await page.click('[aria-label="Agregar 1 pza a Mandarina"]');
  await pausa(page);
  const mandarina = await art("Mandarina");
  assert.deepEqual([mandarina.cantidad, mandarina.comprado], [2, true]);
  // El contador cabe en el renglón (sin salirse de la pantalla).
  const fuera = await page.$$eval(".control-cantidad", (cs) => cs.filter((c) => c.getBoundingClientRect().right > window.innerWidth + 0.5).length);
  assert.equal(fuera, 0, "ningún contador se sale de la pantalla");
  if (ancho === 320 || ancho === 390) await page.screenshot({ path: path.join(CAPTURAS, "contador-" + ancho + "-" + modo + ".png") });
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  assert.equal(await page.$$eval(".control-cantidad", (c) => c.length), 0, "en Por comprar no hay contador");
  paso("contador (−)/(+): pzas de 1 en 1, kg de 0.5, mínimo, sin tocar 'marcado'");

  // 7c. Editor rápido de unidades y precios.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  await page.click("[data-accion=editar-precios]");
  await pausa(page);
  assert.equal(await page.$$eval("[data-precio]", (c) => c.length), 172, "un campo de precio por artículo");
  assert.match(await page.textContent("[data-accion=solo-sin-precio]"), /Solo sin precio · 171/); // tomate ya tiene precio
  await page.click("[data-accion=solo-sin-precio]");
  await pausa(page);
  assert.equal(await page.$$eval("[data-precio]", (c) => c.length), 171, "Solo sin precio oculta los que ya tienen");
  const campo = (nombre) => `[aria-label^="Precio por "][aria-label$=" de ${nombre}"]`;
  await page.fill(campo("Fresas"), "45,90");
  await page.press(campo("Fresas"), "Enter");
  await pausa(page, 400);
  assert.equal((await art("Fresas")).precio, 45.9, "precio con coma decimal guardado");
  assert.ok(await page.evaluate(() => document.activeElement.matches('[aria-label$=" de Kiwi"]')), "Enter pasa al siguiente precio (Kiwi)");
  // Escribir en el siguiente mientras llega el cambio de la base: no se repinta, no se pierde.
  await page.keyboard.type("12");
  await pausa(page, 400);
  assert.equal(await page.inputValue(campo("Kiwi")), "12", "lo escrito sigue ahí tras el guardado anterior");
  assert.ok(await page.evaluate(() => document.activeElement.matches('[aria-label$=" de Kiwi"]')), "el foco no se pierde");
  assert.ok(await page.isVisible(campo("Fresas")), "Fresas sigue visible aunque ya tiene precio (no salta)");
  await page.press(campo("Kiwi"), "Tab"); // salir del campo (como tocar otro control) guarda
  await pausa(page, 300);
  assert.match(await page.textContent("[data-accion=solo-sin-precio]"), /· 169/);
  // Unidad: Fresas → kg (1 kg); Kiwi → g (1 pza → 100 g, no 1 g).
  await page.selectOption('[aria-label="Unidad de Fresas"]', "kg");
  await page.selectOption('[aria-label="Unidad de Kiwi"]', "g");
  await pausa(page, 400);
  assert.deepEqual([(await art("Fresas")).unidad, (await art("Fresas")).cantidad], ["kg", 1]);
  assert.deepEqual([(await art("Kiwi")).unidad, (await art("Kiwi")).cantidad, (await art("Kiwi")).precio], ["g", 100, 12]);
  assert.equal(await page.textContent('.fila-precio:has([aria-label="Unidad de Kiwi"]) [data-por-unidad]'), "/ g");
  // Precio inválido: no se guarda y se avisa; vacío = quitar el precio.
  await page.fill(campo("Limones"), "abc");
  await page.press(campo("Limones"), "Tab");
  await pausa(page);
  assert.equal((await art("Limones")).precio, undefined);
  assert.equal(await page.getAttribute(campo("Limones"), "aria-invalid"), "true");
  assert.match(await ultimoToast(page), /Precio no válido/);
  await page.fill(campo("Limones"), "");
  await page.fill(campo("Fresas"), "");
  await page.press(campo("Fresas"), "Tab");
  await pausa(page, 400);
  assert.equal((await art("Fresas")).precio, undefined, "vaciar el campo quita el precio");
  const fueraEditor = await page.$$eval(".controles-precio", (cs) => cs.filter((c) => c.getBoundingClientRect().right > window.innerWidth + 0.5).length);
  assert.equal(fueraEditor, 0, "los controles del editor caben en pantalla");
  if (ancho === 320 || ancho === 390) await page.screenshot({ path: path.join(CAPTURAS, "editor-precios-" + ancho + "-" + modo + ".png") });
  await page.click("[data-accion=salir-precios]");
  await pausa(page);
  assert.equal(await page.$$eval("[data-precio]", (c) => c.length), 0, "Listo cierra el editor");
  assert.equal(await page.$$eval(".control-cantidad", (c) => c.length), 172, "y vuelve Toda la lista normal");
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  paso("editor de precios: coma decimal, Enter al siguiente, foco estable, unidad ajusta cantidad, inválido/vacío");

  // 8. Marcar en la tienda: desaparece; Deshacer lo regresa.
  await page.click('[aria-label="Marcar Plátanos como comprado"]');
  await pausa(page);
  assert.ok(!(await nombresVisibles(page)).includes("Plátanos"));
  assert.equal(await ultimoToast(page), "Plátanos marcado");
  await page.click(".toast:last-child button");
  await pausa(page);
  assert.ok((await nombresVisibles(page)).includes("Plátanos"), "Deshacer regresa el artículo");
  // "Marcaste hace poco": marcar Mangos (sin usar el toast) y regresarlo desde ahí.
  await page.click('[aria-label="Marcar Mangos como comprado"]');
  await pausa(page);
  assert.ok(!(await nombresVisibles(page)).includes("Mangos"), "Mangos sale de Por comprar");
  assert.match(await page.textContent(".recien-marcados"), /Marcaste hace poco[\s\S]*Mangos/);
  await page.screenshot({ path: path.join(CAPTURAS, "recien-marcados-" + ancho + "-" + modo + ".png") });
  await page.click('[aria-label="Regresar Mangos a Por comprar"]');
  await pausa(page);
  assert.ok((await nombresVisibles(page)).includes("Mangos"), "Regresar lo devuelve a Por comprar");
  assert.equal(await page.$(".recien-marcados"), null, "y sale de 'Marcaste hace poco'");
  const actMangos = Object.values(await leerBD(page, "listas/" + listaId + "/actividad")).filter((e) => e.articulo === "Mangos").map((e) => e.accion);
  assert.deepEqual(actMangos.slice(-2), ["marco", "desmarco"], "queda en el registro");
  await page.screenshot({ path: path.join(CAPTURAS, "por-comprar-" + ancho + "-" + modo + ".png") });

  // 9. Marcar todo (1 escritura) y Deshacer.
  const antesTodo = await page.evaluate(() => window.__mockBD.escrituras.length);
  await page.click("[data-accion=marcar-todo]");
  await pausa(page);
  const escTodo = await page.evaluate((n) => window.__mockBD.escrituras.slice(n), antesTodo);
  assert.equal(escTodo.length, 1, "marcar todo = UNA escritura");
  assert.match(await page.textContent("[data-articulos]"), /Nada por comprar/);
  assert.equal(await ultimoToast(page), "4 artículos marcados");
  await page.click(".toast:last-child button");
  await pausa(page);
  assert.equal((await nombresVisibles(page)).length, 4);
  paso("marcar en tienda + Deshacer; marcar todo (1 escritura) + Deshacer");

  // 10. Eliminar desde el formulario y Deshacer (mismo id, mismos datos).
  const idTomate = Object.entries(await leerBD(page, "listas/" + listaId + "/articulos")).find(([, a]) => a.nombre === "tomate")[0];
  await page.click('[aria-label="Editar tomate"]');
  await page.click("[data-eliminar]");
  await pausa(page);
  assert.equal(await leerBD(page, "listas/" + listaId + "/articulos/" + idTomate), null);
  assert.equal(await ultimoToast(page), "tomate eliminado");
  await page.click(".toast:last-child button");
  await pausa(page);
  assert.equal((await leerBD(page, "listas/" + listaId + "/articulos/" + idTomate)).precio, 25.5);
  paso("eliminar + Deshacer restaura el mismo artículo");

  // 11. Cerrar el formulario con cambios sin guardar pregunta Guardar/Descartar.
  await page.click('[aria-label="Editar Mangos"]');
  await page.fill("#art-notas", "los de Manila");
  await page.click("[data-form-articulo] [data-cancelar]");
  await pausa(page);
  assert.match(await page.textContent(".fondo-modal:last-child"), /¿Guardar cambios\?/);
  await page.click('[data-accion="descartar"]');
  await pausa(page);
  assert.equal(await page.$$eval(".fondo-modal", (m) => m.length), 0);
  assert.equal((Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === "Mangos")).notas, undefined);

  // 12. Validación del formulario: precio inválido no se guarda.
  await page.click('[aria-label="Editar Mangos"]');
  await page.fill("#art-precio", "abc");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page);
  assert.match(await page.textContent("[data-error]"), /precio debe ser/);
  // Con cambios, Escape ya no cierra directo: pregunta; se descarta.
  await page.keyboard.press("Escape");
  await pausa(page);
  await page.click('[data-accion="descartar"]');
  await pausa(page);

  // 12b. Tocar fuera o Escape con cambios NO cierra: pregunta Guardar / Descartar / Seguir.
  const tocarFuera = async () => page.mouse.click(5, 5); // el fondo del modal, fuera de la caja
  const modales = () => page.$$eval(".fondo-modal", (m) => m.length);
  await page.click('[aria-label="Editar Mangos"]');
  await tocarFuera();
  await pausa(page);
  assert.equal(await modales(), 0, "sin cambios, tocar fuera cierra");
  await page.click('[aria-label="Editar Mangos"]');
  await page.fill("#art-notas", "de Manila");
  await tocarFuera();
  await pausa(page);
  assert.equal(await modales(), 2, "con cambios, tocar fuera pregunta (formulario + confirmación)");
  await page.click('[data-accion="seguir"]');
  await pausa(page);
  assert.equal(await modales(), 1);
  assert.equal(await page.inputValue("#art-notas"), "de Manila", "seguir editando conserva lo escrito");
  await page.keyboard.press("Escape");
  await pausa(page);
  assert.equal(await modales(), 2, "Escape con cambios también pregunta");
  await page.keyboard.press("Escape"); // Escape en la confirmación = seguir editando
  await pausa(page);
  assert.equal(await modales(), 1, "solo se cierra la de arriba");
  await tocarFuera();
  await pausa(page);
  await page.click('[data-accion="guardar"]');
  await pausa(page);
  assert.equal(await modales(), 0);
  assert.equal((Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === "Mangos")).notas, "de Manila", "Guardar desde la confirmación guarda");
  // Guardar con un dato inválido desde la confirmación: el formulario se queda abierto con su error.
  await page.click('[aria-label="Editar Mangos"]');
  await page.fill("#art-precio", "abc");
  await tocarFuera();
  await pausa(page);
  await page.click('[data-accion="guardar"]');
  await pausa(page);
  assert.equal(await modales(), 1, "inválido: se queda abierto");
  assert.match(await page.textContent("[data-error]"), /precio debe ser/);
  await tocarFuera();
  await pausa(page);
  await page.click('[data-accion="descartar"]');
  await pausa(page);
  assert.equal(await modales(), 0, "Descartar cierra");
  assert.equal((Object.values(await leerBD(page, "listas/" + listaId + "/articulos")).find((a) => a.nombre === "Mangos")).cantidad, 1, "sin guardar el 0");
  paso("formularios: tocar fuera/Escape con cambios pregunta; inválido no se pierde");

  // 13. Importar otra vez la misma nota no duplica nada.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  await page.click("[data-accion=importar]");
  await page.fill("#texto-importar", nota);
  await pausa(page);
  assert.match(await page.textContent("[data-vista-previa]"), /0<\/strong> artículos nuevos|0 artículos nuevos/);
  assert.match(await page.textContent("[data-vista-previa]"), /171 ya estaban/);
  assert.equal(await page.isDisabled("[data-importar]"), true);
  await page.click(".fondo-modal [data-cancelar]");
  await pausa(page);
  if (await page.$('[data-accion="descartar"]')) await page.click('[data-accion="descartar"]');
  paso("reimportar: 0 nuevos, 171 ya estaban; Guardar/Descartar y validación OK");

  // 14. La vista elegida se recuerda al recargar.
  await page.reload();
  await pausa(page, 500);
  assert.equal(await page.getAttribute('[data-vista="todo"]', "aria-selected"), "true");
  await page.screenshot({ path: path.join(CAPTURAS, "toda-la-lista-" + ancho + "-" + modo + ".png") });

  // 14b. Rediseño 2.1: índice de pasillos, encabezado con baldosa, marcado sin tachar,
  // fuentes reales y etiqueta de la pestaña activa (solo desde 375 px).
  const chips = await page.$$eval(".chip-pasillo", (c) => c.map((x) => [x.getAttribute("href"), x.querySelector(".chip-numero").textContent]));
  assert.equal(chips.length, 14, "un chip por pasillo visible");
  assert.deepEqual(chips.find((c) => c[0] === "#p-frutas"), ["#p-frutas", "2"], "chip de Frutas con sus 2 pendientes");
  assert.equal(await page.$$eval(".grupo-pasillo .baldosa-pasillo svg", (b) => b.length), 14, "baldosa con ícono en cada pasillo");
  await page.click('.chip-pasillo[href="#p-abarrotes"]');
  await page.waitForTimeout(900); // scroll suave
  const destino = await page.evaluate(() => {
    const h = document.querySelector("#p-abarrotes .titulo-pasillo").getBoundingClientRect();
    const ind = document.querySelector(".indice-pasillos").getBoundingClientRect();
    const chip = document.querySelector('.chip-pasillo[href="#p-abarrotes"]');
    return {
      indiceArriba: Math.round(ind.top),
      tituloBajoIndice: Math.round(h.top - ind.bottom),
      chipActivo: chip.classList.contains("activo") && chip.getAttribute("aria-current") === "true",
      scrollY: Math.round(window.scrollY),
    };
  });
  // Índice fijo arriba aunque la página bajó; título del pasillo pegado justo debajo; chip
  // del pasillo actual resaltado.
  assert.ok(destino.scrollY > 500, "la página sí bajó: " + JSON.stringify(destino));
  assert.equal(destino.indiceArriba, 0, "el índice queda fijo arriba: " + JSON.stringify(destino));
  assert.ok(destino.tituloBajoIndice >= -1 && destino.tituloBajoIndice < 40, "título justo debajo del índice: " + JSON.stringify(destino));
  assert.ok(destino.chipActivo, "chip de Abarrotes resaltado: " + JSON.stringify(destino));
  // Al seguir bajando a mano, el resaltado cambia de pasillo.
  await page.evaluate(() => window.scrollTo({ top: document.querySelector("#p-limpieza").offsetTop, behavior: "instant" }));
  await pausa(page, 400);
  assert.ok(await page.$eval('.chip-pasillo[href="#p-limpieza"]', (c) => c.classList.contains("activo")), "el resaltado sigue el scroll");
  if (ancho === 320 || ancho === 390) await page.screenshot({ path: path.join(CAPTURAS, "indice-fijo-" + ancho + "-" + modo + ".png") });
  const marcadoEstilo = await page.$eval(".fila-articulo.marcado .nombre-articulo", (e) => {
    const cs = getComputedStyle(e);
    return { tachado: cs.textDecorationLine, color: cs.color };
  });
  assert.equal(marcadoEstilo.tachado, "none", "lo marcado NO va tachado");
  const fuentes = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      titulos: document.fonts.check('800 36px "Bricolage Grotesque"'),
      texto: document.fonts.check('400 16px "Figtree"'),
      h1: getComputedStyle(document.querySelector("h1")).fontFamily,
    };
  });
  assert.ok(fuentes.titulos && fuentes.texto, "fuentes cargadas: " + JSON.stringify(fuentes));
  assert.match(fuentes.h1, /Bricolage Grotesque/);
  // Las vistas viven en la barra: Toda la lista activa con etiqueta (desde 375 px) y ya no
  // hay pestañas "próximamente".
  assert.equal(await page.$$eval(".envoltura-barra [data-vista]", (b) => b.length), 2);
  assert.equal(await page.$$eval(".envoltura-barra [aria-disabled]", (b) => b.length), 0);
  assert.equal(await page.$$eval(".contenedor [data-vista]", (b) => b.length), 0, "el selector ya no está en el contenido");
  const etiquetaActiva = await page.$eval(".item-barra.activo .etiqueta-barra", (e) => getComputedStyle(e).display);
  assert.equal(etiquetaActiva === "none", ancho < 375, "etiqueta de la pestaña activa visible solo desde 375 px");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await pausa(page, 600);

  // 15. Ningún control de la barra inferior tapa a otro (pasó con el "+" aparte a 390 px).
  const traslapes = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".envoltura-barra .item-barra, .envoltura-barra .btn-accion-principal")];
    const r = els.map((e) => [e.getAttribute("aria-label"), e.getBoundingClientRect()]);
    const malos = [];
    for (let i = 0; i < r.length; i++) {
      if (r[i][1].left < 0 || r[i][1].right > window.innerWidth) malos.push(r[i][0] + " fuera de pantalla");
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i][1], b = r[j][1];
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom && b.top < a.bottom) malos.push(r[i][0] + " / " + r[j][0]);
      }
    }
    return malos;
  });
  assert.deepEqual(traslapes, [], "controles de la barra traslapados");
  assert.equal(await page.$$eval(".toast", (t) => t.length) <= 1, true, "un solo aviso a la vez");

  // 16. Sin scroll horizontal; ninguna fila tapada por la barra al final de la página.
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(desborde, false, "sin scroll horizontal");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await pausa(page);
  const tapada = await page.evaluate(() => {
    const filas = document.querySelectorAll(".fila-articulo");
    const ultima = filas[filas.length - 1].getBoundingClientRect();
    const barra = document.querySelector(".barra-flotante").getBoundingClientRect();
    return ultima.bottom > barra.top;
  });
  assert.equal(tapada, false, "la última fila queda por encima de la barra flotante");

  assert.deepEqual(errores, [], "sin errores de página ni de consola (incluye violaciones de CSP)");
  paso("OK — sin errores ni violaciones de CSP");
  await ctx.close();
}

async function sinAcceso(browser) {
  const { ctx, errores } = await nuevoContexto(browser, { viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(BASE + "/lista.html?lista=no-existe");
  await page.clock.runFor(7000);
  await pausa(page);
  assert.equal(await page.textContent("[data-nombre-lista]"), "No encontramos esta lista");
  assert.ok(await page.isVisible("[data-sin-acceso]"));
  assert.deepEqual(errores, []);
  console.log("  [sin acceso] lista inexistente → aviso tras 6 s, sin errores");
  await ctx.close();
}

// Selector de apariencia en "Mi cuenta": Claro/Oscuro a voluntad, persiste al recargar, y
// "Sistema" sigue al sistema operativo en vivo.
async function apariencia(browser) {
  const { ctx, errores } = await nuevoContexto(browser, { viewport: { width: 390, height: 800 }, modo: null, colorScheme: "light" });
  const page = await ctx.newPage();
  const modoActual = () => page.getAttribute("html", "data-modo");
  await page.goto(BASE + "/index.html");
  await pausa(page, 400);
  assert.equal(await modoActual(), "claro", "por defecto sigue al sistema (claro)");
  await page.click('[aria-label="Mi cuenta"]');
  await pausa(page);
  assert.equal(await page.getAttribute('[data-tema="sistema"]', "aria-checked"), "true");
  await page.click('[data-tema="oscuro"]');
  assert.equal(await modoActual(), "oscuro", "Oscuro se aplica al instante");
  assert.equal(await page.getAttribute('[data-tema="oscuro"]', "aria-checked"), "true");
  await page.screenshot({ path: path.join(CAPTURAS, "apariencia-oscuro.png") });
  await page.reload();
  await pausa(page, 400);
  assert.equal(await modoActual(), "oscuro", "la elección persiste al recargar");
  await page.click('[aria-label="Mi cuenta"]');
  await pausa(page);
  await page.click('[data-tema="claro"]');
  await page.emulateMedia({ colorScheme: "dark" });
  await pausa(page);
  assert.equal(await modoActual(), "claro", "Claro fijo no cambia aunque el sistema pase a oscuro");
  await page.click('[data-tema="sistema"]');
  assert.equal(await modoActual(), "oscuro", "Sistema toma el modo del sistema (oscuro)");
  await page.emulateMedia({ colorScheme: "light" });
  await pausa(page);
  assert.equal(await modoActual(), "claro", "Sistema sigue el cambio en vivo");
  await page.screenshot({ path: path.join(CAPTURAS, "apariencia-claro.png") });
  assert.deepEqual(errores, []);
  console.log("  [apariencia] Claro/Oscuro a voluntad, persiste al recargar, Sistema sigue al SO");
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  let fallo = null;
  try {
    for (const [ancho, modo] of [[390, "claro"], [390, "oscuro"], [320, "claro"], [320, "oscuro"], [1280, "claro"], [1280, "oscuro"]]) {
      console.log("Flujo " + ancho + " px, modo " + modo);
      await flujo(browser, ancho, modo);
    }
    await sinAcceso(browser);
    await apariencia(browser);
  } catch (e) {
    fallo = e;
  }
  await browser.close();
  if (fallo) {
    console.error("FALLÓ:", fallo.message);
    process.exit(1);
  }
  console.log("Todas las pruebas de punta a punta pasaron. Capturas en " + CAPTURAS);
})();
