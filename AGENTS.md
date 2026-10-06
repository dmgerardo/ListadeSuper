# AGENTS.md — Guía técnica viva de ListadeCompras

> Léelo completo antes de cambiar código. Este documento reemplaza a `PROYECTO_INICIAL.md`
> como fuente de verdad técnica; ese archivo queda como referencia histórica de decisiones
> del inicio del proyecto.

## 1. Qué es

PWA de listas de compra compartidas (repo `dmgerardo/ListadeSuper`, app visible como
**"ListadeCompras"**). Sin build ni framework: HTML + CSS + JS vanilla cargado con
`<script>` clásicos, un solo scope global. Firebase (Authentication Google + Realtime
Database + Hosting) vía SDK compat por CDN de gstatic, versión `10.14.1` (no verificada
contra la última versión disponible en esta sesión — revisar si se actualiza).

## 2. Invariantes (no romper sin discutirlo)

- **Nunca declarar la misma `const`/`function` en dos archivos `.js`** — es un
  `SyntaxError` global que rompe toda la app (no hay módulos ES, todo comparte scope).
- **Orden de carga obligatorio** en cada HTML: SDK de Firebase (CDN) → `firebase-config.js`
  (aquí se llama `firebase.initializeApp`) → `db.js` → `auth.js` (usa `refNodo` de `db.js`
  y `firebase.auth()`) → `iconos.js` → `render-utils.js` (usa `icono()`) →
  `catalogo-categorias.js` → vistas (`vista-listas.js`, etc.) → `app-version.js` →
  `version.js` → el script de arranque de esa página (`js/pagina-*.js`, **al final,
  siempre**). `tema.js` va en `<head>`, antes de todo, sin `defer`.
- **Identidad = `auth.uid`**. No existe "userId" propio del cliente ni usuarios anónimos.
- **Reglas cerradas por defecto** (`database.rules.json`): cualquier nodo nuevo necesita su
  propia regla explícita.
- **Escribir campo por campo** (`actualizar`/`update`), nunca reescribir un nodo entero.
  Acciones masivas = una sola escritura multi-ruta con `actualizarMultiple`.
- **Escapar todo lo que se interpola en HTML** con `esc()`; URLs externas con `urlSegura()`.
  Nada de `innerHTML` con datos sin escapar.
- **Ningún `style="..."` inline tampoco** — la CSP (`style-src` sin `'unsafe-inline'`) lo
  bloquea igual que los `<script>` inline. Usar una clase de `css/estilos.css` (ver
  `.fila-tarjeta`, `.enlace-con-icono`, etc. como ejemplo de las utilidades ya creadas para
  esto).
- **`escuchar()` nunca entrega `null`** (entrega `{}`).
- **Ningún `<script>` inline** en los HTML (todo en archivos `.js`) — lo exige la CSP de
  `firebase.json` (aplicada, no Report-Only).
- **Todo JS/CSS nuevo** se agrega a la lista `ARCHIVOS_APP_SHELL` de `sw.js` y a los
  `<script>`/`<link>` de los HTML que lo necesiten.
- **Español** en UI, comentarios, commits y documentación.

## 3. Estructura de archivos

Ver `PROYECTO_INICIAL.md` §2 para el árbol completo. Resumen de lo ya creado (Fase 0-1):

| Archivo | Rol |
|---|---|
| `js/tema.js` | Modo claro/oscuro/sistema antes del primer paint |
| `js/firebase-config.js` | Config pública + `initializeApp` |
| `js/db.js` | `refNodo`, `escuchar`, `obtenerConCache`, `agregar`, `actualizar`, `eliminar`, `actualizarMultiple`, `programarRender`, caché en `localStorage` |
| `js/auth.js` | Login/logout Google, `requerirSesion()`, perfil en `usuarios/{uid}` |
| `js/iconos.js` | `ICONOS_LUCIDE`, `icono()`, `iconoTexto()` |
| `js/render-utils.js` | `esc`, `urlSegura`, `formatoMoneda`, `hoyLocalISO`, `abrirModal`, `confirmarCierreConCambios`, `mostrarToast`, `montarBotonAyuda`, `montarPastillaConexion` |
| `js/catalogo-categorias.js` | Categorías/pasillos y unidades por defecto (placeholder, confirmar en Fase 2) |
| `js/vista-listas.js` | Pantalla "Mis listas": crear, abrir, renombrar |
| `js/pagina-inicio.js` | Script de arranque de `index.html` (bienvenida o "Mis listas") |
| `js/pagina-lista.js` | Script de arranque de `lista.html` |
| `index.html` | Login + "Mis listas" |
| `lista.html` | Abre una lista (solo confirma acceso; artículos llegan en Fase 2) |
| `historial.html` | Historial de versiones para usuarios |
| `database.rules.json` | Reglas (copiadas de `PROYECTO_INICIAL.md` §5, **sin probar con el emulador todavía** — ver `PROXIMA_SESION.md`) |
| `sw.js` | App shell cacheado por versión |

## 4. Autenticación

Ver `PROYECTO_INICIAL.md` §4 (no repetido aquí para no duplicar fuente de verdad). Punto
crítico: `signInWithPopup` con fallback a `signInWithRedirect` si el popup se bloquea o la
app corre como PWA instalada (`display-mode: standalone`). **No probado en iPhone real
todavía** — hacerlo antes de cerrar la Fase 1 por completo (ver `PROXIMA_SESION.md`).

## 5. Modelo de datos y reglas

Ver `PROYECTO_INICIAL.md` §5. Decisión confirmada con el usuario: favoritos/plantillas
viven **dentro de la lista** (compartidos entre miembros, no personales). Moneda inicial
`MXN`. Invitaciones caducan en 7 días y se consideran de un solo uso (ver §11 del doc base,
confirmado — se usará en Fase 4).

## 6. Errores a evitar (bitácora)

- **La CSP (`firebase.json`) bloquea `<script>` inline de verdad — se comprobó en
  producción, no solo en teoría.** `index.html` y `lista.html` tenían su lógica de arranque
  en un `<script>` inline al final del HTML; al desplegar a `pilo-compras.web.app` cargaba
  **pantalla en blanco total** (nada de JS corría) con este error en consola: `Executing
  inline script violates the following Content Security Policy directive 'script-src
  'self' ...'. Either the 'unsafe-inline' keyword, a hash (...), or a nonce (...) is
  required`. La prueba local con `http.server` no lo detecta porque ahí no hay cabeceras
  CSP (esas solo las manda Firebase Hosting) — **probar siempre contra el sitio
  desplegado, no solo en local, antes de dar algo por terminado**. Corregido moviendo esa
  lógica a `js/pagina-inicio.js` y `js/pagina-lista.js`. Mismo tipo de problema con
  `style="..."` inline (CSP `style-src`) — ver invariante en §2, ya corregido en el mismo
  despliegue.
- **La regla de `Cache-Control: no-cache` en `firebase.json` para `**/*.@(html)` NO cubre
  la raíz `/`** (no termina en `.html`), así que el navegador puede cachear "/" con las
  reglas de caché por defecto y servir un HTML viejo después de un deploy nuevo — pasó
  justo después de corregir el bug de arriba: la pestaña mostraba otra vez el error de CSP
  del script inline ya eliminado, porque sirvió una copia cacheada de `/`. Agregada una
  regla de headers explícita para `"source": "/"` además de `**/*.@(html)`.
- **`Event.currentTarget` es `null` fuera del despacho síncrono del evento.** Guardarlo en
  una variable local antes de usarlo dentro de un `.then()`/`.catch()` asíncrono (pasó en
  el botón de login: `ev.currentTarget.disabled = false` dentro del `.catch()` tiraba
  `TypeError: Cannot set properties of null`). Corregido en `index.html`.
- Si `signInWithPopup` cae a `signInWithRedirect` y esa redirección no llega a completarse
  (prueba automatizada, popup bloqueado a medias, usuario cierra la pestaña a mitad), el
  estado "redirect pendiente" queda guardado en el IndexedDB `firebaseLocalStorageDb` y
  `requerirSesion()` puede quedarse sin disparar en la siguiente carga. En un navegador
  real la redirección sí completa (va y vuelve), así que no debería pasar en producción,
  pero si un usuario reporta pantalla en blanco persistente, decirle que borre datos del
  sitio (o probar `localStorage.clear()` + borrar el IndexedDB) como primer diagnóstico.

## 7. Pendiente de verificar (no inventar que ya se probó)

- Versión del SDK compat de Firebase (`10.14.1`) no se confirmó contra la más reciente —
  no había acceso a internet en la sesión que creó este archivo.
- `database.rules.json` no se probó con el Emulador de Firebase ni el Rules Playground.
- Login con Google no se probó en iPhone real (Safari ni PWA instalada). Tampoco se pudo
  completar un login real en esta sesión: Authentication → Google todavía no está
  habilitado en la consola, y la `apiKey` actual devuelve `auth/api-key-not-valid` (ver
  `PROXIMA_SESION.md` — probablemente restricciones de la API key en Google Cloud Console,
  no un typo: el formato y los demás campos del config son correctos).
- El paso `deploy --only database` del workflow de GitHub Actions no se ejecutó nunca
  (requiere el proyecto de Firebase y los secretos ya configurados en GitHub).
- `node --check` y las pruebas de lógica pura en Node no corrieron esta sesión: **no hay
  Node.js instalado en el entorno** donde se escribió este código. Instalarlo y correr las
  pruebas antes de confiar en que el JS no tiene errores de sintaxis.
- Los íconos de `icons/*.png` son un placeholder generado por script (carrito simple sobre
  fondo `--color-primario`), no un diseño final.
