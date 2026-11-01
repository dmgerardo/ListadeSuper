// Lógica pura de artículos (sin DOM ni Firebase): normalizar nombres, interpretar el campo
// de agregado rápido, agrupar por pasillo, totales e importar una nota de texto. Vive aparte
// para poder probarla en Node (pruebas/logica.test.js). Usa las constantes de
// catalogo-categorias.js, que se carga antes.

// normalizarNombre(texto): minúsculas, sin acentos y con espacios colapsados. Es la llave
// para comparar artículos ("Plátanos" === "platanos") y para el filtro de búsqueda.
function normalizarNombre(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Formas escritas de cada unidad (ya normalizadas) que reconoce el agregado rápido.
var _ALIAS_UNIDADES = {
  pieza: "pieza", piezas: "pieza", pz: "pieza", pza: "pieza", pzas: "pieza",
  kg: "kg", kilo: "kg", kilos: "kg", kgs: "kg",
  g: "g", gr: "g", grs: "g", gramo: "g", gramos: "g",
  l: "l", lt: "l", lts: "l", litro: "l", litros: "l",
  ml: "ml",
  paquete: "paquete", paquetes: "paquete", paq: "paquete",
  caja: "caja", cajas: "caja",
  bolsa: "bolsa", bolsas: "bolsa",
  lata: "lata", latas: "lata",
  botella: "botella", botellas: "botella",
  docena: "docena", docenas: "docena"
};

var LARGO_MAX_NOMBRE = 120; // el mismo límite que valida database.rules.json

function _numeroDesdeTexto(texto) {
  var fraccion = /^(\d+)\/(\d+)$/.exec(texto);
  if (fraccion) return Number(fraccion[2]) ? Number(fraccion[1]) / Number(fraccion[2]) : NaN;
  return Number(texto.replace(",", "."));
}

// interpretarTextoRapido("2 kg tomate") → { nombre: "tomate", cantidad: 2, unidad: "kg" }.
// Solo interpreta si el texto EMPIEZA con un número seguido de espacio ("7up" es un nombre);
// la unidad es opcional ("3 limones" = 3 piezas). Sin número: 1 pieza, todo es el nombre.
function interpretarTextoRapido(texto) {
  var limpio = String(texto || "").replace(/\s+/g, " ").trim();
  var resultado = { nombre: limpio, cantidad: 1, unidad: "pieza" };
  var m = /^(\d+(?:[.,]\d+)?|\d+\/\d+)\s+(.+)$/.exec(limpio);
  if (!m) return resultado;
  var cantidad = _numeroDesdeTexto(m[1]);
  if (!(cantidad > 0) || cantidad > 9999) return resultado;
  var resto = m[2];
  var palabras = resto.split(" ");
  var unidad = _ALIAS_UNIDADES[normalizarNombre(palabras[0]).replace(/\.$/, "")];
  if (unidad && palabras.length > 1) {
    // "1 kg de tomate" → "tomate"
    resto = palabras.slice(normalizarNombre(palabras[1]) === "de" && palabras.length > 2 ? 2 : 1).join(" ");
  } else {
    unidad = "pieza";
  }
  return { nombre: resto, cantidad: cantidad, unidad: unidad };
}

// categoriasEfectivas(guardadas) → { id: nombre }: los pasillos de UNA lista. `guardadas` es
// info.categorias ({ id: { nombre } }), que solo existe si la lista ya personalizó sus
// pasillos (renombrar/crear/eliminar). Sin él, rigen los 14 por defecto, así las listas
// anteriores no necesitan migración. Una vez personalizada, ese nodo ES el conjunto completo
// (al primer cambio se escriben todos). "Especiales" es el cajón y nunca falta.
function categoriasEfectivas(guardadas) {
  var mapa = {};
  if (guardadas && typeof guardadas === "object") {
    Object.keys(guardadas).forEach(function (id) {
      var nombre = guardadas[id] && typeof guardadas[id].nombre === "string" ? guardadas[id].nombre.trim() : "";
      if (nombre && /^[a-z0-9_]{1,40}$/.test(id)) mapa[id] = nombre.slice(0, LARGO_MAX_CATEGORIA);
    });
  }
  if (!Object.keys(mapa).length) return Object.assign({}, CATEGORIAS_NOMBRES);
  if (!mapa[CATEGORIA_DEFECTO]) mapa[CATEGORIA_DEFECTO] = CATEGORIAS_NOMBRES[CATEGORIA_DEFECTO];
  return mapa;
}

var LARGO_MAX_CATEGORIA = 40; // el mismo límite que valida database.rules.json

// categoriaValida(id, categorias): el id si existe entre los pasillos de la lista; si no (dato
// viejo, o un pasillo que otro miembro acaba de eliminar), "Especiales", para que ningún
// artículo quede fuera de la vista. `categorias` omitido = los 14 por defecto.
function categoriaValida(id, categorias) {
  var conocidas = categorias || CATEGORIAS_NOMBRES;
  return Object.prototype.hasOwnProperty.call(conocidas, id) ? id : CATEGORIA_DEFECTO;
}

// ordenCategoriasEfectivo(ordenGuardado, categorias): el orden de los pasillos de la lista:
// ALFABÉTICO por nombre (pedido del usuario, 2026-10-06; sin acentos ni mayúsculas, "ñ" tras
// "n"), el mismo en las secciones, el índice, la hoja "Pasillos", los desplegables y la vista
// previa de importar. `ordenGuardado` (info.ordenCategorias, el orden manual de antes) ya no
// se usa: se conserva el parámetro para no tocar a los llamadores y por si algún día se
// reordenan a mano. Renombrar un pasillo lo mueve de lugar. `categorias` omitido = los 14.
function ordenCategoriasEfectivo(ordenGuardado, categorias) {
  var conocidas = categorias || CATEGORIAS_NOMBRES;
  return Object.keys(conocidas).sort(function (a, b) {
    return _COLADOR_NOMBRES.compare(conocidas[a], conocidas[b]) || (a < b ? -1 : a > b ? 1 : 0);
  });
}

// validarNombreCategoria(texto, categorias, idActual) → { ok, nombre, error }. Nombre de 1 a
// 40 caracteres, sin repetir (sin acentos ni mayúsculas) el de OTRO pasillo de la lista: dos
// pasillos con el mismo nombre confundirían al importar una nota, que los reconoce por nombre.
function validarNombreCategoria(texto, categorias, idActual) {
  var nombre = String(texto || "").replace(/\s+/g, " ").trim();
  if (!nombre) return { ok: false, nombre: nombre, error: "Escribe un nombre para el pasillo." };
  if (nombre.length > LARGO_MAX_CATEGORIA) return { ok: false, nombre: nombre, error: "El nombre admite hasta " + LARGO_MAX_CATEGORIA + " caracteres." };
  var n = normalizarNombre(nombre);
  var conocidas = categorias || CATEGORIAS_NOMBRES;
  for (var id in conocidas) {
    if (id !== idActual && normalizarNombre(conocidas[id]) === n) {
      return { ok: false, nombre: nombre, error: "Ya existe un pasillo llamado " + conocidas[id] + "." };
    }
  }
  return { ok: true, nombre: nombre, error: "" };
}

// idNuevaCategoria(categorias) → id para un pasillo creado por el usuario. Solo [a-z0-9_] (es
// la llave en la base, el id del ancla "#p-…" y la clase CSS) y distinto de los existentes.
function idNuevaCategoria(categorias) {
  var id;
  do {
    id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  } while (categorias && Object.prototype.hasOwnProperty.call(categorias, id));
  return id;
}

// contarPorCategoria(articulos, categorias) → { id: cuántos }. Cuenta con categoriaValida:
// un artículo cuyo pasillo ya no existe cuenta en "Especiales", que es donde se ve. Con esto
// la interfaz decide si un pasillo está vacío (única condición para poder eliminarlo).
function contarPorCategoria(articulos, categorias) {
  var conteo = {};
  Object.keys(articulos || {}).forEach(function (id) {
    var a = articulos[id];
    if (!a || typeof a !== "object" || !a.nombre) return;
    var cat = categoriaValida(a.categoria, categorias);
    conteo[cat] = (conteo[cat] || 0) + 1;
  });
  return conteo;
}

// escrituraCategorias(info, nuevas, nuevoOrden) → { ruta: valor } RELATIVAS a listas/{id}/info,
// para una sola escritura multi-ruta. Compara contra lo que la lista tiene hoy: escribe solo
// los pasillos nuevos o renombrados y borra (null) los eliminados; si la lista aún no había
// personalizado nada, escribe todos (así `categorias` pasa a ser el conjunto completo).
function escrituraCategorias(info, nuevas, nuevoOrden) {
  info = info || {};
  var guardadas = info.categorias && typeof info.categorias === "object" ? info.categorias : null;
  var actuales = categoriasEfectivas(guardadas);
  var cambios = {};
  Object.keys(nuevas).forEach(function (id) {
    if (!guardadas || actuales[id] !== nuevas[id]) cambios["categorias/" + id + "/nombre"] = nuevas[id];
  });
  if (guardadas) {
    Object.keys(guardadas).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(nuevas, id)) cambios["categorias/" + id] = null;
    });
  }
  cambios.ordenCategorias = ordenCategoriasEfectivo(nuevoOrden, nuevas);
  return cambios;
}

// Orden alfabético en español: sin distinguir acentos ni mayúsculas, "ñ" después de "n" y
// números por su valor ("Pan 2" antes que "Pan 10").
var _COLADOR_NOMBRES = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function compararPorNombre(a, b) {
  return _COLADOR_NOMBRES.compare(String(a.nombre).trim(), String(b.nombre).trim()) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// agruparArticulos(articulos, ordenGuardado, opciones) → [{ categoria, nombre, articulos }].
// articulos: { id: articulo } tal como viene de la base. opciones.soloPendientes: solo los
// no marcados (vista "Por comprar"). opciones.soloSinPrecio: solo los que no tienen precio
// (editor de precios). opciones.soloFavoritos: solo los marcados con la estrella (favorito:
// true). opciones.categorias: { id: nombre } de la lista (categoriasEfectivas;
// omitido = los 14 por defecto). opciones.filtro: texto a buscar en el nombre (sin acentos). Dentro de
// cada pasillo, orden ALFABÉTICO (pedido del usuario, 2026-10-06; antes
// era el de creación); con nombres iguales desempata la llave, así el orden es estable y un
// artículo no "salta" de lugar al marcarlo o desmarcarlo. Los pasillos vacíos no se devuelven.
function agruparArticulos(articulos, ordenGuardado, opciones) {
  opciones = opciones || {};
  var filtro = normalizarNombre(opciones.filtro);
  var categorias = opciones.categorias || CATEGORIAS_NOMBRES;
  var porCategoria = {};
  Object.keys(articulos || {})
    .sort()
    .forEach(function (id) {
      var a = articulos[id];
      if (!a || typeof a !== "object" || !a.nombre) return;
      if (opciones.soloPendientes && a.comprado) return;
      if (opciones.soloSinPrecio && typeof a.precio === "number") return;
      if (opciones.soloFavoritos && !a.favorito) return;
      if (filtro && normalizarNombre(a.nombre).indexOf(filtro) === -1) return;
      var cat = categoriaValida(a.categoria, categorias);
      (porCategoria[cat] = porCategoria[cat] || []).push(Object.assign({ id: id }, a));
    });
  return ordenCategoriasEfectivo(ordenGuardado, categorias)
    .filter(function (cat) { return porCategoria[cat]; })
    .map(function (cat) {
      return { categoria: cat, nombre: categorias[cat], articulos: porCategoria[cat].sort(compararPorNombre) };
    });
}

// totalesLista(articulos) → { pendientes, marcados, total, sinPrecio }. total = Σ cantidad ×
// precio de los PENDIENTES con precio (lo que falta por comprar), sumado en centavos para no
// arrastrar errores de punto flotante (0.1 + 0.2). sinPrecio = pendientes sin precio, para
// avisar que el total es parcial.
function totalesLista(articulos) {
  var r = { pendientes: 0, marcados: 0, total: 0, sinPrecio: 0 };
  var centavos = 0;
  Object.keys(articulos || {}).forEach(function (id) {
    var a = articulos[id];
    if (!a || typeof a !== "object" || !a.nombre) return;
    if (a.comprado) {
      r.marcados++;
      return;
    }
    r.pendientes++;
    var precio = Number(a.precio);
    var cantidad = a.cantidad === undefined || a.cantidad === null || a.cantidad === "" ? 1 : Number(a.cantidad);
    if (a.precio === undefined || a.precio === null || a.precio === "" || !isFinite(precio) || !isFinite(cantidad)) {
      r.sinPrecio++;
      return;
    }
    centavos += Math.round(cantidad * precio * 100);
  });
  r.total = centavos / 100;
  return r;
}

// Viñetas que se reconocen al importar: "* ", "- ", "• ", "◦ ", casillas "- [ ] " / "[x] ",
// "☐ ", "✓ " y listas numeradas "1. " / "1) ".
var _PATRON_VINETA = /^(?:[*\-•◦▪●○·]\s*(?:\[[ xX✓]?\]\s*)?|\[[ xX✓]?\]\s*|[☐☑✓✔]\s*|\d+[.)]\s+)(.*)$/;

// categoriaDeEncabezado(texto, categorias): id del pasillo si el renglón es el nombre de uno (o
// un alias conocido de uno que exista en la lista), o null. El nombre propio gana sobre el
// alias: si el usuario creó "Pan", "Pan" es suyo aunque exista el alias pan → panaderia.
function categoriaDeEncabezado(texto, categorias) {
  var conocidas = categorias || CATEGORIAS_NOMBRES;
  var n = normalizarNombre(texto).replace(/[:.]+$/, "");
  if (!n) return null;
  for (var id in conocidas) {
    if (normalizarNombre(conocidas[id]) === n) return id;
  }
  var alias = CATEGORIAS_ALIAS[n];
  return alias && Object.prototype.hasOwnProperty.call(conocidas, alias) ? alias : null;
}

// parsearNotaImportada(texto, categorias) → { articulos: [{ nombre, categoria }], ignorados:
// [renglón], nuevos: [{ clave, nombre }] }. `nuevos` son los pasillos que la nota trae y la lista
// aún no tiene (su artículos llevan categoria "nuevo:<clave>"; quien importa los crea y la
// reemplaza por el id real). `categorias` = { id: nombre } de la lista (categoriasEfectivas; omitido = los 14
// por defecto), así un pasillo creado o renombrado por el usuario también se reconoce.
// Formato de la nota del usuario (Notas del iPhone): un renglón SIN viñeta que coincide con
// un pasillo abre esa sección; cada renglón CON viñeta es un artículo de la sección actual (o
// de "Especiales" si aún no hay sección). Un renglón que EMPIEZA con tabulador cuenta como
// viñeta aunque no traiga símbolo (pedido del usuario: así llegan las listas de Notas al
// pegarlas), y si después del tabulador viene una viñeta, se quita. Los renglones sin viñeta
// ni tabulador que no son pasillo (título, instrucciones) se ignoran y se devuelven para
// mostrarlos en la vista previa. Repetidos en la MISMA sección se cargan una vez; en secciones
// distintas (Bicarbonato en Limpieza y en Farmacia) se respetan, porque así los tiene el
// usuario. No se interpreta cantidad del texto ("Aguacates dos", "Leche Entera 2 Santa
// Clara"): el formato es irregular y partirlo echaría a perder el nombre.
function parsearNotaImportada(texto, categorias) {
  var resultado = { articulos: [], ignorados: [], nuevos: [] };
  var categoria = CATEGORIA_DEFECTO;
  var vistos = {};
  var nuevosPorClave = {};
  // true justo después de un encabezado (y hasta el primer artículo): un renglón suelto ahí es una
  // nota bajo el encabezado ("Especiales" / "poner compras de única ocasión"), no otro pasillo.
  var trasEncabezado = false;

  // Cada renglón no vacío se clasifica una vez: artículo (viñeta o tabulador) o texto suelto.
  var renglones = [];
  String(texto || "")
    .split(/\r?\n/)
    .forEach(function (renglon) {
      var conTabulador = /^[ \u00a0]*\t/.test(renglon);
      var limpio = renglon.replace(/\u00a0/g, " ").trim();
      if (!limpio) return;
      var vineta = _PATRON_VINETA.exec(limpio);
      renglones.push({
        texto: limpio,
        esArticulo: !!vineta || conTabulador,
        nombre: vineta ? vineta[1] : limpio
      });
    });

  renglones.forEach(function (r, i) {
    if (!r.esArticulo) {
      var cat = categoriaDeEncabezado(r.texto, categorias);
      if (cat) {
        categoria = cat;
        trasEncabezado = true;
        return;
      }
      // Un renglón suelto que NO es un pasillo conocido pero que va seguido de artículos es el
      // encabezado de un pasillo NUEVO ("Alimentos Fríos"): se propone crearlo. Si no va seguido
      // de artículos (título, instrucciones) se ignora, como antes.
      var siguiente = renglones[i + 1];
      var clave = normalizarNombre(r.texto).replace(/[:.]+$/, "");
      if (!trasEncabezado && siguiente && siguiente.esArticulo && clave && r.texto.replace(/[:.]+$/, "").trim().length <= LARGO_MAX_CATEGORIA) {
        if (!nuevosPorClave[clave]) {
          nuevosPorClave[clave] = { clave: clave, nombre: r.texto.replace(/[:.]+$/, "").replace(/\s+/g, " ").trim() };
          resultado.nuevos.push(nuevosPorClave[clave]);
        }
        categoria = "nuevo:" + clave;
        trasEncabezado = true;
      } else {
        resultado.ignorados.push(r.texto);
      }
      return;
    }
    trasEncabezado = false;
    var nombre = r.nombre.replace(/\s+/g, " ").trim().slice(0, LARGO_MAX_NOMBRE);
    if (!nombre) return;
    var llave = categoria + "|" + normalizarNombre(nombre);
    if (vistos[llave]) return;
    vistos[llave] = true;
    resultado.articulos.push({ nombre: nombre, categoria: categoria });
  });
  return resultado;
}

// separarRepetidos(nuevos, existentes) → { aAgregar, repetidos }. Al importar dos veces la
// misma nota no se duplica nada: se omite lo que ya está en la lista con el mismo nombre
// (sin acentos) en la misma categoría. `categorias`: los pasillos de la lista (opcional).
function separarRepetidos(nuevos, existentes, categorias) {
  var ya = {};
  Object.keys(existentes || {}).forEach(function (id) {
    var a = existentes[id];
    if (a && a.nombre) ya[categoriaValida(a.categoria, categorias) + "|" + normalizarNombre(a.nombre)] = true;
  });
  var r = { aAgregar: [], repetidos: [] };
  nuevos.forEach(function (n) {
    (ya[n.categoria + "|" + normalizarNombre(n.nombre)] ? r.repetidos : r.aAgregar).push(n);
  });
  return r;
}

// buscarPorNombre(articulos, nombre) → id del artículo con ese nombre exacto (sin acentos)
// o null. El campo rápido lo usa para no duplicar: si "leche" ya existe, Enter la pone
// "por comprar" en vez de crear otra.
function buscarPorNombre(articulos, nombre) {
  var n = normalizarNombre(nombre);
  if (!n) return null;
  var ids = Object.keys(articulos || {}).sort();
  for (var i = 0; i < ids.length; i++) {
    var a = articulos[ids[i]];
    if (a && a.nombre && normalizarNombre(a.nombre) === n) return ids[i];
  }
  return null;
}

// Plural de las unidades que lo llevan; kg, g, l y ml se escriben igual.
var _PLURAL_UNIDADES = { pieza: "piezas", paquete: "paquetes", caja: "cajas", bolsa: "bolsas", lata: "latas", botella: "botellas", docena: "docenas" };

// textoCantidad(2, "pieza") → "2 piezas"; textoCantidad(1.5, "kg") → "1.5 kg". Devuelve ""
// para 1 pieza (el caso por defecto), para no llenar la fila de "1 pieza" repetido.
function textoCantidad(cantidad, unidad) {
  var n = cantidad === undefined || cantidad === null || cantidad === "" ? 1 : Number(cantidad);
  if (!isFinite(n) || n <= 0) n = 1;
  var u = unidad || "pieza";
  if (n === 1 && u === "pieza") return "";
  var numero = String(Math.round(n * 100) / 100);
  return numero + " " + (n !== 1 && _PLURAL_UNIDADES[u] ? _PLURAL_UNIDADES[u] : u);
}

// Paso de los botones (+)/(−) de "Toda la lista" según la unidad. Las que se compran por
// peso o volumen avanzan de medio en medio (kg, l) o de 100 en 100 (g, ml); el resto, de 1.
var _PASO_UNIDAD = { kg: 0.5, l: 0.5, g: 100, ml: 100 };

function pasoDeUnidad(unidad) {
  return _PASO_UNIDAD[unidad] || 1;
}

// siguienteCantidad(cantidad, unidad, +1 | -1) → nueva cantidad, o null si no puede bajar
// más. Nunca llega a 0 (las reglas exigen cantidad > 0; para quitarlo está "Eliminar") ni
// pasa de 9999. Si la cantidad no cae en un múltiplo del paso (p. ej. 0.3 kg escrito a mano),
// el primer toque la lleva al múltiplo más cercano en esa dirección, y ya no se desfasa.
function siguienteCantidad(cantidad, unidad, direccion) {
  var paso = pasoDeUnidad(unidad);
  var n = Number(cantidad);
  if (!isFinite(n) || n <= 0) n = 1;
  var pasos = n / paso;
  var redondo = Math.abs(pasos - Math.round(pasos)) < 1e-9;
  var siguiente = direccion > 0
    ? (redondo ? Math.round(pasos) + 1 : Math.ceil(pasos)) * paso
    : (redondo ? Math.round(pasos) - 1 : Math.floor(pasos)) * paso;
  siguiente = Math.round(siguiente * 100) / 100;
  if (siguiente <= 0) return null;
  if (siguiente > 9999) return direccion > 0 ? null : 9999;
  return siguiente;
}

// Unidad para el contador de la fila: explícita, en plural cuando toca. Solo "pieza" se
// abrevia (pza/pzas, de uso común en México); las demás van completas.
// etiquetaUnidad(2, "pieza") → "pzas"; (1, "lata") → "lata"; (3, "paquete") → "paquetes".
function etiquetaUnidad(cantidad, unidad) {
  var u = unidad || "pieza";
  var plural = Number(cantidad) !== 1;
  if (u === "pieza") return plural ? "pzas" : "pza";
  return plural && _PLURAL_UNIDADES[u] ? _PLURAL_UNIDADES[u] : u;
}

// cantidadParaUnidad(cantidad, unidad): la cantidad ajustada a la unidad nueva al cambiarla
// en el editor de precios. Si no llega al paso mínimo (1 pza → g) sube a él (100 g, no 1 g);
// si no es múltiplo del paso (0.5 kg → pieza) sube al múltiplo siguiente (1 pza).
function cantidadParaUnidad(cantidad, unidad) {
  var paso = pasoDeUnidad(unidad);
  var n = Number(cantidad);
  if (!isFinite(n) || n <= 0) n = 1;
  var ajustada = Math.ceil(n / paso - 1e-9) * paso;
  ajustada = Math.round(Math.max(paso, ajustada) * 100) / 100;
  return Math.min(ajustada, 9999);
}

// contarSinPrecio(articulos) → cuántos artículos (marcados o no) no tienen precio.
function contarSinPrecio(articulos) {
  return Object.keys(articulos || {}).filter(function (id) {
    var a = articulos[id];
    return a && typeof a === "object" && a.nombre && typeof a.precio !== "number";
  }).length;
}

// copiarArticulos(articulos, opciones) → [artículo] para una lista NUEVA (duplicar).
// Copia solo los datos del artículo (nombre, cantidad, unidad, pasillo, precio, notas), en
// orden alfabético por pasillo como se ven. opciones.todosMarcados: true = todo entra
// marcado ("ya lo tengo", como al importar); false = conserva marcado/desmarcado de la
// original. opciones.categorias: los pasillos de la lista origen (categoriasEfectivas), para
// que los personalizados conserven su id. opciones.uid: quien duplica (queda como agregadoPor / compradoPor).
// No copia autoría, actividad ni plantillaId (la copia es una lista nueva y propia).
function copiarArticulos(articulos, opciones) {
  opciones = opciones || {};
  var resultado = [];
  agruparArticulos(articulos, null, { categorias: opciones.categorias }).forEach(function (g) {
    g.articulos.forEach(function (a) {
      var marcado = opciones.todosMarcados ? true : !!a.comprado;
      var copia = {
        nombre: String(a.nombre).slice(0, LARGO_MAX_NOMBRE),
        cantidad: typeof a.cantidad === "number" && a.cantidad > 0 && a.cantidad <= 9999 ? a.cantidad : 1,
        unidad: typeof a.unidad === "string" && a.unidad ? a.unidad.slice(0, 20) : "pieza",
        categoria: g.categoria,
        comprado: marcado
      };
      if (typeof a.precio === "number" && a.precio >= 0) copia.precio = a.precio;
      if (typeof a.notas === "string" && a.notas) copia.notas = a.notas.slice(0, 200);
      if (a.favorito === true) copia.favorito = true;
      if (typeof a.fotoUrl === "string" && a.fotoUrl) copia.fotoUrl = a.fotoUrl.slice(0, 1000); // misma URL: no se duplica el archivo
      if (opciones.uid) {
        copia.agregadoPor = opciones.uid;
        if (marcado) copia.compradoPor = opciones.uid;
      }
      resultado.push(copia);
    });
  });
  return resultado;
}

// ===== Comandos (consola "Comandos": captura automática de lo que hay que comprar) =====
//
// Un comando por renglón, campos separados con | (barra vertical). Líneas vacías y las que
// empiezan con # se ignoran (también las cercas ``` de un bloque de código pegado).
//   LIMPIAR                                              → todo lo pendiente pasa a "ya lo tengo"
//   COMPRAR | nombre | cantidad | unidad | pasillo       → poner por comprar (cantidad, unidad y pasillo opcionales)
//   CREAR   | nombre | cantidad | unidad | pasillo | notas → artículo nuevo (pasillo obligatorio; entra marcado)
//   QUITAR  | nombre | pasillo                           → poner "ya lo tengo" (pasillo opcional)
// Los comandos se aplican EN ORDEN sobre una copia de la lista; el resultado es un solo
// conjunto de cambios (planificarComandos). Aquí no hay DOM ni Firebase.

var COMANDOS_NOMBRES = ["LIMPIAR", "COMPRAR", "CREAR", "QUITAR"];
var LARGO_MAX_NOTAS = 200; // el mismo límite que valida database.rules.json

// Campo "cantidad" de un comando: vacío → null (omitido); inválido → { error }.
function _cantidadDeComando(texto) {
  if (!texto) return { valor: null };
  var n = _numeroDesdeTexto(String(texto).trim());
  if (!(n > 0) || n > 9999) return { error: "la cantidad «" + texto + "» no es válida (mayor que 0 y hasta 9999)" };
  return { valor: Math.round(n * 100) / 100 };
}

// Campo "unidad": vacío → null; desconocida → { error }.
function _unidadDeComando(texto) {
  if (!texto) return { valor: null };
  var u = _ALIAS_UNIDADES[normalizarNombre(texto).replace(/\.$/, "")];
  return u ? { valor: u } : { error: "la unidad «" + texto + "» no existe (usa: " + UNIDADES_DEFECTO.join(", ") + ")" };
}

// parsearComandos(texto, categorias) → [{ linea, texto, tipo, ... } | { linea, texto, error }].
// `categorias`: los pasillos de la lista ({ id: nombre }); el pasillo se acepta por nombre.
function parsearComandos(texto, categorias) {
  var cats = categorias || categoriasEfectivas(null);
  var resultado = [];
  String(texto || "").split(/\r\n|\r|\n/).forEach(function (crudo, i) {
    var linea = i + 1;
    var t = crudo.trim();
    if (!t || t.charAt(0) === "#" || t.indexOf("```") === 0) return;
    var campos = t.split("|").map(function (c) { return c.trim(); });
    var tipo = normalizarNombre(campos[0]).toUpperCase();
    var falla = function (mensaje) { resultado.push({ linea: linea, texto: t, error: mensaje }); };
    if (COMANDOS_NOMBRES.indexOf(tipo) < 0) {
      return falla("comando desconocido «" + campos[0] + "» (usa: " + COMANDOS_NOMBRES.join(", ") + ")");
    }
    if (tipo === "LIMPIAR") {
      if (campos.length > 1 && campos.slice(1).some(Boolean)) return falla("LIMPIAR no lleva campos");
      return resultado.push({ linea: linea, texto: t, tipo: "limpiar" });
    }
    var nombre = campos[1] || "";
    if (!nombre) return falla(tipo + " necesita el nombre del artículo");
    if (nombre.length > LARGO_MAX_NOMBRE) return falla("el nombre es demasiado largo (máximo " + LARGO_MAX_NOMBRE + ")");
    var comando = { linea: linea, texto: t, tipo: tipo.toLowerCase(), nombre: nombre };
    var pasilloTexto;
    if (tipo === "QUITAR") {
      if (campos.length > 3) return falla("QUITAR lleva: nombre | pasillo");
      pasilloTexto = campos[2];
    } else {
      if (campos.length > (tipo === "CREAR" ? 6 : 5)) return falla(tipo + " lleva demasiados campos (¿un | dentro de un nombre?)");
      var c = _cantidadDeComando(campos[2]);
      if (c.error) return falla(c.error);
      var u = _unidadDeComando(campos[3]);
      if (u.error) return falla(u.error);
      comando.cantidad = c.valor;
      comando.unidad = u.valor;
      pasilloTexto = campos[4];
      if (tipo === "CREAR") {
        if (!pasilloTexto) return falla("CREAR necesita el pasillo (4.º campo)");
        if (campos[5]) {
          if (campos[5].length > LARGO_MAX_NOTAS) return falla("las notas son demasiado largas (máximo " + LARGO_MAX_NOTAS + ")");
          comando.notas = campos[5];
        }
      }
    }
    if (pasilloTexto) {
      var idPasillo = categoriaDeEncabezado(pasilloTexto, cats);
      if (!idPasillo) return falla("el pasillo «" + pasilloTexto + "» no existe en esta lista");
      comando.categoria = idPasillo;
    }
    resultado.push(comando);
  });
  return resultado;
}

// Hasta 3 nombres parecidos (uno contiene al otro) para sugerir cuando no hay coincidencia exacta.
function _parecidos(nombre, candidatos) {
  var n = normalizarNombre(nombre);
  return candidatos.filter(function (c) {
    var m = normalizarNombre(c.nombre);
    return m.indexOf(n) >= 0 || n.indexOf(m) >= 0;
  }).slice(0, 3).map(function (c) { return c.nombre; });
}

// planificarComandos(texto, articulos, categorias) → {
//   lineas: [{ linea, texto, ok, mensaje }]  (una por comando, en orden; ok=false con la causa),
//   errores, limpiados, porComprar, creados, quitados, // conteos de los comandos que sí aplican
//   cambios: { idExistente: { campo: valorNuevo } }     (solo diferencias reales; null = borrar),
//   nuevos:  [{ nombre, cantidad, unidad, categoria, comprado, notas? }]
// }
// Cada comando se aplica sobre el estado que dejaron los anteriores. Un comando con error se
// omite (y se informa); los demás siguen. Coincidencia de nombre: exacta sin acentos ni
// mayúsculas, dentro del pasillo si se indicó; si el nombre está en varios pasillos y no se
// indicó cuál, es un error (no se adivina).
function planificarComandos(texto, articulos, categorias) {
  var cats = categorias || categoriasEfectivas(null);
  var comandos = parsearComandos(texto, cats);
  var lista = []; // estado simulado: existentes y creados en este lote
  Object.keys(articulos || {}).sort().forEach(function (id) {
    var a = articulos[id];
    if (!a || typeof a !== "object" || !a.nombre) return;
    lista.push({
      id: id, nombre: a.nombre, categoria: categoriaValida(a.categoria, cats),
      comprado: !!a.comprado,
      cantidad: typeof a.cantidad === "number" ? a.cantidad : 1,
      unidad: a.unidad || "pieza", original: a
    });
  });
  var nuevos = [];
  var salida = { lineas: [], errores: 0, limpiados: 0, porComprar: 0, creados: 0, quitados: 0, cambios: {}, nuevos: nuevos };

  function nombrePasillo(id) { return cats[id] || id; }
  function buscar(c) {
    var n = normalizarNombre(c.nombre);
    return lista.filter(function (x) {
      return normalizarNombre(x.nombre) === n && (!c.categoria || x.categoria === c.categoria);
    });
  }

  comandos.forEach(function (c) {
    var linea = { linea: c.linea, texto: c.texto, ok: true, mensaje: "" };
    salida.lineas.push(linea);
    var mal = function (mensaje) { linea.ok = false; linea.mensaje = mensaje; salida.errores++; };
    if (c.error) return mal(c.error);

    if (c.tipo === "limpiar") {
      var n = 0;
      lista.forEach(function (x) { if (!x.comprado) { x.comprado = true; n++; } });
      salida.limpiados += n;
      linea.mensaje = n === 1 ? "1 artículo pendiente pasa a «ya lo tengo»" : n + " artículos pendientes pasan a «ya lo tengo»";
      return;
    }

    var coincidencias = buscar(c);
    if (c.tipo === "crear") {
      if (coincidencias.length) return mal("«" + c.nombre + "» ya existe en " + nombrePasillo(coincidencias[0].categoria) + " (usa COMPRAR)");
      var unidad = c.unidad || "pieza";
      var cantidad = c.cantidad !== null && c.cantidad !== undefined ? c.cantidad : cantidadParaUnidad(1, unidad);
      var nuevo = { nombre: c.nombre, cantidad: cantidad, unidad: unidad, categoria: c.categoria, comprado: true };
      if (c.notas) nuevo.notas = c.notas;
      var sim = { id: null, nombre: c.nombre, categoria: c.categoria, comprado: true, cantidad: cantidad, unidad: unidad, nuevo: nuevo };
      lista.push(sim);
      nuevos.push(nuevo);
      salida.creados++;
      linea.mensaje = "se crea en " + nombrePasillo(c.categoria) + " (" + (textoCantidad(cantidad, unidad) || "1 pieza") + ")";
      return;
    }

    // COMPRAR / QUITAR sobre un artículo existente (o creado antes en este lote).
    if (!coincidencias.length) {
      var sug = _parecidos(c.nombre, lista);
      return mal("«" + c.nombre + "» no existe" + (c.categoria ? " en " + nombrePasillo(c.categoria) : "") +
        (sug.length ? "; ¿quisiste decir " + sug.map(function (s) { return "«" + s + "»"; }).join(", ") + "?" : "") + " (usa CREAR)");
    }
    if (coincidencias.length > 1) {
      return mal("«" + c.nombre + "» está en varios pasillos (" + coincidencias.map(function (x) { return nombrePasillo(x.categoria); }).join(", ") + "): indica cuál");
    }
    var x = coincidencias[0];
    if (c.tipo === "quitar") {
      x.comprado = true;
      salida.quitados++;
      linea.mensaje = x.nombre + " pasa a «ya lo tengo»";
      return;
    }
    x.comprado = false;
    if (c.unidad) x.unidad = c.unidad;
    if (c.cantidad !== null && c.cantidad !== undefined) x.cantidad = c.cantidad;
    else if (c.unidad) x.cantidad = cantidadParaUnidad(x.cantidad, c.unidad);
    salida.porComprar++;
    linea.mensaje = x.nombre + ": " + (textoCantidad(x.cantidad, x.unidad) || "1 pieza") + " por comprar";
  });

  // Los nuevos reflejan su estado final (un COMPRAR posterior los dejó por comprar, etc.).
  lista.forEach(function (x) {
    if (x.nuevo) {
      x.nuevo.comprado = x.comprado;
      x.nuevo.cantidad = x.cantidad;
      x.nuevo.unidad = x.unidad;
      return;
    }
    var o = x.original;
    var d = {};
    if (x.comprado !== !!o.comprado) d.comprado = x.comprado;
    if (x.cantidad !== (typeof o.cantidad === "number" ? o.cantidad : 1)) d.cantidad = x.cantidad;
    if (x.unidad !== (o.unidad || "pieza")) d.unidad = x.unidad;
    if (Object.keys(d).length) salida.cambios[x.id] = d;
  });
  return salida;
}

// generarPromptComandos(opciones) → texto del prompt para una sesión de Claude.
// opciones: { nombreLista, articulos, categorias (id→nombre), orden (ids de pasillos) }.
function generarPromptComandos(opciones) {
  var cats = opciones.categorias || categoriasEfectivas(null);
  var orden = opciones.orden || ordenCategoriasEfectivo(null, cats);
  var grupos = agruparArticulos(opciones.articulos || {}, orden, { categorias: cats });
  var lineasCatalogo = [];
  grupos.forEach(function (g) {
    g.articulos.forEach(function (a) {
      var cantidad = typeof a.cantidad === "number" ? a.cantidad : 1;
      lineasCatalogo.push(a.nombre + " | " + g.nombre + " | " + (a.unidad || "pieza") + " | " + (Math.round(cantidad * 100) / 100) +
        " | " + (a.comprado ? "ya lo tengo" : "POR COMPRAR"));
    });
  });
  var nombresPasillos = orden.filter(function (id) { return cats[id]; }).map(function (id) { return cats[id]; });
  return [
    "Vas a convertir la lista de compras de esta sesión (el análisis de menús y el resumen de lo que hay que comprar) en una lista de COMANDOS para mi aplicación de compras «ListadeCompras», lista «" + (opciones.nombreLista || "") + "».",
    "",
    "## Sintaxis de los comandos",
    "Un comando por renglón; los campos van separados por | (barra vertical). Líneas que empiezan con # son comentarios.",
    "",
    "LIMPIAR",
    "    Pasa TODO lo que está pendiente de compra a «ya lo tengo» (para empezar de cero). Va al inicio.",
    "COMPRAR | nombre | cantidad | unidad | pasillo",
    "    Pone un artículo YA EXISTENTE como pendiente de compra. cantidad, unidad y pasillo son opcionales (si se omiten se conserva lo que ya tiene el artículo). El pasillo solo se necesita si el mismo nombre está en dos pasillos.",
    "CREAR | nombre | cantidad | unidad | pasillo | notas",
    "    Crea un artículo que no existe. El pasillo es OBLIGATORIO. cantidad, unidad y notas son opcionales. Entra como «ya lo tengo»: después va su COMPRAR.",
    "QUITAR | nombre | pasillo",
    "    Pasa un artículo a «ya lo tengo» (sacarlo de lo pendiente). El pasillo es opcional.",
    "",
    "Reglas de los campos:",
    "- nombre: EXACTAMENTE como aparece en el catálogo de abajo (se ignoran mayúsculas y acentos, nada más). No inventes variantes ni pongas | dentro de un nombre.",
    "- cantidad: número mayor que 0 (punto decimal; 1.5 está bien).",
    "- unidad: una de " + UNIDADES_DEFECTO.join(", ") + ".",
    "- pasillo: uno de los pasillos de la lista (abajo), con su nombre.",
    "",
    "Ejemplo:",
    "LIMPIAR",
    "COMPRAR | Leche | 2 | l",
    "COMPRAR | Tomate | 1.5 | kg",
    "CREAR | Chayote | 4 | pieza | " + (nombresPasillos[0] || "Frutas") + " | para el caldo del martes",
    "COMPRAR | Chayote | 4 | pieza",
    "",
    "## Cómo debes trabajar",
    "1. Toma cada cosa que hay que comprar del resumen de esta sesión y júntala: si un ingrediente aparece en varios días del menú, suma las cantidades.",
    "2. Búscala en el catálogo por significado (singular/plural, acentos, marca, sinónimos). Si encuentras UN artículo claramente equivalente, usa COMPRAR con el nombre exacto del catálogo.",
    "3. Si no existe nada equivalente, usa CREAR en el pasillo que corresponda y enseguida COMPRAR del mismo nombre con la cantidad necesaria.",
    "4. Usa la unidad natural de compra (kg para verduras a granel, pieza para latas, etc.). Si la unidad del catálogo no sirve para la cantidad, indica la unidad y la cantidad en el COMPRAR.",
    "5. Empieza con LIMPIAR salvo que yo te diga que conserve lo pendiente. Los artículos marcados POR COMPRAR en el catálogo son restos de la compra anterior: LIMPIAR los quita.",
    "6. PREGÚNTAME antes de dar el resultado si tienes dudas: coincidencias dudosas (varios artículos posibles), pasillo incierto para un artículo nuevo, cantidades que no cuadran, cosas que probablemente ya tengo en casa o ajustes que convenga hacerle a la lista. Haz las preguntas juntas y numeradas.",
    "7. No agregues nada que no esté en el resumen de compras. Si algo del resumen no se puede expresar con estos comandos, dímelo.",
    "8. Cuando ya no haya dudas, responde con UN SOLO bloque de código con los comandos, sin texto dentro del bloque (puedes usar renglones # comentario). Yo lo pegaré tal cual en la aplicación, que revisa cada renglón antes de ejecutarlo.",
    "",
    "## Pasillos de la lista",
    nombresPasillos.join(", "),
    "",
    "## Catálogo actual (" + lineasCatalogo.length + " artículos)",
    "Formato: nombre | pasillo | unidad | cantidad | estado",
    lineasCatalogo.length ? lineasCatalogo.join("\n") : "(la lista está vacía: todo lo que haga falta debe crearse con CREAR)"
  ].join("\n");
}
