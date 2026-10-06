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
// abrirModal(html, alCerrar): monta un modal genérico. Devuelve { cerrar, elemento }.
// alCerrar(motivo) se llama siempre al cerrar ("manual" | "escape" | "fondo" | "programatico").
function abrirModal(html, alCerrar) {
  var fondo = document.createElement("div");
  fondo.className = "fondo-modal";
  fondo.innerHTML = '<div class="caja-modal" role="dialog" aria-modal="true">' + html + "</div>";
  document.body.appendChild(fondo);
  document.body.style.overflow = "hidden";

  function cerrar(motivo) {
    if (!fondo.isConnected) return;
    fondo.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", alTecla);
    if (typeof alCerrar === "function") alCerrar(motivo || "programatico");
  }

  function alTecla(ev) {
    if (ev.key === "Escape") cerrar("escape");
  }

  fondo.addEventListener("mousedown", function (ev) {
    if (ev.target === fondo) cerrar("fondo");
  });
  document.addEventListener("keydown", alTecla);

  var primerCampo = fondo.querySelector("input, select, textarea, button");
  if (primerCampo) primerCampo.focus();

  return { cerrar: cerrar, elemento: fondo };
}

// confirmarCierreConCambios(hayCambios, alConfirmar): si el formulario tiene cambios sin
// guardar, pregunta Guardar/Descartar antes de cerrar; si no, cierra directo.
function confirmarCierreConCambios(hayCambios, cerrarModal, guardar) {
  if (!hayCambios()) {
    cerrarModal();
    return;
  }
  abrirModal(
    '<h3>¿Guardar cambios?</h3><p class="texto-suave">Tienes cambios sin guardar en este formulario.</p>' +
      '<div class="fila-botones">' +
      '<button type="button" class="btn btn-secundario" data-accion="descartar">Descartar</button>' +
      '<button type="button" class="btn" data-accion="guardar">Guardar</button>' +
      "</div>",
    null
  ).elemento.addEventListener("click", function (ev) {
    var accion = ev.target.closest("[data-accion]");
    if (!accion) return;
    ev.target.closest(".fondo-modal").remove();
    document.body.style.overflow = "";
    if (accion.dataset.accion === "guardar") guardar();
    cerrarModal();
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
    abrirModal('<div class="texto-ayuda">' + contenidoHtml + '</div><div class="fila-botones">' +
      '<button type="button" class="btn" data-cerrar>Entendido</button></div>', null)
      .elemento.querySelector("[data-cerrar]").addEventListener("click", function (ev) {
        ev.target.closest(".fondo-modal").remove();
        document.body.style.overflow = "";
      });
  });
  return boton;
}

// montarMenuCuenta(usuario): foto del usuario en la barra; al tocarla abre una hoja con su
// nombre, correo y "Cerrar sesión". Con usuario null, quita el control.
function montarMenuCuenta(usuario) {
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
        '<p class="texto-suave">' + esc(usuario.email || "") + "</p></div>" +
        "</div>" +
        '<div class="fila-botones">' +
        '<button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button>' +
        '<button type="button" class="btn btn-peligro" data-salir>' + icono("log-out", 18) + "<span>Cerrar sesión</span></button>" +
        "</div>",
      null
    );
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
