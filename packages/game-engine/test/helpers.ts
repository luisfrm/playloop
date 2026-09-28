import type { ContentItem } from "../src/content.js"
import type { TrueFalseContent } from "../src/play/types/true-false.js"

export function item(
  id: string,
  payload: Partial<TrueFalseContent> = {}
): ContentItem<TrueFalseContent> {
  return {
    id,
    gameInstanceId: "inst",
    position: Number(id.replace(/\D/g, "")) || 0,
    payload: {
      label: `Elemento ${id}`,
      mediaUrl: `https://example.invalid/${id}.png`,
      isTrue: true,
      ...payload,
    },
  }
}

/** Deterministic PRNG (mulberry32) so rounds are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
