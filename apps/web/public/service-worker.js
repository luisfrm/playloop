/* Playloop service worker.
 * Scope: offline play for the single-player practice mode only. Online and
 * cooperative games need the network by definition and are never cached.
 */

const VERSION = "playloop-v1"
const SHELL_CACHE = `${VERSION}-shell`
const MEDIA_CACHE = `${VERSION}-media`
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

/** The page tells us which media to keep for a downloaded instance. */
self.addEventListener("message", (event) => {
  const message = event.data
  if (
    !message ||
    message.type !== "playloop:cache-media" ||
    !Array.isArray(message.urls)
  )
    return

  event.waitUntil(
    caches.open(MEDIA_CACHE).then(async (cache) => {
      await Promise.all(
        message.urls.map(async (url) => {
          if (typeof url !== "string") return
          try {
            await cache.add(new Request(url, { mode: "no-cors" }))
          } catch {
            // A single unreachable image must not fail the whole download.
          }
        })
      )
    })
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE)
        return (await cache.match("/")) ?? Response.error()
      })
    )
    return
  }

  // Media: cache first, so a downloaded instance keeps working with no network.
  if (request.destination === "image" || url.pathname.startsWith("/media/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request)
            .then((response) => {
              const copy = response.clone()
              void caches
                .open(MEDIA_CACHE)
                .then((cache) => cache.put(request, copy))
              return response
            })
            .catch(() => Response.error())
      )
    )
  }
})
