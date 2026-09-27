import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import { registerSW } from "virtual:pwa-register"

/**
 * Offline storage for one downloaded game instance.
 *
 * Trade-off, accepted deliberately: to run with no network the client must hold
 * the correct answer locally. That is why offline sessions resolve as
 * `practice` mode and never reach the public ranking.
 */

export type OfflineInstance = {
  /** Kept so the local session can be built with the same instance identity. */
  instanceId: string
  slug: string
  title: string
  description: string
  gameTypeKey: string
  settings: unknown
  content: { id: string; payload: unknown }[]
  dictionary: {
    id: string
    gameInstanceId: string
    value: string
    aliases: string[]
  }[]
  mediaUrls: string[]
  downloadedAt: number
}

const DB_NAME = "playloop"
const DB_VERSION = 1
const STORE = "instances"

interface OfflineDatabase extends DBSchema {
  instances: { key: string; value: OfflineInstance }
}

let database: Promise<IDBPDatabase<OfflineDatabase>> | null = null

/** Opened on demand, so importing this module never touches the browser API. */
function openDatabase(): Promise<IDBPDatabase<OfflineDatabase>> {
  database ??= openDB<OfflineDatabase>(DB_NAME, DB_VERSION, {
    upgrade(instance) {
      if (!instance.objectStoreNames.contains(STORE)) {
        instance.createObjectStore(STORE, { keyPath: "slug" })
      }
    },
  })
  return database
}

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}

export async function saveOfflineInstance(
  instance: OfflineInstance
): Promise<void> {
  if (!isOfflineStorageAvailable()) return
  await (await openDatabase()).put(STORE, instance)
  await askServiceWorkerToCache(instance.mediaUrls)
}

export async function loadOfflineInstance(
  slug: string
): Promise<OfflineInstance | null> {
  if (!isOfflineStorageAvailable()) return null
  return (await (await openDatabase()).get(STORE, slug)) ?? null
}

export async function removeOfflineInstance(slug: string): Promise<void> {
  if (!isOfflineStorageAvailable()) return
  await (await openDatabase()).delete(STORE, slug)
}

export async function listOfflineInstances(): Promise<OfflineInstance[]> {
  if (!isOfflineStorageAvailable()) return []
  return (await openDatabase()).getAll(STORE)
}

/** Best effort: without a controlling worker the media simply is not precached. */
async function askServiceWorkerToCache(urls: string[]): Promise<void> {
  if (urls.length === 0 || typeof navigator === "undefined") return
  const registration = await navigator.serviceWorker?.getRegistration()
  registration?.active?.postMessage({ type: "playloop:cache-media", urls })
}

/**
 * The worker itself is built by `vite-plugin-pwa`. `autoUpdate` means a new
 * build takes over on the next visit without asking the player anything.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return
  if (import.meta.env.DEV) return
  registerSW({ immediate: true })
}
