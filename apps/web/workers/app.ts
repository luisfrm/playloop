import {
  createRequestHandler,
  RouterContextProvider,
  type ServerBuild,
} from "react-router"

import { cloudflareContext } from "../app/lib/cloudflare-context"
import { handleRoomRequest } from "../app/lib/coop.server"
import type { Env } from "./env"

export type { Env }

// The Cloudflare Vite plugin exposes the server build as a virtual module; the
// cast only reconciles its module-namespace shape with React Router's contract.
const requestHandler = createRequestHandler(
  () =>
    import("virtual:react-router/server-build") as unknown as Promise<ServerBuild>,
  import.meta.env.MODE
)

/**
 * Worker entry.
 *
 * Static assets are served by Cloudflare's asset layer before this handler runs,
 * so `/icon.svg`, `/manifest.webmanifest` and `/service-worker.js` never reach
 * React Router. Everything else is SSR, with the bindings handed to loaders and
 * actions through the load context.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Cooperative rooms need a WebSocket upgrade, which a React Router route
    // cannot perform, so they are answered here and never reach SSR.
    const room = await handleRoomRequest(request, env)
    if (room) return room

    const context = new RouterContextProvider()
    context.set(cloudflareContext, { env, ctx })
    return requestHandler(request, context)
  },
} satisfies ExportedHandler<Env>

/**
 * The Durable Object class must be exported from the Worker entry for the
 * `ROOMS` binding to resolve. One room per code, addressed with
 * `env.ROOMS.getByName(code)`.
 */
export { RoomDurableObject } from "./room-do"
