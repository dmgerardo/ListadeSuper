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
function mostrarToast(texto, opciones) {
  opciones = opciones || {};
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
  return { quitar: quitar };
}

// ===== Botón flotante de ayuda =====
// montarBotonAyuda(tituloHtml): agrega el FAB "?" si no existe ya uno en la pantalla.
function montarBotonAyuda(contenidoHtml) {
  var existente = document.querySelector(".btn-fab-ayuda");
  if (existente) existente.remove();
  var boton = document.createElement("button");
  boton.type = "button";
  boton.className = "btn-fab-ayuda";
  boton.setAttribute("aria-label", "Ayuda de esta pantalla");
  boton.title = "Ayuda de esta pantalla";
  boton.innerHTML = icono("help-circle", 22);
  boton.addEventListener("click", function () {
    abrirModal('<div class="texto-ayuda">' + contenidoHtml + '</div><div class="fila-botones">' +
      '<button type="button" class="btn" data-cerrar>Entendido</button></div>', null)
      .elemento.querySelector("[data-cerrar]").addEventListener("click", function (ev) {
        ev.target.closest(".fondo-modal").remove();
        document.body.style.overflow = "";
      });
  });
  document.body.appendChild(boton);
  return boton;
}

// ===== Pastilla de conexión =====
function montarPastillaConexion() {
  var existente = document.querySelector(".pastilla-conexion");
  if (existente) return existente.parentElement;
  var barra = document.querySelector(".barra-estado");
  if (!barra) {
    barra = document.createElement("div");
    barra.className = "barra-estado";
    document.body.appendChild(barra);
  }
  var pastilla = document.createElement("button");
  pastilla.classList.add("pastilla-conexion");
  pastilla.type = "button";
  pastilla.className = "pastilla";
  pastilla.disabled = true;
  barra.appendChild(pastilla);

  function actualizar() {
    var enLinea = navigator.onLine;
    pastilla.classList.toggle("pastilla-sin-conexion", !enLinea);
    pastilla.innerHTML = icono(enLinea ? "wifi" : "wifi-off", 14) +
      "<span style=\"margin-left:4px\">" + (enLinea ? "En línea" : "Sin conexión") + "</span>";
  }
  window.addEventListener("online", actualizar);
  window.addEventListener("offline", actualizar);
  actualizar();
  return barra;
}
