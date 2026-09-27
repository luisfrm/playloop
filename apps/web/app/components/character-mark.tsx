/**
 * Hum's character moment — one small mark per page that reacts to the pointer,
 * built entirely in CSS. No image, no Lottie, no animation library. The pulse
 * stops under `prefers-reduced-motion: reduce` via the global override.
 */
export function CharacterMark({ className }: { className?: string }) {
  return (
    <span
      data-slot="character-mark"
      aria-hidden="true"
      className={[
        "bg-accent-3 inline-block size-3 rounded-full",
        "animate-[playloop-pulse_4s_ease-in-out_infinite]",
        "transition-transform duration-200 ease-[var(--ease-spring)]",
        "peer-hover/mark:scale-125",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  )
}
