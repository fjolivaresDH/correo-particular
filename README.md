# correo-particular (nombre provisional)

Extensión de navegador que lee tu Gmail **en tu propio navegador** y te dice tres cosas que un buzón no te dice:

1. **Qué vence** — recibos, renovaciones, garantías, plazos de devolución, citas, suscripciones que se renuevan solas.
2. **Qué es cada cosa** — boletines, avisos automáticos, compras, lo que importa; para que la bandeja se ordene sola.
3. **A quién le debes una respuesta** — conversaciones donde la última palabra es del otro y tú no has contestado.

Sin inteligencia artificial y sin que nadie lea tu correo: todo son **reglas deterministas** que se aplican en local, a partir de un [catálogo público de remitentes](https://github.com/fjolivaresDH/correo-particular-catalogo) que crece con la colaboración de todos.

**Qué sale de tu navegador y qué no.** Tu correo, no: ni el remitente, ni el asunto, ni una cuenta, ni una estadística. Lo único que viaja es **una descarga del catálogo público**, como quien baja una actualización: un GET a un fichero de GitHub, sin parámetros, sin decir quién eres y como mucho una vez al día, cuando abres el popup. Lo comprueba `npm run check:no-network` y está explicado en `src/catalog/update/`.

## Cómo funciona, en tres líneas

- Lee la página de Gmail (`mail.google.com`) desde el navegador. **No usa la API de Google**, no pide permisos de tu cuenta, y no manda nada de tu correo a ningún servidor.
- Aplica el catálogo de reglas a la lista de conversaciones que ves: remitente, asunto y fecha. Nunca el cuerpo ni el fragmento de vista previa. El catálogo va **empaquetado dentro** y, si hay uno descargado más nuevo, se usa ese.
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

`check:no-network` es la promesa del producto convertida en comprobación, y son cuatro:

1. En `src/` no hay ninguna forma de salir a la red —`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `importScripts`— fuera de `src/catalog/update/`.
2. El manifest pide lo mínimo (`storage`, Gmail y el repositorio del catálogo) y el content script solo corre en Gmail.
3. La única URL de red escrita en `src/` es la del catálogo público.
4. `src/catalog/update/` solo puede importar el validador y los tipos: sin acceso al adaptador de Gmail ni a las tres listas, no hay ningún dato del buzón que pudiera mandar.

Las cuatro están comprobadas **en negativo** (un `fetch` fuera de sitio, una URL ajena, un import del adaptador: las tres hacen fallar el comando).

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
  catalog/              de dónde salen las reglas: lo descargado si lo hay, si no lo empaquetado
    bundled.ts          GENERADO por `catalog:sync`: enumera las listas empaquetadas
    validate.ts         validación ligera, la MISMA para lo empaquetado y lo descargado
    update/             la ÚNICA carpeta que sale a la red, y solo al catálogo público
  content/              content script: barre la lista y guarda metadatos en storage
  popup/                interfaz mínima: lee storage y pinta las tres listas
  shared/               tipos que cruzan entre módulos (solo metadatos)
scripts/                check-no-network, sync-catalog
```

## Límites, sin adornos

- **Solo Gmail web**, en `mail.google.com`. Ni Outlook, ni otros correos, ni la API de Gmail.
- **Solo Chrome.** Manifest V3 y Chrome Web Store; sin Firefox ni otros navegadores (decisión de producto).
- **Se rompe si Gmail cambia la página.** No hay API de reserva: toda la fragilidad vive en `src/gmail/`, con su README para re-mapear.
- **Sin móvil.** La app de Gmail no admite extensiones.
- **Solo lee lo que se ve.** La lista de conversaciones de la vista actual (bandeja, enviados, una búsqueda): unas 50-100 filas. No recorre el buzón entero.
- **«A quién debes respuesta» es una aproximación** desde la fila: Gmail no dice quién escribió el último mensaje; se infiere de si apareces entre los participantes. Solo metadatos (remitente, asunto, fecha); nunca contenido.
- **Solo el asunto.** Fecha e importe se extraen del asunto, nunca del cuerpo. Un recibo cuyo asunto no lleva el importe aparece sin él.
- **Catálogo sin verificar.** Hoy son 279 remitentes sembrados, **todos** marcados «ejemplo» hasta que alguien los compruebe con correos reales: los dominios salen de lo que se sabe de cada organización, no de haber visto sus correos, y alguno estará mal (los más dudosos lo dicen en su nota). Una regla equivocada no hace daño —como mucho no reconoce a nadie—, pero el aha depende de que el catálogo se verifique y crezca.
- **El catálogo se actualiza solo, una vez al día,** al abrir el popup. Si la descarga falla se sigue con el que va empaquetado; nunca te quedas sin reglas.

## Lo que no hace en la versión gratis

No usa IA. No envía correo. No lee tu buzón desde fuera. No manda nada de tu correo a ningún servidor, tampoco a los nuestros — de hecho no tenemos servidor: lo único que hay al otro lado es un repositorio público de reglas en GitHub.

## Tramo de pago (después)

Por menos de 1 € al mes, una IA que lee **solo** lo que las reglas ya marcaron como relevante, para resumir, sacar el importe cuando el patrón falla y preparar una respuesta que envías tú desde Gmail. Se procesa en Europa y no se guarda nada.

## Estado

**Esqueleto funcional (septiembre de 2026).** 279 reglas sembradas y actualización automática del catálogo. Nombre provisional; licencia por decidir. De los creadores de Newe.
