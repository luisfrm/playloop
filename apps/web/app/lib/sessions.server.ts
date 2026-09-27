import type { DictionaryEntry, SessionState } from "@playloop/game-engine"
import type { RouterContextProvider } from "react-router"

import { cloudflareContext } from "./cloudflare-context"

/**
 * Server-side session records. The client only ever holds an opaque session id;
 * the prompt, the options and the score all live here. That is what makes the
 * "the client never decides if it was right" rule enforceable.
 */
export type StoredSession = {
  id: string
  instanceId: string
  slug: string
  playerId: string
  /** Validated with the instance's game type settings schema before storing. */
  settings: unknown
  answerMode: "classic" | "expert"
  state: SessionState
  /** The answer. Never serialised to the client. */
  promptId: string
  optionIds: string[]
  askedIds: string[]
  bestStreak: number
  dictionary: DictionaryEntry[]
  expiresAt: number
  /**
   * True between an answer and the moment the next round is served: the round
   * parts still point at the answered prompt, so nothing can resolve it twice
   * and no clock is running for a round the player cannot see yet.
   */
  awaitingNext?: boolean
  /**
   * Set the first time the session's score reaches the ranking. A resent
   * answer on an already-finished session must not write a second score row.
   */
  recordedAt?: number
}

export interface SessionStore {
  get(id: string): Promise<StoredSession | null>
  put(session: StoredSession): Promise<void>
  delete(id: string): Promise<void>
  /**
   * Record one attempt for `key` and return how many fall inside the window,
   * this call included. Used to throttle abusive clients, never to score.
   */
  countRecent(key: string, windowMs: number): Promise<number>
}

/** Dev/test store. A single process, so it needs no serialisation. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>()
  private readonly counters = new Map<string, number[]>()

  async get(id: string): Promise<StoredSession | null> {
    const session = this.sessions.get(id)
    if (!session) return null
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(id)
      return null
    }
    return session
  }

  async put(session: StoredSession): Promise<void> {
    this.sessions.set(session.id, session)
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id)
  }

  async countRecent(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const recent = (this.counters.get(key) ?? []).filter(
      (at) => now - at < windowMs
    )
    recent.push(now)
    this.counters.set(key, recent)
    return recent.length
  }
}

type KvNamespaceLike = {
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>
  delete(key: string): Promise<void>
}

/** Cloudflare KV store. Server-only cache, never exposed to the browser. */
export class KvSessionStore implements SessionStore {
  constructor(private readonly kv: KvNamespaceLike) {}

  async get(id: string): Promise<StoredSession | null> {
    const raw = await this.kv.get(`session:${id}`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as StoredSession
    } catch {
      return null
    }
  }

  async put(session: StoredSession): Promise<void> {
    const ttl = Math.max(
      60,
      Math.floor((session.expiresAt - Date.now()) / 1000) + 60
    )
    await this.kv.put(`session:${session.id}`, JSON.stringify(session), {
      expirationTtl: ttl,
    })
  }

  async delete(id: string): Promise<void> {
    await this.kv.delete(`session:${id}`)
  }

  /**
   * KV has no atomic increment, so the window is best-effort: a burst of
   * concurrent requests can slip past by a few. It exists to stop scripts, not
   * to be a precise quota.
   */
  async countRecent(key: string, windowMs: number): Promise<number> {
    const storageKey = `throttle:${key}`
    const raw = await this.kv.get(storageKey)
    const parsed = raw ? Number.parseInt(raw, 10) : 0
    const next = Number.isFinite(parsed) ? parsed + 1 : 1
    await this.kv.put(storageKey, String(next), {
      expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)),
    })
    return next
  }
}

export const SESSION_TTL_MS = 30 * 60 * 1000

let fallbackStore: SessionStore | null = null

export function getSessionStore(context?: unknown): SessionStore {
  const cache = context
    ? (context as Readonly<RouterContextProvider>).get(cloudflareContext).env
        .CACHE
    : undefined
  if (cache) return new KvSessionStore(cache as KvNamespaceLike)
  fallbackStore ??= new MemorySessionStore()
  return fallbackStore
}
