// Consola de comandos de una lista ("Comandos" en Artículos): capturar de golpe lo que hay que
// comprar. Dos cosas en una hoja:
//  1. "Copiar prompt para Claude": copia al portapapeles un prompt con la sintaxis y el
//     catálogo actual de la lista, para pedirle a una sesión de Claude (que ya tiene el menú de
//     la semana) la lista de comandos.
//  2. Una caja donde se pegan esos comandos: vista previa renglón por renglón y "Ejecutar".
// La sintaxis, la coincidencia de nombres y el prompt viven en logica-articulos.js
// (parsearComandos / planificarComandos / generarPromptComandos, con pruebas). Aquí solo hay
// interfaz y la escritura: UNA multi-ruta (con el registro de actividad) y un Deshacer.
// Usa abrirModal/confirmarCierreConCambios/mostrarToast/esc/icono (render-utils.js, iconos.js).

// _copiarTexto(texto) → Promise<boolean>: Clipboard API; si el navegador la niega, execCommand
// con un campo temporal. false = no se pudo (la hoja muestra el texto para copiarlo a mano).
function _copiarTexto(texto) {
  function respaldo() {
    try {
      var t = document.createElement("textarea");
      t.value = texto;
      t.setAttribute("readonly", "");
      t.className = "copia-temporal";
      document.body.appendChild(t);
      t.select();
      var ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return respaldo(); });
  }
  return Promise.resolve(respaldo());
}

// abrirComandos(ctx): ctx = {
//   listaId, usuario, nombreLista(), articulos(), categorias(), orden(), coordinacion(),
//   refArticulos, alEjecutar()   // alEjecutar: p. ej. pasar a la vista "Comprar"
// }
function abrirComandos(ctx) {
  var modal = abrirModal(
    "<h3>Comandos</h3>" +
      '<p class="texto-suave">Captura de golpe lo que hay que comprar. Pega abajo la lista de comandos ' +
      "(un renglón por comando) y revisa la vista previa antes de ejecutar.</p>" +
      '<button type="button" class="btn btn-secundario btn-ancho-completo" data-copiar-prompt>' + icono("copy", 18) +
      "<span>Copiar prompt para Claude</span></button>" +
      '<p class="texto-suave" data-estado-prompt role="status" aria-live="polite"></p>' +
      '<div class="campo oculto" data-zona-prompt><label for="prompt-manual">Copia este texto (Ctrl/Cmd+C) y pégalo en Claude</label>' +
      '<textarea id="prompt-manual" rows="6" readonly></textarea></div>' +
      '<details class="sintaxis-comandos"><summary>Sintaxis de los comandos</summary>' +
      "<pre>LIMPIAR\n" +
      "COMPRAR | nombre | cantidad | unidad | pasillo\n" +
      "CREAR | nombre | cantidad | unidad | pasillo | notas\n" +
      "QUITAR | nombre | pasillo</pre>" +
      "<p><code>LIMPIAR</code> pasa todo lo pendiente a «ya lo tengo» para empezar de cero. " +
      "<code>COMPRAR</code> pone por comprar un artículo que ya existe (cantidad, unidad y pasillo son opcionales). " +
      "<code>CREAR</code> agrega un artículo nuevo (el pasillo es obligatorio) y entra como «ya lo tengo»: " +
      "después va su <code>COMPRAR</code>. <code>QUITAR</code> lo regresa a «ya lo tengo». " +
      "Los renglones se aplican en orden; los que empiezan con # se ignoran.</p></details>" +
      '<div class="campo"><label for="texto-comandos">Comandos</label>' +
      '<textarea id="texto-comandos" class="area-comandos" rows="8" maxlength="30000" spellcheck="false" autocapitalize="off" ' +
      'placeholder="LIMPIAR&#10;COMPRAR | Leche | 2 | l&#10;CREAR | Chayote | 4 | pieza | Verduras"></textarea></div>' +
      '<div data-vista-previa aria-live="polite"></div>' +
      '<div class="fila-botones">' +
      '<button type="button" class="btn btn-secundario" data-cancelar>Cancelar</button>' +
      '<button type="button" class="btn" data-ejecutar disabled>Ejecutar</button>' +
      "</div>",
    null,
    { hayCambios: function () { return !!area.value.trim(); }, guardar: function () { ejecutar(); } }
  );
  var el = modal.elemento;
  var area = el.querySelector("#texto-comandos");
  var previa = el.querySelector("[data-vista-previa]");
  var botonEjecutar = el.querySelector("[data-ejecutar]");
  var estadoPrompt = el.querySelector("[data-estado-prompt]");
  var plan = null;

  // ===== Prompt para Claude =====
  el.querySelector("[data-copiar-prompt]").addEventListener("click", function () {
    var texto = generarPromptComandos({
      nombreLista: ctx.nombreLista(),
      articulos: ctx.articulos(),
      categorias: ctx.categorias(),
      orden: ctx.orden()
    });
    _copiarTexto(texto).then(function (ok) {
      if (ok) {
        estadoPrompt.textContent = "Prompt copiado ✓ (" + texto.split("\n").length + " renglones). Pégalo en la sesión de Claude que tiene tu menú.";
        el.querySelector("[data-zona-prompt]").classList.add("oculto");
        return;
      }
      var zona = el.querySelector("[data-zona-prompt]");
      var caja = zona.querySelector("textarea");
      caja.value = texto;
      zona.classList.remove("oculto");
      caja.focus();
      caja.select();
      estadoPrompt.textContent = "No pude copiarlo automáticamente: el texto quedó seleccionado abajo.";
    });
  });

  // ===== Vista previa =====
  function actualizarPrevia() {
    if (!area.value.trim()) {
      plan = null;
      previa.innerHTML = "";
      botonEjecutar.disabled = true;
      botonEjecutar.textContent = "Ejecutar";
      return;
    }
    plan = planificarComandos(area.value, ctx.articulos(), ctx.categorias());
    var aplican = plan.lineas.length - plan.errores;
    var partes = [];
    if (plan.limpiados) partes.push(plan.limpiados + " a «ya lo tengo»");
    if (plan.porComprar) partes.push(plan.porComprar + " por comprar");
    if (plan.creados) partes.push(plan.creados + (plan.creados === 1 ? " artículo nuevo" : " artículos nuevos"));
    if (plan.quitados) partes.push(plan.quitados + " quitados");
    var html = '<div class="tarjeta vista-previa-importar"><p><strong>' + plan.lineas.length + "</strong> " +
      (plan.lineas.length === 1 ? "comando" : "comandos") + (partes.length ? ": " + esc(partes.join(" · ")) : "") + "</p>";
    if (plan.errores) {
      html += '<p class="error-formulario">' + plan.errores + (plan.errores === 1 ? " renglón con problema" : " renglones con problema") +
        " (se omiten si ejecutas así; corrígelos arriba o pide a Claude que los ajuste):</p>";
    }
    html += '<ol class="lista-comandos">' + plan.lineas.map(function (l) {
      return l.ok
        ? '<li class="comando-ok"><span class="texto-comando">' + esc(l.texto) + '</span><span class="detalle-articulo">' + esc(l.mensaje) + "</span></li>"
        : '<li class="comando-error"><span class="texto-comando">' + esc(l.texto) + '</span><span class="error-formulario">Renglón ' + l.linea + ": " + esc(l.mensaje) + "</span></li>";
    }).join("") + "</ol></div>";
    previa.innerHTML = html;
    var hayCambios = plan.limpiados > 0 || plan.nuevos.length > 0 || Object.keys(plan.cambios).length > 0;
    botonEjecutar.disabled = !aplican || !hayCambios;
    botonEjecutar.textContent = plan.errores && aplican ? "Ejecutar sin los " + plan.errores + " con problema" : "Ejecutar";
  }
  area.addEventListener("input", actualizarPrevia);

  el.querySelector("[data-cancelar]").addEventListener("click", function () {
    confirmarCierreConCambios(function () { return !!area.value.trim(); }, function () { modal.cerrar("manual"); }, ejecutar);
  });
  botonEjecutar.addEventListener("click", ejecutar);

  // ===== Ejecución: UNA escritura multi-ruta (cambios + actividad) y su Deshacer =====
  function ejecutar() {
    if (!area.value.trim()) return;
    // Se recalcula con la lista de este instante (otro miembro pudo cambiarla mientras tanto).
    var p = planificarComandos(area.value, ctx.articulos(), ctx.categorias());
    var articulos = ctx.articulos();
    var usuario = ctx.usuario;
    var base = "listas/" + ctx.listaId + "/articulos/";
    var cambios = {};
    var revertir = {};
    var coordinacion = ctx.coordinacion();
    var limpiados = 0;

    Object.keys(p.cambios).forEach(function (id) {
      var campos = p.cambios[id];
      var original = articulos[id] || {};
      Object.keys(campos).forEach(function (k) {
        cambios[base + id + "/" + k] = campos[k];
        revertir[base + id + "/" + k] = original[k] === undefined ? null : original[k];
      });
      if ("comprado" in campos) {
        cambios[base + id + "/compradoPor"] = campos.comprado ? usuario.uid : null;
        revertir[base + id + "/compradoPor"] = original.compradoPor || null;
        if (campos.comprado) limpiados++;
        if (coordinacion) {
          coordinacion.agregarEvento(cambios, id, original.nombre, campos.comprado ? "marco" : "desmarco");
          coordinacion.agregarEvento(revertir, id, original.nombre, campos.comprado ? "desmarco" : "marco");
        }
      }
    });
    p.nuevos.forEach(function (n) {
      var id = ctx.refArticulos.push().key;
      var articulo = {
        nombre: n.nombre,
        cantidad: n.cantidad,
        unidad: n.unidad,
        categoria: n.categoria,
        comprado: n.comprado,
        agregadoPor: usuario.uid,
        creado: firebase.database.ServerValue.TIMESTAMP
      };
      if (n.comprado) articulo.compradoPor = usuario.uid;
      if (n.notas) articulo.notas = n.notas;
      cambios[base + id] = articulo;
      revertir[base + id] = null;
    });
    if (!Object.keys(cambios).length) {
      mostrarToast("Esos comandos no cambian nada");
      return;
    }
    var resumen = [];
    var porComprarAhora = p.nuevos.filter(function (n) { return !n.comprado; }).length +
      Object.keys(p.cambios).filter(function (id) { return p.cambios[id].comprado === false; }).length;
    if (limpiados) resumen.push(limpiados + " limpiados");
    if (porComprarAhora) resumen.push(porComprarAhora + " por comprar");
    if (p.nuevos.length) resumen.push(p.nuevos.length + (p.nuevos.length === 1 ? " creado" : " creados"));
    modal.cerrar("manual");
    actualizarMultiple(cambios)
      .then(function () {
        if (ctx.alEjecutar) ctx.alEjecutar();
        mostrarToast("Comandos ejecutados: " + (resumen.join(" · ") || "sin cambios"), {
          duracionMs: 10000,
          accion: {
            etiqueta: "Deshacer",
            alActivar: function () {
              actualizarMultiple(revertir).catch(function (e) {
                console.error("deshacer comandos", e);
                mostrarToast("No se pudo deshacer");
              });
            }
          }
        });
      })
      .catch(function (e) {
        console.error("comandos", e);
        mostrarToast("No se pudieron ejecutar los comandos");
      });
  }
}
