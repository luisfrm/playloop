/**
 * Playloop service worker, built by `vite-plugin-pwa` (Workbox).
 *
 * Scope: offline play for the single-player practice mode only. Online and
 * cooperative games need the network by definition and are never cached.
 */
import { clientsClaim } from "workbox-core"
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { registerRoute, setCatchHandler } from "workbox-routing"
import { CacheFirst, NetworkFirst } from "workbox-strategies"

/** Replaced at build time with every shell asset (document, icons, manifest). */
const SHELL_MANIFEST = (
  self as unknown as {
    __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]
  }
).__WB_MANIFEST

/** The slice of ServiceWorkerGlobalScope this file needs. */
type WorkerScope = {
  skipWaiting(): Promise<void>
  addEventListener(
    type: "message",
    listener: (
      event: MessageEvent & { waitUntil(promise: Promise<unknown>): void }
    ) => void
  ): void
}

const worker = self as unknown as WorkerScope

/** Where the media a player explicitly downloaded is kept. */
const MEDIA_CACHE = "playloop-media"

worker.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(SHELL_MANIFEST)

// Navigations: fresh when there is a network, the shell when there is not.
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({ cacheName: "playloop-pages" })
)

// Media: cache first, so a downloaded instance keeps working with no network.
registerRoute(
  ({ request, url }) =>
    request.destination === "image" || url.pathname.startsWith("/media/"),
  new CacheFirst({ cacheName: MEDIA_CACHE })
)

// A navigation to a page that was never cached falls back to a document the
// player already has: the app routes on the client, so any shell will do.
setCatchHandler(async ({ request }) => {
  if (request.mode !== "navigate") return Response.error()
  const cache = await caches.open("playloop-pages")
  const exact = await cache.match(request.url)
  if (exact) return exact
  const [any] = await cache.keys()
  return (any && (await cache.match(any))) ?? Response.error()
})

/** The page tells us which media to keep for a downloaded instance. */
worker.addEventListener("message", (event) => {
  const message = event.data as { type?: string; urls?: unknown } | undefined
  if (message?.type !== "playloop:cache-media" || !Array.isArray(message.urls))
    return
  event.waitUntil(cacheMedia(message.urls))
})

async function cacheMedia(urls: unknown[]): Promise<void> {
  const cache = await caches.open(MEDIA_CACHE)
  await Promise.all(
    urls.map(async (url) => {
      if (typeof url !== "string") return
      try {
        await cache.add(new Request(url, { mode: "no-cors" }))
      } catch {
        // A single unreachable image must not fail the whole download.
      }
    })
  )
}
