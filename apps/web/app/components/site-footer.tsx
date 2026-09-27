const WORDS = ["PLAYLOOP", "JUEGA EN LOOP", "SIN REGISTRO", "RANKING POR JUEGO"]

/** Ft8 · marquee scroll. Transform-only, and the global reduced-motion rule
 * collapses it to a static line. */
export function SiteFooter() {
  const track = [...WORDS, ...WORDS]

  return (
    <footer data-slot="site-footer" className="mt-16 border-t bg-secondary/50">
      <div className="overflow-hidden py-5">
        <div className="flex w-max animate-[playloop-marquee_32s_linear_infinite] items-center gap-6 font-label text-xs tracking-[0.14em] uppercase">
          {track.map((word, index) => (
            <span key={`${word}-${index}`} className="flex items-center gap-6">
              {word}
              <span aria-hidden="true">·</span>
            </span>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-[var(--shell,80rem)] flex-wrap items-center justify-between gap-2 px-[clamp(1rem,4vw,1.5rem)] pb-6 text-xs text-muted-foreground">
        <span>Playloop · el motor de juegos</span>
        <span>Contenido cargado desde el panel, nunca desde el código</span>
      </div>
    </footer>
  )
}
