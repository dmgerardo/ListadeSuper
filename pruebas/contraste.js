// Contraste WCAG 2.x de los tokens de css/estilos.css, en modo claro y oscuro.
// Uso: node pruebas/contraste.js   → imprime la tabla, escribe pruebas/contraste-resultados.md
// y termina con código 1 si alguna pareja no cumple su umbral.
// Lee los valores directamente del CSS (no hay copia de los colores aquí), así que cambiar un
// token y no correr este script deja la tabla desactualizada: correrlo en cada cambio visual.
// También falla si aparece un color hex fuera de los bloques de tokens.
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(RAIZ, "css", "estilos.css"), "utf8");

// ===== Lectura de tokens =====
function bloque(selector) {
  const i = css.indexOf(selector + " {");
  if (i === -1) throw new Error("No se encontró el bloque " + selector);
  const ini = css.indexOf("{", i) + 1;
  const fin = css.indexOf("\n}", ini);
  return { texto: css.slice(ini, fin), ini, fin };
}
function tokensDe(texto) {
  const t = {};
  for (const m of texto.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/--([\w-]+):\s*([^;]+);/g)) t[m[1]] = m[2].trim();
  return t;
}
const bClaro = bloque(":root");
const bOscuro = bloque(':root[data-modo="oscuro"]');
const claro = tokensDe(bClaro.texto);
const oscuro = Object.assign({}, claro, tokensDe(bOscuro.texto)); // oscuro hereda lo no redefinido

// ===== Color =====
function parsear(valor, tokens, prof = 0) {
  if (prof > 10) throw new Error("var() circular: " + valor);
  valor = valor.trim();
  const v = /^var\(--([\w-]+)\)$/.exec(valor);
  if (v) {
    if (!(v[1] in tokens)) throw new Error("token inexistente: --" + v[1]);
    return parsear(tokens[v[1]], tokens, prof + 1);
  }
  let m = /^#([0-9a-f]{6})$/i.exec(valor);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = /^#([0-9a-f]{3})$/i.exec(valor);
  if (m) return parsear("#" + m[1].split("").map((c) => c + c).join(""), tokens);
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(valor);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error("color no reconocido: " + valor);
}
// Un color translúcido se evalúa compuesto sobre lo que tiene debajo.
function sobre(c, base) {
  if (c.a >= 1) return c;
  return { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 };
}
function luminancia(c) {
  const f = (x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const hex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase();

// ===== Parejas a verificar =====
// [texto, fondo, umbral, uso, base opcional para el fondo translúcido]
const TEXTO = 4.5, UI = 3;
const PAREJAS = [
  ["color-texto", "color-fondo", TEXTO, "Texto sobre el fondo de página"],
  ["color-texto", "color-superficie", TEXTO, "Texto en tarjetas, chips y filas"],
  ["color-texto-suave", "color-fondo", TEXTO, "Subtítulos sobre el fondo"],
  ["color-texto-suave", "color-superficie", TEXTO, "Detalle de artículo y lo marcado (Toda la lista)"],
  ["color-texto-suave", "color-segmento", TEXTO, "Pestaña inactiva del selector de vista"],
  ["color-texto", "color-segmento", TEXTO, "Contador y <code> sobre el riel gris"],
  ["color-primario-oscuro", "color-fondo", TEXTO, "Enlaces y acciones de texto sobre el fondo"],
  ["color-primario-oscuro", "color-superficie", TEXTO, "Acciones de texto en tarjetas"],
  ["color-primario-oscuro", "color-tinte-primario", TEXTO, "Pestaña activa de la barra / ícono del estado vacío"],
  ["color-texto-sobre-primario", "color-primario", TEXTO, "Botón primario, tarjeta de resumen, contador verde"],
  ["color-texto-sobre-peligro", "color-peligro", TEXTO, "Botón 'Cerrar sesión'"],
  ["color-peligro", "color-fondo", TEXTO, "Mensaje de error del formulario (fondo del modal)"],
  ["color-peligro", "color-superficie", UI, "Ícono de eliminar y punto 'Sin conexión'"],
  ["color-toast-texto", "color-toast-fondo", TEXTO, "Texto del toast"],
  ["color-toast-accion", "color-toast-fondo", TEXTO, "Acción 'Deshacer' del toast"],
  ["google-texto", "google-fondo", TEXTO, "Botón 'Continuar con Google'"],
  ["color-texto-suave", "color-barra", TEXTO, "Íconos y 'vN' de la barra (sobre fondo de página)", "color-fondo"],
  ["color-texto-suave", "color-barra", TEXTO, "Íconos y 'vN' de la barra (sobre texto oscuro debajo, peor caso)", "color-texto"],
  ["color-primario-oscuro", "color-tinte-primario", TEXTO, "Etiqueta de la pestaña activa (tinte opaco sobre la barra)"],
  ["color-primario", "color-superficie", UI, "Casilla marcada, borde del campo con foco (componente)"],
  ["color-primario", "color-fondo", UI, "Botón primario / tarjeta de resumen contra el fondo de página"],
  ["color-primario", "color-barra", UI, "Punto 'En línea' en la barra", "color-fondo"],
  ["color-texto-suave", "color-superficie", UI, "Borde de la casilla sin marcar (componente)"],
  ["color-primario-oscuro", "color-superficie", UI, "Anillo de foco (componente)"],
];
const PASILLOS = [...css.matchAll(/--pasillo-([\w]+)-tinte:/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i);
for (const p of PASILLOS) {
  // ≥ 4.5 y no 3: la tinta también se usa para el NÚMERO de pendientes del índice (texto).
  PAREJAS.push(["pasillo-" + p + "-tinta", "pasillo-" + p + "-tinte", TEXTO, "Pasillo " + p + ": ícono y número sobre su tinte"]);
}

// ===== Cálculo =====
const filas = [];
let fallas = 0;
for (const [modoNombre, tokens] of [["claro", claro], ["oscuro", oscuro]]) {
  for (const [fg, bg, umbral, uso, base] of PAREJAS) {
    const cBase = base ? parsear("var(--" + base + ")", tokens) : null;
    const cBg = cBase ? sobre(parsear("var(--" + bg + ")", tokens), cBase) : parsear("var(--" + bg + ")", tokens);
    const cFg = sobre(parsear("var(--" + fg + ")", tokens), cBg);
    const r = contraste(cFg, cBg);
    const ok = r >= umbral;
    if (!ok) fallas++;
    filas.push({ modo: modoNombre, fg, bg: bg + (base ? " sobre " + base : ""), hexFg: hex(cFg), hexBg: hex(cBg), r, umbral, ok, uso });
  }
}

// ===== Hex fuera de los bloques de tokens =====
const fueraDeTokens = [];
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
for (const m of sinComentarios.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
  const dentro = (m.index > bClaro.ini && m.index < bClaro.fin) || (m.index > bOscuro.ini && m.index < bOscuro.fin);
  if (!dentro) fueraDeTokens.push(m[0] + " (línea " + css.slice(0, m.index).split("\n").length + ")");
}

// ===== Salida =====
const lineas = [
  "# Contraste de tokens (WCAG 2.x)",
  "",
  "Generado por `node pruebas/contraste.js` a partir de `css/estilos.css`. No editar a mano.",
  "Umbral: **4.5:1** texto normal, **3:1** íconos/componentes. Los fondos translúcidos se",
  "evalúan compuestos sobre la base indicada.",
  "",
  "| Modo | Texto | Fondo | Colores | Contraste | Umbral | Resultado | Uso |",
  "|---|---|---|---|---|---|---|---|",
  ...filas.map((f) => `| ${f.modo} | \`--${f.fg}\` | \`--${f.bg.replace(" sobre ", "` sobre `--")}\` | ${f.hexFg} / ${f.hexBg} | ${f.r.toFixed(2)}:1 | ${f.umbral}:1 | ${f.ok ? "OK" : "**FALLA**"} | ${f.uso} |`),
  "",
  fueraDeTokens.length ? "**Hex fuera de los bloques de tokens:** " + fueraDeTokens.join(", ") : "Hex fuera de los bloques de tokens: ninguno.",
  "",
];
fs.writeFileSync(path.join(__dirname, "contraste-resultados.md"), lineas.join("\n"));
for (const f of filas) {
  console.log(`${f.ok ? "OK   " : "FALLA"} ${f.modo.padEnd(6)} ${f.r.toFixed(2).padStart(5)}:1 (≥${f.umbral})  ${f.hexFg}/${f.hexBg}  ${f.uso}`);
}
if (fueraDeTokens.length) console.log("Hex fuera de tokens:", fueraDeTokens.join(", "));
console.log(`${filas.length} parejas, ${fallas} fallas. Resultados en pruebas/contraste-resultados.md`);
process.exit(fallas || fueraDeTokens.length ? 1 : 0);
