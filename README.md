# correo-particular (nombre provisional)

Extensión de navegador que lee tu Gmail **en tu propio navegador** y te dice tres cosas que un buzón no te dice:

1. **Qué vence** — recibos, renovaciones, garantías, plazos de devolución, citas, suscripciones que se renuevan solas.
2. **Qué es cada cosa** — boletines, avisos automáticos, compras, lo que importa; para que la bandeja se ordene sola.
3. **A quién le debes una respuesta** — conversaciones donde la última palabra es del otro y tú no has contestado.

Sin inteligencia artificial y sin que nadie lea tu correo: todo son **reglas deterministas** que se aplican en local, a partir de un [catálogo público de remitentes](https://github.com/fjolivaresDH/correo-particular-catalogo) que crece con la colaboración de todos.

## Cómo funciona, en tres líneas

- Lee la página de Gmail (`mail.google.com`) desde el navegador. **No usa la API de Google**, no pide permisos de tu cuenta, y no envía nada a ningún servidor.
- Aplica el catálogo de reglas (empaquetado dentro) a la lista de conversaciones que ves: remitente, asunto y fecha. Nunca el cuerpo ni el fragmento de vista previa.
- Lo que decide —qué vence, qué es cada cosa, a quién debes respuesta— se guarda solo en tu navegador (`chrome.storage.local`) y se enseña en el popup de la extensión.

## Probarla sin empaquetar (modo desarrollador)

```
npm install
npm run build        # deja la extensión lista en dist/
```

1. Abre `chrome://extensions` (o el equivalente de tu navegador Chromium: Edge, Brave, Vivaldi…).
2. Activa **Modo desarrollador**.
3. **Cargar descomprimida** → elige la carpeta `dist/`.
4. Abre Gmail en una pestaña; espera un par de segundos; pulsa el icono de la extensión.

Cada vez que cambies código: `npm run build` y el botón de recargar de la extensión.

## Tests y comprobaciones

```
npm test                  # motor de reglas, tres listas y adaptador de Gmail sobre fixtures
npm run typecheck         # TypeScript estricto
npm run check:no-network  # falla si algo en src/ puede salir a la red o el manifest pide de más
npm run check             # todo lo anterior y el build
```

`check:no-network` es la promesa del producto convertida en comprobación: busca `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` y `EventSource` en `src/` (solo tolerará `fetch` en `src/catalog/update/`, que no existe todavía) y comprueba que `manifest.json` pide únicamente `storage` y `https://mail.google.com/*`.

## Estructura

```
manifest.json           Manifest V3: permisos mínimos (storage + mail.google.com)
build.mjs               esbuild: content script + popup → dist/
catalog/                copia literal del catálogo público (ver catalog/README.md y SNAPSHOT)
src/
  gmail/                adaptador del DOM de Gmail — lo ÚNICO que se rompe si Google cambia la página
    selectors.ts        los selectores, con el porqué de cada uno
    parse-row.ts        fila → ThreadRow (remitente, asunto, fecha, participantes)
    dates.ts            fechas tal como Gmail las pinta (es/en)
    fixtures/           HTML sintético, sin datos reales
    README.md           cómo re-mapear cuando se rompa
  rules/                motor de reglas: puro, sin DOM (dominio + asunto + extracción)
  aha/                  las tres listas, puras
  catalog/              carga y validación ligera del catálogo empaquetado
  content/              content script: barre la lista y guarda metadatos en storage
  popup/                interfaz mínima: lee storage y pinta las tres listas
  shared/               tipos que cruzan entre módulos (solo metadatos)
scripts/                check-no-network, sync-catalog
```

## Límites, sin adornos

- **Solo Gmail web**, en `mail.google.com`. Ni Outlook, ni otros correos, ni la API de Gmail.
- **Solo navegadores Chromium** (Chrome, Edge, Brave…). Firefox, después, si se quiere.
- **Se rompe si Gmail cambia la página.** No hay API de reserva: toda la fragilidad vive en `src/gmail/`, con su README para re-mapear.
- **Sin móvil.** La app de Gmail no admite extensiones.
- **Solo lee lo que se ve.** La lista de conversaciones de la vista actual (bandeja, enviados, una búsqueda): unas 50-100 filas. No recorre el buzón entero.
- **«A quién debes respuesta» es una aproximación** desde la fila: Gmail no dice quién escribió el último mensaje; se infiere de si apareces entre los participantes. Solo metadatos (remitente, asunto, fecha); nunca contenido.
- **Solo el asunto.** Fecha e importe se extraen del asunto, nunca del cuerpo. Un recibo cuyo asunto no lleva el importe aparece sin él.
- **Catálogo pequeño y sin verificar.** Hoy son 12 remitentes sembrados, todos marcados «ejemplo» hasta que alguien los compruebe con correos reales. El aha depende de que el catálogo crezca.
- **Catálogo empaquetado, no descargado.** Actualizarlo hoy es publicar una versión nueva. *TODO*: descarga desde GitHub (raw) con caché local, en `src/catalog/update/`.

## Lo que no hace en la versión gratis

No usa IA. No envía correo. No lee tu buzón desde fuera. No manda nada a ningún servidor, tampoco a los nuestros.

## Tramo de pago (después)

Por menos de 1 € al mes, una IA que lee **solo** lo que las reglas ya marcaron como relevante, para resumir, sacar el importe cuando el patrón falla y preparar una respuesta que envías tú desde Gmail. Se procesa en Europa y no se guarda nada.

## Estado

**Esqueleto funcional (septiembre de 2026).** Nombre provisional; licencia por decidir. De los creadores de Newe.
