# Próxima sesión

> Si eres una sesión nueva de Claude Code (incluida una corriendo en la nube): lee primero
> `AGENTS.md` completo (invariantes técnicas), y este archivo completo antes de tocar
> código. `PROYECTO_INICIAL.md` es el documento de producto original — ya no es la fuente
> de verdad técnica (esa es `AGENTS.md`), pero sigue teniendo el detalle completo de cada
> fase y el modelo de datos.

## Estado actual: Fase 0 y Fase 1 — CERRADAS Y VERIFICADAS (2026-10-06)

- Sitio desplegado y funcionando: **https://pilo-compras.web.app**
- Proyecto de Firebase: `pilo-compras` (Authentication → Google habilitado, Realtime
  Database en `us-central1`, reglas publicadas).
- **Login con Google probado por el usuario en el sitio real — funciona.** (No se probó
  específicamente en iPhone/Safari/PWA instalada; si alguien lo prueba ahí, documentarlo
  aquí.)
- Deploy automático (`.github/workflows/firebase-hosting-merge.yml`) corriendo en verde en
  cada push a `main` (Hosting + reglas de Realtime Database).
- Secreto de GitHub `FIREBASE_SERVICE_ACCOUNT_LISTADESUPER` configurado.
- `js/firebase-config.js` tiene el `firebaseConfig` real completo.

## Qué incluye el código ahora mismo

- Esqueleto (Fase 0): `css/estilos.css`, `js/tema.js`, `js/iconos.js`,
  `js/render-utils.js`, `js/db.js`, `js/catalogo-categorias.js`, `manifest.json`, `sw.js`,
  íconos placeholder, hook de versión, workflow de deploy.
- Login + perfil (`js/auth.js`) y "Mis listas" (`js/vista-listas.js`): crear, abrir,
  renombrar. Arranque de cada página en `js/pagina-inicio.js` / `js/pagina-lista.js` (no
  inline — ver bitácora de errores en AGENTS.md §6, importante leerla).
- `lista.html`: solo confirma que la lista existe y que el usuario tiene acceso; **los
  artículos todavía no existen** — eso es la Fase 2.
- `database.rules.json`: reglas de `PROYECTO_INICIAL.md` §5, ya publicadas y en uso real,
  pero **nunca probadas con el Emulador de Firebase** (ver pendientes abajo).

## Bugs reales encontrados y corregidos esta sesión (contexto útil, no repetir)

Ver el detalle completo en `AGENTS.md` §6 ("Errores a evitar"). Resumen:

1. CSP bloqueaba `<script>` inline → pantalla en blanco en producción. No se detectaba en
   local porque ahí no hay cabeceras CSP (solo las manda Firebase Hosting).
2. CSP bloqueaba `style="..."` inline también (`style-src`).
3. La regla de `Cache-Control: no-cache` no cubría la ruta raíz `/` (solo `*.html`),
   causando que quedara cacheada una versión vieja del HTML en algunos navegadores.

**Lección para la próxima vez que se toque algo visual o de arranque**: probar siempre
contra el sitio ya desplegado (`https://pilo-compras.web.app`), no solo con un servidor
estático local — la CSP y las cabeceras de caché solo existen en el deploy real.

## Pendiente real (no inventar que ya se hizo)

- **`node --check`**: ya corre (Node 22 disponible en la sesión en la nube) y pasa. Pruebas
  de lógica pura en Node: todavía no existen.
- **`database.rules.json` nunca se probó con el Emulador de Firebase ni el Rules
  Playground** — las reglas están en producción protegiendo datos reales sin esa
  verificación. Alta prioridad antes de construir Fase 4 (invitaciones/miembros), que es
  donde las reglas son más complejas.
- **Playwright**: corrió solo en local con Firebase simulado (mock) para validar la barra
  inferior; falta una prueba contra el sitio desplegado.
- **Login en iPhone real** (Safari y PWA instalada): no probado.
- Versión del SDK compat de Firebase (`10.14.1`): no se verificó contra la más reciente
  disponible.
- Íconos de `icons/*.png`: son un placeholder generado por script (carrito simple), no un
  diseño final.

## Cambio de UI (2026-10-06): barra inferior flotante

Por petición del usuario, todos los controles globales (ayuda, +, sesión, versión y estado
de conexión) se movieron a una barra inferior flotante tipo Instagram / iOS (ver invariante
en `AGENTS.md` §2). La sesión ahora se cierra desde la foto del usuario → hoja "Mi cuenta"
→ "Cerrar sesión". En `lista.html` las pestañas (Lista, Favoritos, Plantillas, Miembros)
viven en la misma píldora; "Mis listas" quedó solo como enlace arriba del título.

## Decisiones ya tomadas con el usuario (no volver a preguntar)

- Nombre visible de la app: **ListadeCompras** (el repo de GitHub sigue llamándose
  `ListadeSuper`, no se renombra).
- Proyecto de Firebase: `pilo-compras`, región de Realtime Database `us-central1`.
- Favoritos y plantillas: compartidos **por lista**, no personales.
- Moneda inicial: MXN.
- Invitaciones: caducan en 7 días, un código se considera de un solo uso.
- Flujo de trabajo confirmado por el usuario: **cada cambio se commitea, se pushea y se
  mergea a `main` directamente** (sin esperar aprobación de PR) — así se trabajó a partir
  de la Fase 1. Seguir así salvo que el usuario diga lo contrario.

## Decisiones abiertas para la Fase 2 (preguntar cuando toque)

- Lista de categorías/pasillos por defecto y su orden: hay un placeholder razonable en
  `js/catalogo-categorias.js` (frutas y verduras, panadería, lácteos, carnes y pescados,
  abarrotes, enlatados, bebidas, limpieza, cuidado personal, bebés, mascotas, farmacia,
  otros) — confirmar con el usuario o ajustar antes de construir la vista de artículos.
- Unidades permitidas: placeholder en el mismo archivo (`UNIDADES_DEFECTO`).

## Siguiente paso sugerido

Fase 2 (ver tabla de fases en `PROYECTO_INICIAL.md` §10): artículos — agregar rápido,
cantidad/unidad/categoría/precio, agrupación por pasillo, marcar comprado, quitar, totales,
Deshacer. Construye sobre `lista.html` / `js/pagina-lista.js`, que hoy solo muestra un
mensaje de "próximamente".
