# AGENTS.md — Playloop

Motor de juegos genérico multi-tema. La especificación de producto es
`INITIAL_PROMPT_IMPROVED.md`; léela antes de tocar nada si la tarea es nueva.

---

## Comandos

| Qué | Comando |
|---|---|
| Instalar | `pnpm install` |
| Dev (web en :5173 dentro de workerd) | `pnpm dev` |
| Build | `pnpm build` |
| Tests unitarios (db, game-engine, web) | `pnpm test` |
| Tests e2e (Playwright) | `pnpm --filter web test:e2e` |
| Typecheck | `pnpm typecheck` |
| Formatear | `pnpm format` |
| Lint | `pnpm lint` |

- `pnpm format` es **Prettier** (raíz `.prettierrc`): sin `;`, comillas dobles,
  plugin `prettier-plugin-tailwindcss` (ordena las clases Tailwind).
- **`pnpm lint` es ESLint** (flat config `eslint.config.mjs`, raíz):
  `typescript-eslint` sin reglas con tipos, `eslint-config-prettier` y
  `complexity` máximo 15 por función (§14); vetado `react-icons`.

---

## Regla de diseño no negociable

Ninguna tabla, campo, ruta, componente, variable o comentario puede nombrar un
dominio de contenido concreto. Vocabulario permitido: `item`, `label`, `theme`,
`content`, `dictionary`, `instance`, `player`, `score`.

Los datos de prueba son ficticios y genéricos: `"Tema de prueba"`,
`"Elemento 1"`. El contenido real se carga después, como datos, desde el panel.

Hay tests que fuerzan esto — ejecútalos siempre que toques schema o motor:

- `packages/game-engine/test/architecture.test.ts`
- `packages/db/test/schema.test.ts`

---

## Monorepo

```
apps/web/              React Router v8 (framework mode) + SSR sobre Cloudflare Workers
packages/game-engine/  Motor: tipos de juego, Zod, validación server-side. Sin React.
packages/db/           Drizzle ORM (D1 en prod, memoria en dev/tests) + migraciones
packages/ui/           Componentes shadcn + variantes (cva). Sin lógica de negocio.
```

### `apps/web`

- **Rutas**: mapa central en `apps/web/app/routes.ts`; los archivos viven en
  `apps/web/app/routes/`.
  Públicas: `/`, `/juego/:slug`, `/practica/:slug`, `/sala/:code`,
  `/ranking/:slug`. API: `/api/play`, `/api/upload-url`, `/api/offline/:slug`,
  `/archivos/*` (sirve R2). Admin: `/admin/entrar`, `/admin`, `/admin/nuevo`,
  `/admin/juego/:id`, `/admin/moderacion`.
- **`app/lib/*.server.ts` es server-only** (D1, KV, R2, DO). Nunca lo importes
  desde un componente de cliente.
- **Workers**: `workers/app.ts` es el entry (`wrangler.jsonc` → `main`);
  `workers/room-do.ts` es el Durable Object de salas; los bindings están
  declarados en `workers/env.ts`.
- Las rutas de sala (`/api/room*`) no están en `routes.ts`: se interceptan en el
  Worker antes del SSR (`app/lib/coop.server.ts` → `ROOM_PATH`).

### `packages/game-engine`

- `gameTypes` (singleton) en `src/index.ts`. Contrato `GameTypeDefinition` en
  `src/game-type.ts`: `contentSchema`, `settingsSchema`, `buildRound`,
  `resolveAnswer`, `requiresDictionary`.
- El único tipo registrado hoy es `true_false`
  (`src/play/types/true-false.ts`). Añadir uno nuevo = crear el archivo y
  `gameTypes.register(...)` en `src/index.ts`; el panel lo recoge solo.
- `describeObject` (`src/descriptor.ts`) convierte cualquier schema Zod en un
  descriptor de formulario: el CRUD del panel es genérico y no conoce tipos.
- Otros módulos: `src/realtime/room.ts` (máquina de sala, pura),
  `src/play/session.ts` (sesión un jugador), `src/moderation/name-filter.ts`,
  `src/dictionary.ts`.
- **Sin React, sin `Request`/`Response`**: validación pura.

### `packages/db`

- `src/schema.ts` — 10 tablas (Drizzle/SQLite). `src/d1-repository.ts` es la
  implementación de producción; `src/memory-repository.ts` la de dev/test con
  seed (`seedDemoInstance`).
- Migración única: `migrations/0000_init.sql`. Tras cambiar el schema:
  `pnpm --filter @playloop/db generate`.

### `packages/ui`

- shadcn con cva. Cada componente exporta sus `*Variants`. Los estilos viven en
  `src/styles/globals.css` (tema "Volt"); el design system documentado en
  `src/styles/DESIGN.md`.
- Añadir componentes con:
  `pnpm dlx shadcn@latest add <nombre> -c apps/web` (van a `packages/ui`).

---

## Invariantes

1. **`resolveAnswer` solo corre en el servidor.** En modo online el cliente
   envía ids; el Worker resuelve contra el contenido real.
2. **Las partidas offline/práctica nunca entran al ranking**
   (`countsForRanking` en `game-engine/src/play/session.ts`). Solo `solo` y
   `online`.
3. **El estado del coop vive solo en `RoomDurableObject`**, incluido el tiempo.
   `publicRoomState` nunca publica la respuesta. Las salas caducan por
   Durable Object Alarms (15 min inactividad, 5 min tras terminar).
4. **Modo experto exige diccionario usable** y `expertModeEnabled` en la
   instancia; el jugador selecciona del combobox, no escribe libre.
5. **El ranking es por `GameInstance`**, nunca global.
6. **Imágenes**: el panel pide un presign a `/api/upload-url`, el navegador sube
   directo a R2 y el Worker guarda la referencia en D1. No se proxyan bytes.
7. **Nombre de jugador**: se valida al guardar (`checkName`) contra la lista de
   términos bloqueados, con respaldo manual en `/admin/moderacion`.

---

## Despliegue

`pnpm --filter web deploy` construye con el plugin de Cloudflare y llama a
`wrangler deploy`. Una vez por cuenta, antes del primer despliegue:

1. `wrangler d1 create playloop` y pegar el `database_id` en
   `apps/web/wrangler.jsonc` (hoy pone `REPLACE_WITH_D1_ID`).
2. `wrangler kv namespace create CACHE` y pegar el `id`
   (`REPLACE_WITH_KV_ID`).
3. `wrangler r2 bucket create playloop-media`.
4. `pnpm --filter web deploy:migrate` aplica `packages/db/migrations` a la D1
   remota (`db:migrate:local` hace lo mismo en local, con `--file`).
5. `wrangler secret put` para `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` y los
   cuatro `R2_*` (endpoint S3, bucket y credenciales).

Mientras sigan los valores de desarrollo, el login del panel lo avisa.

## Estilo de código y UI

- `lucide-react` para iconos; nunca `react-icons`.
- Un componente por modal, un componente por formulario.
- Componentes de UI genéricos en `packages/ui`; los de página en
  `apps/web/app/components/`.
- UI y mensajes de usuario en español.
- Tailwind v4 con variables centralizadas (`globals.css`); evita colores
  hardcodeados.

---

## Tests

- **Unit**: Vitest. `packages/*/test/` (entorno node) y `apps/web/test/`
  (jsdom + Testing Library).
- **E2E**: Playwright en `apps/web/e2e/`, con seed de D1 local vía
  `apps/web/e2e/prepare-db.mjs`. Corre contra `vite preview` en :4321.
- Al tocar schema, motor o un flujo de juego, añade/ajusta el test
  correspondiente.
