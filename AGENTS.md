# AGENTS.md — Guía técnica viva de ListadeCompras

> Léelo completo antes de cambiar código. Este documento reemplaza a `PROYECTO_INICIAL.md`
> como fuente de verdad técnica; ese archivo queda como referencia histórica de decisiones
> del inicio del proyecto.

## 1. Qué es

PWA de listas de compra compartidas (repo `dmgerardo/ListadeSuper`, app visible como
**"ListadeCompras"**). Sin build ni framework: HTML + CSS + JS vanilla cargado con
`<script>` clásicos, un solo scope global. Firebase (Authentication Google + Realtime
Database + Hosting) vía SDK compat por CDN de gstatic, versión `10.14.1` (la más reciente
en npm es `12.19.0`, ver §7).

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
- **Semántica de `comprado`** (confirmada con el usuario): marcado = "ya lo tengo / no hace
  falta"; desmarcado = "por comprar". La lista es fija y se reutiliza: no se borran artículos
  al comprar. Lo importado entra marcado. La vista por defecto es "Por comprar".
- **`database.rules.json` se GENERA** con `python3 scripts/generar-reglas.py` (las expresiones
  "admin", "miembro activo", etc. se definen una vez ahí). No editar el JSON a mano.
- **Roles de la app** (`roles/{uid}`: admin / participante / invitado + activo). El
  administrador raíz es `ADMIN_RAIZ` (correo verificado) en el generador Y en `js/roles.js`
  (una prueba verifica que coincidan); no tiene nodo en `roles/`. Alta propia solo como
  invitado activo. Invitado: usa listas a las que lo invitan, no crea. Desactivado: nada.
- **Miembros de lista**: dueño + editores; los editores hacen todo menos eliminar la lista
  (renombran, invitan, quitan a quien no sea el dueño). Invitaciones: código de 128 bits,
  un solo uso (`usadaPor` en la misma escritura que el alta), vencen en 7 días.
- **Marcar/desmarcar se registra en `listas/{id}/actividad`** (quién, qué, cuándo) en la MISMA
  escritura multi-ruta (`escribirArticulo` en `vista-articulos.js`). Es temporal: el cliente
  borra lo de > 24 h al abrir la lista (las reglas permiten borrar solo lo de > 23 h).
- **Cambios de cantidad (+/−) con `transaction`**, para no perder toques simultáneos.
- **Duplicar una lista** (Nueva lista → "Copiar artículos de"): lista + artículos en UNA escritura
  (`crearLista(usuario, nombre, { origen, todosMarcados })`, `copiarArticulos` en
  `logica-articulos.js`). Copia nombre/cantidad/unidad/pasillo/precio/notas y el orden de
  pasillos; NO miembros, actividad ni autoría. Las reglas de `articulos` lo permiten solo al
  crear tu propia lista en la misma escritura (casos en `pruebas/reglas`).
- **Toda regla nueva o cambiada lleva su caso en `pruebas/reglas/reglas.test.js`** y se
  corre `npm test` ahí antes de publicar. `agregadoPor`/`compradoPor` NO se atan a
  `auth.uid` a propósito (el Deshacer de un borrado restaura la autoría de otro miembro).
- **Antes de cada push**: `node --check`, `node --test pruebas/*.test.js`, pruebas de reglas
  y `pruebas/e2e/flujo-compra.js` (ver `pruebas/README.md`).
- **Español** en UI, comentarios, commits y documentación.
- **Controles globales solo en la barra inferior flotante** (`render-utils.js`): pestañas de
  la pantalla, ayuda, estado+versión y cuenta van dentro de la píldora; la acción principal
  (+) va en el botón circular a su derecha. Cada script monta lo suyo en su ranura
  (`data-ranura="pestanas|ayuda|estado|cuenta|principal"`) y la vacía al cambiar de
  pantalla o de sesión. No crear FABs ni barras fijas nuevas fuera de ella. En `lista.html`
  las pestañas de la barra son las **dos vistas** ("Por comprar" con su contador / "Toda la
  lista"; las monta `montarVistaArticulos`), pedido del usuario. Favoritos/Plantillas/Miembros
  **salieron de la barra** mientras no existan: con ellos son 8 controles ≈ 372 px y no caben
  con objetivos de 44 px. Al construir la Fase 3/4, decidir con el usuario dónde van (p. ej.
  un control "Más"). Tampoco hay "+" aparte: agregar es el "+" del campo rápido.
- **Formularios: tocar fuera o Escape con cambios NO cierra** — `abrirModal(html, alCerrar,
  { hayCambios, guardar })` pregunta Guardar / Descartar / Seguir editando. Hay pila de modales
  (Escape y clic fuera solo afectan al de arriba). "Guardar" solo llama `guardar()`: cada
  formulario se cierra solo si guarda bien (si la validación falla, se queda abierto). Todo
  formulario nuevo debe pasar `hayCambios`/`guardar`.
- **Deshacer en "Por comprar"**: además del toast, la sección "Marcaste hace poco" (lo que YO
  marqué en 15 min, desde el registro de actividad) con "Regresar"; no se pierde si llega otro
  aviso ni al recargar.
- **Un solo toast a la vez** (`mostrarToast` reemplaza el anterior). Los toasts van
  **debajo** de los modales (z-index 90 < 100) y encima de la barra (40).
- **Colores solo por tokens**: todo hex vive en `:root` o `:root[data-modo="oscuro"]` de
  `css/estilos.css`; los pasillos también (`--pasillo-<clave>-tinte/-tinta`, expuestos por la
  clase `.pasillo-<clave>` como `--tinte`/`--tinta`). **Toda pareja texto/fondo nueva se agrega
  a `pruebas/contraste.js` y se corre** (falla si algo baja de 4.5:1 texto / 3:1 íconos, o si
  aparece un hex fuera de los tokens). Resultados en `pruebas/contraste-resultados.md`.
- **Íconos solo de Lucide oficial** (`lucide-static` de npm), copiados a `js/iconos.js`, nunca
  escritos a mano ni por CDN.

## 3. Estructura de archivos

Ver `PROYECTO_INICIAL.md` §2 para el árbol completo. Resumen de lo ya creado (Fase 0-1):

| Archivo | Rol |
|---|---|
| `js/tema.js` | Modo claro/oscuro/sistema antes del primer paint |
| `js/firebase-config.js` | Config pública + `initializeApp` |
| `js/db.js` | `refNodo`, `escuchar`, `obtenerConCache`, `agregar`, `actualizar`, `eliminar`, `actualizarMultiple`, `programarRender`, caché en `localStorage` |
| `js/auth.js` | Login/logout Google, `requerirSesion()`, perfil en `usuarios/{uid}` |
| `js/iconos.js` | `ICONOS_LUCIDE` (SVG oficiales de `lucide-static` 1.52.0, ver cabecera), `icono()`, `iconoTexto()` |
| `js/render-utils.js` | `esc`, `urlSegura`, `formatoMoneda`, `hoyLocalISO`, `abrirModal`, `confirmarCierreConCambios`, `mostrarToast` y la barra inferior flotante: `barraInferior`, `ranuraBarra`, `vaciarRanura`, `montarPestanas`, `montarAccionPrincipal`, `montarBotonAyuda`, `montarMenuCuenta` |
| `js/catalogo-categorias.js` | Las 14 categorías/pasillos del usuario (confirmadas en Fase 2, orden de su nota de iPhone; "Especiales" es el cajón, no hay "Otros"), su ícono (`CATEGORIAS_ICONOS`), alias para importar y las 11 unidades |
| `js/logica-articulos.js` | Lógica pura, probada en Node: `normalizarNombre`, `interpretarTextoRapido` ("2 kg tomate"), `ordenCategoriasEfectivo`, `agruparArticulos`, `totalesLista`, `parsearNotaImportada`, `separarRepetidos`, `buscarPorNombre`, `textoCantidad`, `pasoDeUnidad`, `siguienteCantidad`, `etiquetaUnidad` (contador −/+), `compararPorNombre` (orden alfabético), `cantidadParaUnidad`, `contarSinPrecio` (editor de precios), `copiarArticulos` (duplicar lista) |
| `js/vista-articulos.js` | Pantalla de una lista: vistas "Por comprar"/"Toda la lista", campo rápido (busca + agrega), formulario agregar/editar/eliminar, marcar todo, importar nota, totales, Deshacer |
| `js/vista-listas.js` | Pantalla "Mis listas": crear, abrir, renombrar, eliminar (dueño); avisos según rol |
| `js/roles.js` | `ADMIN_RAIZ`, `rolEfectivo`, `asegurarRol`, `escucharRol`, `montarCuentaConRol` |
| `js/vista-usuarios.js` + `js/pagina-usuarios.js` + `usuarios.html` | Administración de usuarios (rol y activo) |
| `js/vista-miembros.js` | Fila de miembros + presencia, hoja "Miembros": invitar (liga), quitar, salir |
| `js/coordinacion.js` | Registro de actividad (24 h), avisos de lo que marcan otros, hoja "Actividad" |
| `js/pagina-unirse.js` + `unirse.html` | Aceptar una invitación (`unirse.html?codigo=…`) |
| `scripts/generar-reglas.py` | Genera `database.rules.json` |
| `js/pagina-inicio.js` | Script de arranque de `index.html` (bienvenida o "Mis listas") |
| `js/pagina-lista.js` | Script de arranque de `lista.html` (pestañas de la barra + `montarVistaArticulos`) |
| `js/version.js` | Estado de conexión + versión en la barra inferior (tocar = forzar actualización) y registro del Service Worker |
| `index.html` | Login + "Mis listas" |
| `lista.html` | Una lista con sus artículos (Fase 2) |
| `pruebas/` | Pruebas: lógica en Node, reglas con el emulador, flujo con Playwright, contraste de tokens (`contraste.js`) — ver `pruebas/README.md` |
| `scripts/generar-iconos.py` | Genera `icons/*.png` (placeholder) con los colores de los tokens. Requiere Pillow |
| `historial.html` | Historial de versiones para usuarios |
| `database.rules.json` | Reglas (GENERADAS, ver arriba). Probadas con el Emulador (`pruebas/reglas`, 34 casos): roles y admin raíz, crear lista por rol, desactivados, artículos, editores, invitaciones de un solo uso, eliminar lista, actividad y presencia |
| `sw.js` | App shell cacheado por versión |

## 3b. Sistema visual "Mercado fresco" (Fase 2.1)

- **Tokens** (`css/estilos.css`, modo claro → oscuro): fondo `#F3F5F0`→`#121815`, superficie
  `#FFFFFF`→`#1B231E`, texto `#15211A`→`#E8EFE9`, texto suave `#56655B`→`#9DB0A3`, primario
  `#17803D`→`#3DBE6E`, primario oscuro (acciones de texto, pestaña activa) `#0F5C2B`→`#7FD9A0`,
  texto sobre primario `#FFFFFF`→`#15211A`, tinte primario `#E4F2E7`→`#1D3B29`, borde
  `#E3E8E1`→`#2A352E`, riel del selector `#E8ECE6`→`#222C26`, peligro `#B42318`→`#F1907C`,
  toast `#15211A`/blanco/acción `#86E0A6` → `#E8EFE9`/`#121815`/acción `#0F5C2B`. Radios 20 px
  (tarjetas), 14 px (chico), 12 px (segmento). Sombra de tarjeta `0 1px 2px` al 6 %.
- **Tipografía**: títulos Bricolage Grotesque 700/800, `letter-spacing: -0.02em`; texto Figtree
  400/500/600/700. h1 36 px. Ambas de Google Fonts (permitidas por la CSP actual).
- **Pasillos**: un par tinte/tinta por pasillo, ≥ 4.5:1 en ambos modos (la tinta también pinta
  el número de pendientes del índice, que es texto). Íconos (`CATEGORIAS_ICONOS`):
  especiales `sparkles`, frutas_temporada `cherry`, frutas `apple`, verduras `carrot`,
  carniceria `beef`, salchichoneria `ham`, refris `refrigerator`, condimentos_aceites
  `cooking-pot`, abarrotes `package`, botanas_semillas `popcorn`, panaderia `croissant`,
  limpieza `spray-can`, personal `toothbrush`, farmacia `pill`.
- **Marcado** se pinta en texto suave **sin tachar** ("ya lo tengo", no "borrado").
- **Contador (−) cantidad unidad (+)** en cada renglón de "Toda la lista" (no en "Por
  comprar"), tipo carrito. Solo cambia `cantidad` (una escritura por toque, sin toast); NO
  marca ni desmarca. Paso: 1 (piezas, paquetes…), 0.5 (kg, l), 100 (g, ml); nunca baja de un
  paso (las reglas exigen > 0; quitar = "Eliminar"). Unidad explícita: solo "pieza" se abrevia
  (pza/pzas). En esa vista el subtotal baja al renglón de detalle para que quepa en 320 px.
- **Índice de pasillos fijo arriba** (`.indice-pasillos`, sticky, `--alto-indice` 60 px): primer
  elemento del cuerpo de la lista; los títulos de pasillo se pegan justo debajo; el chip del
  pasillo que va arriba se resalta al hacer scroll (`marcarPasilloActual`). Al buscar, el
  índice se vacía y los títulos vuelven a pegarse hasta arriba (`:has(.indice-pasillos:empty)`).
- **Orden dentro de cada pasillo: alfabético** (`Intl.Collator("es")`: sin acentos ni
  mayúsculas, ñ tras n, números por valor; desempate por llave). Pedido del usuario.
- **Editor rápido de unidades y precios** ("Unidades y precios" en "Toda la lista"): por
  renglón, selector de unidad + precio unitario; guarda campo por campo en `change` (salir del
  campo o Enter, que pasa al siguiente); "Solo sin precio"; "Listo" lo cierra. **Mientras está
  abierto la lista no se repinta con cada `value`** (`editorPintado`): repintar perdería el
  foco y lo escrito. Cambiar la unidad ajusta la cantidad (`cantidadParaUnidad`: 1 pza → 100 g).
  Leer precios de tiendas en automático se descartó (sin backend, CORS/CSP, términos de uso).
- **Apariencia** (Sistema / Claro / Oscuro): selector en la hoja "Mi cuenta" (tocar la foto
  en la barra), no en la barra (no cabe un 8.º control en 320 px). Usa
  `establecerPreferenciaTema()` de `tema.js`; se guarda por dispositivo en `localStorage`
  (`preferenciaTema`) y "Sistema" sigue al SO en vivo. Sin sesión (bienvenida) no hay selector.
- **Barra inferior**: la pestaña activa lleva tinte primario y su etiqueta; en pantallas
  < 375 px la etiqueta se oculta (con 7 controles no cabe en un iPhone SE), queda el ícono con
  su `aria-label`.

## 3c. Lenguaje visual para las fases siguientes (obligatorio)

Acordado con el usuario (2026-10-06) a partir de su maqueta "Mercado fresco". Toda pantalla
nueva lo sigue; si algo no encaja, se pregunta antes de inventar un patrón.

**B0.** Antes de la Fase 3, **preguntar al usuario qué le falta realmente** (favoritos o
plantillas): su lista ya funciona como catálogo fijo.

**B1. Patrones comunes**
- Encabezado: enlace de regreso arriba a la izquierda (chevron + texto, `.enlace-regreso`),
  título de 34–38 px en la fuente de títulos y subtítulo de una línea en texto suave
  (`.subtitulo`).
- Tarjetas blancas (`.tarjeta`) de radio 20–22 px. **Una sola "tarjeta héroe" por pantalla**
  (fondo primario o `--color-texto`) para lo más importante (ej. `.tarjeta-resumen`).
- Baldosas de ícono (`.baldosa`) de 44–48 px, radio 14–16 px, con colores de pasillo
  (`.pasillo-<clave>`) o tinte primario.
- Botones: primario relleno (`.btn`, texto sobre primario); secundario con borde de 1.5 px y
  fondo blanco (`.btn-secundario`); acciones de texto en primario oscuro (`.btn-texto`). Los de
  solo ícono llevan `aria-label` y `title`.
- Todo borrado o acción masiva lleva toast con Deshacer (`mostrarToast(…, { accion })`).
- Estados vacíos en `.tarjeta.tarjeta-vacia` con ícono en `.circulo-vacio`.

**B2. Fase 3, si el usuario la confirma**
- Favoritos: cuadrícula de 2 columnas de botones-tarjeta (baldosa con inicial o ícono del
  pasillo, nombre, "última cantidad · precio"). Al tocarla se pone por comprar y queda con
  borde primario y palomita. Filtros en píldoras: Todos / Favoritos / Frecuentes.
- Plantillas: la aplicada más reciente como tarjeta héroe oscura con chips de sus artículos y
  dos acciones ("Aplicar otra vez", "Quitar los de esta"). Las demás en tarjetas blancas con
  baldosa, "N artículos · aprox. $X" y botón "Aplicar". Nota fija: si el artículo ya existe se
  suma o se pone por comprar, sin duplicar.

**B3. Mis listas (`index.html`)** — pendiente de construir (en la 2.1 solo se aplicaron
tokens, encabezado y tarjetas con baldosa): la lista más reciente como tarjeta héroe primaria
(ícono, nombre, "N por comprar", avatares de miembros, estimado, "Abrir"); las demás en
cuadrícula de 2 columnas con baldosa de color, nombre y pendientes. "Nueva lista" abajo a la
derecha (oscuro, 56 px) junto a la pastilla "En línea · vN". Ojo: "N por comprar" y el
estimado por lista requieren escuchar los artículos de cada lista (más lecturas).

**B4. Fase 4 (Miembros e invitaciones)** — tarjeta de tinte primario "Invita a alguien" ("La
liga vence en 7 días", campo de solo lectura con la liga + botón copiar, botón primario
"Compartir invitación" con `navigator.share`). Debajo, miembros en una tarjeta: avatar o foto
de 44 px, nombre (con "(tú)"), rol como píldora ("Dueño" en tinte primario) y quitar
(`trash-2`) solo visible para el dueño. **Antes de la UI: escribir los casos de reglas de
invitaciones/miembros en `pruebas/reglas`** (hoy no tienen).

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
- **El Service Worker servía JS/CSS de la versión anterior** (visto en producción con la
  v7: Chrome ejecutaba el `render-utils.js` de la v6 aunque el HTML pedía `?v=7`, y la
  consola mostraba un error de CSP de un `style=""` que ya no existía en el código). Dos
  causas en `sw.js`: (1) el SW viejo sigue controlando la primera carga tras un deploy y su
  `cache.match(req, { ignoreSearch: true })` ignoraba el `?v=N` nuevo; ahora un `?v=` de
  otra versión va directo a la red; (2) `cache.addAll()` en `install` podía llenar el caché
  nuevo con copias viejas de la caché HTTP (Firebase sirve JS/CSS con `max-age`); ahora usa
  `cache: "reload"`. La corrección solo aplica a partir del SW siguiente: la primera carga
  después de un deploy cuyo SW anterior tenía el bug todavía puede salir obsoleta (una
  recarga o tocar la versión lo arregla). También se corrigió `respuesta.clone()` llamado
  dentro de un `.then()` asíncrono ("Response body is already used"): hay que clonar antes
  de devolver la respuesta. Verificado con Playwright + SW real, simulando tres deploys.
- **Errores `.js.map` de gstatic bloqueados por `connect-src`**: los pide DevTools (source
  maps) solo con la consola abierta; la app no los usa. No abrir la CSP por eso.
- **Login en la app anclada a la pantalla de inicio del iPhone regresaba sin sesión**
  (reportado por el usuario, 2026-10-06): iba a Google y volvía al botón "Continuar con
  Google". Causa: `signInWithRedirect` con `authDomain` = `pilo-compras.firebaseapp.com`
  (distinto del dominio de la app) — Safari iOS 16.1+ aísla ese almacenamiento como de
  terceros y el resultado de la redirección se pierde. Corrección (la recomendada por
  Firebase para apps en Hosting): `authDomain` = el mismo dominio de la app
  (`js/firebase-config.js`), y la CSP/`X-Frame-Options` solo en `/` y `*.html` (antes en `**`,
  lo que también alcanzaba `/__/auth/handler` y `/__/auth/iframe`, que usan scripts inline y
  se cargan en iframe). **Requiere** `https://pilo-compras.web.app/__/auth/handler` en "URIs de
  redirección autorizados" del cliente OAuth web en Google Cloud Console; sin eso Google
  responde `redirect_uri_mismatch` en todos los dispositivos. `pruebas/e2e/servidor.py` ahora
  aplica las cabeceras por ruta, como Hosting.
- **`.validate` NO se evalúa al borrar** en Realtime Database: un administrador podía borrar el
  rol de alguien pese a `hasChildren`. Para impedir borrados hay que ponerlo en `.write`
  (`&& newData.exists()`). Lo detectó una prueba del emulador.
- **`newData.parent()` se cuenta desde el nodo de la regla**: desde `listas/$l/miembros/$uid`
  hasta la raíz son 4 `parent()`, no 3 (con 3 las invitaciones válidas fallaban).
- **El mock de Firebase debe avisar a un oyente solo si SU valor cambió** (como Firebase): si
  no, `.info/connected` se disparaba con cada escritura y la presencia se re-anunciaba en ciclo.
- **El administrador raíz no debe tener nodo en `roles/`**: `asegurarRol` le creaba uno de
  "invitado" y aparecía como pendiente de autorización.
- **Un toast de una acción anterior tapaba el formulario recién abierto** (z-index 200 del
  toast contra 100 del modal; visto en capturas de la Fase 2.1 cubriendo el campo "Notas").
  Ahora los toasts van en z-index 90. La prueba `flujo-compra.js` lo verifica.
- **`scroll-behavior: smooth` en `html` hace asíncrono cualquier `scrollTo`**: en pruebas,
  medir después de un scroll requiere `behavior: "instant"` o esperar.
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

- SDK de Firebase: la app usa `10.14.1` (la última de la rama 10); la más reciente en npm al
  2026-10-06 es `12.19.0` (verificado con `npm view firebase version`). Actualizar es un
  cambio aparte: probarlo con `pruebas/e2e` y en el sitio real.
- Multiusuario probado con el emulador (reglas) y con Firebase simulado (UI); **falta la prueba
  real con dos cuentas de Google en dos teléfonos** (latencia, presencia al bloquear la
  pantalla del iPhone, avisos). La presencia se cachea en `localStorage` como todo `escuchar`:
  sin conexión puede mostrar a alguien "en la lista" de la última vez.
- Login con Google no se probó en iPhone real (Safari ni PWA instalada). Tampoco se pudo
  completar un login real en esta sesión: Authentication → Google todavía no está
  habilitado en la consola, y la `apiKey` actual devuelve `auth/api-key-not-valid` (ver
  `PROXIMA_SESION.md` — probablemente restricciones de la API key en Google Cloud Console,
  no un typo: el formato y los demás campos del config son correctos).
- El paso `deploy --only database` del workflow de GitHub Actions no se ejecutó nunca
  (requiere el proyecto de Firebase y los secretos ya configurados en GitHub).
- Las pruebas de `pruebas/e2e` usan Firebase simulado: no cubren login real, latencia ni
  modo sin conexión. La sesión en la nube **no puede abrir `pilo-compras.web.app`** (la política
  de red del entorno lo bloquea): lo desplegado lo verifica el usuario.
- Los íconos de `icons/*.png` siguen siendo un placeholder (carrito simple sobre
  `--color-primario`, `scripts/generar-iconos.py`), no un diseño final.
- Bricolage Grotesque/Figtree vienen de Google Fonts: sin red la primera vez, se ve la
  fuente del sistema (no se cachean en el SW porque son de otro origen).
