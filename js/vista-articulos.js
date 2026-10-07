// Pantalla de una lista: artículos agrupados por pasillo, con dos vistas.
//
// Modelo de uso (confirmado con el usuario en la Fase 2): la lista es fija y se reutiliza.
// MARCADO (comprado: true) = "ya lo tengo / no hace falta"; DESMARCADO = "por comprar".
// En casa se desmarca lo que falta (vista "Toda la lista"); en la tienda se marca lo que se
// va tomando (vista "Por comprar", la de por defecto). Por eso no hay sección "En el
// carrito": lo marcado simplemente sale de "Por comprar".
//
// Usa logica-articulos.js para todo cálculo (agrupar, totales, importar, interpretar texto).

var _CLAVE_VISTA_ARTICULOS = "vistaArticulos"; // comodidad local: la última vista usada

function _leerVistaGuardada() {
  try {
    return localStorage.getItem(_CLAVE_VISTA_ARTICULOS) === "todo" ? "todo" : "pendientes";
  } catch (e) {
    return "pendientes";
  }
}

function _guardarVista(vista) {
  try {
    localStorage.setItem(_CLAVE_VISTA_ARTICULOS, vista);
  } catch (e) {}
}

// _numeroDeCampo("1,5") → 1.5; "" → null. Los campos numéricos son type="text" con
// inputmode="decimal" para aceptar coma decimal (teclado del iPhone en español).
function _numeroDeCampo(texto) {
  var t = String(texto || "").trim().replace(",", ".");
  if (!t) return null;
  var n = Number(t);
  return isFinite(n) ? n : NaN;
}

// montarVistaArticulos(contenedor, listaId, usuario): devuelve la función de limpieza.
function montarVistaArticulos(contenedor, listaId, usuario) {
  var info = {};
  var articulos = {};
  var vista = _leerVistaGuardada();
  var filtro = "";
  // Editor rápido de unidades y precios (dentro de "Toda la lista"). Mientras está abierto la
  // lista NO se repinta con cada cambio de la base: perdería el foco y lo que se está
  // escribiendo. Se repinta solo al entrar, al cambiar el filtro o "Solo sin precio".
  var modoPrecios = false;
  var soloFavoritos = false; // filtro "Favoritos" (en memoria; vale para las dos vistas y la búsqueda)
  var soloSinPrecio = false;
  var editorPintado = false;
  var detenerInfo = null;
  var detenerArticulos = null;
  var temporizadorSinAcceso = null;
  var sinAcceso = false;

  // Pasillos de ESTA lista ({ id: nombre }): los 14 por defecto o los que personalizó (info.categorias).
  function categoriasLista() {
    return categoriasEfectivas(info.categorias);
  }
  var gestorPasillos = null; // hoja "Pasillos" abierta, para repintarla con los cambios en vivo

  var refArticulos = refNodo("listas/" + listaId + "/articulos");
  function refArticulo(id) {
    return refNodo("listas/" + listaId + "/articulos/" + id);
  }
  function rutaArticulo(id) {
    return "listas/" + listaId + "/articulos/" + id;
  }

  contenedor.innerHTML =
    '<div class="contenedor">' +
    '<a href="index.html" class="btn-texto enlace-con-icono enlace-regreso">' + icono("chevron-left", 18) + "<span>Mis listas</span></a>" +
    '<h1 data-nombre-lista>Cargando…</h1>' +
    '<p class="texto-suave oculto" data-sin-acceso>No existe, o tu cuenta no es miembro de ella. ' +
    "Si te la compartieron, pide una invitación nueva.</p>" +
    '<div data-cuerpo class="oculto">' +
    // Índice de pasillos arriba y fijo (sticky) al hacer scroll: pedido del usuario, para
    // navegar una lista de ~170 artículos sin regresar hasta arriba.
    '<nav class="indice-pasillos" data-indice aria-label="Ir a un pasillo"></nav>' +
    '<div class="fila-miembros" data-fila-miembros></div>' +
    '<section class="tarjeta-resumen" data-resumen aria-live="polite" aria-label="Resumen de la lista"></section>' +
    '<form class="campo-rapido" data-form-rapido autocomplete="off">' +
    icono("search", 20) +
    '<input type="text" data-campo-rapido maxlength="130" enterkeyhint="done" ' +
    'placeholder="Busca o agrega: 2 kg tomate" aria-label="Buscar o agregar artículo">' +
    '<button type="button" class="btn-limpiar-busqueda oculto" data-limpiar-busqueda aria-label="Borrar lo escrito" title="Borrar lo escrito">' + icono("x", 20) + "</button>" +
    '<button type="submit" class="btn-agregar-rapido" aria-label="Agregar artículo" title="Agregar artículo">' + icono("plus", 22) + "</button>" +
    "</form>" +
    '<div class="acciones-lista" data-acciones></div>' +
    '<div data-articulos></div>' +
    "</div>" +
    "</div>";

  var tituloEl = contenedor.querySelector("[data-nombre-lista]");
  var cuerpo = contenedor.querySelector("[data-cuerpo]");
  var avisoSinAcceso = contenedor.querySelector("[data-sin-acceso]");
  var resumenEl = contenedor.querySelector("[data-resumen]");
  var indiceEl = contenedor.querySelector("[data-indice]");
  var ultimoResumen = ""; // aria-live: solo se reescribe si cambió, para no repetir el anuncio
  // Selector de vista en la barra inferior (pedido del usuario): reemplaza la pestaña "Lista".
  // Favoritos/Plantillas/Miembros salieron de la barra mientras no existan: con ellos no
  // caben las dos vistas con objetivos táctiles de 44 px (8 controles ≈ 372 px > 366 px).
  montarPestanas(
    '<div class="pestanas-vista" role="tablist" aria-label="Qué artículos ver">' +
      '<button type="button" role="tab" class="item-barra" data-vista="pendientes" title="Por comprar">' +
      icono("shopping-cart", 22) + '<span class="etiqueta-barra">Por comprar</span>' +
      '<span class="contador contador-barra" data-contador-pendientes></span></button>' +
      '<button type="button" role="tab" class="item-barra" data-vista="todo" title="Toda la lista">' +
      icono("list", 22) + '<span class="etiqueta-barra">Toda la lista</span></button>' +
      "</div>"
  );
  var ranuraPestanas = ranuraBarra("pestanas");
  var contadorEl = ranuraPestanas.querySelector("[data-contador-pendientes]");
  var zonaAcciones = contenedor.querySelector("[data-acciones]");
  var zonaArticulos = contenedor.querySelector("[data-articulos]");
  var formRapido = contenedor.querySelector("[data-form-rapido]");
  var campoRapido = contenedor.querySelector("[data-campo-rapido]");
  var botonLimpiar = contenedor.querySelector("[data-limpiar-busqueda]");
  function actualizarBotonLimpiar() {
    botonLimpiar.classList.toggle("oculto", !campoRapido.value);
  }
  var pestanasVista = ranuraPestanas.querySelectorAll("[data-vista]");

  // ===== Pintado =====

  // Contador (−) cantidad unidad (+) de "Toda la lista", tipo carrito de compras: la cantidad
  // y su unidad siempre visibles. Solo cambia la cantidad (no marca ni desmarca).
  function controlCantidad(a) {
    var n = typeof a.cantidad === "number" ? a.cantidad : 1;
    var unidad = a.unidad || "pieza";
    var paso = pasoDeUnidad(unidad);
    var textoPaso = String(paso) + " " + etiquetaUnidad(paso, unidad);
    var puedeBajar = siguienteCantidad(n, unidad, -1) !== null;
    var puedeSubir = siguienteCantidad(n, unidad, 1) !== null;
    var actual = String(Math.round(n * 100) / 100);
    return (
      '<div class="control-cantidad" role="group" aria-label="' + esc("Cantidad de " + a.nombre) + '">' +
      '<button type="button" class="btn-cantidad" data-cantidad="-1" data-id="' + esc(a.id) + '"' + (puedeBajar ? "" : " disabled") +
      ' aria-label="' + esc("Quitar " + textoPaso + " a " + a.nombre) + '" title="' + esc("Quitar " + textoPaso) + '">' + icono("minus", 18) + "</button>" +
      '<span class="valor-cantidad"><span class="numero-cantidad">' + esc(actual) + "</span>" +
      '<span class="unidad-cantidad">' + esc(etiquetaUnidad(n, unidad)) + "</span></span>" +
      '<button type="button" class="btn-cantidad btn-cantidad-mas" data-cantidad="1" data-id="' + esc(a.id) + '"' + (puedeSubir ? "" : " disabled") +
      ' aria-label="' + esc("Agregar " + textoPaso + " a " + a.nombre) + '" title="' + esc("Agregar " + textoPaso) + '">' + icono("plus", 18) + "</button>" +
      "</div>"
    );
  }

  function filaArticulo(a) {
    // En "Toda la lista" la cantidad vive en el contador y el subtotal baja al renglón de
    // detalle (no caben contador y precio a la derecha en un iPhone de 320 px).
    var conContador = vista === "todo";
    var detalle = [];
    var cantidad = textoCantidad(a.cantidad, a.unidad);
    if (cantidad && !conContador) detalle.push(esc(cantidad));
    if (a.notas) detalle.push('<span class="notas-articulo">' + esc(a.notas) + "</span>");
    // Quién lo marcó durante esta compra (registro de las últimas 24 h), si no fui yo.
    var porQuien = a.comprado && coordinacion ? coordinacion.recientePor(a.id) : null;
    if (porQuien && porQuien !== usuario.uid && miembrosLista) {
      detalle.push('<span class="por-quien">' + icono("check", 12) + " por " + esc(miembrosLista.nombreDe(porQuien)) + "</span>");
    }
    var precio = "";
    if (typeof a.precio === "number") {
      var n = typeof a.cantidad === "number" ? a.cantidad : 1;
      var subtotal = esc(formatoMoneda(n * a.precio, info.moneda));
      if (conContador) detalle.push('<span class="precio-detalle">' + subtotal + "</span>");
      else precio = '<span class="precio-articulo">' + subtotal + "</span>";
    }
    var etiquetaCasilla = a.comprado
      ? "Desmarcar " + a.nombre + " (poner por comprar)"
      : "Marcar " + a.nombre + " como comprado";
    return (
      '<li class="fila-articulo' + (a.comprado ? " marcado" : "") + (conContador ? " con-contador" : "") + '">' +
      '<button type="button" class="casilla" role="checkbox" aria-checked="' + (a.comprado ? "true" : "false") + '" ' +
      'data-alternar="' + esc(a.id) + '" aria-label="' + esc(etiquetaCasilla) + '" title="' + esc(etiquetaCasilla) + '">' +
      '<span class="casilla-circulo">' + icono("check", 18) + "</span>" +
      "</button>" +
      '<button type="button" class="cuerpo-articulo" data-editar="' + esc(a.id) + '" aria-label="Editar ' + esc(a.nombre) + '">' +
      '<span class="textos-articulo">' +
      '<span class="nombre-articulo">' + esc(a.nombre) + "</span>" +
      (detalle.length ? '<span class="detalle-articulo">' + detalle.join(" · ") + "</span>" : "") +
      "</span>" +
      // Miniatura al final del texto y antes del precio (pedido del usuario). Es un <span> dentro
      // del botón de editar (no puede haber botones anidados): tocarla abre la foto en grande, el
      // resto del renglón abre la edición; desde el formulario también se ve la foto con teclado.
      (a.fotoUrl
        ? '<span class="miniatura-fila" data-ver-foto="' + esc(a.id) + '" title="Ver la foto">' +
          '<img src="' + esc(a.fotoUrl) + '" alt="' + esc("Foto de " + a.nombre) + '" loading="lazy" decoding="async"></span>'
        : "") +
      precio +
      "</button>" +
      '<button type="button" class="btn-favorito" data-favorito="' + esc(a.id) + '" aria-pressed="' + (a.favorito ? "true" : "false") + '" ' +
      'aria-label="' + esc((a.favorito ? "Quitar de favoritos: " : "Marcar como favorito: ") + a.nombre) + '" ' +
      'title="' + (a.favorito ? "Quitar de favoritos" : "Marcar como favorito") + '">' + icono("star", 20) + "</button>" +
      (conContador ? controlCantidad(a) : "") +
      "</li>"
    );
  }

  // Renglón del editor de precios: nombre arriba; unidad y precio unitario abajo (en dos
  // líneas para que quepa en 320 px).
  function filaPrecio(a) {
    var unidad = a.unidad || "pieza";
    var precio = typeof a.precio === "number" ? String(a.precio) : "";
    return (
      '<li class="fila-articulo fila-precio' + (a.comprado ? " marcado" : "") + '">' +
      '<span class="nombre-articulo">' + esc(a.nombre) + "</span>" +
      '<div class="controles-precio">' +
      '<select class="select-unidad" data-unidad="' + esc(a.id) + '" aria-label="' + esc("Unidad de " + a.nombre) + '">' +
      opcionesUnidad(unidad) + "</select>" +
      '<label class="campo-precio">' +
      '<span class="simbolo-moneda" aria-hidden="true">$</span>' +
      '<input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" data-precio="' + esc(a.id) + '" ' +
      'value="' + esc(precio) + '" placeholder="Precio" aria-label="' + esc("Precio por " + etiquetaUnidad(1, unidad) + " de " + a.nombre) + '">' +
      "</label>" +
      '<span class="por-unidad" data-por-unidad>/ ' + esc(etiquetaUnidad(1, unidad)) + "</span>" +
      "</div>" +
      "</li>"
    );
  }

  function pintarGrupos(grupos, fila) {
    fila = fila || filaArticulo;
    return grupos
      .map(function (g) {
        return (
          '<section class="grupo-pasillo" id="p-' + esc(g.categoria) + '">' +
          '<h2 class="titulo-pasillo">' +
          '<span class="baldosa-pasillo ' + esc(clasePasillo(g.categoria)) + '" aria-hidden="true">' + icono(iconoPasillo(g.categoria), 18) + "</span>" +
          esc(g.nombre) + ' <span class="contador">' + g.articulos.length + "</span>" +
          '<button type="button" class="btn-agregar-pasillo" data-agregar-pasillo="' + esc(g.categoria) + '" ' +
          'aria-label="' + esc("Agregar un artículo a " + g.nombre) + '" title="' + esc("Agregar a " + g.nombre) + '">' + icono("plus", 18) + "</button></h2>" +
          '<ul class="lista-articulos">' + g.articulos.map(fila).join("") + "</ul>" +
          "</section>"
        );
      })
      .join("");
  }

  // Chips del índice: uno por pasillo visible, con el número de PENDIENTES de ese pasillo
  // (en "Toda la lista" también, porque es lo que importa al planear).
  function pintarIndice(grupos) {
    indiceEl.innerHTML = grupos
      .map(function (g) {
        var pendientes = g.articulos.filter(function (a) { return !a.comprado; }).length;
        return (
          '<a class="chip-pasillo ' + esc(clasePasillo(g.categoria)) + '" href="#p-' + esc(g.categoria) + '" ' +
          'aria-label="' + esc(g.nombre + ": " + pendientes + " por comprar") + '">' +
          '<span class="chip-numero" aria-hidden="true">' + pendientes + "</span>" +
          "<span>" + esc(g.nombre) + "</span></a>"
        );
      })
      .join("");
    requestAnimationFrame(marcarPasilloActual);
  }

  function pintarResumen(t) {
    var nota = t.pendientes === 0 ? "nada pendiente"
      : t.sinPrecio === 0 ? "todos con precio"
      : t.sinPrecio === 1 ? "1 sin precio" : t.sinPrecio + " sin precio";
    var html =
      '<div class="resumen-bloque">' +
      '<span class="resumen-etiqueta">Por comprar</span>' +
      '<span class="resumen-numero">' + t.pendientes + ' <span class="resumen-de">de ' + (t.pendientes + t.marcados) + "</span></span>" +
      "</div>" +
      '<div class="resumen-bloque resumen-derecha">' +
      '<span class="resumen-etiqueta">Estimado</span>' +
      '<span class="resumen-monto">' + esc(formatoMoneda(t.total, info.moneda)) + "</span>" +
      '<span class="resumen-nota">' + esc(nota) + "</span>" +
      "</div>";
    if (html !== ultimoResumen) {
      resumenEl.innerHTML = html;
      ultimoResumen = html;
    }
  }

  function pintar() {
    programarRender("vista-articulos", function () {
      if (!info.nombre) {
        cuerpo.classList.add("oculto");
        tituloEl.textContent = sinAcceso ? "No encontramos esta lista" : "Cargando…";
        avisoSinAcceso.classList.toggle("oculto", !sinAcceso);
        return;
      }
      tituloEl.textContent = info.nombre;
      avisoSinAcceso.classList.add("oculto");
      cuerpo.classList.remove("oculto");

      var t = totalesLista(articulos);
      contadorEl.textContent = t.pendientes ? String(t.pendientes) : "";
      pintarResumen(t);

      pestanasVista.forEach(function (b) {
        var activa = b.dataset.vista === vista;
        b.setAttribute("aria-selected", activa ? "true" : "false");
        b.classList.toggle("activo", activa);
        // Nombre accesible con el número: la etiqueta visible se oculta en la pestaña inactiva.
        b.setAttribute("aria-label", b.dataset.vista === "pendientes"
          ? "Por comprar (" + t.pendientes + ")" : "Toda la lista (" + (t.pendientes + t.marcados) + ")");
      });

      if (modoPrecios && t.pendientes + t.marcados > 0) {
        pintarEditorPrecios();
        return;
      }

      // Acciones según la vista (se ocultan mientras se busca, para no distraer).
      var acciones = "";
      var botonActividad = '<button type="button" class="btn-texto enlace-con-icono boton-actividad" data-accion="actividad">' +
        icono("history", 18) + "<span>Actividad</span></button>";
      var totalFavoritos = Object.keys(articulos).filter(function (k) { return articulos[k] && articulos[k].favorito; }).length;
      var botonFavoritos = '<button type="button" class="btn-texto enlace-con-icono boton-filtro-favoritos" data-accion="solo-favoritos" aria-pressed="' +
        (soloFavoritos ? "true" : "false") + '">' + icono("star", 18) + "<span>Favoritos (" + totalFavoritos + ")</span></button>";
      if (!filtro) {
        acciones = botonActividad + botonFavoritos;
        if (vista === "pendientes" && t.pendientes > 0) {
          acciones += '<button type="button" class="btn-texto enlace-con-icono" data-accion="marcar-todo">' +
            icono("check-check", 18) + "<span>Marcar todo como comprado</span></button>";
        } else if (vista === "todo") {
          acciones +=
            '<button type="button" class="btn-texto enlace-con-icono" data-accion="editar-precios">' +
            icono("pencil", 18) + "<span>Unidades y precios</span></button>" +
            '<button type="button" class="btn-texto enlace-con-icono" data-accion="pasillos">' +
            icono("tags", 18) + "<span>Pasillos</span></button>" +
            '<button type="button" class="btn-texto enlace-con-icono" data-accion="importar">' +
            icono("clipboard-list", 18) + "<span>Importar desde una nota</span></button>";
        }
      }
      zonaAcciones.innerHTML = acciones;

      var total = t.pendientes + t.marcados;
      if (total === 0) {
        indiceEl.innerHTML = "";
        zonaArticulos.innerHTML =
          '<div class="tarjeta tarjeta-vacia">' +
          '<span class="circulo-vacio" aria-hidden="true">' + icono("clipboard-list", 26) + "</span>" +
          '<p class="titulo-vacio">Esta lista está vacía</p>' +
          "<p>Escribe arriba para agregar un artículo, o pega tu lista desde una nota.</p>" +
          '<button type="button" class="btn" data-accion="importar">' + icono("clipboard-list", 18) + "<span>Importar desde una nota</span></button></div>";
        return;
      }

      if (filtro) {
        // Al buscar se ve TODO lo que coincide (marcado o no), para poder desmarcar algo que
        // ya existe en vez de agregarlo duplicado.
        var coincidencias = agruparArticulos(articulos, info.ordenCategorias, { categorias: categoriasLista(), soloFavoritos: soloFavoritos, filtro: filtro });
        indiceEl.innerHTML = ""; // al buscar, el índice estorba: se ve solo lo que coincide
        var exacto = buscarPorNombre(articulos, interpretarTextoRapido(filtro).nombre);
        var sugerencia = exacto
          ? ""
          : '<p class="pista-busqueda">Enter para agregar <strong>' + esc(interpretarTextoRapido(filtro).nombre) + "</strong> como nuevo.</p>";
        zonaArticulos.innerHTML = coincidencias.length
          ? sugerencia + pintarGrupos(coincidencias)
          : '<p class="vacio">Sin coincidencias. Enter para agregar <strong>' + esc(interpretarTextoRapido(filtro).nombre) + "</strong>.</p>";
        return;
      }

      var grupos = agruparArticulos(articulos, info.ordenCategorias, { categorias: categoriasLista(), soloFavoritos: soloFavoritos, soloPendientes: vista === "pendientes" });
      pintarIndice(grupos);
      var recientes = vista === "pendientes" ? seccionRecientes() : "";
      if (soloFavoritos && grupos.length === 0) {
        zonaArticulos.innerHTML = recientes +
          '<div class="tarjeta tarjeta-vacia">' +
          '<span class="circulo-vacio" aria-hidden="true">' + icono("star", 26) + "</span>" +
          '<p class="titulo-vacio">' + (vista === "pendientes" ? "Ningún favorito por comprar" : "Aún no tienes favoritos") + "</p>" +
          "<p>Toca la estrella de un artículo para marcarlo como favorito.</p>" +
          '<button type="button" class="btn btn-secundario" data-accion="solo-favoritos">Ver todos</button></div>';
        return;
      }
      if (vista === "pendientes" && grupos.length === 0) {
        zonaArticulos.innerHTML = recientes +
          '<div class="tarjeta tarjeta-vacia">' +
          '<span class="circulo-vacio" aria-hidden="true">' + icono("check", 28) + "</span>" +
          '<p class="titulo-vacio">Nada por comprar</p>' +
          "<p>En <strong>Toda la lista</strong> desmarca lo que necesites.</p>" +
          '<button type="button" class="btn btn-secundario" data-ir-vista="todo">Ver toda la lista</button></div>';
        return;
      }
      zonaArticulos.innerHTML = pintarGrupos(grupos) + recientes;
    });
  }

  // "Marcaste hace poco": red de seguridad para un toque equivocado en la tienda (el artículo
  // desaparece de "Por comprar"). Sale del registro de actividad: lo que YO marqué en los
  // últimos 15 min y sigue marcado. A diferencia del toast con Deshacer, no se pierde si llega
  // otro aviso ni al recargar.
  var MINUTOS_RECIENTES = 15;
  function seccionRecientes() {
    if (!coordinacion) return "";
    var lista = coordinacion.recientesMios(MINUTOS_RECIENTES).filter(function (e) {
      return articulos[e.articuloId] && articulos[e.articuloId].comprado;
    }).slice(0, 5);
    if (!lista.length) return "";
    return (
      '<section class="recien-marcados" aria-label="Marcaste hace poco">' +
      '<h2 class="titulo-recientes">' + icono("history", 18) + "Marcaste hace poco</h2>" +
      '<ul class="lista-articulos">' + lista.map(function (e) {
        var a = articulos[e.articuloId];
        return (
          '<li class="fila-reciente">' +
          '<span class="casilla-circulo casilla-hecha" aria-hidden="true">' + icono("check", 16) + "</span>" +
          '<span class="nombre-reciente">' + esc(a.nombre) + "</span>" +
          '<button type="button" class="btn-texto" data-regresar="' + esc(e.articuloId) + '" aria-label="' + esc("Regresar " + a.nombre + " a Por comprar") + '">' +
          icono("refresh-cw", 16) + "<span>Regresar</span></button>" +
          "</li>"
        );
      }).join("") + "</ul></section>"
    );
  }

  function pintarEditorPrecios() {
    var faltan = contarSinPrecio(articulos);
    zonaAcciones.innerHTML =
      '<div class="barra-editor-precios">' +
      '<button type="button" class="btn-chip' + (soloSinPrecio ? " activo" : "") + '" data-accion="solo-sin-precio" aria-pressed="' + (soloSinPrecio ? "true" : "false") + '">' +
      "Solo sin precio · " + faltan + "</button>" +
      '<button type="button" class="btn btn-chico" data-accion="salir-precios">' + icono("check", 18) + "<span>Listo</span></button>" +
      "</div>" +
      '<p class="pista-busqueda">Precio por unidad. Se guarda solo al salir de cada campo; Enter pasa al siguiente.</p>';
    if (editorPintado) return;
    var grupos = agruparArticulos(articulos, info.ordenCategorias, { categorias: categoriasLista(), soloFavoritos: soloFavoritos, filtro: filtro, soloSinPrecio: soloSinPrecio });
    if (filtro) indiceEl.innerHTML = "";
    else pintarIndice(grupos);
    zonaArticulos.innerHTML = grupos.length
      ? pintarGrupos(grupos, filaPrecio)
      : '<div class="tarjeta tarjeta-vacia"><span class="circulo-vacio" aria-hidden="true">' + icono("check", 28) + "</span>" +
        '<p class="titulo-vacio">' + (filtro ? "Sin coincidencias" : "Todos tienen precio") + "</p></div>";
    editorPintado = true;
  }

  function repintarEditor() {
    editorPintado = false;
    pintar();
  }

  // ===== Escrituras =====

  function fallo(mensaje) {
    return function (error) {
      console.error(mensaje, error);
      mostrarToast(mensaje);
    };
  }

  // escribirArticulo(id, campos, accion): campos del artículo + (si accion) el evento de
  // actividad, en UNA escritura multi-ruta. accion: "marco" | "desmarco" | null.
  function escribirArticulo(id, campos, accion) {
    var cambios = {};
    Object.keys(campos).forEach(function (k) {
      cambios[rutaArticulo(id) + "/" + k] = campos[k];
    });
    if (accion && coordinacion) coordinacion.agregarEvento(cambios, id, (articulos[id] || {}).nombre, accion);
    return actualizarMultiple(cambios);
  }

  // alternar(id): marcar ↔ desmarcar, campo por campo. En "Por comprar" el artículo
  // desaparece al marcarlo, así que ahí se ofrece Deshacer (un toque equivocado en la tienda
  // es fácil); en "Toda la lista" el cambio se ve en su lugar y no hace falta.
  function alternar(id) {
    var a = articulos[id];
    if (!a) return;
    var antes = { comprado: !!a.comprado, compradoPor: a.compradoPor || null };
    var ahora = !a.comprado;
    escribirArticulo(id, { comprado: ahora, compradoPor: ahora ? usuario.uid : null }, ahora ? "marco" : "desmarco")
      .catch(fallo("No se pudo guardar el cambio"));
    if (vista === "pendientes" && !filtro && ahora) {
      mostrarToast(a.nombre + " marcado", {
        accion: {
          etiqueta: "Deshacer",
          alActivar: function () {
            escribirArticulo(id, antes, antes.comprado ? "marco" : "desmarco").catch(fallo("No se pudo deshacer"));
          }
        }
      });
    }
  }

  // (+)/(−): TRANSACCIÓN sobre la cantidad. Si dos personas tocan "+" a la vez sobre
  // "2 pzas", Firebase reintenta con el valor real del servidor y quedan 4 (con una escritura
  // simple las dos escribirían 3 y se perdería un toque). Sin toast: el cambio se ve en el
  // contador y se deshace con el botón contrario.
  function cambiarCantidad(id, direccion) {
    var a = articulos[id];
    if (!a) return;
    var unidad = a.unidad || "pieza";
    if (siguienteCantidad(a.cantidad, unidad, direccion) === null) return;
    if (!a.unidad) actualizar(refArticulo(id), { unidad: "pieza" }).catch(function () {});
    refArticulo(id).child("cantidad").transaction(function (actual) {
      // null en el primer intento puede ser solo el caché local: se asume 1 y, si el servidor
      // tenía otro valor, Firebase vuelve a llamar con el real.
      var nueva = siguienteCantidad(actual === null ? 1 : actual, unidad, direccion);
      return nueva === null ? undefined : nueva; // undefined = cancelar
    }).catch(fallo("No se pudo cambiar la cantidad"));
  }

  // Marca breve de "guardado" en el campo (sin toast: serían cientos de avisos).
  function senalarGuardado(el) {
    el.classList.remove("invalido");
    el.removeAttribute("aria-invalid");
    el.classList.add("guardado");
    setTimeout(function () { el.classList.remove("guardado"); }, 1200);
  }

  // Editor de precios: precio unitario, campo por campo. Vacío = sin precio.
  function guardarPrecio(input) {
    var id = input.dataset.precio;
    var a = articulos[id];
    if (!a) return;
    var precio = _numeroDeCampo(input.value);
    if (precio !== null && (!(precio >= 0) || precio >= 10000000)) {
      input.classList.add("invalido");
      input.setAttribute("aria-invalid", "true");
      mostrarToast("Precio no válido: escribe solo el número, p. ej. 28.50");
      return;
    }
    if (precio !== null) precio = Math.round(precio * 100) / 100;
    var anterior = typeof a.precio === "number" ? a.precio : null;
    input.value = precio === null ? "" : String(precio); // "28,5" → "28.5"
    if (precio === anterior) {
      input.classList.remove("invalido");
      input.removeAttribute("aria-invalid");
      return;
    }
    actualizar(refArticulo(id), { precio: precio })
      .then(function () { senalarGuardado(input); })
      .catch(fallo("No se pudo guardar el precio"));
  }

  // Cambiar la unidad ajusta la cantidad si hace falta (1 pza → 100 g) y el "/ unidad".
  function guardarUnidad(select) {
    var id = select.dataset.unidad;
    var a = articulos[id];
    if (!a) return;
    var unidad = select.value;
    if (unidad === (a.unidad || "pieza")) return;
    var fila = select.closest(".fila-precio");
    var etiqueta = etiquetaUnidad(1, unidad);
    fila.querySelector("[data-por-unidad]").textContent = "/ " + etiqueta;
    fila.querySelector("[data-precio]").setAttribute("aria-label", "Precio por " + etiqueta + " de " + a.nombre);
    actualizar(refArticulo(id), { unidad: unidad, cantidad: cantidadParaUnidad(a.cantidad, unidad) })
      .then(function () { senalarGuardado(select); })
      .catch(fallo("No se pudo guardar la unidad"));
  }

  function crearArticulo(datos) {
    var id = refArticulos.push().key;
    var articulo = {
      nombre: datos.nombre,
      cantidad: datos.cantidad || 1,
      unidad: datos.unidad || "pieza",
      categoria: categoriaValida(datos.categoria, categoriasLista()),
      comprado: !!datos.comprado,
      agregadoPor: usuario.uid,
      creado: firebase.database.ServerValue.TIMESTAMP
    };
    if (typeof datos.precio === "number") articulo.precio = datos.precio;
    if (datos.notas) articulo.notas = datos.notas;
    if (datos.fotoUrl) articulo.fotoUrl = datos.fotoUrl;
    if (articulo.comprado) articulo.compradoPor = usuario.uid;
    return refArticulo(id).set(articulo).then(function () {
      return id;
    });
  }

  // Enter en el campo rápido: si ya existe un artículo con ese nombre, se pone "por
  // comprar" (con la cantidad escrita, si se escribió una) en vez de duplicarlo; si no, se
  // abre el formulario de artículo ya con lo escrito (nombre, cantidad, unidad) para que la
  // persona ELIJA el pasillo: pedido del usuario, no se deja en "Especiales" por defecto.
  function agregarRapido(texto) {
    var datos = interpretarTextoRapido(texto);
    if (!datos.nombre) return;
    var existente = buscarPorNombre(articulos, datos.nombre);
    var trajoCantidad = /^\d/.test(texto.trim());
    if (existente) {
      var a = articulos[existente];
      var cambios = {};
      if (a.comprado) {
        cambios.comprado = false;
        cambios.compradoPor = null;
      }
      if (trajoCantidad) {
        cambios.cantidad = datos.cantidad;
        cambios.unidad = datos.unidad;
      }
      if (Object.keys(cambios).length === 0) {
        mostrarToast(a.nombre + " ya está por comprar");
        return;
      }
      var antes = { comprado: !!a.comprado, compradoPor: a.compradoPor || null, cantidad: a.cantidad === undefined ? null : a.cantidad, unidad: a.unidad || null };
      escribirArticulo(existente, cambios, a.comprado ? "desmarco" : null).catch(fallo("No se pudo guardar el cambio"));
      mostrarToast(a.nombre + " está por comprar", {
        accion: {
          etiqueta: "Deshacer",
          alActivar: function () {
            var revertir = { comprado: antes.comprado, compradoPor: antes.compradoPor };
            if (trajoCantidad) {
              revertir.cantidad = antes.cantidad;
              revertir.unidad = antes.unidad;
            }
            escribirArticulo(existente, revertir, antes.comprado ? "marco" : null).catch(fallo("No se pudo deshacer"));
          }
        }
      });
      return;
    }
    abrirFormularioArticulo(null, {
      nombre: datos.nombre.slice(0, LARGO_MAX_NOMBRE),
      cantidad: String(datos.cantidad),
      unidad: datos.unidad
    });
  }

  function eliminarArticulo(id) {
    var copia = Object.assign({}, articulos[id]);
    eliminar(refArticulo(id))
      .then(function () {
        mostrarToast((copia.nombre || "Artículo") + " eliminado", {
          accion: {
            etiqueta: "Deshacer",
            alActivar: function () {
              // Se restaura tal cual (mismo id, misma autoría): las reglas lo permiten a
              // cualquier miembro, probado en pruebas/reglas.
              refArticulo(id).set(copia).catch(fallo("No se pudo deshacer"));
            }
          }
        });
      })
      .catch(fallo("No se pudo eliminar el artículo"));
  }

  // Marcar todo = UNA escritura multi-ruta (atómica: o se marcan todos o ninguno).
  function marcarTodo() {
    var ids = Object.keys(articulos).filter(function (id) {
      return articulos[id] && articulos[id].nombre && !articulos[id].comprado;
    });
    if (!ids.length) return;
    var cambios = {};
    var revertir = {};
    ids.forEach(function (id) {
      cambios[rutaArticulo(id) + "/comprado"] = true;
      cambios[rutaArticulo(id) + "/compradoPor"] = usuario.uid;
      revertir[rutaArticulo(id) + "/comprado"] = false;
      revertir[rutaArticulo(id) + "/compradoPor"] = articulos[id].compradoPor || null;
      if (coordinacion) {
        coordinacion.agregarEvento(cambios, id, articulos[id].nombre, "marco");
        coordinacion.agregarEvento(revertir, id, articulos[id].nombre, "desmarco");
      }
    });
    actualizarMultiple(cambios)
      .then(function () {
        mostrarToast(ids.length === 1 ? "1 artículo marcado" : ids.length + " artículos marcados", {
          accion: {
            etiqueta: "Deshacer",
            alActivar: function () {
              actualizarMultiple(revertir).catch(fallo("No se pudo deshacer"));
            }
          }
        });
      })
      .catch(fallo("No se pudieron marcar los artículos"));
  }

  // ===== Formulario agregar / editar (comparten formulario) =====

  function opcionesCategoria(seleccionada) {
    var cats = categoriasLista();
    // Artículo nuevo sin pasillo de origen: nada elegido de antemano (hay que escoger uno).
    return (seleccionada ? "" : '<option value="" selected disabled>Elige un pasillo…</option>') + ordenCategoriasEfectivo(info.ordenCategorias, cats)
      .map(function (id) {
        return '<option value="' + esc(id) + '"' + (id === seleccionada ? " selected" : "") + ">" + esc(cats[id]) + "</option>";
      })
      .join("");
  }

  function opcionesUnidad(seleccionada) {
    var unidades = UNIDADES_DEFECTO.slice();
    // Un dato con una unidad que ya no está en el catálogo se conserva como opción.
    if (seleccionada && unidades.indexOf(seleccionada) === -1) unidades.push(seleccionada);
    return unidades
      .map(function (u) {
        return '<option value="' + esc(u) + '"' + (u === seleccionada ? " selected" : "") + ">" + esc(u) + "</option>";
      })
      .join("");
  }

  // prefill (solo artículo nuevo): { nombre, cantidad, unidad, categoria } con lo que ya se sabe
  // (lo escrito en el campo rápido, o el pasillo desde donde se tocó su "+").
  function abrirFormularioArticulo(idExistente, prefill) {
    prefill = prefill || {};
    var a = idExistente ? articulos[idExistente] : null;
    if (idExistente && !a) return;
    var inicial = {
      nombre: a ? a.nombre : prefill.nombre || "",
      cantidad: a && typeof a.cantidad === "number" ? String(a.cantidad) : prefill.cantidad || "1",
      unidad: a && a.unidad ? a.unidad : prefill.unidad || "pieza",
      categoria: a ? categoriaValida(a.categoria, categoriasLista()) : prefill.categoria && categoriasLista()[prefill.categoria] ? prefill.categoria : "",
      precio: a && typeof a.precio === "number" ? String(a.precio) : "",
      notas: a && a.notas ? a.notas : "",
      fotoUrl: a && a.fotoUrl ? a.fotoUrl : ""
    };
    var fotoActual = inicial.fotoUrl; // URL elegida en este formulario ("" = sin foto)
    var subidas = []; // rutas de Storage subidas en este formulario (para descartar las que no queden)
    var rutaVigente = null; // la subida que corresponde a fotoActual, si fue subida aquí
    var guardado = false;
    var modal = abrirModal(
      "<h3>" + (a ? "Editar artículo" : "Nuevo artículo") + "</h3>" +
        '<form data-form-articulo novalidate>' +
        '<div class="campo"><label for="art-nombre">Nombre</label>' +
        '<input id="art-nombre" name="nombre" type="text" maxlength="120" required value="' + esc(inicial.nombre) + '"></div>' +
        // Orden pedido por el usuario: nombre / pasillo / unidad + precio / notas. La cantidad
        // no tiene campo: se cambia con (−)/(+) en el renglón de la lista.
        '<div class="campo"><label for="art-categoria">Pasillo</label>' +
        '<select id="art-categoria" name="categoria">' + opcionesCategoria(inicial.categoria) + "</select></div>" +
        '<div class="fila-campos">' +
        '<div class="campo"><label for="art-unidad">Unidad</label>' +
        '<select id="art-unidad" name="unidad">' + opcionesUnidad(inicial.unidad) + "</select></div>" +
        '<div class="campo"><label for="art-precio">Precio unitario</label>' +
        '<input id="art-precio" name="precio" type="text" inputmode="decimal" placeholder="Opcional" value="' + esc(inicial.precio) + '"></div>' +
        "</div>" +
        '<div class="campo"><label for="art-notas">Notas</label>' +
        '<textarea id="art-notas" name="notas" rows="3" maxlength="200" placeholder="Opcional (marca, tamaño…)">' + esc(inicial.notas) + "</textarea></div>" +
        '<div class="campo"><span class="etiqueta-campo">Foto</span><div class="zona-foto" data-zona-foto></div></div>' +
        '<p class="error-formulario oculto" data-error role="alert"></p>' +
        '<div class="fila-botones">' +
        (a
          ? '<button type="button" class="btn-accion-icono btn-accion-peligro" data-eliminar aria-label="Eliminar artículo" title="Eliminar artículo">' + icono("trash-2", 20) + "</button>" +
            '<span class="separador-flexible"></span>'
          : "") +
        '<button type="button" class="btn-accion-icono" data-cancelar aria-label="Cancelar" title="Cancelar">' + icono("x", 20) + "</button>" +
        '<button type="submit" class="btn-accion-icono btn-accion-primario" aria-label="Guardar" title="Guardar">' + icono("save", 20) + "</button>" +
        "</div>" +
        "</form>",
      // Al cerrar: lo subido a Storage en este formulario que no quedó guardado se borra.
      function () {
        subidas.forEach(function (ruta) {
          if (!guardado || ruta !== rutaVigente) borrarFotoSubida(ruta);
        });
      },
      // Tocar fuera / Escape con cambios: preguntar en vez de perder lo capturado.
      { hayCambios: function () { return hayCambios(); }, guardar: function () { guardar(); } }
    );
    var form = modal.elemento.querySelector("[data-form-articulo]");
    var errorEl = modal.elemento.querySelector("[data-error]");
    var zonaFoto = modal.elemento.querySelector("[data-zona-foto]");

    function pintarFoto() {
      zonaFoto.innerHTML = fotoActual
        ? '<button type="button" class="miniatura-foto" data-foto-ver aria-label="Ver la foto" title="Ver la foto">' +
          '<img src="' + esc(fotoActual) + '" alt=""></button>' +
          '<button type="button" class="btn-accion-icono" data-foto-cambiar aria-label="Cambiar la foto" title="Cambiar la foto">' + icono("image", 20) + "</button>" +
          '<button type="button" class="btn-accion-icono btn-accion-peligro" data-foto-quitar aria-label="Quitar la foto" title="Quitar la foto">' + icono("trash-2", 20) + "</button>"
        : '<button type="button" class="foto-agregar" data-foto-agregar aria-label="Agregar una foto" title="Agregar una foto">' + icono("plus", 24) + "</button>";
    }
    pintarFoto();

    function elegirFoto() {
      abrirSelectorFoto({
        listaId: listaId,
        uid: usuario.uid,
        alElegir: function (foto) {
          // La subida anterior hecha en ESTE formulario ya no hace falta.
          if (rutaVigente) {
            borrarFotoSubida(rutaVigente);
            subidas = subidas.filter(function (r) { return r !== rutaVigente; });
          }
          rutaVigente = foto.ruta;
          if (foto.ruta) subidas.push(foto.ruta);
          fotoActual = foto.url;
          pintarFoto();
        }
      });
    }
    zonaFoto.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-foto-agregar], [data-foto-cambiar]")) elegirFoto();
      else if (ev.target.closest("[data-foto-ver]")) verFoto(fotoActual, inicial.nombre || form.nombre.value);
      else if (ev.target.closest("[data-foto-quitar]")) {
        if (rutaVigente) {
          borrarFotoSubida(rutaVigente);
          subidas = subidas.filter(function (r) { return r !== rutaVigente; });
          rutaVigente = null;
        }
        fotoActual = "";
        pintarFoto();
      }
    });

    function valores() {
      return {
        nombre: form.nombre.value.replace(/\s+/g, " ").trim(),
        cantidad: inicial.cantidad, // sin campo en el formulario: se conserva (o viene del campo rápido)
        unidad: form.unidad.value,
        categoria: form.categoria.value,
        precio: form.precio.value.trim(),
        notas: form.notas.value.trim(),
        fotoUrl: fotoActual
      };
    }

    function hayCambios() {
      var v = valores();
      return Object.keys(inicial).some(function (k) {
        return String(v[k]) !== String(inicial[k]);
      });
    }

    function mostrarError(texto) {
      errorEl.textContent = texto;
      errorEl.classList.remove("oculto");
    }

    function guardar() {
      var v = valores();
      if (!v.nombre) return mostrarError("Escribe el nombre del artículo.");
      if (!v.categoria) return mostrarError("Elige el pasillo del artículo.");
      var cantidad = _numeroDeCampo(v.cantidad);
      if (cantidad === null) cantidad = 1;
      if (!(cantidad > 0) || cantidad > 9999) return mostrarError("La cantidad debe ser un número mayor que 0.");
      var precio = _numeroDeCampo(v.precio);
      if (precio !== null && (!(precio >= 0) || precio >= 10000000)) return mostrarError("El precio debe ser un número (o déjalo vacío).");
      if (precio !== null) precio = Math.round(precio * 100) / 100;

      if (!a) {
        guardado = true;
        crearArticulo({ nombre: v.nombre, cantidad: cantidad, unidad: v.unidad, categoria: v.categoria, precio: precio, notas: v.notas, fotoUrl: v.fotoUrl, comprado: false })
          .then(function () { mostrarToast("Guardado ✓"); })
          .catch(fallo("No se pudo guardar el artículo"));
        modal.cerrar("manual");
        return;
      }
      // Edición campo por campo: solo lo que cambió; vaciar precio o notas los borra.
      var cambios = {};
      if (v.nombre !== a.nombre) cambios.nombre = v.nombre;
      if (cantidad !== a.cantidad) cambios.cantidad = cantidad;
      if (v.unidad !== a.unidad) cambios.unidad = v.unidad;
      if (v.categoria !== a.categoria) cambios.categoria = v.categoria;
      if (precio !== (typeof a.precio === "number" ? a.precio : null)) cambios.precio = precio;
      if ((v.notas || null) !== (a.notas || null)) cambios.notas = v.notas || null;
      if ((v.fotoUrl || null) !== (a.fotoUrl || null)) cambios.fotoUrl = v.fotoUrl || null;
      guardado = true;
      modal.cerrar("manual");
      if (!Object.keys(cambios).length) return;
      actualizar(refArticulo(idExistente), cambios)
        .then(function () { mostrarToast("Guardado ✓"); })
        .catch(fallo("No se pudo guardar el artículo"));
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      guardar();
    });
    modal.elemento.querySelector("[data-cancelar]").addEventListener("click", function () {
      confirmarCierreConCambios(hayCambios, function () { modal.cerrar("manual"); }, guardar);
    });
    var botonEliminar = modal.elemento.querySelector("[data-eliminar]");
    if (botonEliminar) {
      botonEliminar.addEventListener("click", function () {
        modal.cerrar("manual");
        eliminarArticulo(idExistente);
      });
    }
  }


  // ===== Pasillos: renombrar, crear y eliminar (solo vacíos) =====

  // Cada cambio se guarda al instante, como el editor de unidades y precios (no hay botón
  // Guardar). Todo va en UNA escritura multi-ruta sobre listas/{id}/info (escrituraCategorias).
  function escribirPasillos(nuevas, orden) {
    var cambios = escrituraCategorias(info, nuevas, orden);
    var multi = {};
    Object.keys(cambios).forEach(function (ruta) {
      multi["listas/" + listaId + "/info/" + ruta] = cambios[ruta];
    });
    return actualizarMultiple(multi);
  }

  function abrirPasillos() {
    if (gestorPasillos || !info.nombre) return;
    var modal = abrirModal(
      "<h3>Pasillos</h3>" +
        '<p class="texto-suave">Cambia el nombre, crea pasillos nuevos o elimina los que estén vacíos. ' +
        "Los cambios se guardan al momento y los ven todos los miembros de la lista.</p>" +
        '<ul class="lista-pasillos" data-lista-pasillos></ul>' +
        '<form class="fila-campos fila-nuevo-pasillo" data-form-pasillo novalidate autocomplete="off">' +
        '<div class="campo"><label for="pasillo-nuevo">Nuevo pasillo</label>' +
        '<input id="pasillo-nuevo" name="nombre" type="text" maxlength="' + LARGO_MAX_CATEGORIA + '" placeholder="Ej. Mascotas"></div>' +
        '<button type="submit" class="btn btn-secundario">' + icono("plus", 18) + "<span>Agregar</span></button>" +
        "</form>" +
        '<p class="error-formulario oculto" data-error role="alert"></p>' +
        // Los avisos van DENTRO de la hoja (no como toast): los toasts quedan debajo de los
        // modales por diseño y el Deshacer de un pasillo eliminado no se podría tocar.
        '<div class="aviso-pasillos oculto" data-aviso role="status"><span data-aviso-texto></span>' +
        '<button type="button" class="btn-texto" data-deshacer-pasillo>Deshacer</button></div>' +
        '<div class="fila-botones"><button type="button" class="btn" data-cerrar>Listo</button></div>',
      function () { gestorPasillos = null; }
    );
    var listaEl = modal.elemento.querySelector("[data-lista-pasillos]");
    var formNuevo = modal.elemento.querySelector("[data-form-pasillo]");
    var errorEl = modal.elemento.querySelector("[data-error]");
    var avisoEl = modal.elemento.querySelector("[data-aviso]");
    var deshacerPasillo = null; // qué hace el botón Deshacer del aviso (solo tras eliminar)

    function mostrarError(texto) {
      errorEl.textContent = texto;
      errorEl.classList.toggle("oculto", !texto);
    }

    function avisar(texto, deshacer) {
      deshacerPasillo = deshacer || null;
      avisoEl.querySelector("[data-aviso-texto]").textContent = texto;
      avisoEl.querySelector("[data-deshacer-pasillo]").classList.toggle("oculto", !deshacer);
      avisoEl.classList.remove("oculto");
    }

    function repintar() {
      var cats = categoriasLista();
      var conteo = contarPorCategoria(articulos, cats);
      listaEl.innerHTML = ordenCategoriasEfectivo(info.ordenCategorias, cats)
        .map(function (id) {
          var n = conteo[id] || 0;
          var porque = id === CATEGORIA_DEFECTO ? "Especiales es el pasillo de respaldo y no se puede eliminar"
            : n ? "No se puede eliminar: tiene " + n + (n === 1 ? " artículo" : " artículos") : "Eliminar pasillo";
          return (
            '<li class="fila-pasillo">' +
            '<span class="baldosa-pasillo ' + esc(clasePasillo(id)) + '" aria-hidden="true">' + icono(iconoPasillo(id), 18) + "</span>" +
            '<input type="text" class="campo-pasillo" data-pasillo="' + esc(id) + '" maxlength="' + LARGO_MAX_CATEGORIA + '" value="' + esc(cats[id]) + '" ' +
            'aria-label="' + esc("Nombre del pasillo " + cats[id]) + '">' +
            '<span class="cuenta-pasillo">' + n + "</span>" +
            '<button type="button" class="btn-accion-icono btn-accion-peligro" data-quitar-pasillo="' + esc(id) + '"' +
            (id === CATEGORIA_DEFECTO || n ? " disabled" : "") +
            ' aria-label="' + esc(porque + " (" + cats[id] + ")") + '" title="' + esc(porque) + '">' + icono("trash-2", 18) + "</button>" +
            "</li>"
          );
        })
        .join("");
    }

    gestorPasillos = { elemento: modal.elemento, repintar: repintar };
    repintar();

    function renombrar(campo) {
      var id = campo.dataset.pasillo;
      var cats = categoriasLista();
      if (!cats[id]) return;
      var v = validarNombreCategoria(campo.value, cats, id);
      if (!v.ok) {
        mostrarError(v.error);
        campo.value = cats[id];
        return;
      }
      mostrarError("");
      if (v.nombre === cats[id]) {
        campo.value = v.nombre;
        return;
      }
      var nuevas = Object.assign({}, cats);
      nuevas[id] = v.nombre;
      escribirPasillos(nuevas, info.ordenCategorias)
        .then(function () { avisar("Pasillo renombrado ✓"); })
        .catch(fallo("No se pudo renombrar el pasillo"));
    }

    function crear() {
      var cats = categoriasLista();
      var v = validarNombreCategoria(formNuevo.nombre.value, cats, null);
      if (!v.ok) return mostrarError(v.error);
      mostrarError("");
      var id = idNuevaCategoria(cats);
      var nuevas = Object.assign({}, cats);
      nuevas[id] = v.nombre;
      var orden = ordenCategoriasEfectivo(info.ordenCategorias, cats).concat(id);
      formNuevo.nombre.value = "";
      escribirPasillos(nuevas, orden)
        .then(function () { avisar("Pasillo «" + v.nombre + "» creado ✓"); })
        .catch(fallo("No se pudo crear el pasillo"));
    }

    function quitar(id) {
      var cats = categoriasLista();
      if (!cats[id] || id === CATEGORIA_DEFECTO) return;
      // Se revisa de nuevo con lo más reciente: otro miembro pudo agregar algo a este pasillo.
      if ((contarPorCategoria(articulos, cats)[id] || 0) > 0) {
        mostrarError("Ese pasillo ya tiene artículos: muévelos a otro pasillo para poder eliminarlo.");
        return;
      }
      mostrarError("");
      var nombre = cats[id];
      var ordenAntes = ordenCategoriasEfectivo(info.ordenCategorias, cats);
      var nuevas = Object.assign({}, cats);
      delete nuevas[id];
      escribirPasillos(nuevas, ordenAntes.filter(function (x) { return x !== id; }))
        .then(function () {
          avisar("Pasillo «" + nombre + "» eliminado", function () {
            var actuales = categoriasLista();
            if (actuales[id]) return;
            var restauradas = Object.assign({}, actuales);
            restauradas[id] = nombre;
            var orden = ordenCategoriasEfectivo(info.ordenCategorias, actuales);
            orden.splice(Math.min(ordenAntes.indexOf(id), orden.length), 0, id);
            escribirPasillos(restauradas, orden)
              .then(function () { avisar("Pasillo «" + nombre + "» restaurado ✓"); })
              .catch(fallo("No se pudo deshacer"));
          });
        })
        .catch(fallo("No se pudo eliminar el pasillo"));
    }

    listaEl.addEventListener("change", function (ev) {
      if (ev.target.matches("[data-pasillo]")) renombrar(ev.target);
    });
    listaEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.matches("[data-pasillo]")) {
        ev.preventDefault();
        ev.target.blur(); // el cambio de foco dispara "change" y guarda
      }
    });
    listaEl.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-quitar-pasillo]");
      if (b && !b.disabled) quitar(b.dataset.quitarPasillo);
    });
    avisoEl.querySelector("[data-deshacer-pasillo]").addEventListener("click", function () {
      if (deshacerPasillo) deshacerPasillo();
    });
    formNuevo.addEventListener("submit", function (ev) {
      ev.preventDefault();
      crear();
    });
    modal.elemento.querySelector("[data-cerrar]").addEventListener("click", function () {
      var pendiente = formNuevo.nombre.value.trim();
      if (pendiente) crear(); // "Listo" con un nombre escrito y sin agregar: no se pierde
      modal.cerrar("manual");
    });
  }

  // ===== Importar desde una nota =====

  function abrirImportar() {
    var modal = abrirModal(
      "<h3>Importar desde una nota</h3>" +
        '<p class="texto-suave">Pega tu lista. Cada renglón con el nombre de un pasillo (Frutas, Verduras, ' +
        "Abarrotes…, o uno que tú hayas creado) abre esa sección, y cada renglón con viñeta (<code>* Plátanos</code>) " +
        "o que empiece con tabulador es un artículo. Un renglón con otro nombre, seguido de artículos, " +
        "<strong>crea un pasillo nuevo</strong> con ese nombre. " +
        "Todo entra <strong>marcado</strong> (no hace falta); después desmarca lo que necesites comprar.</p>" +
        '<div class="campo"><label for="texto-importar">Tu lista</label>' +
        '<textarea id="texto-importar" rows="8" maxlength="30000" placeholder="Frutas&#10;* Plátanos&#10;* Mangos"></textarea></div>' +
        '<div data-vista-previa aria-live="polite"></div>' +
        '<div class="fila-botones">' +
        '<button type="button" class="btn btn-secundario" data-cancelar>Cancelar</button>' +
        '<button type="button" class="btn" data-importar disabled>Importar</button>' +
        "</div>",
      null,
      { hayCambios: function () { return !!area.value.trim(); }, guardar: function () { importar(); } }
    );
    var area = modal.elemento.querySelector("#texto-importar");
    var previa = modal.elemento.querySelector("[data-vista-previa]");
    var botonImportar = modal.elemento.querySelector("[data-importar]");
    var porAgregar = [];
    var pasillosDeLaNota = []; // pasillos que trae la nota y la lista aún no tiene

    function actualizarPrevia() {
      var cats = categoriasLista();
      var r = parsearNotaImportada(area.value, cats);
      var s = separarRepetidos(r.articulos, articulos, cats);
      porAgregar = s.aAgregar;
      pasillosDeLaNota = r.nuevos;
      botonImportar.disabled = porAgregar.length === 0;
      botonImportar.textContent = porAgregar.length ? "Importar " + porAgregar.length : "Importar";
      if (!area.value.trim()) {
        previa.innerHTML = "";
        return;
      }
      var porCategoria = {};
      porAgregar.forEach(function (n) {
        porCategoria[n.categoria] = (porCategoria[n.categoria] || 0) + 1;
      });
      var html = '<div class="tarjeta vista-previa-importar"><p><strong>' + porAgregar.length + "</strong> artículos nuevos";
      if (s.repetidos.length) html += " · " + s.repetidos.length + " ya estaban en la lista (no se duplican)";
      html += "</p>";
      // Los pasillos nuevos de la nota se listan con su nombre y la marca "(nuevo)".
      var nombresNuevos = {};
      r.nuevos.forEach(function (n) { nombresNuevos["nuevo:" + n.clave] = n.nombre; });
      var ids = ordenCategoriasEfectivo(info.ordenCategorias, cats).filter(function (c) { return porCategoria[c]; });
      var idsNuevos = Object.keys(nombresNuevos).filter(function (c) { return porCategoria[c]; });
      if (ids.length || idsNuevos.length) {
        html += '<ul class="resumen-importar">' +
          ids.map(function (c) { return "<li>" + esc(cats[c]) + ": " + porCategoria[c] + "</li>"; }).join("") +
          idsNuevos.map(function (c) { return "<li>" + esc(nombresNuevos[c]) + " <em>(pasillo nuevo)</em>: " + porCategoria[c] + "</li>"; }).join("") +
          "</ul>";
      }
      if (r.ignorados.length) {
        html += '<p class="texto-suave">Renglones que no son pasillo ni artículo (se ignoran): ' +
          r.ignorados.slice(0, 5).map(function (t) { return "<q>" + esc(t.length > 60 ? t.slice(0, 60) + "…" : t) + "</q>"; }).join(", ") +
          (r.ignorados.length > 5 ? " y " + (r.ignorados.length - 5) + " más" : "") + "</p>";
      }
      previa.innerHTML = html + "</div>";
    }

    area.addEventListener("input", actualizarPrevia);
    modal.elemento.querySelector("[data-cancelar]").addEventListener("click", function () {
      confirmarCierreConCambios(function () { return !!area.value.trim(); }, function () { modal.cerrar("manual"); }, importar);
    });
    botonImportar.addEventListener("click", importar);

    // UNA escritura multi-ruta con todos los artículos. Las llaves push se generan en orden,
    // y como son cronológicas, la lista conserva el orden de la nota dentro de cada pasillo.
    function importar() {
      if (!porAgregar.length) return;
      var cambios = {};
      var deshacer = {};
      // Pasillos nuevos de la nota que sí tienen artículos por agregar: se crean en ESTA misma
      // escritura (escrituraCategorias deja `info.categorias` completo si aún no lo estaba).
      var cats = categoriasLista();
      var idPorClave = {};
      var nuevas = Object.assign({}, cats);
      pasillosDeLaNota.forEach(function (p) {
        if (!porAgregar.some(function (n) { return n.categoria === "nuevo:" + p.clave; })) return;
        var idNuevo = idNuevaCategoria(nuevas);
        idPorClave["nuevo:" + p.clave] = idNuevo;
        nuevas[idNuevo] = p.nombre;
      });
      var idsCreados = Object.keys(idPorClave).map(function (k) { return idPorClave[k]; });
      if (idsCreados.length) {
        var rutasPasillos = escrituraCategorias(info, nuevas, ordenCategoriasEfectivo(info.ordenCategorias, cats).concat(idsCreados));
        Object.keys(rutasPasillos).forEach(function (ruta) {
          cambios["listas/" + listaId + "/info/" + ruta] = rutasPasillos[ruta];
        });
        // Deshacer también quita los pasillos que la importación creó.
        idsCreados.forEach(function (idNuevo) { deshacer["listas/" + listaId + "/info/categorias/" + idNuevo] = null; });
      }
      porAgregar.forEach(function (n) {
        var id = refArticulos.push().key;
        cambios[rutaArticulo(id)] = {
          nombre: n.nombre,
          cantidad: 1,
          unidad: "pieza",
          categoria: idPorClave[n.categoria] || n.categoria,
          comprado: true,
          compradoPor: usuario.uid,
          agregadoPor: usuario.uid,
          creado: firebase.database.ServerValue.TIMESTAMP
        };
        deshacer[rutaArticulo(id)] = null;
      });
      var cuantos = porAgregar.length;
      modal.cerrar("manual");
      if (vista !== "todo") cambiarVista("todo"); // lo importado entra marcado: verlo en "Toda la lista"
      actualizarMultiple(cambios)
        .then(function () {
          mostrarToast(cuantos + " artículos importados" + (idsCreados.length ? " y " + idsCreados.length + (idsCreados.length === 1 ? " pasillo nuevo" : " pasillos nuevos") : ""), {
            duracionMs: 8000,
            accion: {
              etiqueta: "Deshacer",
              alActivar: function () {
                actualizarMultiple(deshacer).catch(fallo("No se pudo deshacer"));
              }
            }
          });
        })
        .catch(fallo("No se pudo importar la lista"));
    }
  }

  // ===== Eventos =====

  function cambiarVista(nueva) {
    vista = nueva;
    if (nueva !== "todo") modoPrecios = false;
    editorPintado = false;
    _guardarVista(nueva);
    pintar();
  }

  function alTocarPestana(ev) {
    var b = ev.target.closest("[data-vista]");
    if (b) cambiarVista(b.dataset.vista);
  }
  ranuraPestanas.addEventListener("click", alTocarPestana);

  // Resalta en el índice el pasillo que está arriba al hacer scroll, y lo trae a la vista
  // dentro de la fila de chips (que tiene scroll horizontal propio).
  var scrollPendiente = false;
  function marcarPasilloActual() {
    scrollPendiente = false;
    var chips = indiceEl.querySelectorAll(".chip-pasillo");
    if (!chips.length) return;
    var limite = indiceEl.getBoundingClientRect().bottom + 8;
    var actual = null;
    zonaArticulos.querySelectorAll(".grupo-pasillo").forEach(function (sec) {
      if (sec.getBoundingClientRect().top <= limite) actual = sec.id;
    });
    if (!actual) actual = chips[0].getAttribute("href").slice(1);
    chips.forEach(function (c) {
      var es = c.getAttribute("href") === "#" + actual;
      c.classList.toggle("activo", es);
      if (es) c.setAttribute("aria-current", "true");
      else c.removeAttribute("aria-current");
      if (es) {
        var izq = c.offsetLeft, der = izq + c.offsetWidth;
        if (izq < indiceEl.scrollLeft || der > indiceEl.scrollLeft + indiceEl.clientWidth) {
          indiceEl.scrollTo({ left: Math.max(0, izq - 12), behavior: "smooth" });
        }
      }
    });
  }
  function alHacerScroll() {
    if (scrollPendiente) return;
    scrollPendiente = true;
    requestAnimationFrame(marcarPasilloActual);
  }
  window.addEventListener("scroll", alHacerScroll, { passive: true });

  campoRapido.addEventListener("input", function () {
    filtro = campoRapido.value.trim();
    editorPintado = false;
    actualizarBotonLimpiar();
    pintar();
  });

  // El "+" del campo es la acción de agregar de esta pantalla (no hay botón "+" aparte en la
  // barra inferior: con las 4 pestañas y los 3 controles globales no cabe en un iPhone).
  // Con texto agrega rápido; vacío abre el formulario completo.
  // (X) del campo: borra todo lo escrito de un toque (pedido del usuario) y deja el foco.
  botonLimpiar.addEventListener("click", function () {
    campoRapido.value = "";
    filtro = "";
    editorPintado = false;
    actualizarBotonLimpiar();
    pintar();
    campoRapido.focus();
  });

  formRapido.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var texto = campoRapido.value.trim();
    if (!texto) {
      if (info.nombre) abrirFormularioArticulo(null);
      return;
    }
    campoRapido.value = "";
    filtro = "";
    actualizarBotonLimpiar();
    agregarRapido(texto);
    pintar();
    campoRapido.focus(); // para seguir agregando sin volver a tocar el campo
  });

  contenedor.addEventListener("click", function (ev) {
    var regresarBtn = ev.target.closest("[data-regresar]");
    if (regresarBtn) {
      var idR = regresarBtn.dataset.regresar;
      escribirArticulo(idR, { comprado: false, compradoPor: null }, "desmarco")
        .then(function () { mostrarToast((articulos[idR] || {}).nombre + " regresó a Por comprar"); })
        .catch(fallo("No se pudo regresar el artículo"));
      return;
    }
    var fotoBtn = ev.target.closest("[data-ver-foto]");
    if (fotoBtn) {
      var af0 = articulos[fotoBtn.dataset.verFoto];
      if (af0 && af0.fotoUrl) verFoto(af0.fotoUrl, af0.nombre);
      return;
    }
    var favoritoBtn = ev.target.closest("[data-favorito]");
    if (favoritoBtn) {
      var idF = favoritoBtn.dataset.favorito;
      var af = articulos[idF];
      if (af) {
        // true se guarda; quitarlo borra el campo (null), no escribe false.
        escribirArticulo(idF, { favorito: af.favorito ? null : true }, null).catch(fallo("No se pudo cambiar el favorito"));
      }
      return;
    }
    var agregarPasilloBtn = ev.target.closest("[data-agregar-pasillo]");
    if (agregarPasilloBtn) {
      abrirFormularioArticulo(null, { categoria: agregarPasilloBtn.dataset.agregarPasillo });
      return;
    }
    var cantidadBtn = ev.target.closest("[data-cantidad]");
    if (cantidadBtn) {
      if (!cantidadBtn.disabled) cambiarCantidad(cantidadBtn.dataset.id, Number(cantidadBtn.dataset.cantidad));
      return;
    }
    var alternarBtn = ev.target.closest("[data-alternar]");
    if (alternarBtn) {
      alternar(alternarBtn.dataset.alternar);
      return;
    }
    var editarBtn = ev.target.closest("[data-editar]");
    if (editarBtn) {
      abrirFormularioArticulo(editarBtn.dataset.editar);
      return;
    }
    var accion = ev.target.closest("[data-accion]");
    if (accion) {
      if (accion.dataset.accion === "marcar-todo") marcarTodo();
      if (accion.dataset.accion === "importar") abrirImportar();
      if (accion.dataset.accion === "pasillos") abrirPasillos();
      if (accion.dataset.accion === "solo-favoritos") {
        soloFavoritos = !soloFavoritos;
        pintar();
      }
      if (accion.dataset.accion === "actividad" && coordinacion) coordinacion.abrirActividad();
      if (accion.dataset.accion === "editar-precios") {
        modoPrecios = true;
        repintarEditor();
      }
      if (accion.dataset.accion === "salir-precios") {
        modoPrecios = false;
        repintarEditor();
      }
      if (accion.dataset.accion === "solo-sin-precio") {
        soloSinPrecio = !soloSinPrecio;
        repintarEditor();
      }
      return;
    }
    var irVista = ev.target.closest("[data-ir-vista]");
    if (irVista) cambiarVista(irVista.dataset.irVista);
  });

  contenedor.addEventListener("change", function (ev) {
    if (ev.target.matches("[data-precio]")) guardarPrecio(ev.target);
    else if (ev.target.matches("[data-unidad]")) guardarUnidad(ev.target);
  });
  // Enter en un precio = pasar al siguiente (el cambio de foco dispara "change" y guarda).
  contenedor.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || !ev.target.matches("[data-precio]")) return;
    ev.preventDefault();
    var campos = Array.prototype.slice.call(contenedor.querySelectorAll("[data-precio]"));
    var siguiente = campos[campos.indexOf(ev.target) + 1];
    if (siguiente) siguiente.focus();
    else ev.target.blur();
  });

  montarBotonAyuda(
    "<h3>Esta lista</h3>" +
      "<p><strong>Marcado</strong> = ya lo tienes o no hace falta. <strong>Sin marcar</strong> = por comprar.</p>" +
      "<p><strong>En casa</strong>: abre <em>Toda la lista</em> y quita la marca de lo que necesites.</p>" +
      "<p><strong>En la tienda</strong>: en <em>Por comprar</em> ves solo lo que falta, por pasillo. Toca el " +
      "círculo al tomar cada cosa y desaparece de la vista (si te equivocas, toca <em>Deshacer</em>).</p>" +
      "<p>El campo de arriba <strong>busca</strong> mientras escribes. Con Enter (o <strong>+</strong>), si el " +
      "artículo ya existe lo pone por comprar; si no, lo agrega. Puedes escribir la cantidad: <em>2 kg tomate</em>. " +
      "Con el campo vacío, <strong>+</strong> abre el formulario completo.</p>" +
      "<p>En <em>Toda la lista</em>, los botones <strong>−</strong> y <strong>+</strong> de cada artículo cambian " +
      "la cantidad (de 1 en 1; kg y litros de medio en medio; gramos y ml de 100 en 100).</p>" +
      "<p><strong>Unidades y precios</strong> (en <em>Toda la lista</em>): pon la unidad y el precio por unidad " +
      "de todos tus artículos de corrido; usa <em>Solo sin precio</em> para ver lo que falta. Puedes tener abierta " +
      "la página de tu tienda en otra pestaña para copiar los precios.</p>" +
      "<p>Toca el nombre de un artículo para cambiar cantidad, unidad, pasillo, precio o notas, o para eliminarlo.</p>" +
      "<p>En <em>Toda la lista</em> → <em>Pasillos</em> puedes cambiar el nombre de un pasillo, crear los tuyos y " +
      "eliminar los que estén vacíos.</p>"
  );

  // ===== Datos en tiempo real =====

  // Si la hoja "Pasillos" está abierta, su lista se repinta con cada cambio (los míos y los de
  // otros miembros), salvo que se esté escribiendo el nombre de un pasillo: repintar le
  // quitaría el foco y lo escrito. El campo "Nuevo pasillo" está fuera de la lista y no se toca.
  function repintarGestorPasillos() {
    if (!gestorPasillos) return;
    var activo = document.activeElement;
    if (activo && activo.matches && activo.matches("[data-pasillo]") && gestorPasillos.elemento.contains(activo)) return;
    gestorPasillos.repintar();
  }

  detenerInfo = escuchar(refNodo("listas/" + listaId + "/info"), function (valor) {
    info = valor || {};
    repintarGestorPasillos();
    if (info.nombre) {
      sinAcceso = false;
      clearTimeout(temporizadorSinAcceso);
    }
    pintar();
  });
  // Miembros, presencia y coordinación (registro de actividad + avisos de los demás).
  var miembrosLista = montarMiembrosLista(contenedor.querySelector("[data-fila-miembros]"), listaId, usuario, function () { return info; });
  var coordinacion = montarCoordinacion(listaId, usuario, miembrosLista.nombreDe, function () {
    if (!modoPrecios) pintar(); // para los "por Ana"
  });

  detenerArticulos = escuchar(refArticulos, function (valor) {
    articulos = valor || {};
    repintarGestorPasillos();
    pintar();
  });
  // escuchar() entrega {} tanto "aún no llega" como "no existe / sin permiso": si en 6 s no
  // llega el nombre de la lista, se avisa en vez de quedarse en "Cargando…" para siempre.
  temporizadorSinAcceso = setTimeout(function () {
    if (!info.nombre) {
      sinAcceso = true;
      pintar();
    }
  }, 6000);

  return function limpiar() {
    if (detenerInfo) detenerInfo();
    if (detenerArticulos) detenerArticulos();
    clearTimeout(temporizadorSinAcceso);
    window.removeEventListener("scroll", alHacerScroll);
    miembrosLista.limpiar();
    coordinacion.limpiar();
    ranuraPestanas.removeEventListener("click", alTocarPestana);
    vaciarRanura("pestanas");
    vaciarRanura("principal");
  };
}
