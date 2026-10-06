// Fotos de los artículos: obtener la imagen (archivo, portapapeles o URL), reducirla y subirla
// a Firebase Storage. Solo se guarda en la base el campo `fotoUrl` del artículo (una URL https).
//
// Decisiones (v22):
// - La foto se REDUCE en el dispositivo (lado mayor 1280 px, JPEG): una foto de celular pesa
//   varios MB y esto es una lista de compras; con ~150 KB basta y la subida es rápida.
// - Con "Desde una URL" NO se descarga ni se sube nada: se guarda la URL tal cual (el
//   navegador no deja leer imágenes de otros sitios por CORS). Si ese sitio la borra, se pierde.
// - Los archivos de Storage NO se borran al eliminar o cambiar un artículo ya guardado: el
//   Deshacer lo restaura con su foto y "Duplicar lista" comparte la misma URL. Solo se borra lo
//   que se subió en un formulario y se descartó (cancelar, o cambiar de foto antes de guardar).
// - Las reglas de Storage no pueden consultar la base de datos para saber si eres miembro de la
//   lista (ver storage.rules y SEGURIDAD.md).
// Usa abrirModal/esc/icono (render-utils.js, iconos.js).

var FOTO_MAX_LADO = 1280;
var FOTO_CALIDAD = 0.82;
var FOTO_MAX_ARCHIVO = 25 * 1024 * 1024; // lo que se acepta ANTES de reducir

// urlDeFotoValida(texto) → la URL https limpia, o null. Solo https: la app se sirve por https
// y el navegador bloquearía una imagen http (contenido mixto).
function urlDeFotoValida(texto) {
  var t = String(texto || "").trim();
  if (!t || t.length > 1000) return null;
  try {
    var u = new URL(t);
    return u.protocol === "https:" ? u.href : null;
  } catch (e) {
    return null;
  }
}

// reducirImagen(blob) → Promise<Blob JPEG>. Fondo blanco para PNG/GIF con transparencia.
function reducirImagen(blob) {
  return new Promise(function (ok, mal) {
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var lado = Math.max(img.naturalWidth, img.naturalHeight);
      if (!lado) return mal(new Error("La imagen está vacía."));
      var escala = Math.min(1, FOTO_MAX_LADO / lado);
      var lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
      lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
      var ctx = lienzo.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      lienzo.toBlob(function (b) {
        if (b) ok(b);
        else mal(new Error("No se pudo procesar la imagen."));
      }, "image/jpeg", FOTO_CALIDAD);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      mal(new Error("Ese archivo no es una imagen que se pueda abrir."));
    };
    img.src = url;
  });
}

// subirFoto(listaId, uid, blob) → Promise<{ url, ruta }>. El nombre lleva el uid de quien sube
// (las reglas de Storage lo exigen) y es único.
function subirFoto(listaId, uid, blob) {
  if (typeof firebase === "undefined" || typeof firebase.storage !== "function") {
    return Promise.reject(new Error("Firebase Storage no está disponible en esta página."));
  }
  var ruta = "listas/" + listaId + "/fotos/" + uid + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ".jpg";
  var ref = firebase.storage().ref(ruta);
  return ref
    .put(blob, { contentType: "image/jpeg" })
    .then(function () { return ref.getDownloadURL(); })
    .then(function (url) { return { url: url, ruta: ruta }; });
}

// borrarFotoSubida(ruta): mejor esfuerzo; nunca falla hacia arriba.
function borrarFotoSubida(ruta) {
  try {
    return firebase.storage().ref(ruta).delete().catch(function () {});
  } catch (e) {
    return Promise.resolve();
  }
}

// prepararYSubir(listaId, uid, blob) → Promise<{ url, ruta }> con validaciones de tamaño/tipo.
function prepararYSubir(listaId, uid, blob) {
  if (!blob) return Promise.reject(new Error("No hay imagen."));
  if (blob.type && blob.type.indexOf("image/") !== 0) return Promise.reject(new Error("Ese archivo no es una imagen."));
  if (blob.size > FOTO_MAX_ARCHIVO) return Promise.reject(new Error("La imagen pesa demasiado (máximo 25 MB)."));
  return reducirImagen(blob).then(function (reducida) {
    return subirFoto(listaId, uid, reducida);
  });
}

// imagenDelPortapapeles() → Promise<Blob>. Necesita permiso del navegador (Safari pregunta con
// un botón "Pegar"); si no existe la API o no hay imagen, rechaza para mostrar la alternativa.
function imagenDelPortapapeles() {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
    return Promise.reject(new Error("sin-api"));
  }
  return navigator.clipboard.read().then(function (items) {
    for (var i = 0; i < items.length; i++) {
      var tipo = items[i].types.filter(function (t) { return t.indexOf("image/") === 0; })[0];
      if (tipo) return items[i].getType(tipo);
    }
    throw new Error("sin-imagen");
  });
}

// comprobarUrlDeImagen(url) → Promise<url>: la URL debe cargar como imagen (y la CSP lo permita).
function comprobarUrlDeImagen(url) {
  return new Promise(function (ok, mal) {
    var img = new Image();
    img.onload = function () { ok(url); };
    img.onerror = function () { mal(new Error("No se pudo cargar una imagen de esa dirección.")); };
    img.src = url;
  });
}

// abrirSelectorFoto({ listaId, uid, alElegir }): el modal "¿Cómo quieres agregar la foto?" con
// Elegir archivo / Pegar del portapapeles / Desde una URL. alElegir({ url, ruta }) — `ruta` solo
// viene si se subió a Storage (para poder descartarla si el formulario no se guarda).
function abrirSelectorFoto(opciones) {
  var modal = abrirModal(
    "<h3>¿Cómo quieres agregar la foto?</h3>" +
      '<div class="opciones-foto">' +
      '<button type="button" class="btn btn-ancho-completo" data-foto-archivo>' + icono("image", 18) + "<span>Elegir archivo</span></button>" +
      '<button type="button" class="btn btn-secundario btn-ancho-completo" data-foto-pegar>' + icono("clipboard-paste", 18) + "<span>Pegar del portapapeles</span></button>" +
      '<button type="button" class="btn btn-secundario btn-ancho-completo" data-foto-url>' + icono("link", 18) + "<span>Desde una URL</span></button>" +
      "</div>" +
      '<div class="campo oculto" data-zona-pegar><label for="foto-pegar">Pega aquí la imagen</label>' +
      '<input id="foto-pegar" type="text" autocomplete="off" placeholder="Mantén presionado y elige Pegar (o Ctrl/Cmd+V)"></div>' +
      '<form class="campo oculto" data-zona-url novalidate><label for="foto-url">Dirección (https) de la imagen</label>' +
      '<input id="foto-url" type="url" inputmode="url" autocomplete="off" placeholder="https://…">' +
      '<button type="submit" class="btn btn-ancho-completo">Usar esta imagen</button></form>' +
      '<input type="file" accept="image/*" class="oculto" data-foto-input>' +
      '<p class="texto-suave" data-estado-foto role="status" aria-live="polite"></p>' +
      '<div class="fila-botones"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button></div>'
  );
  var el = modal.elemento;
  var estado = el.querySelector("[data-estado-foto]");
  var ocupado = false;

  function mensaje(texto) {
    estado.textContent = texto || "";
  }

  function terminar(foto) {
    modal.cerrar("manual");
    opciones.alElegir(foto);
  }

  // Todo lo que llega como imagen (archivo, portapapeles, evento paste) pasa por aquí.
  function subir(blob) {
    if (ocupado) return;
    ocupado = true;
    el.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    mensaje("Subiendo la foto…");
    prepararYSubir(opciones.listaId, opciones.uid, blob)
      .then(terminar)
      .catch(function (e) {
        ocupado = false;
        el.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
        var causa = e && e.code === "storage/unauthorized" ? "No tienes permiso para subir fotos."
          : e && /storage\/(bucket-not-found|project-not-found|retry-limit-exceeded|unknown)/.test(e.code || "") ? "Firebase Storage no responde: ¿ya está activado en el proyecto?"
          : e && e.message ? e.message : "No se pudo subir la foto.";
        mensaje(causa);
      });
  }

  var inputArchivo = el.querySelector("[data-foto-input]");
  el.querySelector("[data-foto-archivo]").addEventListener("click", function () { inputArchivo.click(); });
  inputArchivo.addEventListener("change", function () {
    if (inputArchivo.files && inputArchivo.files[0]) subir(inputArchivo.files[0]);
  });

  var zonaPegar = el.querySelector("[data-zona-pegar]");
  el.querySelector("[data-foto-pegar]").addEventListener("click", function () {
    mensaje("");
    imagenDelPortapapeles()
      .then(subir)
      .catch(function (e) {
        // Sin API (Firefox), permiso negado o sin imagen: queda el campo para pegar a mano.
        mensaje(e && e.message === "sin-imagen" ? "No hay una imagen en el portapapeles. Cópiala y vuelve a intentar." : "Pega la imagen en el campo de abajo.");
        zonaPegar.classList.remove("oculto");
        zonaPegar.querySelector("input").focus();
      });
  });
  // Pegar con Ctrl/Cmd+V (o el menú Pegar del teléfono) en cualquier parte del modal.
  el.addEventListener("paste", function (ev) {
    var items = (ev.clipboardData && ev.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && items[i].type.indexOf("image/") === 0) {
        ev.preventDefault();
        subir(items[i].getAsFile());
        return;
      }
    }
    // Pegaron una dirección: se toma como URL.
    var texto = ev.clipboardData ? ev.clipboardData.getData("text") : "";
    if (urlDeFotoValida(texto)) {
      ev.preventDefault();
      usarUrl(texto);
    }
  });

  var zonaUrl = el.querySelector("[data-zona-url]");
  el.querySelector("[data-foto-url]").addEventListener("click", function () {
    zonaUrl.classList.remove("oculto");
    zonaUrl.querySelector("input").focus();
  });
  function usarUrl(texto) {
    var url = urlDeFotoValida(texto);
    if (!url) return mensaje("Escribe una dirección que empiece con https://");
    mensaje("Revisando la imagen…");
    comprobarUrlDeImagen(url)
      .then(function () { terminar({ url: url, ruta: null }); })
      .catch(function (e) { mensaje(e.message); });
  }
  zonaUrl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    usarUrl(zonaUrl.querySelector("input").value);
  });
  el.querySelector("[data-cerrar]").addEventListener("click", function () { modal.cerrar("manual"); });
}

// verFoto(url, titulo): la foto en grande, en un modal.
function verFoto(url, titulo) {
  var modal = abrirModal(
    "<h3>" + esc(titulo || "Foto") + "</h3>" +
      '<img class="foto-ampliada" src="' + esc(url) + '" alt="' + esc("Foto de " + (titulo || "el artículo")) + '">' +
      '<div class="fila-botones"><button type="button" class="btn" data-cerrar>Cerrar</button></div>'
  );
  modal.elemento.querySelector("[data-cerrar]").addEventListener("click", function () { modal.cerrar("manual"); });
}
