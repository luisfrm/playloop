import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import { Logo } from "@playloop/ui/components/logo"
import { TriangleAlert } from "lucide-react"
import {
  Form,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
} from "react-router"

import { PasswordInput } from "@/components/password-input"

import {
  LOGIN_PATH,
  adminConfigFromEnv,
  adminCookieForRequest,
  checkAdminPassword,
  clearAdminCookie,
  createAdminToken,
  isAdmin,
} from "@/lib/admin-auth.server"
import { readAdminUser, verifyStoredUser } from "@/lib/admin-user.server"
import { getEnv, getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/admin-login"

/** Only ever bounce back into the panel, never to an attacker-supplied host. */
function safeRedirectTo(value: string | null | undefined): string {
  const target = (value ?? "").trim()
  return target.startsWith("/admin") && !target.startsWith("//")
    ? target
    : "/admin"
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const config = adminConfigFromEnv(getEnv(context))

  if (await isAdmin(context, request)) {
    throw redirect(
      safeRedirectTo(new URL(request.url).searchParams.get("redirectTo"))
    )
  }

  const user = await readAdminUser(await getRepository(context))
  if (!user) throw redirect("/init")
  return {
    usingDevDefaults: config.usingDevDefaults,
    username: user.username,
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const config = adminConfigFromEnv(getEnv(context))
  const form = await request.formData()

  if (form.get("intent") === "logout") {
    return redirect(LOGIN_PATH, {
      headers: { "Set-Cookie": clearAdminCookie() },
    })
  }

  const username = String(form.get("username") ?? "")
  const password = String(form.get("password") ?? "")

  // The stored user first; `ADMIN_PASSWORD` stays valid as the master
  // credential, which is also the way in before `/init` has ever run.
  const known = await verifyStoredUser(await getRepository(context), {
    username,
    password,
  })
  if (!known && !(await checkAdminPassword(config, password))) {
    return data({ error: "Usuario o contraseña incorrectos." }, { status: 401 })
  }

  return redirect(safeRedirectTo(String(form.get("redirectTo") ?? "")), {
    headers: {
      "Set-Cookie": adminCookieForRequest(
        await createAdminToken(config),
        request
      ),
    },
  })
}
export default function AdminLogin() {
  const { usingDevDefaults, username } = useLoaderData<typeof loader>()
  const result = useActionData<typeof action>()
  const location = useLocation()
  const redirectTo =
    new URLSearchParams(location.search).get("redirectTo") ?? ""

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo as="p" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo el equipo entra aquí.
          </p>
        </div>
      </header>

      {usingDevDefaults ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-dashed bg-card p-4 text-xs text-muted-foreground">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          Estás usando la contraseña de desarrollo. Antes de publicar, define{" "}
          <code className="font-mono">ADMIN_PASSWORD</code> y{" "}
          <code className="font-mono">ADMIN_SESSION_SECRET</code> con{" "}
          <code className="font-mono">wrangler secret put</code>.
        </p>
      ) : null}

      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="username">
            Usuario
          </label>
          <Input
            id="username"
            name="username"
            size="lg"
            autoComplete="username"
            defaultValue={username}
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="password">
            Contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            size="lg"
            autoComplete="current-password"
            required
          />
        </div>

        {result?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        ) : null}

        <Button type="submit" size="lg">
          Entrar
        </Button>
      </Form>
    </main>
  )
}
