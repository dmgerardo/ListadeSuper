# Próxima sesión

## Qué se hizo (Fase 0 + Fase 1, 2026-10-05)

- Esqueleto completo: `css/estilos.css` (tokens + componentes), `js/tema.js`,
  `js/iconos.js`, `js/render-utils.js`, `js/db.js`, `js/catalogo-categorias.js`,
  `manifest.json`, `sw.js`, íconos placeholder generados por script, hook de versión
  (`.githooks/pre-commit` + `scripts/bump-version.py`), workflow de deploy
  (`.github/workflows/firebase-hosting-merge.yml`), docs (`AGENTS.md`, `CLAUDE.md`,
  `README.md`, `SEGURIDAD.md`, `historial.html`, este archivo).
- Login con Google (`js/auth.js`: popup con fallback a redirect) + `usuarios/{uid}`.
- "Mis listas" (`js/vista-listas.js` + `index.html`): crear, abrir, renombrar.
- `lista.html`: pantalla mínima que confirma que la lista existe y que el usuario tiene
  acceso (lee `listas/{id}/info`); los artículos llegan en la Fase 2.
- `database.rules.json`: copiadas tal cual de `PROYECTO_INICIAL.md` §5.
- Repo conectado a `dmgerardo/ListadeSuper` (ya existía en GitHub).

## Qué falta / qué NO se probó (decirlo explícito, no inventar que ya se hizo)

- **Firebase**: el usuario confirmó que el proyecto ya existe pero **todavía no configuró
  Authentication → Google**. `js/firebase-config.js` y `.firebaserc` quedaron con
  placeholders `REEMPLAZAR-*` — hay que pedirle el Project ID real y el objeto
  `firebaseConfig` (apiKey, authDomain, databaseURL, storageBucket, messagingSenderId,
  appId) y pegarlos. También falta el secreto de GitHub
  `FIREBASE_SERVICE_ACCOUNT_LISTADESUPER` para que el workflow de deploy funcione (§8 del
  documento base).
- El entorno de esta sesión **no tenía Node.js, npm ni Firebase CLI instalados** → no se
  pudo: correr `node --check` sobre los `.js`, correr pruebas de lógica pura, usar el
  Emulador de Firebase para probar `database.rules.json`, ni correr Playwright. Antes de
  dar la Fase 1 por cerrada, instalar esas herramientas y correr esas pruebas (ver §6 y §10
  del documento base).
- **Login en iPhone real** (Safari y PWA instalada): no probado, requiere un dispositivo
  físico y la app ya desplegada con un dominio autorizado.
- Verificar la versión del SDK compat de Firebase (`10.14.1`) contra la más reciente
  disponible — no se verificó en línea esta sesión.
- Verificar en el navegador, ya desplegado, que la CSP de `firebase.json` no bloquee nada
  del flujo de login con Google (consola sin violaciones).
- Deploy automático: falta confirmar que el workflow corre en verde en el primer push a
  `main` (requiere los secretos de Firebase ya mencionados).

## Decisiones ya tomadas con el usuario (no volver a preguntar)

- Nombre visible de la app: **ListadeCompras** (el repo de GitHub sigue llamándose
  `ListadeSuper`, no se renombra).
- Región de Realtime Database: `us-central1`.
- Favoritos y plantillas: compartidos **por lista**, no personales.
- Moneda inicial: MXN.
- Invitaciones: caducan en 7 días, un código se considera de un solo uso.

## Decisiones abiertas para la Fase 2 (preguntar cuando toque)

- Lista de categorías/pasillos por defecto y su orden: se puso un placeholder razonable en
  `js/catalogo-categorias.js` (frutas y verduras, panadería, lácteos, carnes y pescados,
  abarrotes, enlatados, bebidas, limpieza, cuidado personal, bebés, mascotas, farmacia,
  otros) — confirmar con el usuario o ajustar antes de construir la vista de artículos.
- Unidades permitidas: placeholder en el mismo archivo (`UNIDADES_DEFECTO`).
