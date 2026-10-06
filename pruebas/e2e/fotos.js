// Fotos de los artículos: archivo, portapapeles (API y evento paste) y URL; miniatura en la
// lista, vista ampliada, quitar, y limpieza de lo subido y descartado. Storage está simulado
// (mock-firebase.js). Uso: python3 pruebas/e2e/servidor.py &  y  node pruebas/e2e/fotos.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
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
const subidos = (page) => page.evaluate(() => Object.keys(window.__mockStorage || {}));

// PNG RGB de ancho×alto (degradado) sin dependencias: para probar que se reduce a ≤ 1280 px.
function png(ancho, alto) {
  const crcTabla = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTabla[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const trozo = (tipo, datos) => { const t = Buffer.from(tipo); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, datos]))); return Buffer.concat([l, t, datos, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) { const i = y * (ancho * 3 + 1) + 1 + x * 3; filas[i] = (x * 255 / ancho) | 0; filas[i + 1] = (y * 255 / alto) | 0; filas[i + 2] = 120; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", zlib.deflateSync(filas)), trozo("IEND", Buffer.alloc(0))]);
}
const GRANDE = png(2000, 1000);
const CHICA = png(40, 40);
const OTRA = png(64, 32); // distinta de CHICA: si no, el JPEG sería idéntico y no habría "cambio"

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
  await ctx.route("https://imagenes.ejemplo.test/**", (r) => r.fulfill({ contentType: "image/png", body: CHICA }));
  const page = await ctx.newPage();
  const paso = (t) => console.log("  [" + ancho + "px " + modo + "] " + t);

  await page.goto(BASE + "/index.html");
  await pausa(page, 400);
  await page.click(".btn-accion-principal");
  await page.fill("#campo-nombre-lista", "Fotos");
  await page.click('[data-form-lista] button[type="submit"]');
  await pausa(page, 300);
  await page.goto(BASE + "/" + (await page.getAttribute(".fila-tarjeta-enlace", "href")));
  await pausa(page, 400);
  const listaId = new URL(page.url()).searchParams.get("lista");
  const articulos = () => leerBD(page, "listas/" + listaId + "/articulos");
  const porNombre = async (n) => Object.values(await articulos()).find((a) => a.nombre === n);

  // 1. Artículo nuevo: el campo Foto va al final y el selector ofrece las tres formas.
  await page.fill("[data-campo-rapido]", "Aceite de oliva");
  await page.press("[data-campo-rapido]", "Enter");
  await pausa(page);
  assert.deepEqual(await page.$$eval("[data-form-articulo] input, [data-form-articulo] select, [data-form-articulo] textarea, [data-form-articulo] [data-zona-foto]", (c) => c.map((x) => x.id || "zona-foto")),
    ["art-nombre", "art-categoria", "art-unidad", "art-precio", "art-notas", "zona-foto"]);
  await page.click("[data-foto-agregar]");
  await pausa(page);
  assert.match(await page.textContent(".opciones-foto"), /Elegir archivo/);
  assert.match(await page.$$eval(".caja-modal h3", (h) => h[h.length - 1].textContent), /¿Cómo quieres agregar la foto\?/);
  for (const t of ["Elegir archivo", "Pegar del portapapeles", "Desde una URL"]) assert.match(await page.textContent(".fondo-modal:last-child .opciones-foto"), new RegExp(t));
  await page.screenshot({ path: path.join(CAPTURAS, "foto-selector-" + ancho + "-" + modo + ".png") });
  paso("selector con las tres opciones");

  // 2. Archivo grande: se reduce (≤ 1280 px, JPEG), se sube y se ve la miniatura en el formulario.
  await page.setInputFiles("[data-foto-input]", { name: "aceite.png", mimeType: "image/png", buffer: GRANDE });
  await page.waitForSelector("[data-zona-foto] .miniatura-foto img");
  let sub = await subidos(page);
  assert.equal(sub.length, 1);
  assert.match(sub[0], new RegExp("^listas/" + listaId + "/fotos/u1-.*\\.jpg$"));
  const info = await page.evaluate((r) => { const o = window.__mockStorage[r]; return new Promise((ok) => { const i = new Image(); i.onload = () => ok({ tipo: o.tipo, w: i.naturalWidth, h: i.naturalHeight, bytes: o.bytes }); i.src = o.url; }); }, sub[0]);
  assert.equal(info.tipo, "image/jpeg");
  assert.equal(info.w, 1280);
  assert.equal(info.h, 640);
  assert.ok(info.bytes < GRANDE.length, "la reducida pesa menos que el original");
  paso("archivo 2000×1000 → JPEG " + info.w + "×" + info.h + " (" + Math.round(info.bytes / 1024) + " KB)");

  // 3. Cambiar la foto sube otra y borra la anterior (solo la de este formulario); pegar por evento.
  await page.click("[data-foto-cambiar]");
  await pausa(page);
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "pegada.png", { type: "image/png" }));
    document.querySelector(".fondo-modal:last-child").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, CHICA.toString("base64"));
  await page.waitForFunction(() => document.querySelectorAll(".fondo-modal").length === 1);
  sub = await subidos(page);
  assert.equal(sub.length, 1, "la subida anterior del formulario se borró");
  paso("pegar (evento paste) reemplaza la foto y limpia la anterior");

  // 4. Guardar: queda fotoUrl en el artículo y miniatura en la lista.
  await page.selectOption("#art-categoria", "abarrotes");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page, 400);
  const aceite = await porNombre("Aceite de oliva");
  assert.match(aceite.fotoUrl, /^data:image\/jpeg/);
  assert.equal((await subidos(page)).length, 1);
  await page.click('[data-vista="todo"]');
  await pausa(page);
  assert.equal(await page.$$eval(".miniatura-fila img", (i) => i.length), 1);
  await page.screenshot({ path: path.join(CAPTURAS, "foto-lista-" + ancho + "-" + modo + ".png") });
  const fuera = await page.$$eval(".fila-articulo", (f) => f.filter((x) => x.scrollWidth > x.clientWidth + 1).length);
  assert.equal(fuera, 0, "la fila no se desborda");
  // Ver la foto en grande y cerrar.
  await page.click(".miniatura-fila");
  await pausa(page);
  assert.equal(await page.isVisible(".foto-ampliada"), true);
  await page.click(".fondo-modal:last-child [data-cerrar]");
  await pausa(page);
  assert.equal(await page.$$eval(".fondo-modal", (m) => m.length), 0);
  paso("guardar: fotoUrl en el artículo, miniatura en la fila, vista ampliada");

  // 5. Descartar un formulario con una subida nueva: se borra de Storage.
  await page.click('[aria-label="Editar Aceite de oliva"]');
  await pausa(page);
  await page.click("[data-foto-cambiar]");
  await pausa(page);
  await page.setInputFiles("[data-foto-input]", { name: "otra.png", mimeType: "image/png", buffer: OTRA });
  await page.waitForFunction(() => document.querySelectorAll(".fondo-modal").length === 1);
  assert.equal((await subidos(page)).length, 2);
  await page.click("[data-form-articulo] [data-cancelar]");
  await pausa(page);
  await page.click('[data-accion="descartar"]');
  await pausa(page);
  assert.equal((await subidos(page)).length, 1, "lo descartado se borró; la foto guardada se conserva");
  assert.equal((await porNombre("Aceite de oliva")).fotoUrl, aceite.fotoUrl);
  paso("descartar el formulario borra lo subido en él y respeta la foto guardada");

  // 6. Desde una URL: se valida (https y que cargue como imagen), no sube nada.
  await page.click('[aria-label="Editar Aceite de oliva"]');
  await pausa(page);
  await page.click("[data-foto-cambiar]");
  await pausa(page);
  await page.click("[data-foto-url]");
  await page.fill("#foto-url", "http://imagenes.ejemplo.test/a.png");
  await page.click("[data-zona-url] button[type=submit]");
  assert.match(await page.textContent("[data-estado-foto]"), /empiece con https/);
  await page.fill("#foto-url", "https://imagenes.ejemplo.test/no-existe.txt");
  await ctx.route("https://imagenes.ejemplo.test/no-existe.txt", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "hola" }));
  await page.click("[data-zona-url] button[type=submit]");
  await page.waitForFunction(() => /No se pudo cargar/.test(document.querySelector("[data-estado-foto]").textContent));
  await page.fill("#foto-url", "https://imagenes.ejemplo.test/aceite.png");
  await page.click("[data-zona-url] button[type=submit]");
  await page.waitForFunction(() => document.querySelectorAll(".fondo-modal").length === 1);
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page, 400);
  assert.equal((await porNombre("Aceite de oliva")).fotoUrl, "https://imagenes.ejemplo.test/aceite.png");
  assert.equal((await subidos(page)).length, 1, "la URL no sube nada; lo guardado antes no se borra (Deshacer/duplicar)");
  paso("URL: http y no-imagen se rechazan; una https válida se guarda tal cual");

  // 7. Portapapeles con la API (permiso concedido) en un artículo nuevo.
  await page.fill("[data-campo-rapido]", "Café");
  await page.press("[data-campo-rapido]", "Enter");
  await pausa(page);
  await page.click("[data-foto-agregar]");
  await pausa(page);
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })]);
  }, CHICA.toString("base64"));
  await page.click("[data-foto-pegar]");
  await page.waitForFunction(() => document.querySelectorAll(".fondo-modal").length === 1, null, { timeout: 5000 }).catch(() => {});
  const conApi = await page.isVisible("[data-zona-foto] .miniatura-foto");
  if (!conApi) {
    // Sin permiso/soporte el selector muestra el campo para pegar a mano: eso también es válido.
    assert.equal(await page.isVisible("[data-zona-pegar]"), true, "sin API de portapapeles debe ofrecer el campo para pegar");
  }
  paso("portapapeles: " + (conApi ? "API del navegador" : "alternativa del campo de pegado"));
  // Quitar la foto en el formulario y guardar: el artículo queda sin foto.
  if (conApi) {
    await page.click("[data-foto-quitar]");
    assert.equal(await page.isVisible("[data-foto-agregar]"), true);
  } else {
    await page.click("[data-foto-pegar] ~ * [data-cerrar], .fondo-modal:last-child [data-cerrar]");
  }
  await page.selectOption("#art-categoria", "abarrotes");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page, 400);
  assert.equal((await porNombre("Café")).fotoUrl, undefined);

  // 8. Quitar la foto de un artículo guardado borra el campo.
  await page.click('[aria-label="Editar Aceite de oliva"]');
  await pausa(page);
  await page.click("[data-foto-quitar]");
  await page.click('[data-form-articulo] button[type="submit"]');
  await pausa(page, 400);
  assert.equal((await porNombre("Aceite de oliva")).fotoUrl, undefined);
  assert.equal(await page.$$eval(".miniatura-fila", (m) => m.length), 0);
  paso("quitar la foto borra el campo y la miniatura");

  // 9. Si Storage falla (no activado / sin permiso) se avisa en el selector y no se pierde nada.
  await page.evaluate(() => { window.__mockStorageFalla = true; });
  await page.click('[aria-label="Editar Café"]');
  await pausa(page);
  await page.click("[data-foto-agregar]");
  await pausa(page);
  await page.setInputFiles("[data-foto-input]", { name: "x.png", mimeType: "image/png", buffer: CHICA });
  await page.waitForFunction(() => /No tienes permiso/.test(document.querySelector("[data-estado-foto]").textContent));
  assert.equal(await page.isDisabled("[data-foto-archivo]"), false, "los botones se reactivan para reintentar");
  paso("error de Storage: aviso claro y se puede reintentar");

  assert.deepEqual(errores, []);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  let fallo = null;
  try {
    for (const [ancho, modo] of [[390, "claro"], [320, "oscuro"], [1280, "claro"]]) {
      console.log("Fotos " + ancho + " px, modo " + modo);
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
  console.log("Fotos: todo pasó. Capturas en " + CAPTURAS);
})();
