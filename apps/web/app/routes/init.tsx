import { Button } from "@playloop/ui/components/button"
import { Input } from "@playloop/ui/components/input"
import { Logo } from "@playloop/ui/components/logo"
import { data, Form, redirect, useActionData } from "react-router"

import { PasswordInput } from "@/components/password-input"

import {
  LOGIN_PATH,
  adminConfigFromEnv,
  adminCookieForRequest,
  createAdminToken,
} from "@/lib/admin-auth.server"
import {
  createAdminUser,
  readAdminUser,
  validateNewUser,
} from "@/lib/admin-user.server"
import { getEnv, getRepository } from "@/lib/repository.server"

import type { Route } from "./+types/init"

/**
 * First-run door: the only moment the panel lets someone mint the operator
 * account. Once one exists this route is out of the way for good.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const repository = await getRepository(context)
  if (await readAdminUser(repository)) throw redirect(LOGIN_PATH)
  return null
}

export async function action({ request, context }: Route.ActionArgs) {
  const repository = await getRepository(context)

  if (await readAdminUser(repository)) {
    return data({ error: "El panel ya tiene usuario." }, { status: 409 })
  }

  const form = await request.formData()
  const username = String(form.get("username") ?? "")
  const password = String(form.get("password") ?? "")
  const repeat = String(form.get("repeat") ?? "")

  const problem = validateNewUser({ username, password, repeat })
  if (problem) return data({ error: problem }, { status: 400 })

  const user = await createAdminUser(repository, { username, password })
  if (!user) {
    return data({ error: "El panel ya tiene usuario." }, { status: 409 })
  }

  return redirect("/admin", {
    headers: {
      "Set-Cookie": adminCookieForRequest(
        await createAdminToken(adminConfigFromEnv(getEnv(context))),
        request
      ),
    },
  })
}

export default function Init() {
  const result = useActionData<typeof action>()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo as="p" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Primer arranque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea el usuario del panel. Solo se puede hacer una vez.
          </p>
        </div>
      </header>

      <Form method="post" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="username">
            Usuario
          </label>
          <Input
            id="username"
            name="username"
            size="lg"
            autoComplete="username"
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
            autoComplete="new-password"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="repeat">
            Repite la contraseña
          </label>
          <PasswordInput
            id="repeat"
            name="repeat"
            size="lg"
            autoComplete="new-password"
            required
          />
        </div>

        {result?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        ) : null}

        <Button type="submit" size="lg">
          Crear usuario
        </Button>
      </Form>
    </main>
  )
}
