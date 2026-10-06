# Contraste de tokens (WCAG 2.x)

Generado por `node pruebas/contraste.js` a partir de `css/estilos.css`. No editar a mano.
Umbral: **4.5:1** texto normal, **3:1** íconos/componentes. Los fondos translúcidos se
evalúan compuestos sobre la base indicada.

| Modo | Texto | Fondo | Colores | Contraste | Umbral | Resultado | Uso |
|---|---|---|---|---|---|---|---|
| claro | `--color-texto` | `--color-fondo` | #15211A / #F3F5F0 | 15.13:1 | 4.5:1 | OK | Texto sobre el fondo de página |
| claro | `--color-texto` | `--color-superficie` | #15211A / #FFFFFF | 16.61:1 | 4.5:1 | OK | Texto en tarjetas, chips y filas |
| claro | `--color-texto-suave` | `--color-fondo` | #56655B / #F3F5F0 | 5.61:1 | 4.5:1 | OK | Subtítulos sobre el fondo |
| claro | `--color-texto-suave` | `--color-superficie` | #56655B / #FFFFFF | 6.16:1 | 4.5:1 | OK | Detalle de artículo y lo marcado (Toda la lista) |
| claro | `--color-texto-suave` | `--color-segmento` | #56655B / #E8ECE6 | 5.16:1 | 4.5:1 | OK | Pestaña inactiva del selector de vista |
| claro | `--color-texto` | `--color-segmento-activo` | #15211A / #FFFFFF | 16.61:1 | 4.5:1 | OK | Opción elegida del selector (vista / apariencia) |
| claro | `--color-texto` | `--color-segmento` | #15211A / #E8ECE6 | 13.90:1 | 4.5:1 | OK | Contador, <code> y botón (−) de cantidad sobre el riel gris |
| claro | `--color-texto-suave` | `--color-superficie` | #56655B / #FFFFFF | 6.16:1 | 4.5:1 | OK | Unidad del contador de cantidad (pza, kg…) en la fila |
| claro | `--color-primario-oscuro` | `--color-fondo` | #0F5C2B / #F3F5F0 | 7.40:1 | 4.5:1 | OK | Enlaces y acciones de texto sobre el fondo |
| claro | `--color-primario-oscuro` | `--color-superficie` | #0F5C2B / #FFFFFF | 8.12:1 | 4.5:1 | OK | Acciones de texto en tarjetas |
| claro | `--color-primario-oscuro` | `--color-tinte-primario` | #0F5C2B / #E4F2E7 | 7.02:1 | 4.5:1 | OK | Pestaña activa de la barra / ícono del estado vacío |
| claro | `--color-texto-sobre-primario` | `--color-primario` | #FFFFFF / #17803D | 5.01:1 | 4.5:1 | OK | Botón primario, tarjeta de resumen, contador verde |
| claro | `--color-texto-sobre-peligro` | `--color-peligro` | #FFFFFF / #B42318 | 6.57:1 | 4.5:1 | OK | Botón 'Cerrar sesión' |
| claro | `--color-peligro` | `--color-fondo` | #B42318 / #F3F5F0 | 5.99:1 | 4.5:1 | OK | Mensaje de error del formulario (fondo del modal) |
| claro | `--color-peligro` | `--color-superficie` | #B42318 / #FFFFFF | 6.57:1 | 3:1 | OK | Ícono de eliminar y punto 'Sin conexión' |
| claro | `--color-toast-texto` | `--color-toast-fondo` | #FFFFFF / #15211A | 16.61:1 | 4.5:1 | OK | Texto del toast |
| claro | `--color-toast-accion` | `--color-toast-fondo` | #86E0A6 / #15211A | 10.46:1 | 4.5:1 | OK | Acción 'Deshacer' del toast |
| claro | `--google-texto` | `--google-fondo` | #1F1F1F / #FFFFFF | 16.48:1 | 4.5:1 | OK | Botón 'Continuar con Google' |
| claro | `--color-texto-suave` | `--color-barra` sobre `--color-fondo` | #56655B / #FDFEFD | 6.08:1 | 4.5:1 | OK | Íconos y 'vN' de la barra (sobre fondo de página) |
| claro | `--color-texto-suave` | `--color-barra` sobre `--color-texto` | #56655B / #DEE0DF | 4.65:1 | 4.5:1 | OK | Íconos y 'vN' de la barra (sobre texto oscuro debajo, peor caso) |
| claro | `--color-primario-oscuro` | `--color-tinte-primario` | #0F5C2B / #E4F2E7 | 7.02:1 | 4.5:1 | OK | Etiqueta de la pestaña activa (tinte opaco sobre la barra) |
| claro | `--color-primario` | `--color-superficie` | #17803D / #FFFFFF | 5.01:1 | 3:1 | OK | Casilla marcada, borde del campo con foco (componente) |
| claro | `--color-primario` | `--color-fondo` | #17803D / #F3F5F0 | 4.56:1 | 3:1 | OK | Botón primario / tarjeta de resumen contra el fondo de página |
| claro | `--color-primario` | `--color-barra` sobre `--color-fondo` | #17803D / #FDFEFD | 4.95:1 | 3:1 | OK | Punto 'En línea' en la barra |
| claro | `--color-texto-suave` | `--color-superficie` | #56655B / #FFFFFF | 6.16:1 | 3:1 | OK | Borde de la casilla sin marcar (componente) |
| claro | `--color-primario-oscuro` | `--color-superficie` | #0F5C2B / #FFFFFF | 8.12:1 | 3:1 | OK | Anillo de foco (componente) |
| claro | `--pasillo-especiales-tinta` | `--pasillo-especiales-tinte` | #8A4B05 / #FDE9CF | 5.74:1 | 4.5:1 | OK | Pasillo especiales: ícono y número sobre su tinte |
| claro | `--pasillo-frutas_temporada-tinta` | `--pasillo-frutas_temporada-tinte` | #A3262A / #FCE4E4 | 6.05:1 | 4.5:1 | OK | Pasillo frutas_temporada: ícono y número sobre su tinte |
| claro | `--pasillo-frutas-tinta` | `--pasillo-frutas-tinte` | #136B35 / #E4F2E7 | 5.70:1 | 4.5:1 | OK | Pasillo frutas: ícono y número sobre su tinte |
| claro | `--pasillo-verduras-tinta` | `--pasillo-verduras-tinte` | #0E6B4E / #E1F2EC | 5.60:1 | 4.5:1 | OK | Pasillo verduras: ícono y número sobre su tinte |
| claro | `--pasillo-carniceria-tinta` | `--pasillo-carniceria-tinte` | #9A3B12 / #F8E3DD | 5.66:1 | 4.5:1 | OK | Pasillo carniceria: ícono y número sobre su tinte |
| claro | `--pasillo-salchichoneria-tinta` | `--pasillo-salchichoneria-tinte` | #A21F5C / #FCE4EF | 6.06:1 | 4.5:1 | OK | Pasillo salchichoneria: ícono y número sobre su tinte |
| claro | `--pasillo-refris-tinta` | `--pasillo-refris-tinte` | #1F5FAD / #E3EEFA | 5.42:1 | 4.5:1 | OK | Pasillo refris: ícono y número sobre su tinte |
| claro | `--pasillo-condimentos_aceites-tinta` | `--pasillo-condimentos_aceites-tinte` | #566413 / #EEF2D8 | 5.68:1 | 4.5:1 | OK | Pasillo condimentos_aceites: ícono y número sobre su tinte |
| claro | `--pasillo-abarrotes-tinta` | `--pasillo-abarrotes-tinte` | #6E4E12 / #F3ECDF | 6.47:1 | 4.5:1 | OK | Pasillo abarrotes: ícono y número sobre su tinte |
| claro | `--pasillo-botanas_semillas-tinta` | `--pasillo-botanas_semillas-tinte` | #765800 / #FBF1C9 | 5.85:1 | 4.5:1 | OK | Pasillo botanas_semillas: ícono y número sobre su tinte |
| claro | `--pasillo-panaderia-tinta` | `--pasillo-panaderia-tinte` | #8F4312 / #FBE7D3 | 5.86:1 | 4.5:1 | OK | Pasillo panaderia: ícono y número sobre su tinte |
| claro | `--pasillo-limpieza-tinta` | `--pasillo-limpieza-tinte` | #5B3FA8 / #EEE8FA | 6.45:1 | 4.5:1 | OK | Pasillo limpieza: ícono y número sobre su tinte |
| claro | `--pasillo-personal-tinta` | `--pasillo-personal-tinte` | #0A6875 / #DDF2F5 | 5.57:1 | 4.5:1 | OK | Pasillo personal: ícono y número sobre su tinte |
| claro | `--pasillo-farmacia-tinta` | `--pasillo-farmacia-tinte` | #3A48A0 / #E7E9F8 | 6.66:1 | 4.5:1 | OK | Pasillo farmacia: ícono y número sobre su tinte |
| oscuro | `--color-texto` | `--color-fondo` | #E8EFE9 / #121815 | 15.38:1 | 4.5:1 | OK | Texto sobre el fondo de página |
| oscuro | `--color-texto` | `--color-superficie` | #E8EFE9 / #1B231E | 13.75:1 | 4.5:1 | OK | Texto en tarjetas, chips y filas |
| oscuro | `--color-texto-suave` | `--color-fondo` | #9DB0A3 / #121815 | 7.86:1 | 4.5:1 | OK | Subtítulos sobre el fondo |
| oscuro | `--color-texto-suave` | `--color-superficie` | #9DB0A3 / #1B231E | 7.02:1 | 4.5:1 | OK | Detalle de artículo y lo marcado (Toda la lista) |
| oscuro | `--color-texto-suave` | `--color-segmento` | #9DB0A3 / #222C26 | 6.30:1 | 4.5:1 | OK | Pestaña inactiva del selector de vista |
| oscuro | `--color-texto` | `--color-segmento-activo` | #E8EFE9 / #34443B | 8.82:1 | 4.5:1 | OK | Opción elegida del selector (vista / apariencia) |
| oscuro | `--color-texto` | `--color-segmento` | #E8EFE9 / #222C26 | 12.33:1 | 4.5:1 | OK | Contador, <code> y botón (−) de cantidad sobre el riel gris |
| oscuro | `--color-texto-suave` | `--color-superficie` | #9DB0A3 / #1B231E | 7.02:1 | 4.5:1 | OK | Unidad del contador de cantidad (pza, kg…) en la fila |
| oscuro | `--color-primario-oscuro` | `--color-fondo` | #7FD9A0 / #121815 | 10.57:1 | 4.5:1 | OK | Enlaces y acciones de texto sobre el fondo |
| oscuro | `--color-primario-oscuro` | `--color-superficie` | #7FD9A0 / #1B231E | 9.45:1 | 4.5:1 | OK | Acciones de texto en tarjetas |
| oscuro | `--color-primario-oscuro` | `--color-tinte-primario` | #7FD9A0 / #1D3B29 | 7.21:1 | 4.5:1 | OK | Pestaña activa de la barra / ícono del estado vacío |
| oscuro | `--color-texto-sobre-primario` | `--color-primario` | #15211A / #3DBE6E | 6.95:1 | 4.5:1 | OK | Botón primario, tarjeta de resumen, contador verde |
| oscuro | `--color-texto-sobre-peligro` | `--color-peligro` | #15211A / #F1907C | 7.13:1 | 4.5:1 | OK | Botón 'Cerrar sesión' |
| oscuro | `--color-peligro` | `--color-fondo` | #F1907C / #121815 | 7.73:1 | 4.5:1 | OK | Mensaje de error del formulario (fondo del modal) |
| oscuro | `--color-peligro` | `--color-superficie` | #F1907C / #1B231E | 6.91:1 | 3:1 | OK | Ícono de eliminar y punto 'Sin conexión' |
| oscuro | `--color-toast-texto` | `--color-toast-fondo` | #121815 / #E8EFE9 | 15.38:1 | 4.5:1 | OK | Texto del toast |
| oscuro | `--color-toast-accion` | `--color-toast-fondo` | #0F5C2B / #E8EFE9 | 6.94:1 | 4.5:1 | OK | Acción 'Deshacer' del toast |
| oscuro | `--google-texto` | `--google-fondo` | #1F1F1F / #FFFFFF | 16.48:1 | 4.5:1 | OK | Botón 'Continuar con Google' |
| oscuro | `--color-texto-suave` | `--color-barra` sobre `--color-fondo` | #9DB0A3 / #1A211D | 7.15:1 | 4.5:1 | OK | Íconos y 'vN' de la barra (sobre fondo de página) |
| oscuro | `--color-texto-suave` | `--color-barra` sobre `--color-texto` | #9DB0A3 / #38403A | 4.70:1 | 4.5:1 | OK | Íconos y 'vN' de la barra (sobre texto oscuro debajo, peor caso) |
| oscuro | `--color-primario-oscuro` | `--color-tinte-primario` | #7FD9A0 / #1D3B29 | 7.21:1 | 4.5:1 | OK | Etiqueta de la pestaña activa (tinte opaco sobre la barra) |
| oscuro | `--color-primario` | `--color-superficie` | #3DBE6E / #1B231E | 6.73:1 | 3:1 | OK | Casilla marcada, borde del campo con foco (componente) |
| oscuro | `--color-primario` | `--color-fondo` | #3DBE6E / #121815 | 7.53:1 | 3:1 | OK | Botón primario / tarjeta de resumen contra el fondo de página |
| oscuro | `--color-primario` | `--color-barra` sobre `--color-fondo` | #3DBE6E / #1A211D | 6.85:1 | 3:1 | OK | Punto 'En línea' en la barra |
| oscuro | `--color-texto-suave` | `--color-superficie` | #9DB0A3 / #1B231E | 7.02:1 | 3:1 | OK | Borde de la casilla sin marcar (componente) |
| oscuro | `--color-primario-oscuro` | `--color-superficie` | #7FD9A0 / #1B231E | 9.45:1 | 3:1 | OK | Anillo de foco (componente) |
| oscuro | `--pasillo-especiales-tinta` | `--pasillo-especiales-tinte` | #E9C79C / #3F3016 | 7.97:1 | 4.5:1 | OK | Pasillo especiales: ícono y número sobre su tinte |
| oscuro | `--pasillo-frutas_temporada-tinta` | `--pasillo-frutas_temporada-tinte` | #F2AFB1 / #472422 | 7.48:1 | 4.5:1 | OK | Pasillo frutas_temporada: ícono y número sobre su tinte |
| oscuro | `--pasillo-frutas-tinta` | `--pasillo-frutas-tinte` | #9FE0B5 / #1A4128 | 7.54:1 | 4.5:1 | OK | Pasillo frutas: ícono y número sobre su tinte |
| oscuro | `--pasillo-verduras-tinta` | `--pasillo-verduras-tinte` | #95D9C2 / #173A2D | 7.73:1 | 4.5:1 | OK | Pasillo verduras: ícono y número sobre su tinte |
| oscuro | `--pasillo-carniceria-tinta` | `--pasillo-carniceria-tinte` | #EEB79F / #442B1A | 7.41:1 | 4.5:1 | OK | Pasillo carniceria: ícono y número sobre su tinte |
| oscuro | `--pasillo-salchichoneria-tinta` | `--pasillo-salchichoneria-tinte` | #F0A9C9 / #462232 | 7.31:1 | 4.5:1 | OK | Pasillo salchichoneria: ícono y número sobre su tinte |
| oscuro | `--pasillo-refris-tinta` | `--pasillo-refris-tinte` | #A9C9F0 / #1C364C | 7.32:1 | 4.5:1 | OK | Pasillo refris: ícono y número sobre su tinte |
| oscuro | `--pasillo-condimentos_aceites-tinta` | `--pasillo-condimentos_aceites-tinte` | #CCD69B / #2E381A | 8.05:1 | 4.5:1 | OK | Pasillo condimentos_aceites: ícono y número sobre su tinte |
| oscuro | `--pasillo-abarrotes-tinta` | `--pasillo-abarrotes-tinte` | #DCC9A0 / #36311A | 8.01:1 | 4.5:1 | OK | Pasillo abarrotes: ícono y número sobre su tinte |
| oscuro | `--pasillo-botanas_semillas-tinta` | `--pasillo-botanas_semillas-tinte` | #E3CE85 / #383414 | 8.05:1 | 4.5:1 | OK | Pasillo botanas_semillas: ícono y número sobre su tinte |
| oscuro | `--pasillo-panaderia-tinta` | `--pasillo-panaderia-tinte` | #EDBE9C / #402D1A | 7.74:1 | 4.5:1 | OK | Pasillo panaderia: ícono y número sobre su tinte |
| oscuro | `--pasillo-limpieza-tinta` | `--pasillo-limpieza-tinte` | #C6B7F0 / #2F2C4A | 7.24:1 | 4.5:1 | OK | Pasillo limpieza: ícono y número sobre su tinte |
| oscuro | `--pasillo-personal-tinta` | `--pasillo-personal-tinte` | #93D3DC / #16393A | 7.49:1 | 4.5:1 | OK | Pasillo personal: ícono y número sobre su tinte |
| oscuro | `--pasillo-farmacia-tinta` | `--pasillo-farmacia-tinte` | #B3BCEE / #252F48 | 7.19:1 | 4.5:1 | OK | Pasillo farmacia: ícono y número sobre su tinte |

Hex fuera de los bloques de tokens: ninguno.
