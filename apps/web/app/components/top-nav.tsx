import { Logo } from "@playloop/ui/components/logo"
import { Link, NavLink } from "react-router"

import { PlayerMenu } from "@/components/player-menu"

const LINKS = [
  { to: "/", label: "Catálogo" },
  { to: "/ranking", label: "Ranking" },
  { to: "/admin", label: "Panel" },
]

/**
 * N1b · canonical three-section nav: wordmark left, centred link cluster,
 * player control right. Ported from the previous N9 edge-aligned bar now that
 * the home has real destinations.
 */
export function TopNav() {
  return (
    <header
      data-slot="top-nav"
      className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur"
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-16 w-full max-w-[var(--shell,80rem)] items-center gap-4 px-[clamp(1rem,4vw,1.5rem)]"
      >
        <Link
          to="/"
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Logo size="sm" as="p" />
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  [
                    "inline-block rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground",
                  ].join(" ")
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div
          data-slot="top-nav-actions"
          className="ml-auto flex items-center gap-2 md:ml-0"
        >
          <PlayerMenu />
        </div>
      </nav>
    </header>
  )
}
