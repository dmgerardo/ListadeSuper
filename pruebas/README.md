# Pruebas

Tres niveles. Correr los tres antes de dar algo por terminado (ver `AGENTS.md` §2).

| Qué | Cómo | Necesita |
|---|---|---|
| Sintaxis de todo el JS | `for f in js/*.js sw.js; do node --check $f; done` | Node |
| Lógica pura (`js/logica-articulos.js`, catálogo) | `node --test pruebas/*.test.js` | Node 18+ |
| Reglas de `database.rules.json` | `cd pruebas/reglas && npm install && npm test` | Node + Java 11+ |
| Flujo completo en el navegador | `python3 pruebas/e2e/servidor.py &` y `node pruebas/e2e/flujo-compra.js` | Python 3 + Playwright |
| Contraste WCAG de los tokens | `node pruebas/contraste.js` (escribe `contraste-resultados.md`) | Node |

## Reglas (`pruebas/reglas/`)

`npm test` arranca el `.jar` del Emulador de Realtime Database (lo descarga `firebase-tools`
la primera vez en `~/.cache/firebase/emulators/`) y corre `reglas.test.js` contra él con
`@firebase/rules-unit-testing`. No usa `firebase emulators:exec` a propósito: en la sesión en
la nube el CLI manda su llamada local para cargar las reglas por el proxy de salida y recibe
"request blocked". Puerto por defecto 9000 (`PUERTO_EMULADOR=9011 npm test` para cambiarlo).

## Navegador (`pruebas/e2e/`)

- `servidor.py` sirve el repo con **las mismas cabeceras de `firebase.json`** (CSP incluida),
  para que se note lo que solo falla en Firebase Hosting.
- `mock-firebase.js` reemplaza al SDK de Firebase: Auth con un usuario fijo y una Realtime
  Database en memoria (persiste en `sessionStorage` entre páginas). **No aplica las reglas**
  (eso lo cubren las pruebas del emulador).
- `flujo-compra.js` recorre la Fase 2 completa en 390, 320 y 1280 px, cada uno en claro y oscuro,
  con las fuentes de Google cargadas de verdad (una violación de CSP al pedirlas falla):
  importar `nota-ejemplo.txt` (la lista real del usuario), desmarcar, campo rápido, editar,
  totales, marcar todo, eliminar con Deshacer, reimportar sin duplicar, sin errores de página
  ni violaciones de CSP, sin controles de la barra traslapados; además (Fase 2.1) índice de
  pasillos que salta a la sección, baldosas con ícono, marcado sin tachar, fuentes cargadas,
  etiqueta de pestaña activa solo desde 375 px y ningún toast encima de un formulario; y
  (v12) el contador (−)/(+) de "Toda la lista": paso por unidad, mínimo, no toca "marcado";
  (v13) el selector de apariencia; (v14) orden alfabético y el editor de unidades y precios
  (coma decimal, Enter al siguiente, foco estable mientras llegan cambios, inválido/vacío). Capturas en
  `pruebas/e2e/capturas/` (o `CAPTURAS=...`), ignoradas por git.

Nada de `pruebas/` se despliega (está en `hosting.ignore` de `firebase.json`).
