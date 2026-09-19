# Copia empaquetada del catálogo

Estos ficheros son una **copia literal** de
[`correo-particular-catalogo`](https://github.com/fjolivaresDH/correo-particular-catalogo)
(`catalog/**`), tomada en el commit que dice `SNAPSHOT`. La extensión los
empaqueta dentro y no descarga nada en esta versión.

- Para actualizarlos desde un clon local del catálogo:
  `npm run catalog:sync -- ../correo-particular-catalogo`
  (copia `catalog/**` y reescribe `SNAPSHOT`).
- No se editan a mano aquí: una regla nueva se propone en el repositorio del
  catálogo, y se trae con el comando de arriba.

**TODO (actualización en caliente):** descargar el catálogo público desde GitHub
(raw) con caché local en `chrome.storage`. Cuando exista, vivirá en
`src/catalog/update/`, que es la ÚNICA carpeta en la que
`npm run check:no-network` tolera `fetch(`. Hasta entonces, el catálogo se
actualiza publicando una versión nueva de la extensión.
