# Playloop

Motor de juegos multi-tema. React Router (framework mode v8) + SSR sobre Cloudflare
Workers, Drizzle sobre D1, y el resto de la plataforma de Cloudflare como
almacenamiento.

## Desarrollo

```bash
pnpm install
pnpm dev          # apps/web en http://localhost:5173
```

El dev server corre dentro de `workerd` a través de `@cloudflare/vite-plugin`, así
que los bindings y el runtime coinciden con producción. Sin `wrangler.jsonc`
configurado la app cae a un repositorio en memoria ya sembrado, de modo que no
hace falta ningún recurso de Cloudflare para trabajar en local.

## Build y preview

```bash
pnpm --filter web build      # build/client (estáticos) + build/server (Worker)
pnpm --filter web preview    # sirve el build en workerd
```

El plugin de Vite escribe `build/server/wrangler.json` y
`.wrangler/deploy/config.json`, así que `wrangler` usa automáticamente el bundle
compilado. No edites esos archivos: se regeneran en cada build.

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/` | Catálogo |
| `/juego/:slug` | Partida individual (la resuelve el servidor) |
| `/practica/:slug` | Práctica **sin conexión** con un juego descargado. Solo cliente: lee IndexedDB y ejecuta el motor en el navegador. Nunca entra al ranking |
| `/sala/:code` | Sala cooperativa (Durable Object + WebSocket) |
| `/ranking/:slug` | Ranking del juego |
| `/admin` | Panel |
| `/archivos/*` | Sirve los objetos subidos desde el binding `MEDIA` |

## Subida de media

El panel sube archivos en tres pasos: pide una URL prefirmada al Worker, hace `PUT`
**directo a R2** desde el navegador, y guarda la referencia en el elemento de
contenido. Para que el `PUT` funcione el bucket necesita una política CORS que
permita `PUT` desde el origen de la app; y si configuras
`MEDIA_PUBLIC_BASE_URL` se usa esa URL pública en lugar de `/archivos/*`.

Sin los secretos `R2_*` el control de subida aparece desactivado y lo explica:
no hay forma de subir a medias.

## Deploy

Faltan por crear los recursos reales y pegar sus ids en `apps/web/wrangler.jsonc`:

```bash
cd apps/web
pnpm exec wrangler d1 create playloop          # -> database_id
pnpm exec wrangler kv namespace create CACHE   # -> id
pnpm exec wrangler r2 bucket create playloop-media

# secretos de R2 para las URL prefirmadas de subida
pnpm exec wrangler secret put R2_S3_ENDPOINT
pnpm exec wrangler secret put R2_BUCKET
pnpm exec wrangler secret put R2_ACCESS_KEY_ID
pnpm exec wrangler secret put R2_SECRET_ACCESS_KEY

# esquema de base de datos
pnpm exec wrangler d1 execute playloop --remote --file ../../packages/db/migrations/0000_init.sql

pnpm run deploy   # react-router build && wrangler deploy
```

Sustituye `REPLACE_WITH_D1_ID` y `REPLACE_WITH_KV_ID` en `apps/web/wrangler.jsonc`
antes de desplegar.

## Componentes

Para añadir componentes de shadcn/ui, ejecuta desde el root del `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Esto coloca los componentes en `packages/ui/src/components`.

```tsx
import { Button } from "@playloop/ui/components/button"
```
