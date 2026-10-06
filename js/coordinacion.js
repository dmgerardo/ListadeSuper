// Coordinación cuando varias personas compran a la vez con la misma lista:
// - Registro TEMPORAL (24 h) de quién marcó o desmarcó qué y cuándo, en
//   listas/{id}/actividad. Se escribe en la MISMA escritura multi-ruta que el cambio del
//   artículo (o se guardan los dos, o ninguno). Pedido del usuario: "a modo de auditoría,
//   temporal, solo para coordinar la compra". No hay servidor que lo limpie: cada vez que
//   alguien abre la lista se borran los eventos de más de 24 h (las reglas permiten borrar
//   solo los de más de 23 h).
// - Aviso dentro de la app cuando OTRA persona marca o desmarca mientras tienes la lista
//   abierta ("Ana marcó Leche").
// - Hoja "Actividad" con el registro.

var HORAS_ACTIVIDAD = 24;
var _MS_ACTIVIDAD = HORAS_ACTIVIDAD * 3600 * 1000;

function _horaCorta(ts) {
  try {
    return new Date(ts).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

// montarCoordinacion(listaId, usuario, nombreDe) → { agregarEvento, recientePor, abrirActividad, limpiar }
// nombreDe(uid): nombre corto de un miembro (de vista-miembros.js).
// alCambiar(): se llama cuando cambia el registro (para repintar los "por Ana").
function montarCoordinacion(listaId, usuario, nombreDe, alCambiar) {
  var base = "listas/" + listaId + "/actividad";
  var refActividad = refNodo(base);
  var eventos = {};
  var vistos = {};
  var primeraCarga = true;
  // Los eventos de otros anteriores a abrir la lista no se avisan (ya pasaron); se tolera
  // 1 min de diferencia entre el reloj del teléfono y el del servidor.
  var desde = Date.now() - 60 * 1000;
  var miNombre = String(usuario.displayName || usuario.email || "Alguien").split(" ")[0].slice(0, 120);
  var modal = null;

  // agregarEvento(cambios, articuloId, articulo, accion): agrega el evento a un objeto de
  // escritura multi-ruta (para actualizarMultiple) y lo devuelve.
  function agregarEvento(cambios, articuloId, articulo, accion) {
    var id = refActividad.push().key;
    cambios[base + "/" + id] = {
      uid: usuario.uid,
      nombre: miNombre,
      accion: accion,
      articuloId: articuloId,
      articulo: String(articulo || "").slice(0, 120) || "(sin nombre)",
      ts: firebase.database.ServerValue.TIMESTAMP
    };
    return cambios;
  }

  // recientePor(articuloId) → uid de quien lo marcó durante esta compra (último evento de las
  // últimas 24 h, si fue "marcó"), o null. Sirve para el "por Ana" del renglón.
  function recientePor(articuloId) {
    var ultimo = null;
    Object.keys(eventos).forEach(function (k) {
      var e = eventos[k];
      if (e && e.articuloId === articuloId && (!ultimo || e.ts >= ultimo.ts)) ultimo = e;
    });
    return ultimo && ultimo.accion === "marco" ? ultimo.uid : null;
  }

  // recientesMios(minutos) → eventos "marcó" MÍOS de los últimos N minutos que siguen siendo el
  // último movimiento de ese artículo (más reciente primero). Para "Marcaste hace poco".
  function recientesMios(minutos) {
    var limite = Date.now() - minutos * 60 * 1000;
    var ultimo = {};
    Object.keys(eventos).forEach(function (k) {
      var e = eventos[k];
      if (e && typeof e.ts === "number" && (!ultimo[e.articuloId] || e.ts >= ultimo[e.articuloId].ts)) ultimo[e.articuloId] = e;
    });
    return Object.keys(ultimo).map(function (k) { return ultimo[k]; })
      .filter(function (e) { return e.uid === usuario.uid && e.accion === "marco" && e.ts >= limite; })
      .sort(function (a, b) { return b.ts - a.ts; });
  }

  function avisarAjenos(nuevos) {
    if (!nuevos.length) return;
    // Por persona: un aviso con el artículo, o con cuántos si fueron varios (p. ej. "marcar todo").
    var porPersona = {};
    nuevos.forEach(function (e) {
      (porPersona[e.uid] = porPersona[e.uid] || []).push(e);
    });
    Object.keys(porPersona).forEach(function (uid) {
      var lista = porPersona[uid];
      var quien = nombreDe(uid) !== "Alguien" ? nombreDe(uid) : lista[0].nombre;
      var texto;
      if (lista.length === 1) {
        texto = quien + (lista[0].accion === "marco" ? " marcó " : " puso por comprar ") + lista[0].articulo;
      } else {
        var marcados = lista.filter(function (e) { return e.accion === "marco"; }).length;
        texto = quien + " " + (marcados === lista.length ? "marcó " + lista.length + " artículos"
          : marcados === 0 ? "puso por comprar " + lista.length + " artículos"
          : "cambió " + lista.length + " artículos");
      }
      mostrarToast(texto, { duracionMs: 4000 });
    });
  }

  var detener = escuchar(refActividad.orderByChild("ts").limitToLast(200), function (valor) {
    eventos = valor || {};
    var nuevos = [];
    Object.keys(eventos).sort().forEach(function (id) {
      if (vistos[id]) return;
      vistos[id] = true;
      var e = eventos[id];
      if (!primeraCarga && e && e.uid !== usuario.uid && typeof e.ts === "number" && e.ts >= desde) nuevos.push(e);
    });
    // La primera entrega puede venir del caché local: no se avisa nada de ella.
    primeraCarga = false;
    avisarAjenos(nuevos);
    if (modal) pintarActividad();
    if (alCambiar) alCambiar();
  });

  // Limpieza de lo viejo (> 24 h): una escritura multi-ruta con todo lo vencido.
  refActividad.orderByChild("ts").endAt(Date.now() - _MS_ACTIVIDAD).once("value").then(function (snap) {
    var viejos = snap.val() || {};
    var cambios = {};
    Object.keys(viejos).forEach(function (id) { cambios[base + "/" + id] = null; });
    if (Object.keys(cambios).length) return actualizarMultiple(cambios);
  }).catch(function (e) {
    console.warn("No se pudo limpiar la actividad vieja", e);
  });

  function pintarActividad() {
    var zona = modal.elemento.querySelector("[data-actividad]");
    var lista = Object.keys(eventos).map(function (id) { return eventos[id]; })
      .filter(function (e) { return e && typeof e.ts === "number"; })
      .sort(function (a, b) { return b.ts - a.ts; });
    zona.innerHTML = lista.length
      ? '<ul class="lista-articulos lista-actividad">' + lista.map(function (e) {
          var quien = e.uid === usuario.uid ? "Tú" : (nombreDe(e.uid) !== "Alguien" ? nombreDe(e.uid) : e.nombre);
          return '<li class="fila-actividad"><span class="hora-actividad">' + esc(_horaCorta(e.ts)) + "</span>" +
            '<span class="icono-actividad' + (e.accion === "marco" ? " marco" : "") + '" aria-hidden="true">' + icono(e.accion === "marco" ? "check" : "plus", 16) + "</span>" +
            "<span><strong>" + esc(quien) + "</strong> " +
            (e.uid === usuario.uid ? (e.accion === "marco" ? "marcaste" : "pusiste por comprar") : (e.accion === "marco" ? "marcó" : "puso por comprar")) +
            " " + esc(e.articulo) + "</span></li>";
        }).join("") + "</ul>"
      : '<p class="vacio">Sin movimientos en las últimas ' + HORAS_ACTIVIDAD + " horas.</p>";
  }

  function abrirActividad() {
    modal = abrirModal(
      "<h3>Actividad</h3>" +
        '<p class="texto-suave">Quién marcó o puso por comprar cada artículo en las últimas ' + HORAS_ACTIVIDAD +
        " horas. Sirve para coordinarse durante la compra; después se borra solo.</p>" +
        '<div data-actividad aria-live="polite"></div>' +
        '<div class="fila-botones"><button type="button" class="btn btn-secundario" data-cerrar>Cerrar</button></div>',
      function () { modal = null; }
    );
    modal.elemento.querySelector("[data-cerrar]").addEventListener("click", function () { modal.cerrar("manual"); });
    pintarActividad();
  }

  return {
    agregarEvento: agregarEvento,
    recientePor: recientePor,
    recientesMios: recientesMios,
    abrirActividad: abrirActividad,
    limpiar: function () {
      detener();
      if (modal) modal.cerrar("programatico");
    }
  };
}
