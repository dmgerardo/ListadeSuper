# Próxima sesión

> Si eres una sesión nueva de Claude Code (incluida una corriendo en la nube): lee primero
> `AGENTS.md` completo (invariantes técnicas), y este archivo completo antes de tocar
> código. `PROYECTO_INICIAL.md` es el documento de producto original — ya no es la fuente
> de verdad técnica (esa es `AGENTS.md`), pero sigue teniendo el detalle completo de cada
> fase y el modelo de datos.

## Estado actual: multiusuario (roles, invitaciones, coordinación) — 2026-10-06

- Roles de la app (admin raíz `dmgerardo@gmail.com` + admins por rol, participantes,
  invitados, activo/desactivado), pantalla `usuarios.html`, invitaciones por liga (1 uso, 7
  días) con `unirse.html`, editores = todo menos eliminar, eliminar lista (dueño), registro
  temporal de actividad (24 h) con avisos "Ana marcó Leche", presencia "en la lista ahora",
  "por Ana", (+/−) por transacción. Ver `AGENTS.md` §2/§3/§6.
- Probado: reglas 31/31 en el emulador (+2 mutaciones detectadas), lógica 16/16, contraste
  96/96, e2e compra y e2e multiusuario (390/320/1280). **Falta: prueba real con dos cuentas.**
- Decisiones del usuario: admin raíz por correo + poder nombrar más admins; un invitado sin
  autorizar SÍ puede unirse y editar listas a las que lo invitan; editores "todo menos
  eliminar la lista"; avisos dentro de la app (no push) + registro temporal de quién marcó.

## Estado anterior: v16 en `main` (2026-10-06)

- v16: login en la app anclada del iPhone — `authDomain` = dominio de la app y CSP solo en
  documentos (ver `AGENTS.md` §6). El usuario agregó (captura, 2026-10-06)
  `https://pilo-compras.web.app/__/auth/handler` a los URIs de redirección del cliente OAuth
  web y `https://pilo-compras.web.app` a los orígenes. **Falta que lo confirme en el iPhone.**
- v15: "Por comprar"/"Toda la lista" pasaron a la barra inferior (reemplazan la pestaña
  "Lista"); Favoritos/Plantillas/Miembros salieron de la barra hasta que existan (no cabían).
  Índice de pasillos arriba y fijo, con el pasillo actual resaltado. Ver `AGENTS.md` §2 y §3b.

- v13: selector de apariencia Sistema/Claro/Oscuro en la hoja "Mi cuenta".
- v14: orden alfabético dentro de cada pasillo y editor rápido de unidades y precios
  ("Unidades y precios" en "Toda la lista"). Detalle en `AGENTS.md` §3b.

## Fase 2.1 (rediseño "Mercado fresco") — EN `main` (v11, 2026-10-06)

Solo presentación sobre la Fase 2 (sin cambios de lógica, datos ni reglas). Ver `AGENTS.md`
§3b (tokens, tipografía, íconos y colores por pasillo) y §3c (**lenguaje visual obligatorio
para las fases siguientes**). Probado en local: contraste (76 parejas, `pruebas/contraste.js`),
lógica 11/11, reglas 15/15, flujo completo con CSP real en 390/320/1280 px × claro/oscuro con
las fuentes reales. **Falta que el usuario lo vea en el sitio real** (iPhone y escritorio).

## Estado anterior: Fase 2 (artículos) — CONSTRUIDA Y PROBADA EN LOCAL (2026-10-06)

- Sitio: **https://pilo-compras.web.app** (proyecto Firebase `pilo-compras`, RTDB `us-central1`).
  Deploy automático en cada push a `main` (Hosting + reglas).
- Fase 0 y 1 cerradas (login con Google probado por el usuario en el sitio real).
- Fase 2 en `main` (v10). Probado: lógica en Node (10 pruebas), reglas con el Emulador de
  Firebase (15 casos), flujo completo con Playwright + Firebase simulado + CSP real en 390 px
  (claro/oscuro), 320 px y 1280 px. **Falta que el usuario lo pruebe en el sitio real** (esta
  sesión en la nube no puede abrir `pilo-compras.web.app`: la política de red lo bloquea).

## Cómo usa la app el usuario (define el diseño de la Fase 2)

Viene de una nota de Notas del iPhone (copia en `pruebas/nota-ejemplo.txt`, 171 artículos en
14 secciones). La lista es fija y se reutiliza: **marcado = ya lo tengo / no hace falta;
desmarcado = por comprar**. En casa desmarca lo que falta ("Toda la lista"); en la tienda
marca lo que va tomando ("Por comprar", la vista por defecto; lo marcado desaparece con
Deshacer). Por eso no hay sección "En el carrito".

## Qué incluye la Fase 2

- `js/logica-articulos.js` (puro) + `js/vista-articulos.js` (pantalla) + reglas de
  `articulos` validadas campo por campo (`database.rules.json`).
- Campo rápido: busca mientras escribes (en toda la lista); Enter/"+" agrega o, si ya existe,
  lo pone por comprar (no duplica); entiende "2 kg tomate"; vacío + "+" abre el formulario.
- Formulario agregar/editar (nombre, cantidad, unidad, pasillo, precio unitario con coma
  decimal, notas), eliminar con Deshacer, Guardar/Descartar al cerrar con cambios.
- Importar desde una nota: vista previa (cuántos por pasillo, renglones ignorados), UNA
  escritura multi-ruta, todo entra marcado, reimportar no duplica. Deshacer.
- "Marcar todo como comprado" (una escritura) con Deshacer. Total estimado de lo pendiente
  con precio, y cuántos pendientes no tienen precio.
- Barra inferior en `lista.html` sin "+" aparte (no cabía en 375 px); un solo toast a la vez.

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

- **Probar la Fase 2 en el sitio real** (el usuario): importar su nota, desmarcar en casa,
  marcar en la tienda, en iPhone (Safari y PWA instalada) y en Chrome de escritorio.
- Reglas de **invitaciones/miembros** sin casos en el emulador (llegan con la Fase 4).
- **Login en iPhone real** (Safari y PWA instalada): no probado.
- **SDK de Firebase**: la app usa `10.14.1`; la más reciente es `12.19.0` (npm, 2026-10-06).
  Actualizar es un cambio aparte, con pruebas.
- **Mis listas como en la maqueta (B3)**: tarjeta héroe de la lista más reciente con "N por
  comprar", estimado y avatares + cuadrícula de 2 columnas. En la 2.1 solo se aplicaron tokens,
  encabezado ("Hola, …") y tarjetas con baldosa. Necesita leer los artículos de cada lista.
- Reordenar pasillos por lista (`info.ordenCategorias` ya existe, falta la pantalla).
- Íconos de `icons/*.png`: placeholder.

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

- Fase 2 (2026-10-06): categorías = las 14 de su nota, en su orden ("Especiales" es el
  cajón, sin "Otros"); unidades = pieza, kg, g, l, ml, paquete, caja, bolsa, lata, botella,
  docena; importar entra todo marcado; vista por defecto "Por comprar" (se recuerda por
  dispositivo).

## Siguiente paso sugerido

1. Que el usuario pruebe la Fase 2 + 2.1 en el sitio real y reporte.
2. Fase 3 (ver `PROYECTO_INICIAL.md` §10): favoritos/frecuentes + autocompletado + plantillas.
   Ojo: con el modelo de uso del usuario (la lista ES su catálogo fijo) puede que "favoritos"
   y "plantillas" pesen menos de lo que pensaba el documento original — **preguntarle antes
   de construir** qué le falta realmente.
