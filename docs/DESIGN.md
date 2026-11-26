# Diseño de Seyro-MP4

**Versión 1.0 · 2026-11-26**

## Dirección visual

Brutalismo limpio con ADN Seyroo: bloques rectos, rejillas marcadas, bordes sólidos de 2px, jerarquía tipográfica fuerte y acentos con propósito. Cero gradientes decorativos, cero sombras difusas, cero tarjetas con relleno hueco.

Referencia compartida por el usuario: imagen de 502×762 con paleta papel/tinta muestreada `#e8e8ea`, `#d5d5d4`, `#f4f4f4` y `#3e3b3b`. El modelo de este entorno no pudo interpretar la composición visual, así que la inspiración se aplica sobre los datos medibles y las instrucciones explícitas, no sobre una lectura inventada de la imagen.

## Tokens

| Token | Papel (light) | Terminal (dark) |
| --- | --- | --- |
| `--bg` | `#f2f0ea` papel crudo | `#0b0b0b` terminal profundo |
| `--surface` | `#ffffff` | `#131313` |
| `--ink` | `#111111` | `#f2f0ea` |
| `--muted` | `#56534e` | `#a8a49c` |
| `--border` | `#111111` | `#f2f0ea` |
| `--radius` | `0` | `0` |
| `--border-width` | `2px` | `2px` |

El acento por defecto es `#ff6b00`, el mismo naranja de Seyropea. Presets: naranja Seyroo, lima ácido `#c6ff00`, coral `#ff4d3d`, cian `#00d9ff` y ámbar `#ffb000`. El color elegido nunca se aplica sin verificar contraste: se calcula WCAG, se escoge automáticamente `#111111` o `#ffffff` para el texto sobre el acento y se exigen ≥4.5:1 para ese texto y ≥3:1 contra al menos uno de los dos fondos. Los botones primarios mantienen el borde oscuro para que un acento claro siga siendo visible sobre papel.

## Modos

- `paper`: claro, alto contraste, tipo documento técnico impreso.
- `terminal`: oscuro profundo, tipo editor.
- `system`: sigue `prefers-color-scheme`.

`boot.js` se carga de forma bloqueante en `<head>` y aplica modo/acento/tipografía antes de que se pinte el cuerpo: sin parpadeo y sin `innerHTML`.

## Tipografía

Tres familias, todas con fallbacks del sistema y sin peticiones de red:

| Id | Pila CSS | Uso |
| --- | --- | --- |
| `grotesk` | `system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | Bloques y títulos de peso marcado |
| `mono` | `"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace` | Resoluciones, bitrates, estados y rutas |
| `editorial` | `Georgia, "Times New Roman", serif` | Lectura larga y documentación |

La elección se aplica a `--font-ui`; los datos técnicos usan siempre `--font-mono` para conservar coherencia incluso con otra tipografía principal.

## Componentes

Nombres y semántica compartidos con Seyropea, adaptados al brutalismo:

- `Toast`: avisos no bloqueantes, `role=status`/`alert`.
- `Modal`: diálogo con `role=dialog`, `aria-modal`, foco inicial, cierre con `Esc` y restauración de foco.
- `Tooltip`: `data-tooltip` + `aria-label`, sin interceptar clics.
- `Badge`: etiquetas compactas con borde visible.
- `Skeleton`: matriz de puntos DIVAE (tres tamaños, patrón determinista, `currentColor`) sobre barras cuadradas. Se usa para metadatos, formatos y cola; nunca como spinner genérico.
- `FormatSelector` y `QueueItem`: se añaden con el motor en el Paso 5.

Todos los componentes construyen nodos con `textContent`/`createElement`: ningún dato externo se pasa por `innerHTML`.

## i18n

`src/frontend/i18n.js` centraliza español e inglés con respaldo a español. Incluye textos de interfaz, estados, tooltips, errores (`E_*`) y plataformas. `translateDom(root, locale)` aplica `data-i18n`, `data-i18n-title` y `data-i18n-aria`. La estructura admite más idiomas añadiendo un diccionario; el selector persiste en `localStorage`.

Los cuerpos legales viven en `docs/*.md` como fuente única y se enlazan desde la app y la web; sus títulos y enlaces están en el diccionario. La traducción íntegra de esos documentos se incorpora al mismo pipeline en el Paso 6.

## Persistencia y seguridad

`localStorage` guarda únicamente `{mode, accent, customAccent, font, locale}` bajo `seyro-mp4.settings`. Nada de telemetría, credenciales ni URLs. La lectura valida valores contra listas blancas y colores HEX; si falla, se usan defaults. CSP mantiene `script-src 'self'` y estilos locales.

## Web

`docs/index.html` usa los mismos tokens, selector de idioma es/en y enlaces a repositorio y documentos legales. Es estática, rápida y no simula descargas.
