import { Logo } from "@playloop/ui/components/logo"
import { LayoutGrid, LogOut, Settings, Shield, Sparkles } from "lucide-react"
import { Form, NavLink, Outlet } from "react-router"

import { requireAdmin } from "@/lib/admin-auth.server"

import type { Route } from "./+types/admin-layout"

/**
 * Guards every panel route at once. Child actions guard themselves, because an
 * action runs on its own when a form is submitted.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  await requireAdmin(request, context)
  return null
}

const SECTIONS = [
  { to: "/admin", label: "Juegos", icon: LayoutGrid, end: true },
  {
    to: "/admin/moderation",
    label: "Ranking y moderación",
    icon: Shield,
    end: false,
  },
  {
    to: "/admin/settings",
    label: "Configuración",
    icon: Settings,
    end: false,
  },
]

/**
 * Admin shell. The sidebar is a real list of links, not a disclosure widget —
 * there are four destinations in total, so hiding them would cost more than it
 * saves.
 */
export default function AdminLayout() {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="border-b bg-sidebar text-sidebar-foreground lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo size="sm" as="p" />
          <span className="font-label text-[11px] tracking-[0.1em] uppercase">
            Panel
          </span>
        </div>

        <nav aria-label="Panel" className="px-3 pb-5">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                      "hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground",
                    ].join(" ")
                  }
                >
                  <section.icon aria-hidden="true" className="size-4" />
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Form method="post" action="/admin/login" className="px-3 pb-5">
          <input type="hidden" name="intent" value="logout" />
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Salir
          </button>
        </Form>

        <p className="hidden items-start gap-2 px-5 pb-5 text-xs text-muted-foreground lg:flex">
          <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          El contenido es data. El motor no sabe de qué trata ningún juego.
        </p>
      </aside>

      <main className="min-w-0 flex-1 px-[clamp(1rem,3vw,2rem)] py-8">
        <Outlet />
      </main>
    </div>
  )
}
