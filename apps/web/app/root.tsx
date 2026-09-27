import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"

import { useEffect } from "react"

import { registerServiceWorker } from "@/lib/offline"

import type { Route } from "./+types/root"
import "@playloop/ui/globals.css"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#f7f2e7" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Vaya"
  let details = "Ha ocurrido un error inesperado."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    // Loaders throw their own Spanish message; showing it beats a generic page.
    const payload = error.data as { message?: string } | undefined
    const loaderMessage =
      typeof payload?.message === "string" && payload.message.length > 0
        ? payload.message
        : null
    message = error.status === 404 ? "404" : `Error ${error.status}`
    details =
      loaderMessage ??
      (error.status === 404
        ? "No encontramos esa página."
        : error.statusText || details)
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 px-6 py-24">
      <h1 className="font-heading text-3xl font-bold">{message}</h1>
      <p className="text-sm text-muted-foreground">{details}</p>
      {stack ? (
        <pre className="w-full overflow-x-auto rounded-[var(--radius-md)] border p-4 text-xs">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  )
}
