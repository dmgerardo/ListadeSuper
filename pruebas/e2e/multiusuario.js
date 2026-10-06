// Roles, administración de usuarios, invitaciones y coordinación en vivo, en el navegador
// con la CSP real y Firebase simulado (mock-firebase.js). Lo que "hace otra persona" se
// simula escribiendo en la base con window.__mockBD.escribirComoOtro (como llegaría desde
// otro teléfono). Las REGLAS se prueban aparte con el emulador (pruebas/reglas).
// Uso: python3 pruebas/e2e/servidor.py &   y luego   node pruebas/e2e/multiusuario.js
const fs = require("fs");
const path = require("path");
let playwright;
try {
  playwright = require("playwright");
} catch (e) {
  playwright = require("/opt/node22/lib/node_modules/playwright");
}
const assert = require("assert/strict");

const BASE = process.env.BASE || "http://127.0.0.1:8767";
const CAPTURAS = process.env.CAPTURAS || path.join(__dirname, "capturas");
const mock = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
fs.mkdirSync(CAPTURAS, { recursive: true });

const RAIZ = { uid: "u1", displayName: "Gerardo Prueba", email: "dmgerardo@gmail.com", emailVerified: true, photoURL: "" };
const ANA = { uid: "u2", displayName: "Ana López", email: "ana@ejemplo.com", emailVerified: true, photoURL: "" };
const LUIS = { uid: "u3", displayName: "Luis Pérez", email: "luis@ejemplo.com", emailVerified: true, photoURL: "" };
const EVE = { uid: "u9", displayName: "Eve Invitada", email: "eve@ejemplo.com", emailVerified: true, photoURL: "" };

const pausa = (page, ms) => page.waitForTimeout(ms || 300);
const leerBD = (page, ruta) => page.evaluate((r) => window.__mockBD.leer(r), ruta);
const ultimoToast = (page) => page.$$eval(".toast span", (t) => (t.length ? t[t.length - 1].textContent : null));
const comoUsuario = (page, u) => page.evaluate((x) => sessionStorage.setItem("__usuarioMock", JSON.stringify(x)), u);
const escribirComoOtro = (page, cambios) => page.evaluate((c) => window.__mockBD.escribirComoOtro(c), cambios);

async function contexto(browser, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", hasTouch: viewport.width < 600 });
  const errores = [];
  ctx.on("weberror", (e) => errores.push("error de página: " + e.error().message));
  ctx.on("console", (m) => { if (m.type() === "error") errores.push("consola: " + m.text()); });
  await ctx.addInitScript((u) => { window.__USUARIO_MOCK = u; }, RAIZ);
  await ctx.route(/gstatic\.com\/firebasejs\//, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/gstatic\.com\/firebasejs\/.*app-compat/, (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
  return { ctx, errores, page: await ctx.newPage() };
}

async function roles(browser) {
  const { ctx, errores, page } = await contexto(browser, { width: 390, height: 860 });
  // 1. Invitado nuevo: se da de alta como invitado; ve el aviso y no tiene "+".
  await page.goto(BASE + "/index.html");
  await comoUsuario(page, EVE);
  await page.reload();
  await pausa(page, 500);
  assert.deepEqual(await leerBD(page, "roles/u9"), { rol: "invitado", activo: true }, "alta como invitado activo");
  assert.match(await page.textContent("[data-avisos-rol]"), /Tu cuenta espera autorización/);
  assert.equal(await page.$(".btn-accion-principal"), null, "invitado: sin botón Nueva lista");
  assert.match(await page.textContent("[data-lista-de-listas]"), /Cuando alguien te invite/);
  await page.screenshot({ path: path.join(CAPTURAS, "invitado-390.png") });
  // 2. El administrador lo autoriza: el "+" aparece sin recargar.
  await escribirComoOtro(page, { "roles/u9/rol": "participante" });
  await pausa(page);
  assert.ok(await page.$(".btn-accion-principal"), "autorizado: aparece Nueva lista en vivo");
  assert.equal((await page.textContent("[data-avisos-rol]")).trim(), "");
  // 3. Desactivado: se le explica, sin listas.
  await escribirComoOtro(page, { "roles/u9/activo": false });
  await pausa(page);
  assert.match(await page.textContent("#app"), /Tu cuenta está desactivada/);
  // 4. Un no-administrador no entra a Usuarios.
  await page.goto(BASE + "/usuarios.html");
  await pausa(page, 500);
  assert.match(await page.textContent("#app"), /solo para administradores|desactivada/);
  console.log("  [roles] invitado sin '+', autorización y desactivación en vivo, Usuarios solo admin");

  // 5. Administrador (raíz): Usuarios lista a todos, pendientes primero; cambia rol y activo.
  await comoUsuario(page, RAIZ);
  await escribirComoOtro(page, {
    "usuarios/u9": { nombre: "Eve Invitada", email: "eve@ejemplo.com", foto: "" },
    "usuarios/u3": { nombre: "Luis Pérez", email: "luis@ejemplo.com", foto: "" },
    "roles/u9": { rol: "invitado", activo: true },
    "roles/u3": { rol: "participante", activo: true },
  });
  await page.goto(BASE + "/index.html");
  await pausa(page, 500);
  assert.match(await page.textContent("[data-avisos-rol]"), /1 persona espera/, "aviso al admin de pendientes");
  await page.click('[aria-label="Mi cuenta"]');
  await pausa(page);
  assert.ok(await page.$('.caja-modal a[href="usuarios.html"]'), "Mi cuenta → Administrar usuarios");
  assert.match(await page.textContent(".caja-modal .pildora-rol"), /Administrador \(raíz\)/);
  await page.goto(BASE + "/usuarios.html");
  await pausa(page, 500);
  const filas = await page.$$eval(".fila-usuario .nombre-lista", (n) => n.map((x) => x.textContent));
  assert.equal(filas[0], "Eve Invitada", "el pendiente va primero");
  assert.equal(await page.$('[aria-label="Rol de Gerardo Prueba"]'), null, "mi fila no se edita");
  await page.screenshot({ path: path.join(CAPTURAS, "usuarios-390.png") });
  await page.selectOption('[aria-label="Rol de Eve Invitada"]', "participante");
  await pausa(page);
  const eve = await leerBD(page, "roles/u9");
  assert.deepEqual([eve.rol, eve.activo, eve.actualizadoPor], ["participante", true, "u1"]);
  await page.uncheck('[aria-label="Cuenta activa: Luis Pérez"]');
  await pausa(page);
  assert.equal((await leerBD(page, "roles/u3")).activo, false);
  assert.match(await ultimoToast(page), /Luis Pérez desactivada/);
  console.log("  [usuarios] pendientes primero, cambiar rol y desactivar, sin editar la propia fila");
  assert.deepEqual(errores, []);
  await ctx.close();
}

async function invitacionYCoordinacion(browser, viewport, etiqueta) {
  const { ctx, errores, page } = await contexto(browser, viewport);
  const paso = (t) => console.log("  [" + etiqueta + "] " + t);
  // Lista del administrador con dos artículos.
  await page.goto(BASE + "/index.html");
  await pausa(page, 400);
  await page.click(".btn-accion-principal");
  await page.fill("#campo-nombre-lista", "Súper");
  await page.click('[data-form-lista] button[type="submit"]');
  await pausa(page);
  const enlace = await page.getAttribute(".fila-tarjeta-enlace", "href");
  const listaId = new URL(BASE + "/" + enlace).searchParams.get("lista");
  await page.goto(BASE + "/" + enlace);
  await pausa(page, 500);
  for (const n of ["Leche", "Pan", "Huevo", "Café"]) {
    await page.fill("[data-campo-rapido]", n);
    await page.press("[data-campo-rapido]", "Enter");
    await pausa(page, 150);
  }
  const articulos = await leerBD(page, "listas/" + listaId + "/articulos");
  const idDe = (n) => Object.keys(articulos).find((k) => articulos[k].nombre === n);

  // Miembros: crear liga de invitación.
  await page.click("[data-abrir-miembros]");
  await pausa(page);
  assert.match(await page.textContent("[data-lista-miembros]"), /Gerardo Prueba \(tú\)/);
  assert.match(await page.textContent("[data-lista-miembros]"), /Dueño/);
  await page.click("[data-crear-liga]");
  await pausa(page);
  const liga = await page.inputValue("[data-liga]");
  const codigo = new URL(liga).searchParams.get("codigo");
  assert.match(liga, /\/unirse\.html\?codigo=[A-Za-z0-9_-]{22}$/, "liga con código de 128 bits");
  const inv = await leerBD(page, "invitaciones/" + codigo);
  assert.equal(inv.listaId, listaId);
  const dias = (inv.expira - Date.now()) / 86400000;
  assert.ok(dias > 6.9 && dias <= 7, "vence en ~7 días: " + dias);
  await page.screenshot({ path: path.join(CAPTURAS, "miembros-" + etiqueta + ".png") });
  await page.click(".caja-modal [data-cerrar]");
  paso("liga de invitación creada (un solo uso, 7 días)");

  // Ana abre la liga, ve la invitación y se une.
  await comoUsuario(page, ANA);
  await page.goto(liga);
  await pausa(page, 500);
  assert.match(await page.textContent("#app"), /Gerardo Prueba te invitó a “Súper”/);
  await page.click("[data-unirme]");
  await page.waitForURL(/lista\.html/);
  await pausa(page, 500);
  assert.equal((await leerBD(page, "listas/" + listaId + "/miembros/u2")).rol, "editor");
  assert.equal(await leerBD(page, "invitaciones/" + codigo + "/usadaPor"), "u2");
  assert.equal(await leerBD(page, "listasDeUsuario/u2/" + listaId), true);
  assert.equal(await page.textContent("[data-nombre-lista]"), "Súper");
  // La misma liga otra vez: "ya estás"; para Luis: "ya se usó".
  await page.goto(liga);
  await pausa(page, 500);
  assert.match(await page.textContent("#app"), /Ya estás en “Súper”/);
  await comoUsuario(page, LUIS);
  await page.reload();
  await pausa(page, 500);
  assert.match(await page.textContent("#app"), /ya se usó/);
  paso("Ana se une con la liga; reusarla: 'ya estás' / 'ya se usó'");

  // De vuelta como el dueño: Ana en la lista ahora (presencia) y su marca en vivo.
  await comoUsuario(page, RAIZ);
  await page.goto(BASE + "/" + enlace);
  await pausa(page, 500);
  await escribirComoOtro(page, { ["listas/" + listaId + "/presencia/u2"]: { nombre: "Ana López", visto: Date.now() } });
  await pausa(page);
  assert.match(await page.textContent("[data-fila-miembros]"), /Ana está en la lista ahora/);
  const evento = (art, id, accion) => ({ uid: "u2", nombre: "Ana", accion, articuloId: id, articulo: art, ts: Date.now() });
  await escribirComoOtro(page, {
    ["listas/" + listaId + "/articulos/" + idDe("Leche") + "/comprado"]: true,
    ["listas/" + listaId + "/articulos/" + idDe("Leche") + "/compradoPor"]: "u2",
    ["listas/" + listaId + "/actividad/-ana1"]: evento("Leche", idDe("Leche"), "marco"),
  });
  await pausa(page);
  assert.equal(await ultimoToast(page), "Ana marcó Leche", "aviso en vivo de lo que marca otra persona");
  assert.ok(!(await page.$$eval(".nombre-articulo", (n) => n.map((x) => x.textContent))).includes("Leche"), "sale de Por comprar");
  // Varias a la vez (p. ej. 'marcar todo' de Ana): un solo aviso.
  const marcas = {};
  ["Pan", "Huevo"].forEach((n, i) => {
    marcas["listas/" + listaId + "/articulos/" + idDe(n) + "/comprado"] = true;
    marcas["listas/" + listaId + "/actividad/-ana2" + i] = evento(n, idDe(n), "marco");
  });
  await escribirComoOtro(page, marcas);
  await pausa(page);
  assert.equal(await ultimoToast(page), "Ana marcó 2 artículos");
  // En "Toda la lista": "por Ana" en lo que ella marcó.
  await page.click('[data-vista="todo"]');
  await pausa(page);
  assert.match(await page.textContent('.fila-articulo:has([aria-label="Cantidad de Leche"]) .por-quien'), /por Ana/);
  // Mi marca queda en el registro, con mi uid, en la misma escritura.
  const antes = await page.evaluate(() => window.__mockBD.escrituras.length);
  await page.click('[aria-label="Marcar Café como comprado"]');
  await pausa(page);
  const esc = await page.evaluate((n) => window.__mockBD.escrituras.slice(n), antes);
  assert.equal(esc.length, 1, "marcar + registrar = UNA escritura");
  const act = await leerBD(page, "listas/" + listaId + "/actividad");
  const mio = Object.values(act).find((e) => e.uid === "u1" && e.articulo === "Café");
  assert.ok(mio && mio.accion === "marco" && typeof mio.ts === "number", "evento propio registrado");
  // Hoja de actividad.
  await page.click("[data-accion=actividad]");
  await pausa(page);
  const textoActividad = await page.textContent("[data-actividad]");
  assert.match(textoActividad, /Tú marcaste Café/);
  assert.match(textoActividad, /Ana marcó Leche/);
  await page.screenshot({ path: path.join(CAPTURAS, "actividad-" + etiqueta + ".png") });
  await page.keyboard.press("Escape");
  paso("presencia, aviso 'Ana marcó Leche', aviso agrupado, 'por Ana', registro en la misma escritura");

  // (+) usa transacción.
  const antesT = await page.evaluate(() => window.__mockBD.escrituras.length);
  await page.click('[aria-label="Agregar 1 pza a Leche"]');
  await pausa(page);
  const escT = await page.evaluate((n) => window.__mockBD.escrituras.slice(n), antesT);
  assert.ok(escT.some((e) => e.tipo === "transaction" && /cantidad$/.test(e.ruta)), "cantidad por transacción");

  // Limpieza: un evento de hace 25 h se borra al abrir la lista; los recientes se quedan.
  await escribirComoOtro(page, { ["listas/" + listaId + "/actividad/-viejo"]: evento("Viejo", idDe("Pan"), "marco") });
  await escribirComoOtro(page, { ["listas/" + listaId + "/actividad/-viejo/ts"]: Date.now() - 25 * 3600 * 1000 });
  await page.reload();
  await pausa(page, 600);
  const act2 = await leerBD(page, "listas/" + listaId + "/actividad");
  assert.equal(act2["-viejo"], undefined, "lo de más de 24 h se borra");
  assert.ok(act2["-ana1"], "lo reciente se queda");
  paso("cantidad por transacción; limpieza de actividad > 24 h");

  // El dueño quita a Ana: se va de miembros y de su índice.
  await page.click("[data-abrir-miembros]");
  await pausa(page);
  await page.click('[aria-label="Quitar a Ana López"]');
  await pausa(page);
  assert.equal(await leerBD(page, "listas/" + listaId + "/miembros/u2"), null);
  assert.equal(await leerBD(page, "listasDeUsuario/u2/" + listaId), null);
  await page.keyboard.press("Escape");
  paso("el dueño quita a un miembro (y su índice)");

  // Un miembro se sale solo (Luis entra con otra liga y sale).
  await page.click("[data-abrir-miembros]");
  await page.click("[data-crear-liga]");
  await pausa(page);
  const liga2 = await page.inputValue("[data-liga]");
  await comoUsuario(page, LUIS);
  await escribirComoOtro(page, { "roles/u3": { rol: "invitado", activo: true } });
  await page.goto(liga2);
  await pausa(page, 500);
  await page.click("[data-unirme]");
  await page.waitForURL(/lista\.html/);
  await pausa(page, 500);
  await page.click("[data-abrir-miembros]");
  await pausa(page);
  assert.equal(await page.$('[aria-label="Quitar a Gerardo Prueba"]'), null, "un editor no ve 'quitar' en el dueño");
  await page.click("[data-salir-lista]");
  await page.waitForURL(/index\.html/);
  assert.equal(await leerBD(page, "listas/" + listaId + "/miembros/u3"), null);
  paso("un invitado (sin autorizar) se une con liga, y sale de la lista");

  // El dueño elimina la lista (con confirmación): desaparece para todos.
  await comoUsuario(page, RAIZ);
  await page.goto(BASE + "/index.html");
  await pausa(page, 500);
  await page.click('[aria-label="Renombrar o eliminar lista"]');
  await page.click("[data-eliminar-lista]");
  await page.click("[data-confirmar]");
  await pausa(page);
  assert.equal(await leerBD(page, "listas/" + listaId), null);
  assert.equal(await leerBD(page, "listasDeUsuario/u1/" + listaId), null);
  paso("el dueño elimina la lista");

  const desborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(desborde, false);
  assert.deepEqual(errores, [], "sin errores de página ni violaciones de CSP");
  await ctx.close();
}

(async () => {
  const browser = await playwright.chromium.launch();
  let fallo = null;
  try {
    console.log("Roles y administración");
    await roles(browser);
    for (const [w, et] of [[390, "390"], [320, "320"], [1280, "1280"]]) {
      console.log("Invitación y coordinación " + et + " px");
      await invitacionYCoordinacion(browser, { width: w, height: 860 }, et);
    }
  } catch (e) {
    fallo = e;
  }
  await browser.close();
  if (fallo) {
    console.error("FALLÓ:", fallo.message);
    process.exit(1);
  }
  console.log("Todas las pruebas multiusuario pasaron. Capturas en " + CAPTURAS);
})();
