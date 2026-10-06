# ListadeSuper — Documento base del proyecto

> **Cómo usar este archivo**
> 1. Crea el repositorio vacío `https://github.com/dmgerardo/ListadeSuper` y sube este archivo
>    a la raíz como `PROYECTO_INICIAL.md`.
> 2. Abre una sesión de Claude Code sobre ese repo y pega como primer mensaje:
>    **"Lee PROYECTO_INICIAL.md completo y ejecuta la Fase 0 y la Fase 1. Pregúntame lo
>    necesario."**
> 3. En la primera sesión, el agente debe convertir este documento en `AGENTS.md` (guía
>    técnica viva), `CLAUDE.md` (apuntador a AGENTS.md), `README.md` (usuarios finales),
>    `SEGURIDAD.md` y `PROXIMA_SESION.md` (continuidad entre sesiones), tal como en
>    `dmgerardo/PlaneadorDeViajes`.
>
> Este documento hereda las prácticas de **Planeador de Viajes Familiar**
> (`dmgerardo/PlaneadorDeViajes`). Donde dice "igual que en el Planeador", el agente puede
> consultar ese repo como referencia de implementación; NO copiar su modelo de
> autenticación (ver §4: allá la autenticación es la deuda de seguridad principal).

---

## 1. Objetivo

App web (PWA) para mantener **listas de compras compartidas** (supermercado, farmacia,
ferretería…), usable desde el celular en la tienda y desde la computadora en casa, en
español, con sincronización en tiempo real entre los miembros de cada lista.

### Alcance de la versión 1 (decidido con el usuario)

| # | Función | Detalle |
|---|---------|---------|
| 1 | **Login con Google obligatorio** | Ningún dato se ve ni se escribe sin cuenta de Google. |
| 2 | **Listas compartidas por invitación** | Cada lista tiene dueño y miembros. El dueño genera una liga/código de invitación; quien la abre (con su cuenta de Google) se une. Todos los miembros ven y editan en tiempo real. |
| 3 | **Artículos con cantidad, unidad y categoría/pasillo** | Ej. "2 kg · Frutas y verduras". La lista se agrupa por categoría, en el orden de pasillos que defina la lista. |
| 4 | **Precio y total estimado** | Precio por artículo (unitario) y moneda de la lista; total estimado de lo pendiente y total de lo ya tomado ("en el carrito"). |
| 5 | **Catálogo de favoritos / frecuentes** | Artículos que se compran seguido, para agregarlos con un toque; recuerda la última cantidad, unidad, categoría y precio. |
| 6 | **Plantillas de compra** | Una plantilla (ej. "Despensa semanal") agrega **muchos artículos con un solo toque**; después se van eliminando de forma sencilla (marcar comprado, quitar con un toque, "Quitar comprados", "Quitar los de esta plantilla", con **Deshacer**). |

Fuera de la v1 (no implementar sin preguntar): varias tiendas por lista, escaneo de código
de barras, historial de precios con gráficas, notificaciones push, listas públicas.

---

## 2. Tecnología (la misma que el Planeador)

- **Sin build ni framework**: HTML + CSS + JavaScript vanilla (ES2020+), cargado con
  `<script>` clásicos (sin `type="module"`). Todos comparten un solo scope global: **nunca
  declares la misma `const`/`function` en dos archivos** (es un `SyntaxError` que rompe toda
  la app). Lo compartido vive en un archivo que carga antes que las vistas
  (`render-utils.js`, `db.js`, `iconos.js`).
- **Firebase (SDK compat por CDN de gstatic)**: Authentication (Google), Realtime Database,
  Hosting. Usar la misma línea compat que el Planeador (`10.14.1`) o la versión compat más
  reciente que el agente **verifique** al iniciar; la versión vive en un solo lugar y se
  repite en `sw.js` (lista del app shell).
- **PWA**: `manifest.json`, iconos 16/32/48/180/192/512, `sw.js` que cachea el "app shell"
  (HTML red-primero con `ignoreSearch`; CSS/JS caché-primero dentro del caché de ESA versión).
- **Offline de solo lectura** con caché en `localStorage` (patrón `escuchar()` /
  `obtenerConCache()` del Planeador, ver §6). Escribir sin señal: Firebase lo encola solo;
  la UI debe indicarlo (pastilla de conexión).
- **Iconos**: SVG de Lucide embebidos inline en `js/iconos.js` (sin CDN, para que funcionen
  offline). `icono(nombre, tamano)` y `iconoTexto(nombre, texto, tamano)`. **Nunca emoji
  como icono funcional.**
- **Tipografías**: Google Fonts `Caprasimo` (títulos) y `Figtree` (texto), igual que el
  Planeador.

### Estructura de archivos sugerida

```
index.html            Pantalla "Mis listas" (+ login con Google)
lista.html            Una lista (?lista=ID): artículos, favoritos, plantillas, miembros
unirse.html           Aceptar invitación (?codigo=...)  — o una ruta dentro de index.html
historial.html        Historial de versiones para el usuario
manifest.json, sw.js, icons/
css/estilos.css       Tokens de diseño + componentes (un solo archivo, como el Planeador)
js/app-version.js     const APP_VERSION = "1";  (lo sube el hook, ver §9)
js/version.js         Badge de versión (toca = forzar actualización) + registro del SW
js/tema.js            Modo claro/oscuro/sistema antes del primer paint (en <head>)
js/firebase-config.js Configuración pública del proyecto Firebase
js/auth.js            Login/logout con Google, requerirSesion(), perfil en usuarios/{uid}
js/db.js              refNodo, escuchar, obtenerConCache, agregar, actualizar, eliminar,
                      actualizarMultiple, programarRender, caché localStorage
js/iconos.js          ICONOS_LUCIDE + icono()/iconoTexto()
js/render-utils.js    esc, urlSegura, abrirModal, mostrarToast (con acción Deshacer),
                      formatoMoneda, botón de ayuda flotante, pastilla de conexión
js/catalogo-categorias.js  Categorías/pasillos por defecto y unidades
js/vista-listas.js    "Mis listas" (crear, abrir, salir de una lista)
js/vista-articulos.js Lista de compra agrupada por pasillo + totales
js/vista-favoritos.js Catálogo de frecuentes/favoritos
js/vista-plantillas.js Plantillas (crear, editar, aplicar)
js/vista-miembros.js  Miembros e invitaciones
database.rules.json   Reglas de seguridad (§5) — se despliegan (§9)
firebase.json, .firebaserc
.github/workflows/firebase-hosting-merge.yml
.githooks/pre-commit + scripts/bump-version.py
AGENTS.md, CLAUDE.md, README.md, SEGURIDAD.md, PROXIMA_SESION.md, LICENSE
```

---

## 3. Estándares visuales (iguales al Planeador)

Copiar del Planeador (`css/estilos.css`) los **tokens y componentes**, no las pantallas:

- **Tokens en `:root`** y redefinidos por modo (`[data-modo="claro"|"oscuro"]`, fijado por
  `js/tema.js` en `<head>` antes del primer paint; la preferencia guardada puede ser
  "sistema" pero el atributo siempre trae el valor resuelto). Paleta base del Planeador:
  `--color-fondo #f5ead8`, `--color-superficie #ebddc5`, `--color-texto #201e1d`,
  `--color-primario #c67139`, `--color-primario-oscuro #8c491a`, `--color-peligro #a8402c`,
  `--color-exito #7a8a5e`, `--color-texto-suave` = texto al 72% (WCAG ≥ 4.5:1 verificado),
  `--color-borde` = texto al 16%, `--radio 18px`, `--sombra`, `--espacio 12px`.
  **Ningún color de marca en hex fuera de los bloques de tokens.** Toda combinación nueva
  de texto/fondo se verifica con la fórmula de contraste WCAG (≥ 4.5:1 para texto normal).
- **Temas** (opcional en v1): arrancar con "clásico" + claro/oscuro/sistema; dejar la
  estructura `data-tema` lista para agregar más como en el Planeador.
- **Móvil primero**: `viewport` con `maximum-scale=1, viewport-fit=cover`; **todos los
  `input/select/textarea` a 16px** (si no, iOS hace zoom); márgenes con
  `env(safe-area-inset-*)`; nada con scroll horizontal de página.
- **Barra inferior de navegación** (`.nav-inferior`) en `lista.html`: Lista · Favoritos ·
  Plantillas · Miembros · "Mis listas" (flecha a la izquierda, al final).
- **Botón "+" flotante** (`.btn-fab-agregar`, abajo a la derecha, vidrio esmerilado) para
  agregar; **botón "?" flotante** de ayuda por vista (`.btn-fab-ayuda`, abajo a la
  izquierda) que abre un modal con instrucciones en lenguaje para cualquier persona.
- **Pastilla flotante de conexión** ("En línea" / "Sin conexión") junto al **badge de
  versión** (`vN`, tocarlo fuerza actualizar: da de baja el SW, borra cachés y recarga).
- **Captura SIEMPRE en modal** (`abrirModal(html, alCerrar)`), nunca `prompt()`;
  `confirm()` solo para borrar. Cerrar un formulario con cambios sin guardar pregunta
  Guardar/Descartar (mismo mecanismo genérico del Planeador).
- **Agregar y editar comparten formulario** (`abrirFormularioX(idExistente)`); tocar la
  fila abre la edición (sin botón "Editar" aparte); "Eliminar" vive dentro del formulario.
- **Botones de acción icon-only** (`.btn-accion-icono`: guardar = `save`, cancelar = `x`,
  eliminar = `trash-2`), siempre con `aria-label` y `title`.
- **Toasts** cortos para confirmar ("Guardado ✓") y con acción **Deshacer** para borrados
  y acciones masivas (quitar comprados, quitar plantilla).

### Pantalla principal de una lista (comportamiento esperado)

- Arriba: nombre de la lista, total estimado pendiente, total en carrito, número de
  artículos pendientes/comprados, campo de búsqueda/agregado rápido (escribir + Enter
  agrega; autocompleta desde el catálogo de frecuentes).
- Cuerpo: artículos **agrupados por categoría** en el orden de pasillos de la lista. Cada
  fila: casilla grande "comprado" (toque = tachado y baja al final de su grupo o a una
  sección "En el carrito"), nombre, cantidad + unidad, precio × cantidad, botón quitar (×).
- Acciones masivas: **Quitar comprados**, **Desmarcar todo** (reutilizar la lista), y por
  plantilla aplicada **Quitar los de esta plantilla** — todas con Deshacer.

---

## 4. Autenticación con Google (diferencia principal contra el Planeador)

- **Proveedor**: Firebase Authentication → Google. **Sin** usuarios anónimos, **sin**
  contraseñas propias, **sin** hashes en la base de datos (eso fue la deuda crítica del
  Planeador: allá la identidad era una convención del cliente y las reglas solo podían
  exigir `auth != null`).
- **Identidad = `auth.uid`** de Firebase, verificado por el servidor. Las reglas (§5) se
  anclan a `auth.uid` desde el día 1. No existe un "userId" propio del cliente.
- `requerirSesion()` en `auth.js`: espera `onAuthStateChanged`; sin usuario muestra la
  pantalla de bienvenida con el botón "Continuar con Google"; con usuario crea/actualiza
  `usuarios/{uid}` (nombre, correo, foto) y continúa.
- **Flujo de login**: `signInWithPopup(new GoogleAuthProvider())`; si el popup está
  bloqueado o la app corre como PWA instalada (`display-mode: standalone`), usar
  `signInWithRedirect` + `getRedirectResult` al cargar. Para que el redirect funcione en
  Safari/iOS (bloqueo de almacenamiento de terceros), configurar `authDomain` en
  `firebase-config.js` igual al dominio donde se sirve la app en Firebase Hosting (p.ej.
  `listadesuper.web.app`), que ya expone `/__/auth/handler`. **El agente debe probar el
  login en un iPhone real (Safari y PWA instalada) antes de dar la fase por terminada** y
  documentar el resultado; si falla, consultar la guía oficial de Firebase "Best practices
  for using signInWithRedirect on browsers that block third-party storage".
- Dominios autorizados (consola de Firebase → Authentication → Settings): el de Hosting y
  `localhost` para pruebas.
- Cerrar sesión: en la pantalla "Mis listas" (menú de cuenta con foto/nombre), y borra los
  cachés locales de listas (`localStorage`) para no dejar datos en un dispositivo compartido.

---

## 5. Modelo de datos y reglas (Realtime Database)

### Nodos

```
usuarios/{uid}: { nombre, email, foto, creado }
listasDeUsuario/{uid}/{listaId}: true            // índice "Mis listas"
listas/{listaId}:
  info:       { nombre, moneda: "MXN", creadaPor: uid, creada: ts,
                ordenCategorias: [ "frutas", "lacteos", ... ] }
  miembros/{uid}: { rol: "dueno" | "editor", nombre, email, desde: ts, codigo? }
  articulos/{articuloId}: { nombre, cantidad, unidad, categoria, precio,
                comprado: bool, compradoPor?: uid, agregadoPor: uid, creado: ts,
                plantillaId?: id, notas? }
  catalogo/{itemId}: { nombre, nombreNorm, unidad, categoria, precio, cantidad,
                favorito: bool, veces: n, ultimaVez: ts }
  plantillas/{plantillaId}: { nombre, creadaPor, articulos/{k}: { nombre, cantidad,
                unidad, categoria, precio } }
invitaciones/{codigo}: { listaId, creadaPor: uid, creada: ts, expira: ts }
```

- `catalogo` y `plantillas` viven **dentro de la lista** (compartidos por los miembros, que
  es lo natural para una lista familiar). Confirmar con el usuario en la Fase 2 si prefiere
  favoritos personales en `usuarios/{uid}`.
- `catalogo` se alimenta solo: al agregar o marcar comprado un artículo se suma `veces`, se
  actualiza `ultimaVez` y se recuerdan unidad/categoría/precio; "favorito" lo marca la
  persona. El autocompletado del campo rápido busca por `nombreNorm` (sin acentos,
  minúsculas).
- **Aplicar plantilla** = UNA escritura multi-ruta (`actualizarMultiple`) que crea todos
  sus artículos con `plantillaId`; si un artículo ya está pendiente en la lista con el
  mismo nombre normalizado, **suma cantidad** en vez de duplicar (mostrarlo en el toast).
- Dinero: `precio` es número (unitario, en la moneda de la lista); total =
  Σ(cantidad × precio) de los que tienen precio; formatear con `Intl.NumberFormat("es-MX",
  { style: "currency", currency })`.
- Códigos de invitación: **≥ 128 bits aleatorios** (`crypto.getRandomValues`, base64url),
  con caducidad (p.ej. 7 días). Compartir con `navigator.share` o copiar liga
  `…/unirse.html?codigo=XXXX`.

### Reglas (`database.rules.json`) — punto de partida

Cerrado por defecto y anclado a `auth.uid`. El agente debe **probarlas con el Emulador de
Firebase o el "Rules Playground" antes de publicar** (alta de lista, invitación, unirse,
miembro editando, no-miembro intentando leer/escribir, dueño quitando miembro).

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "usuarios": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "listasDeUsuario": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$listaId": {
          ".write": "auth != null && (auth.uid === $uid || root.child('listas/' + $listaId + '/miembros/' + auth.uid + '/rol').val() === 'dueno')"
        }
      }
    },
    "listas": {
      "$listaId": {
        ".read": "auth != null && data.child('miembros/' + auth.uid).exists()",
        "info": {
          ".write": "auth != null && ((!data.exists() && newData.child('creadaPor').val() === auth.uid) || root.child('listas/' + $listaId + '/miembros/' + auth.uid + '/rol').val() === 'dueno')",
          ".validate": "newData.hasChildren(['nombre', 'moneda', 'creadaPor']) && newData.child('nombre').isString() && newData.child('nombre').val().length <= 80"
        },
        "miembros": {
          "$uid": {
            ".write": "auth != null && ((auth.uid === $uid && !data.exists() && newData.child('rol').val() === 'dueno' && !root.child('listas/' + $listaId + '/info').exists()) || (auth.uid === $uid && !data.exists() && newData.child('rol').val() === 'editor' && root.child('invitaciones/' + newData.child('codigo').val() + '/listaId').val() === $listaId && root.child('invitaciones/' + newData.child('codigo').val() + '/expira').val() > now) || (auth.uid === $uid && !newData.exists() && data.child('rol').val() !== 'dueno') || (root.child('listas/' + $listaId + '/miembros/' + auth.uid + '/rol').val() === 'dueno' && auth.uid !== $uid))"
          }
        },
        "articulos": {
          ".write": "auth != null && root.child('listas/' + $listaId + '/miembros/' + auth.uid).exists()",
          "$articuloId": {
            ".validate": "!newData.exists() || (newData.child('nombre').isString() && newData.child('nombre').val().length > 0 && newData.child('nombre').val().length <= 120)"
          }
        },
        "catalogo": { ".write": "auth != null && root.child('listas/' + $listaId + '/miembros/' + auth.uid).exists()" },
        "plantillas": { ".write": "auth != null && root.child('listas/' + $listaId + '/miembros/' + auth.uid).exists()" }
      }
    },
    "invitaciones": {
      "$codigo": {
        ".read": "auth != null",
        ".write": "auth != null && ((!data.exists() && newData.child('creadaPor').val() === auth.uid && root.child('listas/' + newData.child('listaId').val() + '/miembros/' + auth.uid + '/rol').val() === 'dueno') || (data.exists() && !newData.exists() && root.child('listas/' + data.child('listaId').val() + '/miembros/' + auth.uid + '/rol').val() === 'dueno'))"
      }
    }
  }
}
```

Notas para el agente: (1) en un update multi-ruta, `root`/`data` son el estado **anterior**
y `newData` el posterior — por eso crear lista (info + miembros/{uid} dueño) en una sola
escritura sí pasa la regla de "la lista no existe todavía"; (2) unirse = escribir
`miembros/{miUid}` con `rol: "editor"` y `codigo`, más `listasDeUsuario/{miUid}/{listaId}`;
(3) el dueño no puede salirse sin transferir la propiedad (definir el flujo en la Fase 4);
(4) cualquier nodo nuevo necesita su regla, la raíz está cerrada.

---

## 6. Calidad de código (prácticas heredadas)

- **Comentarios en español que explican el *porqué*** (decisiones, bugs reales que se
  corrigieron, pedidos explícitos del usuario), no el *qué*.
- **Escapar todo lo que se interpola en HTML** con `esc()`; URLs externas con
  `urlSegura()` (solo http/https). Nada de `innerHTML` con datos sin escapar.
- **Una sola fuente de verdad** por dato y por lógica; funciones puras para cálculos
  (totales, agrupación por pasillo, fusión de plantillas, normalización de nombres) en un
  archivo propio, probables en Node.
- **`escuchar(ref, cb)` nunca entrega `null`** (entrega `{}`), cachea en `localStorage` y
  entrega primero lo cacheado; `obtenerConCache(ref)` para lecturas de una vez con timeout.
  Cada `montarVistaX(contenedor, …)` **devuelve su función de limpieza** (quita
  listeners). Repintados agrupados con `programarRender()`.
- **Escrituras campo por campo** (`update`) — nunca reescribir un nodo entero que tenga
  campos que el formulario no maneja. Acciones masivas = una sola escritura multi-ruta.
- `localStorage` siempre dentro de `try/catch` y solo para comodidades locales (vista
  recordada, caché offline).
- "Hoy" con la hora local del dispositivo (`hoyLocalISO()`), nunca con una zona fija.
- **Pruebas antes de cada push**: `node --check` de cada JS; pruebas de lógica pura en
  Node (`vm` cargando los archivos); **Playwright** contra la app servida localmente con un
  mock de Firebase (Auth + RTDB) para los flujos principales, en 1280 px y 390 px, sin
  errores de página; capturas de pantalla revisadas. Ningún "listo" sin evidencia.
- **Accesibilidad**: contraste WCAG, `aria-label` en todo botón de solo icono, áreas de
  toque ≥ 44 px, foco visible.

---

## 7. Seguridad desde el inicio

Aplicar desde la v1 lo que en el Planeador quedó como deuda (ver su `SEGURIDAD.md`):

- Reglas anclas a `auth.uid` + validación de esquema (§5).
- Cabeceras en `firebase.json`: `Content-Security-Policy` **aplicada** (no solo
  Report-Only) — por eso **ningún `<script>` inline** (todo en archivos `.js`), más
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`,
  `Permissions-Policy`, `Strict-Transport-Security`; HTML/JSON con `Cache-Control:
  no-cache`. La CSP debe permitir `https://apis.google.com` y el dominio de auth para el
  login con Google (verificar en el navegador que no haya violaciones).
- Ningún secreto en el repo: `firebase-config.js` es configuración pública (la protección
  real son las reglas); la cuenta de servicio vive solo en *GitHub Secrets*.
- Sin datos sensibles en la lista (es una lista de compras): no guardar tarjetas ni
  direcciones.

---

## 8. Puesta en marcha manual (la hace el dueño, una vez)

1. Consola de Firebase → **crear proyecto nuevo** (p.ej. `listadesuper`).
2. **Authentication** → habilitar proveedor **Google**; correo de soporte; dominios
   autorizados.
3. **Realtime Database** → crear (región a elegir) en modo bloqueado; publicar
   `database.rules.json` (o dejar que el workflow lo haga, §9).
4. **Hosting** → habilitar. Desde una terminal con Firebase CLI:
   `firebase init hosting:github` sobre el repo `dmgerardo/ListadeSuper` — crea la cuenta
   de servicio y el secreto `FIREBASE_SERVICE_ACCOUNT_LISTADESUPER` en GitHub.
5. Copiar la configuración web del proyecto a `js/firebase-config.js`.
6. En GitHub: permitir que Claude (GitHub App) acceda al repo; rama por defecto `main`.

---

## 9. Flujo de Git, GitHub y despliegue (igual que el Planeador)

- **Despliegue automático**: `.github/workflows/firebase-hosting-merge.yml` — en cada push
  a `main`, `actions/checkout@v4` + `FirebaseExtended/action-hosting-deploy@v0` con
  `firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_LISTADESUPER }}`,
  `channelId: live`, `projectId: listadesuper`. Opcional: canal de vista previa por PR.
- **Reglas de la base de datos**: en el Planeador se pegaban a mano en la consola (y se
  olvidaba). Aquí, agregar al workflow un paso `npx firebase-tools deploy --only database`
  con la misma cuenta de servicio (requiere el rol de administrador de Realtime Database en
  IAM) — **verificar que funcione**; si no, documentar el paso manual en `README.md` y en
  `AGENTS.md` como "Errores a evitar".
- **Versión y caché**: hook `.githooks/pre-commit` → `scripts/bump-version.py` sube `?v=N`
  en los `<script>/<link>` de los HTML y `APP_VERSION` en `js/app-version.js` cuando el
  commit toca `.js`/`.css`. Activar en cada clon: `git config core.hooksPath .githooks`.
  `sw.js` usa `APP_VERSION` en el nombre del caché y en la lista del app shell; **todo JS
  nuevo se agrega a esa lista y a los HTML**.
- **Trabajo con Claude Code**: rama de trabajo por sesión → commit en español, claro →
  push → PR → merge automático (preferencia del usuario: "siempre consolida y haz el
  deploy") → revisar que el workflow de deploy termine en verde → reiniciar la rama desde
  `main`. Cada versión actualiza `historial.html` (texto para usuarios), `AGENTS.md`
  (invariantes técnicas) y `PROXIMA_SESION.md` (qué se hizo, qué falta, qué no se probó).
- `firebase.json` → `hosting.ignore`: `.github/**`, `.githooks/**`, `scripts/**`,
  `docs/**`, `*.md`, `database.rules.json`, etc. (no publicar archivos internos).

---

## 10. Plan por fases (cada una cabe en una sesión)

| Fase | Contenido | Hecho cuando… |
|------|-----------|---------------|
| 0 | Esqueleto: estructura de archivos, tokens CSS, tema, iconos, render-utils, db.js, SW, manifest, hook de versión, workflow de deploy, docs (AGENTS/CLAUDE/README/SEGURIDAD/PROXIMA_SESION/historial) | El sitio vacío se despliega solo al hacer merge a `main` y muestra `v1`. |
| 1 | Login con Google + `usuarios/{uid}` + "Mis listas" (crear/abrir/renombrar) + reglas §5 probadas | Login probado en computadora y en iPhone (Safari y PWA); un no-miembro no puede leer una lista ajena (probado). |
| 2 | Artículos: agregar rápido, cantidad/unidad/categoría/precio, agrupación por pasillo, comprado, quitar, totales, Deshacer | Flujo de compra completo en 390 px sin errores; totales verificados con casos a mano. |
| 3 | Catálogo de frecuentes/favoritos + autocompletado + plantillas (crear desde la lista actual, aplicar con un toque, quitar los de una plantilla) | Aplicar una plantilla de 30 artículos = 1 escritura; duplicados suman cantidad. |
| 4 | Miembros e invitaciones (liga/código con caducidad, unirse, quitar miembro, salir, transferir dueño) | Dos cuentas de Google distintas editan la misma lista en tiempo real. |
| 5 | Pulido: offline (pastilla, caché), ayuda por vista, accesibilidad, CSP aplicada sin violaciones | Recorrido completo en modo avión de solo lectura; consola sin errores ni violaciones de CSP. |

## 11. Decisiones abiertas (preguntar al usuario cuando toque)

- Favoritos/plantillas: ¿por lista (compartidos, default de este documento) o personales?
- Lista de categorías por defecto y su orden de pasillos; ¿unidades permitidas?
- Moneda por defecto (MXN) y si se permite cambiar por lista.
- Caducidad de invitaciones (7 días por defecto) y si un código sirve para varias personas.
- Nombre visible de la app e icono.
- Región de la Realtime Database.

---

## 12. Reglas de trabajo para el agente

- Leer `AGENTS.md` completo antes de cambiar código (una vez creado).
- Respuestas concretas y verificables; **nada inventado**: si algo no se probó (p.ej.
  login en iPhone real), decirlo explícitamente.
- Preguntar con opciones cuando haya una decisión de producto; no cambiar decisiones ya
  tomadas sin preguntar.
- Commit, push, PR, merge y verificación del deploy automáticos al terminar cada cambio.
- Español en UI, comentarios, commits y documentación.
