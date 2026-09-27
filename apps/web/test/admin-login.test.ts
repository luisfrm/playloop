import { describe, expect, it } from "vitest"

import { createAdminUser } from "@/lib/admin-user.server"
import { getRepository } from "@/lib/repository.server"
import { loader } from "@/routes/admin-login"

function loginArgs() {
  return {
    request: new Request("http://localhost/admin/login"),
    context: undefined,
    params: {},
  } as unknown as Parameters<typeof loader>[0]
}

async function redirectOf(promise: Promise<unknown>): Promise<Response> {
  try {
    await promise
  } catch (thrown) {
    expect(thrown).toBeInstanceOf(Response)
    return thrown as Response
  }
  throw new Error("el loader no redirigio")
}

describe("admin login entry", () => {
  it("sends a visitor with no operator to /init", async () => {
    const response = await redirectOf(loader(loginArgs()))
    expect(response.headers.get("Location")).toBe("/init")
  })

  it("stays on login and suggests the stored username once there is one", async () => {
    await createAdminUser(await getRepository(undefined), {
      username: "operador",
      password: "clave-larga-123",
    })

    const data = await loader(loginArgs())
    expect(data).toMatchObject({ username: "operador" })
  })
})
