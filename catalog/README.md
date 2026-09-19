# Copia empaquetada del catálogo

Estos ficheros son una **copia literal** de
[`correo-particular-catalogo`](https://github.com/fjolivaresDH/correo-particular-catalogo)
(`catalog/**`), tomada en el commit que dice `SNAPSHOT`. La extensión los
empaqueta dentro: son las reglas con las que arranca y las que usa si la
descarga falla o todavía no ha ocurrido.

- Para actualizarlos desde un clon local del catálogo:
  `npm run catalog:sync -- ../correo-particular-catalogo`
  (copia `catalog/**`, reescribe `SNAPSHOT` y regenera `src/catalog/bundled.ts`,
  que es lo que evita que una lista nueva se copie y no la cargue nadie).
- No se editan a mano aquí: una regla nueva se propone en el repositorio del
  catálogo, y se trae con el comando de arriba.

**Actualización en caliente (hecho):** `src/catalog/update/` se trae el catálogo
público desde GitHub (raw) y lo guarda en `chrome.storage.local`, como mucho una
vez al día y solo al abrir el popup. Es la ÚNICA carpeta en la que
`npm run check:no-network` tolera `fetch(`; lee su cabecera antes de tocarla.
Estos ficheros siguen siendo el suelo: lo descargado los sustituye solo si
valida.
