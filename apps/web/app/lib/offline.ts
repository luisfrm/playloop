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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "slug" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = run(transaction.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}

export async function saveOfflineInstance(
  instance: OfflineInstance
): Promise<void> {
  if (!isOfflineStorageAvailable()) return
  await withStore(
    "readwrite",
    (store) => store.put(instance) as IDBRequest<IDBValidKey>
  )
  await askServiceWorkerToCache(instance.mediaUrls)
}

export async function loadOfflineInstance(
  slug: string
): Promise<OfflineInstance | null> {
  if (!isOfflineStorageAvailable()) return null
  const found = await withStore<OfflineInstance | undefined>(
    "readonly",
    (store) => store.get(slug) as IDBRequest<OfflineInstance | undefined>
  )
  return found ?? null
}

export async function removeOfflineInstance(slug: string): Promise<void> {
  if (!isOfflineStorageAvailable()) return
  await withStore(
    "readwrite",
    (store) => store.delete(slug) as IDBRequest<undefined>
  )
}

export async function listOfflineInstances(): Promise<OfflineInstance[]> {
  if (!isOfflineStorageAvailable()) return []
  return withStore<OfflineInstance[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<OfflineInstance[]>
  )
}

/** Best effort: without a controlling worker the media simply is not precached. */
async function askServiceWorkerToCache(urls: string[]): Promise<void> {
  if (urls.length === 0 || typeof navigator === "undefined") return
  const registration = await navigator.serviceWorker?.getRegistration()
  registration?.active?.postMessage({ type: "playloop:cache-media", urls })
}

export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return
  if (import.meta.env.DEV) return
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js")
  })
}
