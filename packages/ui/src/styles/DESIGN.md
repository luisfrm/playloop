# Design System — tema «Volt»

La fuente de verdad es `packages/ui/src/styles/globals.css`: este documento
explica las decisiones y los roles, pero los valores viven en ese archivo. Si
cambian allí, hay que actualizar aquí.

Todo es **CSS**: variables en `:root` y utilidades de Tailwind v4 generadas
desde el bloque `@theme inline`. Cambiar de tema (otra marca, otro contenido)
debería tocar solo esos valores, nunca los componentes.

## 1. Dirección

No es «modo oscuro genérico más un acento neón». La identidad se construye con
**azules en capas** (fondo, superficies y acento no son el mismo azul), una
**familia de cinco acentos** para que una parrilla de fichas nunca repita color,
y dos colores semánticos fuera de la familia azul para que el feedback del juego
no se confunda con la marca.

- El fondo nunca es negro puro: es un azul-tinta casi negro.
- La jerarquía sube por tono de azul (fondo → `card` → `popover`), no por sombra
  gris genérica.
- El único tema que se sirve es el oscuro: `.dark` repite los valores de `:root`
  a propósito, para no romper la convención de shadcn cuando exista un tema
  claro.
- Los colores se declaran en **oklch** nativo (`oklch(L C H)` y con alfa), sin
  envolverlos en `hsl()`.

## 2. Paleta

| Token | Uso | Valor |
|---|---|---|
| `--background` | Fondo de la app | `oklch(0.16 0.035 258)` |
| `--foreground` | Texto principal | `oklch(0.95 0.02 250)` |
| `--card` | Superficies: fichas, paneles, inputs | `oklch(0.21 0.04 258)` |
| `--popover` | Modales, menús, diálogos | `oklch(0.26 0.045 258)` |
| `--primary` | Acción principal, marca, foco | `oklch(0.62 0.2 262)` |
| `--primary-deep` | Bordes y estados hundidos del primario | `oklch(0.48 0.19 262)` |
| `--primary-cast` | Velo del primario para capas translúcidas | `oklch(0.62 0.2 262 / 0.45)` |
| `--secondary` | Controles secundarios | `oklch(0.27 0.035 258)` |
| `--muted` | Rellenos apagados, fondos de chips | `oklch(0.24 0.03 258)` |
| `--muted-foreground` | Texto secundario, metadatos | `oklch(0.68 0.035 258)` |
| `--accent` | Hover y resaltado (cian, el segundo azul) | `oklch(0.78 0.14 210)` |
| `--accent-2` | Acento cian de la familia múltiple | `oklch(0.78 0.14 235)` |
| `--accent-3` | Acento coral de la familia múltiple | `oklch(0.72 0.18 18)` |
| `--mint` | Acento menta de la familia múltiple | `oklch(0.78 0.15 165)` |
| `--lavender` | Acento lavanda de la familia múltiple | `oklch(0.76 0.12 300)` |
| `--success` | Acierto, confirmaciones | `oklch(0.78 0.15 165)` |
| `--warning` | Aviso, tiempo justo | `oklch(0.8 0.15 80)` |
| `--destructive` | Fallo, error, acción irreversible | `oklch(0.66 0.21 18)` |
| `--border-subtle` | Borde apenas visible | `oklch(0.85 0.05 258 / 10%)` |
| `--border` | Borde por defecto | `oklch(0.85 0.06 258 / 16%)` |
| `--border-strong` | Borde de foco o separador fuerte | `oklch(0.85 0.08 258 / 28%)` |
| `--input` | Borde de campos de formulario | `oklch(0.85 0.06 258 / 20%)` |
| `--ring` | Anillo de foco | `oklch(0.62 0.2 262)` |

Los bordes son **tres capas de alfa azulada**, no una línea gris plana: sobre
distintas superficies el mismo borde sigue leyéndose.

### Acentos múltiples

`pear` reutiliza `--primary`; los otros cuatro (`accent-2`, `accent-3`, `mint`,
`lavender`) son tonos propios. Los usan las insignias (`Badge`), la parrilla del
catálogo (una tinta por ficha, rotando por índice) y la marca de personaje. Se
exponen como colores de Tailwind (`bg-accent-2`, `border-mint`, …) desde
`@theme inline`.

### Tokens heredados de shadcn

`--chart-1…5` y la familia `--sidebar-*` existen para que los componentes de
shadcn tengan lo que esperan; el panel no los usa todavía.

## 3. Tipografía

Las fuentes se instalan como paquetes (`@fontsource-variable/*`), no por CDN:

| Rol | Token | Familia |
|---|---|---|
| Display y títulos | `--font-heading` | **Outfit Variable** (aplicada a `h1`–`h4`) |
| Cuerpo y UI | `--font-sans` | **Geist Variable** (fuente base del `body`) |
| Labels, cifras y código | `--font-label`, `--font-mono` | **JetBrains Mono Variable** |

Escala que usan los componentes:

| Uso | Clases | Peso |
|---|---|---|
| Título de página | `font-heading text-2xl`–`text-4xl` (según ruta) | `bold` |
| Título de ficha o panel | `font-heading text-lg`–`text-2xl` | `bold` |
| Cuerpo | `text-sm`–`text-base` | `normal` |
| Metadatos y ayudas | `text-xs`–`text-sm text-muted-foreground` | `normal` |
| Labels | `font-label text-[11px] uppercase tracking-[0.08em]` | `medium` |

Las **mayúsculas y el tracking amplio** se reservan para labels y para datos que
se leen como etiqueta (códigos de sala, estados). El texto corriente va en
sentence case; no se usan «eyebrows» decorativos ni em-dashes de adorno.
El `body` fija `font-variant-numeric: tabular-nums`, así que marcadores y
tiempos no bailan al cambiar de dígito.

## 4. Radios

`--radius: 0.75rem` y una escala derivada: `--radius-sm` (0.6×), `--radius-md`
(0.8×), `--radius-lg` (1×), `--radius-xl` (1.3×), `--radius-2xl` (1.6×) y
`--radius-pill` (9999px). El radio comunica jerarquía, no se repite en todo:

| Elemento | Radio |
|---|---|
| Botones | `rounded-lg` |
| Inputs y campos | `rounded-[var(--radius-md)]` |
| Fichas, paneles y diálogos | `rounded-[var(--radius-lg)]` |
| Insignias, chips y contadores | `rounded-full` |

## 5. Elevación y foco

No hay tokens de sombra globales: cada variante de componente define la suya en
oklch, para que la sombra sea del mismo azul que el tema y no un gris neutro.

- `Card`: `elevation="soft"` (por defecto) y `elevation="lifted"` cambian la
  sombra; `flat` solo deja el borde.
- Diálogos y popups usan una sombra más abierta (`shadow-[0_18px_44px_-20px_…]`).
- El foco de teclado es un anillo con `--ring` (`focus-visible:ring-3`), nunca
  `outline: none` sin sustituto.

## 6. Movimiento

Tokens en `:root`: `--ease-spring`, `--ease-snap`, `--ease-out`, y las
duraciones `--dur-fast` (140 ms), `--dur-base` (220 ms), `--dur-slow` (600 ms).
Los keyframes del tema son `playloop-pulse` (la marca de personaje, en reposo),
`playloop-star-burst` (destello al acertar) y `playloop-marquee` (pie), y todos
respetan `prefers-reduced-motion` por el override global de `@layer base`.

La animación se reserva para transiciones que responden a algo: acertar,
terminar una ronda, abrir un diálogo. No se anima la entrada de cada ficha.

## 7. Accesibilidad

- Foco visible siempre, con `--ring`.
- `foreground` sobre `background`/`card` supera AA con holgura;
  `muted-foreground` está en el límite, así que no se usa para texto menor de
  14 px.
- Ningún estado se comunica **solo** por color: el acierto lleva color e icono.
- `prefers-reduced-motion` desactiva animaciones y transiciones.

## 8. Piezas propias del juego

- **Resaltado en línea**: `em` y `.hl` pintan un subrayado degradado cian
  (`--hl`), no un fondo de marca, para que un énfasis no parezca un botón.
- **Tiempo**: cuenta atrás con cifras monoespaciadas; bajo el último tramo pasa
  a `--warning`.
- **Feedback de respuesta**: `--success` en la opción correcta y `--destructive`
  en la marcada si falló; el resto de opciones baja opacidad, no cambia de color.
- **Código de sala**: se muestra con `font-heading` en tamaño grande; es el
  único sitio donde el tracking amplio está justificado.
- **Marca de personaje**: un punto `--accent-3` que pulsa en reposo y se agranda
  al pasar el puntero, hecho solo con CSS.

## 9. Qué evitar

- Un único acento brillante sobre negro plano: aquí hay varios azules en capas y
  una familia de acentos.
- Sombras grises genéricas o el mismo radio y la misma sombra para todo.
- Mayúsculas sostenidas, tracking amplio o em-dashes como decoración.
- Duplicar valores en los componentes: si un color o un radio hace falta, sale
  de un token de `globals.css`.
