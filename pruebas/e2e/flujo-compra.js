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
    window.__USUARIO_MOCK = { uid: "u1", displayName: "Prueba", email: "prueba@ejemplo.com", photoURL: "" };
    try {
      localStorage.setItem("preferenciaTema", modo);
    } catch (e) {}
  }, opciones.modo || "claro");
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
  assert.deepEqual(frutas, ["Plátanos", "Mangos", "Manzanas gala unas 8"]);
  paso("importación: 1 escritura, 171 artículos, 14 pasillos en orden");

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
  await page.fill("[data-campo-rapido]", "2 kg tomate");
  await page.press("[data-campo-rapido]", "Enter");
  await pausa(page);
  assert.equal(await ultimoToast(page), "tomate agregado a Especiales");
  assert.equal(await page.inputValue("[data-campo-rapido]"), "", "el campo se limpia");
  assert.ok(await page.evaluate(() => document.activeElement.matches("[data-campo-rapido]")), "el foco se queda en el campo");
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
  paso("campo rápido: buscar, alta '2 kg tomate', sin duplicar existentes");

  // 5b. "+" con el campo vacío abre el formulario completo.
  await page.click('[aria-label="Agregar artículo"]');
  await pausa(page);
  assert.match(await page.textContent(".caja-modal h3"), /Nuevo artículo/);
  await page.keyboard.press("Escape");
  await pausa(page);

  // 6. "Por comprar": solo los 4, por pasillo.
  await page.click('[data-vista="pendientes"]');
  await pausa(page);
  assert.deepEqual(await nombresVisibles(page), ["tomate", "Plátanos", "Mangos", "Leche Entera 2 Santa Clara"]);
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
  assert.deepEqual(await nombresVisibles(page), ["Plátanos", "Mangos", "tomate", "Leche Entera 2 Santa Clara"]);
  paso("edición: pasillo + precio con coma; total $51.00 (2 kg × $25.50)");

  // 8. Marcar en la tienda: desaparece; Deshacer lo regresa.
  await page.click('[aria-label="Marcar Plátanos como comprado"]');
  await pausa(page);
  assert.ok(!(await nombresVisibles(page)).includes("Plátanos"));
  assert.equal(await ultimoToast(page), "Plátanos marcado");
  await page.click(".toast:last-child button");
  await pausa(page);
  assert.ok((await nombresVisibles(page)).includes("Plátanos"), "Deshacer regresa el artículo");
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

  // 12. Validación del formulario: cantidad inválida no se guarda.
  await page.click('[aria-label="Editar Mangos"]');
  await page.fill("#art-cantidad", "0");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page);
  assert.match(await page.textContent("[data-error]"), /mayor que 0/);
  await page.keyboard.press("Escape");

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
    return { top: Math.round(h.top), visible: h.top >= 0 && h.bottom <= window.innerHeight };
  });
  assert.ok(destino.visible && destino.top < 80, "el chip lleva al pasillo y su título queda visible arriba: " + JSON.stringify(destino));
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

(async () => {
  const browser = await chromium.launch();
  let fallo = null;
  try {
    for (const [ancho, modo] of [[390, "claro"], [390, "oscuro"], [320, "claro"], [320, "oscuro"], [1280, "claro"], [1280, "oscuro"]]) {
      console.log("Flujo " + ancho + " px, modo " + modo);
      await flujo(browser, ancho, modo);
    }
    await sinAcceso(browser);
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
