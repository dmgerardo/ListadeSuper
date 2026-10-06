// Utilidades compartidas de render, usadas por todas las vistas. Se carga antes que ellas.

// esc(texto): escapa para insertar de forma segura dentro de HTML. Usar SIEMPRE que se
// interpole un dato en innerHTML (nombre de artículo, de lista, de persona, etc.).
function esc(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// urlSegura(url): solo deja pasar http/https; cualquier otra cosa (javascript:, data:, etc.)
// se convierte en "#" para que nunca se pueda inyectar un esquema peligroso en un href/src.
function urlSegura(url) {
  try {
    var u = new URL(url, window.location.origin);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (e) {}
  return "#";
}

// formatoMoneda(valor, moneda): usa Intl con la moneda de la lista (MXN por defecto).
function formatoMoneda(valor, moneda) {
  var n = Number(valor) || 0;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN" }).format(n);
}

// hoyLocalISO(): "hoy" con la hora local del dispositivo, nunca con una zona fija.
function hoyLocalISO() {
  var d = new Date();
  var mes = String(d.getMonth() + 1).padStart(2, "0");
  var dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mes + "-" + dia;
}

// ===== Modal =====
// Pila de modales abiertos: Escape y el clic fuera solo afectan al de ARRIBA (p. ej. la
// confirmación "¿Guardar cambios?" encima de un formulario), y el scroll de la página se
// libera solo cuando se cierra el último.
var _pilaModales = [];

// abrirModal(html, alCerrar, opciones): monta un modal genérico. Devuelve { cerrar, elemento }.
// alCerrar(motivo) se llama siempre al cerrar ("manual" | "escape" | "fondo" | "programatico").
// opciones.hayCambios() + opciones.guardar(): si al tocar fuera o con Escape hay cambios sin
// guardar, NO se cierra: se pregunta Guardar / Descartar / Seguir editando (pedido del
// usuario: no perder lo capturado por un toque fuera de la ventana).
function abrirModal(html, alCerrar, opciones) {
  opciones = opciones || {};
  var fondo = document.createElement("div");
  fondo.className = "fondo-modal";
  fondo.innerHTML = '<div class="caja-modal" role="dialog" aria-modal="true">' + html + "</div>";
  document.body.appendChild(fondo);
  document.body.style.overflow = "hidden";
  var api;

  function cerrarYa(motivo) {
    if (!fondo.isConnected) return;
    fondo.remove();
    var i = _pilaModales.indexOf(api);
    if (i !== -1) _pilaModales.splice(i, 1);
    if (!_pilaModales.length) document.body.style.overflow = "";
    document.removeEventListener("keydown", alTecla);
    if (typeof alCerrar === "function") alCerrar(motivo || "programatico");
  }

  function cerrar(motivo) {
    if ((motivo === "fondo" || motivo === "escape") && typeof opciones.hayCambios === "function" && opciones.hayCambios()) {
      confirmarCierreConCambios(opciones.hayCambios, function () { cerrarYa("manual"); }, opciones.guardar);
      return;
    }
    cerrarYa(motivo);
  }

  function esElDeArriba() {
    return _pilaModales[_pilaModales.length - 1] === api;
  }

  function alTecla(ev) {
    if (ev.key === "Escape" && esElDeArriba()) cerrar("escape");
  }

  fondo.addEventListener("mousedown", function (ev) {
    if (ev.target === fondo && esElDeArriba()) cerrar("fondo");
  });
  document.addEventListener("keydown", alTecla);

  api = { cerrar: cerrar, elemento: fondo };
  _pilaModales.push(api);

  var primerCampo = fondo.querySelector("input, select, textarea, button");
  if (primerCampo) primerCampo.focus();

  return api;
}

// confirmarCierreConCambios(hayCambios, cerrarModal, guardar): si el formulario tiene cambios
// sin guardar, pregunta Guardar / Descartar / Seguir editando; si no, cierra directo.
// "Guardar" solo llama guardar(): cada formulario se cierra solo si guarda bien (si falla la
// validación se queda abierto con su mensaje, en vez de perder lo capturado).
// Tocar fuera o Escape en esta confirmación = seguir editando.
function confirmarCierreConCambios(hayCambios, cerrarModal, guardar) {
  if (!hayCambios()) {
    cerrarModal();
    return;
  }
  var confirmacion = abrirModal(
    '<h3>¿Guardar cambios?</h3><p class="texto-suave">Tienes cambios sin guardar en este formulario.</p>' +
      '<div class="fila-botones fila-botones-confirmar">' +
      '<button type="button" class="btn-texto" data-accion="seguir">Seguir editando</button>' +
      '<button type="button" class="btn btn-secundario" data-accion="descartar">Descartar</button>' +
      (typeof guardar === "function" ? '<button type="button" class="btn" data-accion="guardar">Guardar</button>' : "") +
      "</div>",
    null
  );
  confirmacion.elemento.addEventListener("click", function (ev) {
    var accion = ev.target.closest("[data-accion]");
    if (!accion) return;
    confirmacion.cerrar("manual");
    if (accion.dataset.accion === "guardar") guardar();
    else if (accion.dataset.accion === "descartar") cerrarModal();
  });
}

// ===== Toasts =====
function contenedorToasts() {
  var c = document.querySelector(".contenedor-toasts");
  if (!c) {
    c = document.createElement("div");
    c.className = "contenedor-toasts";
    c.setAttribute("role", "status");
    c.setAttribute("aria-live", "polite");
    document.body.appendChild(c);
  }
  return c;
}

// mostrarToast(texto, opciones): opciones.accion = { etiqueta, alActivar } para Deshacer.
// Solo hay UN aviso a la vez: el nuevo reemplaza al anterior (al agregar varias cosas
// seguidas, apilarlos tapaba la lista; el Deshacer que vale es el de la última acción).
function mostrarToast(texto, opciones) {
  opciones = opciones || {};
  Array.prototype.forEach.call(contenedorToasts().querySelectorAll(".toast"), function (previo) {
    if (previo._quitar) previo._quitar();
    else previo.remove();
  });
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = "<span>" + esc(texto) + "</span>";
  if (opciones.accion) {
    var boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = opciones.accion.etiqueta || "Deshacer";
    boton.addEventListener("click", function () {
      opciones.accion.alActivar();
      quitar();
    });
    toast.appendChild(boton);
  }
  contenedorToasts().appendChild(toast);
  var tiempo = opciones.duracionMs || (opciones.accion ? 6000 : 2500);
  var temporizador = setTimeout(quitar, tiempo);
  function quitar() {
    clearTimeout(temporizador);
    toast.remove();
  }
  toast._quitar = quitar;
  return { quitar: quitar };
}

// ===== Barra inferior flotante =====
// Una sola barra flotante (estilo Instagram / iOS) concentra todos los controles globales:
// pestañas de la pantalla, ayuda, estado+versión y cuenta. La acción principal (+) va en
// un botón circular aparte, a la derecha de la barra. Cada control vive en su "ranura"
// (data-ranura) para que cada script monte o quite solo lo suyo, en cualquier orden.
function barraInferior() {
  var envoltura = document.querySelector(".envoltura-barra");
  if (envoltura) return envoltura;
  envoltura = document.createElement("div");
  envoltura.className = "envoltura-barra";
  envoltura.innerHTML =
    '<nav class="barra-flotante" aria-label="Barra de controles">' +
    '<div class="ranura-barra" data-ranura="pestanas"></div>' +
    '<div class="ranura-barra" data-ranura="ayuda"></div>' +
    '<div class="ranura-barra" data-ranura="estado"></div>' +
    '<div class="ranura-barra" data-ranura="cuenta"></div>' +
    "</nav>" +
    '<div class="ranura-barra" data-ranura="principal"></div>';
  document.body.appendChild(envoltura);
  return envoltura;
}

function ranuraBarra(nombre) {
  return barraInferior().querySelector('[data-ranura="' + nombre + '"]');
}

// vaciarRanura(nombre): quita lo montado en esa ranura (al cambiar de pantalla o sesión).
function vaciarRanura(nombre) {
  ranuraBarra(nombre).innerHTML = "";
}

// montarPestanas(html): html de los <a class="item-barra"> de navegación de la pantalla.
// Una pestaña con aria-disabled="true" y data-nombre="..." avisa que llega pronto (en vez de
// no hacer nada); la pestaña activa (aria-current="page") solo sube al inicio, sin recargar.
function montarPestanas(html) {
  var ranura = ranuraBarra("pestanas");
  ranura.innerHTML = html;
  if (ranura.dataset.escuchando) return;
  ranura.dataset.escuchando = "1";
  ranura.addEventListener("click", function (ev) {
    var pestana = ev.target.closest(".item-barra");
    if (!pestana) return;
    if (pestana.getAttribute("aria-disabled") === "true") {
      ev.preventDefault();
      mostrarToast((pestana.dataset.nombre || "Esta sección") + " llega en una próxima versión");
    } else if (pestana.getAttribute("aria-current") === "page") {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

// montarAccionPrincipal(nombreIcono, etiqueta, alActivar): el botón circular "+". Devuelve
// el botón; vaciarRanura("principal") lo quita.
function montarAccionPrincipal(nombreIcono, etiqueta, alActivar) {
  var ranura = ranuraBarra("principal");
  ranura.innerHTML =
    '<button type="button" class="btn-accion-principal" aria-label="' + esc(etiqueta) + '" title="' + esc(etiqueta) + '">' +
    icono(nombreIcono, 26) +
    "</button>";
  var boton = ranura.firstChild;
  boton.addEventListener("click", alActivar);
  return boton;
}

// montarBotonAyuda(contenidoHtml): ayuda contextual de la pantalla actual (reemplaza la previa).
function montarBotonAyuda(contenidoHtml) {
  var ranura = ranuraBarra("ayuda");
  ranura.innerHTML =
    '<button type="button" class="item-barra" aria-label="Ayuda de esta pantalla" title="Ayuda de esta pantalla">' +
    icono("help-circle", 22) +
    "</button>";
  var boton = ranura.firstChild;
  boton.addEventListener("click", function () {
    var ayuda = abrirModal('<div class="texto-ayuda">' + contenidoHtml + '</div><div class="fila-botones">' +
      '<button type="button" class="btn" data-cerrar>Entendido</button></div>', null);
    ayuda.elemento.querySelector("[data-cerrar]").addEventListener("click", function () {
      ayuda.cerrar("manual");
    });
  });
  return boton;
}

// ===== Apariencia (claro / oscuro / sistema) =====
// Vive en la hoja "Mi cuenta" y no en la barra: con las 4 pestañas de una lista y los 3
// controles globales no cabe un botón más en un iPhone SE. La preferencia se guarda en este
// dispositivo (localStorage, vía tema.js) y se aplica al instante, sin recargar.
var _OPCIONES_TEMA = [
  { valor: "sistema", etiqueta: "Sistema", icono: "monitor" },
  { valor: "claro", etiqueta: "Claro", icono: "sun" },
  { valor: "oscuro", etiqueta: "Oscuro", icono: "moon" }
];

function selectorTema() {
  var actual = window.obtenerPreferenciaTema ? window.obtenerPreferenciaTema() : "sistema";
  return (
    '<p class="etiqueta-seccion" id="titulo-apariencia">Apariencia</p>' +
    '<div class="selector-vista selector-tema" role="radiogroup" aria-labelledby="titulo-apariencia">' +
    _OPCIONES_TEMA.map(function (o) {
      var activa = o.valor === actual;
      return (
        '<button type="button" role="radio" data-tema="' + o.valor + '" aria-checked="' + (activa ? "true" : "false") + '"' +
        (activa ? ' class="activa"' : "") + ">" + icono(o.icono, 18) + "<span>" + o.etiqueta + "</span></button>"
      );
    }).join("") +
    "</div>"
  );
}

function conectarSelectorTema(contenedor) {
  contenedor.addEventListener("click", function (ev) {
    var boton = ev.target.closest("[data-tema]");
    if (!boton || !window.establecerPreferenciaTema) return;
    window.establecerPreferenciaTema(boton.dataset.tema);
    contenedor.querySelectorAll("[data-tema]").forEach(function (b) {
      var activa = b === boton;
      b.classList.toggle("activa", activa);
      b.setAttribute("aria-checked", activa ? "true" : "false");
    });
  });
}

// montarMenuCuenta(usuario, rol): foto del usuario en la barra; al tocarla abre una hoja con
// su nombre, correo, rol, apariencia y "Cerrar sesión" (y "Administrar usuarios" si es
// administrador). rol = rolEfectivo() de roles.js (opcional). Con usuario null, lo quita.
function montarMenuCuenta(usuario, rol) {
  var ranura = ranuraBarra("cuenta");
  if (!usuario) {
    ranura.innerHTML = "";
    return null;
  }
  ranura.innerHTML =
    '<button type="button" class="item-barra" aria-label="Mi cuenta" title="Mi cuenta">' +
    (usuario.photoURL
      ? '<img class="foto-cuenta" src="' + esc(urlSegura(usuario.photoURL)) + '" alt="" width="28" height="28" referrerpolicy="no-referrer">'
      : icono("user", 22)) +
    "</button>";
  var boton = ranura.firstChild;
  var foto = boton.querySelector("img");
  if (foto) {
    // Sin onerror inline (CSP): si la foto no carga, se cambia por el ícono genérico.
    foto.addEventListener("error", function () {
      foto.outerHTML = icono("user", 22);
    });
  }
  boton.addEventListener("click", function () {
    var modal = abrirModal(
      '<div class="cabecera-cuenta">' +
        (usuario.photoURL
          ? '<img class="foto-cuenta foto-cuenta-grande" src="' + esc(urlSegura(usuario.photoURL)) + '" alt="" width="56" height="56" referrerpolicy="no-referrer">'
          : "") +
        "<div><h3>" + esc(usuario.displayName || "Mi cuenta") + "</h3>" +
        '<p class="texto-suave">' + esc(usuario.email || "") + "</p>" +
        (rol ? '<p class="pildora-rol' + (rol.esAdmin ? " pildora-rol-admin" : "") + '">' +
          esc((typeof ETIQUETAS_ROL !== "undefined" && ETIQUETAS_ROL[rol.rol]) || rol.rol) +
          (rol.esRaiz ? " (raíz)" : "") + (rol.activo ? "" : " · desactivada") + "</p>" : "") +
        "</div>" +
        "</div>" +
        (rol && rol.esAdmin
          ? '<a class="btn btn-secundario btn-ancho-completo enlace-admin" href="usuarios.html">' + icono("users", 18) + "<span>Administrar usuarios</span></a>"
          : "") +
        selectorTema() +
        '<div class="fila-botones">' +
        '<button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button>' +
        '<button type="button" class="btn btn-peligro" data-salir>' + icono("log-out", 18) + "<span>Cerrar sesión</span></button>" +
        "</div>",
      null
    );
    conectarSelectorTema(modal.elemento);
    modal.elemento.querySelector("[data-cerrar]").addEventListener("click", function () {
      modal.cerrar("manual");
    });
    modal.elemento.querySelector("[data-salir]").addEventListener("click", function () {
      modal.cerrar("manual");
      cerrarSesion();
    });
  });
  return boton;
}
