# Próxima sesión

> Si eres una sesión nueva de Claude Code (incluida una corriendo en la nube): lee primero
> `AGENTS.md` completo (invariantes técnicas), y este archivo completo antes de tocar
> código. `PROYECTO_INICIAL.md` es el documento de producto original — ya no es la fuente
> de verdad técnica (esa es `AGENTS.md`), pero sigue teniendo el detalle completo de cada
> fase y el modelo de datos.

## Estado actual: v21 en `main` (2026-10-06); verificar el deploy en GitHub Actions

- Sitio: **https://pilo-compras.web.app** (proyecto Firebase `pilo-compras`, RTDB `us-central1`).
  Cada push a `main` despliega Hosting + reglas (GitHub Actions; la corrida 17, la de v19,
  terminó en `success`).
- Rama de trabajo: `claude/youthful-dijkstra-fo1zpw`. Flujo acordado con el usuario: commit,
  push a la rama y push directo a `main` (`git push origin HEAD:main`), **sin PR**.
- Pruebas al cierre de v19, todas en verde: lógica 17/17 (`node --test pruebas/*.test.js`),
  reglas 34/34 en el emulador (`cd pruebas/reglas && npm test`), contraste 96 parejas sin
  fallas (`node pruebas/contraste.js`), E2E `flujo-compra.js` y `multiusuario.js` a
  390/320/1280 px en claro y oscuro. Cómo correrlas: `pruebas/README.md`.

## Qué se hizo, por versión (más reciente primero)

- **v22 — fotos de artículos** (`js/fotos.js`, `storage.rules`). **Requiere acción del usuario:**
  1. Consola de Firebase → **Storage** → "Comenzar" (modo producción; misma región que la base si
     la pide). El bucket que ya está en `js/firebase-config.js` es `pilo-compras.firebasestorage.app`.
  2. Dar a la cuenta de servicio del deploy el rol **Administrador de Firebase Rules / Storage**
     (IAM) para que el paso "Publicar reglas de Storage" del workflow funcione; mientras tanto ese
     paso falla sin detener el deploy. Alternativa: pegar `storage.rules` a mano en la consola.
  3. Sin Storage activado, "Elegir archivo" y "Pegar" muestran un error al subir; "Desde una URL"
     funciona igual (no usa Storage).
  Probado: pruebas de navegador con Storage SIMULADO (`pruebas/e2e/fotos.js`), reglas de la base
  (38). **NO probado:** Storage real, ni `storage.rules` (no hay emulador de Storage en las
  pruebas), ni el portapapeles en un iPhone real.
- **v21 — pasillos en orden alfabético** (lista, índice, hoja Pasillos y desplegables). El orden manual
  (`info.ordenCategorias`) quedó sin uso.
- **v20 — pasillos, agregar y favoritos** (pedidos del usuario; ver `AGENTS.md` §2):
  - Hoja "Pasillos" (Toda la lista): renombrar, crear y eliminar vacíos con Deshacer; datos en
    `info.categorias` (regla nueva con 3 casos en el emulador). Se copian al duplicar.
  - Importar reconoce los pasillos de la lista y toma el tabulador como viñeta.
  - Agregar un artículo nuevo abre el formulario sin pasillo preelegido; "+" por pasillo.
  - Formulario reordenado, sin cantidad. Estrella de favorito + filtro.
  - Pruebas: lógica 29, reglas 37, `pruebas/e2e/pasillos.js` nuevo, `flujo-compra` y
    `multiusuario` actualizados (agregar ahora abre formulario). **Sin probar en el sitio real.**
  Flujo acordado: al terminar cada cambio, commit + push a la rama + push a `main` (sin PR).

- **v19 — duplicar una lista.** En "Nueva lista" → "Copiar artículos de" (las listas del
  usuario) y "Los artículos copiados entran": todos marcados (por defecto, igual que al
  importar) o igual que en la original. El nombre sugerido es "X (copia)". Se copian nombre,
  cantidad, unidad, pasillo, precio, notas y el orden de pasillos. No se copian miembros,
  actividad ni autoría (`copiarArticulos` en `js/logica-articulos.js`). Lista + artículos van
  en UNA escritura multi-ruta (`_escribirListaNueva` en `js/vista-listas.js`). Hay una rama
  nueva en las reglas de `articulos` que solo lo permite cuando creas tu propia lista en esa
  misma escritura (3 casos en el emulador).
- **v18 —**
  - Sección "Marcaste hace poco" con Regresar en Por comprar (lo marcado por ti en los
    últimos 15 min, tomado del registro de actividad).
  - Un formulario con cambios ya no se cierra al tocar fuera ni con Escape: pregunta Guardar /
    Descartar / Seguir editando. Hay pila de modales.
  - (X) para limpiar la búsqueda.
- **v17 — multiusuario.**
  - Roles de la app: admin raíz `dmgerardo@gmail.com` + admins por rol, participante,
    invitado, activo/desactivado. Pantalla `usuarios.html`.
  - Invitaciones por liga (1 uso, 7 días) con `unirse.html`.
  - Los editores pueden todo menos eliminar la lista; eliminar la lista es solo del dueño.
  - Registro temporal de actividad (24 h) con avisos dentro de la app ("Ana marcó Leche"),
    presencia "en la lista ahora", "por Ana", y (+/−) por transacción.
  - Ver `AGENTS.md` §2/§3/§6.
- **v16 — login en la app anclada del iPhone.** `authDomain` = dominio de la app y CSP solo
  en documentos. El usuario agregó `https://pilo-compras.web.app/__/auth/handler` al cliente
  OAuth y **confirmó que ya funciona**.
- **v15 —**
  - "Por comprar" y "Toda la lista" pasaron a la barra inferior.
  - El índice de pasillos va arriba, fijo, con el pasillo actual resaltado.
- **v14 —**
  - Orden alfabético dentro de cada pasillo.
  - Editor rápido "Unidades y precios" (en "Toda la lista").
- **v13 —** selector de apariencia Sistema/Claro/Oscuro en "Mi cuenta".
- **v11 —** rediseño "Mercado fresco" (Fase 2.1). Ver `AGENTS.md` §3b (tokens, íconos,
  colores por pasillo) y §3c (**lenguaje visual obligatorio para las fases siguientes**).
- **v10 —** Fase 2 (artículos):
  - Campo rápido que busca y agrega ("2 kg tomate").
  - Formulario de artículo.
  - Importar desde una nota (todo entra marcado, reimportar no duplica).
  - Marcar todo, con Deshacer.
  - Total estimado.

## Cómo usa la app el usuario (define el diseño)

Viene de una nota de Notas del iPhone (copia en `pruebas/nota-ejemplo.txt`, 171 artículos en
14 secciones). La lista es fija y se reutiliza:

- **Marcado = ya lo tengo / no hace falta; desmarcado = por comprar.**
- En casa desmarca lo que falta ("Toda la lista").
- En la tienda marca lo que va tomando ("Por comprar", la vista por defecto). Lo marcado
  desaparece de la vista y se puede deshacer.

Lo marcado se ve en color suave, **no tachado**. No hay sección "En el carrito".

## Pendiente de probar (el usuario, en el sitio real — esta sesión no puede abrirlo)

La política de red del entorno en la nube bloquea `pilo-compras.web.app`. Lo desplegado lo
verifica el usuario.

1. **Duplicar (v19):** recargar hasta ver v19 → Mis listas → (+) → elegir una lista en
   "Copiar artículos de" → revisar que llegan los artículos con precio, unidad y pasillo, y
   que se respeta el modo marcado / igual que la original.
2. **Multiusuario real con dos cuentas de Google en dos teléfonos.** Revisar:
   - la invitación;
   - los avisos "X marcó…" y su latencia;
   - "Marcaste hace poco";
   - la presencia al bloquear la pantalla del iPhone.

   Las pruebas actuales usan el emulador (reglas) y Firebase simulado (UI).
3. La pantalla de usuarios (`usuarios.html`): autorizar a un invitado para que pueda crear
   listas, nombrar otro admin y desactivar a alguien.

## Pendientes conocidos (solo si el usuario los pide)

- **Fase 3 (favoritos/frecuentes/plantillas, `PROYECTO_INICIAL.md` §10): PREGUNTARLE ANTES
  de construir** qué necesita de verdad. Con su modelo de uso (la lista ES su catálogo fijo),
  y ahora que existe duplicar lista, puede que pesen poco. Ojo: Favoritos y Plantillas
  salieron de la barra en v15 porque no cabían; si regresan, hay que decidir dónde van.
- **Transferir la propiedad** de una lista: no existe (solo el dueño la elimina).
- **SDK de Firebase:** la app usa `10.14.1`; la más reciente en npm es `12.19.0`
  (2026-10-06). Actualizar es un cambio aparte, con pruebas.
- **"Mis listas" como en la maqueta (B3):** tarjeta héroe de la lista más reciente + cuadrícula
  de 2 columnas. Necesita leer los artículos de cada lista.
- **Reordenar pasillos por lista:** `info.ordenCategorias` ya existe y se copia al duplicar;
  falta la pantalla.
- **Presencia sin conexión:** se cachea en `localStorage`, así que sin conexión puede mostrar
  a alguien "en la lista" de la última vez.
- **Íconos de `icons/*.png`:** placeholder.

## Decisiones ya tomadas con el usuario (no volver a preguntar)

- **Nombre y proyecto:**
  - Nombre visible: **ListadeCompras**. El repo sigue siendo `ListadeSuper`.
  - Firebase `pilo-compras`, RTDB `us-central1`.
- **Categorías:** las 14 de su nota, en su orden: especiales, frutas_temporada, frutas,
  verduras, carniceria, salchichoneria, refris, condimentos_aceites, abarrotes,
  botanas_semillas, panaderia, limpieza, personal, farmacia. "Especiales" es el cajón; no hay
  "Otros".
- **Unidades:** pieza, kg, g, l, ml, paquete, caja, bolsa, lata, botella, docena.
- **Importar y vistas:**
  - Al importar, todo entra marcado.
  - La vista por defecto es "Por comprar" y se recuerda por dispositivo.
- **Duplicar:** por defecto todo entra marcado; se puede elegir "igual que en la original".
- **Favoritos/plantillas y moneda:**
  - Favoritos y plantillas son **por lista**.
  - Moneda MXN.
- **Invitaciones:** caducan en 7 días y son de un solo uso.
- **Roles:**
  - Admin raíz `dmgerardo@gmail.com`, con la posibilidad de nombrar más admins.
  - Un invitado sin autorizar SÍ puede unirse y editar las listas a las que lo invitan, pero
    no crear listas.
  - Los editores pueden todo menos eliminar la lista (pueden quitar a miembros que no sean el
    dueño).
- **Avisos:** dentro de la app, no push. Hay un registro temporal (24 h) de quién marcó qué.
- **Forma de trabajo:**
  - UI, comentarios, commits y docs en español.
  - Las decisiones de producto se le preguntan con opciones.
  - Respuestas concretas y verificables.

## Lecciones (detalle en `AGENTS.md` §6)

- **Infraestructura de pruebas:**
  - La CSP y las cabeceras solo existen en Firebase Hosting. `pruebas/e2e/servidor.py` las
    reproduce desde `firebase.json`; úsalo siempre en E2E.
  - `firebase emulators:exec` falla detrás del proxy. Usa `pruebas/reglas/correr.js`, que
    lanza el jar directo.
  - No uses `pkill -f`: mata la propia shell.
- **Reglas de la base:**
  - Se GENERAN con `scripts/generar-reglas.py`; nunca edites `database.rules.json` a mano.
  - En escrituras multi-ruta, `root`/`data` son el estado VIEJO.
  - `.validate` no corre al borrar.
- **Versión y Service Worker:**
  - El hook `.githooks/pre-commit` sube `APP_VERSION`; requiere `git config core.hooksPath
    .githooks`.
  - El Service Worker cachea por versión.
