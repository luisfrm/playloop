import { useSyncExternalStore } from "react"

/**
 * Player identity lives in the client, never in KV. It is a stable id plus a
 * display name today; when real accounts exist they will point at the same id,
 * so this shape does not change.
 */
export type PlayerProfile = {
  id: string
  name: string
}

const STORAGE_KEY = "playloop.player"

let current: PlayerProfile | null = null
let hydrated = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function isProfile(value: unknown): value is PlayerProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PlayerProfile).id === "string" &&
    typeof (value as PlayerProfile).name === "string"
  )
}

export function readPlayer(): PlayerProfile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isProfile(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writePlayer(profile: PlayerProfile): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Storage can be unavailable (private mode). The session still works.
  }
}

export function newPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID()
  return `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function savePlayerName(name: string): PlayerProfile {
  const profile: PlayerProfile = { id: current?.id ?? newPlayerId(), name }
  current = profile
  writePlayer(profile)
  emit()
  return profile
}

export function subscribeToPlayer(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPlayerSnapshot(): PlayerProfile | null {
  return current
}

/** Called from an effect so the server render never touches localStorage. */
export function hydratePlayer(): void {
  if (hydrated) return
  hydrated = true
  current = readPlayer()
  if (current) emit()
}

export function usePlayer(): PlayerProfile | null {
  return useSyncExternalStore(subscribeToPlayer, getPlayerSnapshot, () => null)
}

export type NameError = "empty" | "too_short" | "too_long"

/** Client-side shape check only. The authoritative filter runs server-side. */
export function validatePlayerName(
  raw: string,
  maxLength = 24
): NameError | null {
  const name = raw.trim()
  if (name.length === 0) return "empty"
  if (name.length < 2) return "too_short"
  if (name.length > maxLength) return "too_long"
  return null
}
