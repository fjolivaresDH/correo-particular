# Adaptador de Gmail — la única carpeta que se rompe cuando Google cambia la página

Aquí vive todo lo que depende del DOM de `mail.google.com`. El resto del código
recibe `ThreadRow` (`src/shared/types.ts`) y no sabe que existe Gmail.

## Qué lee, de dónde

| Dato | Selector | Por qué creemos que existe |
|---|---|---|
| Fila de hilo | `tr.zA` (`zE` no leído, `yO` leído) | Estable desde la interfaz de 2012; lo usan Mailtrack, Boomerang, Streak, InboxSDK |
| Participantes | `td.yX` → `span[email][name]` (`yP` leído, `zF` no leído) | Los atributos `email`/`name` son los que alimentan la tarjeta al pasar el ratón |
| Yo mismo | `span[name="yo"]` («me», «moi», «ich»…) | Gmail sustituye el nombre del dueño por «yo» en la lista |
| Nº de mensajes | `td.yX span.bA4` («3») | Solo aparece cuando el hilo tiene más de uno |
| Asunto | `td.a4W span.bog` | El fragmento de vista previa va en `span.y2`, que NO se lee |
| Id del hilo | `data-legacy-thread-id` / `data-thread-id` en el asunto o la fila | Gmail los expone en la vista clásica; si faltan, se deriva uno del asunto+remitente+fecha |
| Fecha | `td.xW span[title]` | El `title` lleva la fecha completa; el texto visible, la corta |

Selectores en `selectors.ts`; lógica en `parse-row.ts`; fechas en `dates.ts`.

## Qué NO se puede saber desde la fila

- Quién escribió el ÚLTIMO mensaje. Gmail pinta los participantes en orden de
  aparición, no de último mensaje. Se aproxima con: «aparezco entre los
  participantes» (`hasOwnReply`) y «soy el último pintado» (`lastIsMe`).
- El cuerpo. Ni se lee ni se guardará nunca en esta versión.

## Cómo re-mapear cuando se rompa

1. Abre Gmail web, F12, inspecciona una fila de la bandeja.
2. Localiza el `<tr>` del hilo y actualiza `SELECTORS.row`; luego, dentro de
   él, la celda de remitente (busca los atributos `email`), la de asunto y la
   de fecha (busca el `title` con la fecha completa).
3. Actualiza los fixtures de `fixtures/` con el HTML nuevo, **anonimizado**
   (nombres y direcciones inventados, sin fragmento de vista previa).
4. `npm test`: los tests del adaptador corren sobre los fixtures.

Los fixtures son sintéticos, escritos a mano a partir de la estructura de
Gmail; no son capturas de ningún buzón real.
