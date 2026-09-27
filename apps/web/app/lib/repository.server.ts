import {
  D1Repository,
  MemoryRepository,
  seedDemoInstance,
  type ContentRepository,
} from "@playloop/db"
import type { RouterContextProvider } from "react-router"

import { cloudflareContext, type CloudflareEnv } from "./cloudflare-context"

export type { CloudflareEnv }

let fallback: Promise<ContentRepository> | null = null

/** Read the Worker bindings a loader or action was given, if any. */
function readEnv(context?: unknown): CloudflareEnv {
  if (!context) return {}
  return (context as Readonly<RouterContextProvider>).get(cloudflareContext).env
}

/**
 * D1 when the binding is present; a seeded in-memory store otherwise, so
 * `pnpm dev` needs no setup.
 *
 * Takes the bindings directly rather than a load context because it is also
 * called outside React Router: the room API runs in the Worker entry, which has
 * `env` but no load context.
 */
export function repositoryFromEnv(
  env: CloudflareEnv
): Promise<ContentRepository> {
  if (env.DB) return Promise.resolve(new D1Repository(env.DB as never))

  fallback ??= (async () => {
    const repository = new MemoryRepository()
    await seedDemoInstance(repository)
    return repository
  })()

  return fallback
}

/** One accessor for every loader and action. */
export function getRepository(context?: unknown): Promise<ContentRepository> {
  return repositoryFromEnv(readEnv(context))
}

export function getEnv(context?: unknown): CloudflareEnv {
  return readEnv(context)
}
