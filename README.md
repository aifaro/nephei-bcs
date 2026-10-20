# nephei-bcs

[bcs.nephei.org](https://bcs.nephei.org): una referencia visual del *Battalion Combat Series* (MMP / The Gamers), versión 2.0 de las reglas de serie. No es oficial y no cubre las reglas propias de cada juego.

El reglamento va en cinco capítulos, en el orden de las *Series Rules*, bajo el menú «Reglamento»:

1. **Fichas y unidades.** Anatomía interactiva de una ficha, caras desplegada y de movimiento, infantería, AV y Dual, los cuatro tipos de AV, Hard y ruptura, el apoyo, los marcadores y el cuadro de capacidades.
2. **Secuencia y SNAFU.** Fases del turno, la activación paso a paso, una calculadora de SNAFU, la Segunda Activación y la fatiga.
3. **Mando y suministro.** Formaciones y mancha, radio de mando, HQ y trenes, la MSR, los OBJ y sus zonas, Safe Path, aislamiento y saltos.
4. **Movimiento y ZOC.** Clases de movimiento, la Terrain Effects Chart de *Arracourt* con hexes recortados de su mapa, apilamiento, un mapa interactivo con los cinco tipos de ZOC (No ZOC, Non-AV, Support AV, Real AV y Engagement Zone), pantallas, tráfico y retiradas voluntarias.
5. **Combate.** Un asistente para saber qué ataque puedes usar y una ficha por cada tipo: ataque regular, de choque, enfrentamiento, ataque por fuego y bombardeo. Retiradas y Stopping Engagements.

Además:

- **Simulador.** Se colocan las fichas en un mapa de hexes, se marcan las circunstancias y calcula los modificadores, los requisitos y la probabilidad de cada resultado. Al tirar, aplica el resultado sobre las fichas: bajas, retiradas, avance y tráfico.
- **Tablas y glosario.** Las tablas de la serie para consultar o imprimir, y más de setenta términos en inglés y castellano. Los términos del texto enlazan al glosario y muestran su definición al pasar por encima.

Sitio estático, sin dependencias ni paso de compilación.

## Estructura

| Ruta | Qué es |
|---|---|
| `public/*.html` | Las páginas. |
| `public/css/bcs.css` | Estilos comunes, temas claro y oscuro, e impresión. |
| `public/css/simulador.css` | Estilos del simulador y de la calculadora de SNAFU. |
| `public/js/reglas.js` | El motor: tablas transcritas y cálculo de modificadores. No toca el DOM. |
| `public/js/fichas.js` | Las unidades de ejemplo con los valores impresos en sus fichas reales, y cómo se pintan. |
| `public/js/simulador.js` | El simulador. |
| `public/js/datos.js` | El glosario y el índice del buscador (Ctrl+K). |
| `public/js/comun.js` | Cabecera con el menú del reglamento, capítulos, pie, tema, buscador y enlaces al glosario. |
| `public/fichas/` | Fichas reales: `u/` las unidades por cara (`-d` desplegada, `-m` movimiento), `m/` los marcadores, `t/` los hexes de terreno del mapa de *Arracourt* y en la raíz las de la galería. |
| `tests/reglas.test.js` | Pruebas del motor. |

## Pruebas

```
node tests/reglas.test.js
```

Comprueban los modificadores del Combat y del Engagement Table, las filas del Barrage Table, los resultados y las distribuciones de probabilidad contra casos calculados a mano.

## Despliegue

Worker `nephei-bcs` en Cloudflare, conectado a este repositorio con Workers Builds: cada push a `main` despliega `public/` como assets. El dominio `bcs.nephei.org` está en `routes` de `wrangler.jsonc`.

## Fuentes y derechos

- Reglas y tablas: *BCS v2.0 Series Rules*, *Charts & Tables* y *Support Book* (© 2021 Multi-Man Publishing). Las reglas completas y vigentes están en [multimanpublishing.com](https://www.multimanpublishing.com/).
- Las fichas de `public/fichas/` vienen de los módulos de VASSAL de *Arracourt*, *Danger Forward* (el Tiger y el marcador de Prepared Defense) y *Valley of Tears*. Su arte es © Multi-Man Publishing; se muestran como ejemplo en una ayuda de juego gratuita y sin ánimo de lucro.
- Las parejas de caras salen del `buildFile.xml` de cada módulo. Cuando a una unidad le quedan menos pasos que los impresos, la web tapa la casilla con los que le quedan.
