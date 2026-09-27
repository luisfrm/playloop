# Design System — Tema por defecto

Este documento define el tema visual por defecto de la plataforma. Todo está resuelto como **variables CSS**, siguiendo la regla del proyecto: cambiar de tema (para un nuevo contenido/marca) debe implicar tocar únicamente estos valores, nunca los componentes.

## Dirección de diseño

No es "modo oscuro genérico + un acento neón". La identidad se construye con **varios tonos de azul en capas** (el fondo, las superficies y el acento no son el mismo azul) más dos acentos semánticos (éxito/error) que se mantienen fuera de la familia azul para que la retroalimentación del juego sea instantánea y no se confunda con la marca.

- El fondo nunca es negro puro: es un azul-tinta casi negro, para que la superficie se sienta parte de una misma familia de color.
- La jerarquía se comunica **elevando el tono de azul** (fondo → superficie → superficie elevada), no solo con sombra gris genérica.
- El acento primario es vívido y se usa con disciplina: para acciones principales, focus y estados activos — no como relleno decorativo.
- El feedback del juego (correcto / incorrecto / vidas / tiempo) usa colores semánticos deliberadamente fuera del azul, para que nunca se pierdan contra el fondo de marca.

---

## 1. Paleta base

| Token | Uso | Hex aprox. | HSL |
|---|---|---|---|
| `ink` | Fondo base de la app | `#070B18` | `226 55% 6%` |
| `surface` | Cards, inputs, filas | `#101B30` | `219 50% 12%` |
| `surface-raised` | Modales, popovers, dropdowns | `#182544` | `222 48% 18%` |
| `border` | Bordes sutiles sobre superficie | `#223154` | `222 42% 23%` |
| `primary` | Acción principal, marca, focus | `#2F6FFF` | `221 100% 59%` |
| `accent` | Highlight secundario, elementos activos/hover | `#35D0FF` | `194 100% 60%` |
| `foreground` | Texto principal sobre fondo oscuro | `#E7ECFA` | `224 66% 94%` |
| `muted-foreground` | Texto secundario, hints, timestamps | `#8793B3` | `224 22% 62%` |
| `success` | Respuesta correcta, confirmaciones | `#2DD9A0` | `160 69% 51%` |
| `warning` | Vida perdida, advertencias | `#FFB020` | `39 100% 56%` |
| `destructive` | Respuesta incorrecta, game over, errores | `#FF4D6D` | `349 100% 65%` |

`primary` y `accent` están a ~27° de distancia en el círculo cromático (azul → cian): suficiente para que se distingan sin salir de la familia fría de la marca.

---

## 2. Variables CSS (listas para `globals.css`)

Formato compatible con shadcn/ui (HSL sin la función `hsl()`, para poder usarlas como `hsl(var(--primary))` en Tailwind).

```css
:root {
  --background: 226 55% 6%;
  --foreground: 224 66% 94%;

  --card: 219 50% 12%;
  --card-foreground: 224 66% 94%;

  --popover: 222 48% 18%;
  --popover-foreground: 224 66% 94%;

  --primary: 221 100% 59%;
  --primary-foreground: 226 55% 6%;

  --secondary: 219 50% 16%;
  --secondary-foreground: 224 66% 94%;

  --muted: 219 40% 14%;
  --muted-foreground: 224 22% 62%;

  --accent: 194 100% 60%;
  --accent-foreground: 226 55% 6%;

  --success: 160 69% 51%;
  --success-foreground: 226 55% 6%;

  --warning: 39 100% 56%;
  --warning-foreground: 226 55% 6%;

  --destructive: 349 100% 65%;
  --destructive-foreground: 226 55% 6%;

  --border: 222 42% 23%;
  --input: 222 42% 23%;
  --ring: 221 100% 59%;

  --radius: 0.75rem;
}
```

`success` y `warning` no son tokens nativos de shadcn: agrégalos como variantes extra en `packages/ui` (mismo patrón que `destructive`) para poder usarlos en `Badge`, `Button` y en los indicadores de vidas/tiempo del juego.

---

## 3. Tipografía

| Rol | Familia | Notas |
|---|---|---|
| Display / headings | **Space Grotesk** | Geométrica, algo técnica — le da carácter de "producto de juego", no de dashboard genérico |
| Body / UI (panel, formularios, texto largo) | **Inter** | Alta legibilidad en tamaños pequeños, necesaria para el panel admin |

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

--font-display: 'Space Grotesk', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
```

Escala tipográfica (line-height incluido, evitar usar solo `text-Npx` sin ritmo):

| Uso | Tamaño | Line-height | Peso |
|---|---|---|---|
| Título de sección (home) | 2.25rem (36px) | 1.15 | 600–700 |
| Título de card / juego | 1.25rem (20px) | 1.3 | 600 |
| Cuerpo | 1rem (16px) | 1.5 | 400 |
| Texto secundario / meta | 0.875rem (14px) | 1.4 | 400–500 |
| Label de UI (botones, badges) | 0.8125rem (13px) | 1 | 500–600 |

No usar mayúsculas sostenidas (`uppercase`) como recurso por defecto en labels — solo si el propio contenido lo pide (ej. un código de sala corto).

---

## 4. Radios y elevación

Los radios comunican jerarquía, no son un valor único repetido en todo:

| Elemento | Radio |
|---|---|
| Botones | `rounded-full` (pill) — refuerza el carácter lúdico/interactivo |
| Cards de juego, inputs | `rounded-2xl` (`--radius`) |
| Modales, popovers | `rounded-xl` |
| Badges, chips (vidas, tiempo) | `rounded-full` |

Elevación: en vez de sombra gris genérica (`rgba(0,0,0,.1)` en todo), usar **glow de color** ligado al azul de marca para elementos activos/focus, y solo el salto de tono de superficie (`surface` → `surface-raised`) para jerarquía pasiva:

```css
--shadow-elevated: 0 8px 24px -8px hsl(226 55% 2% / 0.6);
--shadow-glow-primary: 0 0 0 1px hsl(var(--primary) / 0.4), 0 0 24px hsl(var(--primary) / 0.25);
--shadow-glow-accent: 0 0 0 1px hsl(var(--accent) / 0.4), 0 0 20px hsl(var(--accent) / 0.2);
```

`shadow-glow-primary` se usa en focus visible y en el estado "en curso" de una partida activa; no se aplica a todas las cards por igual (evitar que todo brille).

---

## 5. Accesibilidad y foco

- Foco de teclado siempre visible: anillo con `--ring` (`primary`) + `shadow-glow-primary`, nunca solo `outline: none`.
- Contraste mínimo AA: `foreground` sobre `background`/`card` ya cumple (~13:1). Verificar `muted-foreground` sobre `surface` (queda ~4.6:1, límite — no usarlo para texto menor a 14px).
- Reducir motion: respetar `prefers-reduced-motion`; las transiciones de acierto/error deben tener una alternativa sin animación (solo cambio de color + ícono).

---

## 6. Componentes específicos del juego

Estos son los únicos lugares donde el color se desvía deliberadamente del azul de marca — es información, no decoración:

- **Vidas**: ícono lleno en `warning` mientras queda vida, ícono vacío en `border`/`muted-foreground`. Nunca `destructive` para "vida restante" (se reserva para el fallo final).
- **Barra de tiempo**: `primary` mientras hay tiempo cómodo, transición a `warning` bajo el 30%, a `destructive` bajo el 10%. Un solo color por estado, sin degradado arcoíris.
- **Feedback de respuesta**: fondo/borde `success` en la opción correcta, `destructive` en la opción marcada si fue incorrecta. El resto de las opciones baja opacidad, no cambia de color.
- **Sala de código (coop)**: el código se muestra en `font-display`, tamaño grande, con `letter-spacing` leve — es el único lugar donde el tracking amplio está justificado (es un código para leer y compartir, no una etiqueta decorativa).

---

## 7. Qué evitar (por diseño, no por accidente)

- Un único acento brillante sobre negro plano — aquí hay dos azules distintos + superficies escalonadas, no un tono plano.
- Cards idénticas con el mismo radio y la misma sombra gris para todo — los radios varían por rol (botón vs. card vs. modal).
- Eyebrows en mayúsculas o labels con em-dash como adorno — el texto de UI es directo y en sentence case.
- Animación de entrada (fade + slide) repetida en cada card del grid — la animación se reserva para transiciones que responden a una acción del jugador (acertar, perder una vida, abrir un modal).