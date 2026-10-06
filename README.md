# ListadeCompras

Listas de compra compartidas, en tiempo real, para supermercado, farmacia, ferretería o lo
que necesites. Entra con tu cuenta de Google, crea una lista e invita a quien quieras —
todos ven y editan al mismo tiempo, desde el celular en la tienda o la computadora en casa.

## Qué puedes hacer hoy (v1)

- Iniciar sesión con tu cuenta de Google.
- Crear listas de compra y renombrarlas.
- Ver tus listas desde cualquier dispositivo con la misma cuenta.

Lo que viene en las próximas versiones: agregar artículos con cantidad/precio/categoría,
favoritos, plantillas de compra e invitar a otras personas a tus listas. Puedes ver el
detalle en [historial.html](historial.html) una vez desplegada la app.

## Para desarrolladores

La guía técnica completa está en [AGENTS.md](AGENTS.md). Resumen rápido:

- Sin build: HTML + CSS + JS plano, Firebase (Auth Google + Realtime Database + Hosting).
- Clona el repo y activa el hook de versión una vez: `git config core.hooksPath .githooks`.
- No hay servidor de desarrollo: abre los `.html` directamente o sírvelos con cualquier
  servidor estático. El login con Google y la base de datos requieren un dominio
  autorizado en Firebase (ver §8 de `PROYECTO_INICIAL.md`); `localhost` ya está permitido
  para pruebas.
- Documento base del proyecto (decisiones de producto): `PROYECTO_INICIAL.md`.
- Seguridad: [SEGURIDAD.md](SEGURIDAD.md).

## Licencia

MIT — ver [LICENSE](LICENSE).
