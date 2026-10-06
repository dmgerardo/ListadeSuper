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

// ordenCategoriasEfectivo(ordenGuardado, categorias): el orden de pasillos de la lista, sin ids
// desconocidos ni repetidos, y con los pasillos que falten agregados al final (primero los
// por defecto en su orden, luego los creados por el usuario). Las listas creadas antes de la
// Fase 2 traen ids viejos (frutas_verduras, lacteos…): quedan filtrados y la lista usa el
// orden por defecto, sin migrar datos. `categorias` omitido = los 14 por defecto.
function ordenCategoriasEfectivo(ordenGuardado, categorias) {
  var conocidas = categorias || CATEGORIAS_NOMBRES;
  var lista = Array.isArray(ordenGuardado)
    ? ordenGuardado
    : ordenGuardado && typeof ordenGuardado === "object"
      ? Object.keys(ordenGuardado).sort(function (a, b) { return a - b; }).map(function (k) { return ordenGuardado[k]; })
      : [];
  var relleno = CATEGORIAS_ORDEN_DEFECTO.concat(Object.keys(conocidas));
  var vistos = {};
  var orden = [];
  lista.concat(relleno).forEach(function (id) {
    if (Object.prototype.hasOwnProperty.call(conocidas, id) && !vistos[id]) {
      vistos[id] = true;
      orden.push(id);
    }
  });
  return orden;
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
// [renglón] }. `categorias` = { id: nombre } de la lista (categoriasEfectivas; omitido = los 14
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
  var resultado = { articulos: [], ignorados: [] };
  var categoria = CATEGORIA_DEFECTO;
  var vistos = {};
  String(texto || "")
    .split(/\r?\n/)
    .forEach(function (renglon) {
      var conTabulador = /^[ \u00a0]*\t/.test(renglon);
      var limpio = renglon.replace(/\u00a0/g, " ").trim();
      if (!limpio) return;
      var vineta = _PATRON_VINETA.exec(limpio);
      var nombreCrudo;
      if (vineta) {
        nombreCrudo = vineta[1];
      } else if (conTabulador) {
        nombreCrudo = limpio;
      } else {
        var cat = categoriaDeEncabezado(limpio, categorias);
        if (cat) categoria = cat;
        else resultado.ignorados.push(limpio);
        return;
      }
      var nombre = nombreCrudo.replace(/\s+/g, " ").trim().slice(0, LARGO_MAX_NOMBRE);
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
      if (opciones.uid) {
        copia.agregadoPor = opciones.uid;
        if (marcado) copia.compradoPor = opciones.uid;
      }
      resultado.push(copia);
    });
  });
  return resultado;
}
