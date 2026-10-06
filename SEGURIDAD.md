# Seguridad — ListadeCompras

## Modelo de identidad

Autenticación exclusiva con Google vía Firebase Authentication. Sin usuarios anónimos, sin
contraseñas propias, sin hashes en la base de datos. `auth.uid` (verificado por el
servidor de Firebase) es la única identidad; `database.rules.json` se ancla a él en cada
nodo. Esto es intencional: en el proyecto hermano (`PlaneadorDeViajes`) la identidad era
una convención del cliente y las reglas solo podían exigir `auth != null`, lo que fue su
deuda de seguridad principal. Aquí no existe ese problema desde el día 1.

## Reglas de la base de datos

`database.rules.json`: `.read`/`.write` cerrados en la raíz; cada nodo abre acceso
explícitamente y queda anclado a `auth.uid` o a la membresía de la lista
(`listas/{id}/miembros/{uid}`). **Pendiente**: probarlas con el Emulador de Firebase o el
Rules Playground antes de publicar en producción (alta de lista, invitación, unirse,
miembro editando, no-miembro intentando leer/escribir, dueño quitando miembro) — no se hizo
en la sesión que creó este archivo porque el entorno no tenía Node.js/Firebase CLI
instalados. No publicar cambios a las reglas sin esa prueba.

## Cabeceras HTTP (`firebase.json`)

CSP **aplicada** (no Report-Only): permite scripts propios más
`https://apis.google.com` y `https://www.gstatic.com` (SDK de Firebase y login de Google),
estilos de Google Fonts, conexiones a `*.googleapis.com` y `*.firebaseio.com` (incluyendo
WebSocket), e `iframe` solo hacia `*.firebaseapp.com` y `accounts.google.com` (necesario
para el flujo de `signInWithRedirect`). Además: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
`Permissions-Policy` restrictiva, `Strict-Transport-Security`, y HTML/JSON con
`Cache-Control: no-cache`. **Pendiente verificar en el navegador** (consola sin violaciones
de CSP) una vez desplegado — no se pudo probar en esta sesión sin un despliegue real.

Por esto mismo, ningún `<script>` puede ir inline en los archivos HTML: todo vive en
archivos `.js` propios.

## Secretos

`js/firebase-config.js` es configuración pública (la protección real son las reglas, no
este archivo). La cuenta de servicio de Firebase vive únicamente en el secreto de GitHub
`FIREBASE_SERVICE_ACCOUNT_LISTADESUPER`, nunca en el repo.

## Datos que NO se guardan

Es una lista de compras: no se guardan tarjetas, direcciones ni otros datos sensibles.
Los códigos de invitación son aleatorios de ≥128 bits (`crypto.getRandomValues`,
base64url) con caducidad — se implementan en la Fase 4, todavía no existen en el código.

## Pendientes de esta área (ver también AGENTS.md §7)

- Probar las reglas con el Emulador de Firebase.
- Verificar la CSP en un despliegue real (consola del navegador sin violaciones).
- Probar el login con Google en iPhone real (Safari y PWA instalada).

## Fotos de artículos (Firebase Storage, v22)

- Las reglas de Storage (`storage.rules`) **no pueden consultar Realtime Database**, así que no
  verifican que quien sube o lee una foto sea miembro de esa lista. Exigen sesión, que el nombre
  del archivo empiece con el uid de quien lo sube, que sea JPEG y que pese menos de 2 MB; borrar
  solo lo puede quien la subió. Cualquier cuenta con sesión podría subir imágenes (≤ 2 MB) bajo
  `listas/*/fotos/`. Mitigación futura: Firestore con membresía, o un backend que firme las subidas.
- Las URL de descarga de Storage llevan un token largo e impredecible; quien tenga la URL ve la foto.
- "Desde una URL" admite imágenes de cualquier sitio https: eso obliga a `img-src … https:` en la CSP
  (el navegador pide la imagen a ese sitio, que ve la IP del usuario). Los scripts siguen cerrados.
- No se suben metadatos EXIF: la foto se redibuja en un canvas y se guarda como JPEG nuevo.
