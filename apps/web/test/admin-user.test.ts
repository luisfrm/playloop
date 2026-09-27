import { MemoryRepository } from "@playloop/db"
import { describe, expect, it } from "vitest"

import {
  ADMIN_USER_KEY,
  createAdminUser,
  hashPassword,
  readAdminUser,
  validateNewUser,
  verifyPassword,
  verifyStoredUser,
} from "@/lib/admin-user.server"

describe("password hashing", () => {
  it("accepts the right password and rejects any other", async () => {
    const stored = await hashPassword("clave-larga-123")

    await expect(verifyPassword("clave-larga-123", stored)).resolves.toBe(true)
    await expect(verifyPassword("clave-larga-124", stored)).resolves.toBe(false)
  })

  it("never stores the password in the clear", async () => {
    const stored = await hashPassword("clave-larga-123")

    expect(stored).not.toContain("clave-larga-123")
    expect(stored.startsWith("pbkdf2$sha256$")).toBe(true)
  })

  it("rejects a malformed stored value instead of throwing", async () => {
    await expect(verifyPassword("x", "vaya")).resolves.toBe(false)
  })

  it("salts, so the same password never hashes the same twice", async () => {
    expect(await hashPassword("clave-larga-123")).not.toBe(
      await hashPassword("clave-larga-123")
    )
  })
})

describe("the operator account", () => {
  it("starts empty and only ever creates the first user", async () => {
    const repository = new MemoryRepository()
    expect(await readAdminUser(repository)).toBeNull()

    const created = await createAdminUser(repository, {
      username: "operador",
      password: "clave-larga-123",
    })
    expect(created?.username).toBe("operador")

    await expect(
      createAdminUser(repository, {
        username: "otro",
        password: "clave-larga-123",
      })
    ).resolves.toBeNull()
    expect((await readAdminUser(repository))?.username).toBe("operador")
  })

  it("verifies the stored user and ignores the case of the name", async () => {
    const repository = new MemoryRepository()
    await createAdminUser(repository, {
      username: "operador",
      password: "clave-larga-123",
    })

    await expect(
      verifyStoredUser(repository, {
        username: "OPERADOR",
        password: "clave-larga-123",
      })
    ).resolves.toBe(true)
    await expect(
      verifyStoredUser(repository, {
        username: "operador",
        password: "otra-clave-123",
      })
    ).resolves.toBe(false)
    await expect(
      verifyStoredUser(repository, {
        username: "ajeno",
        password: "clave-larga-123",
      })
    ).resolves.toBe(false)
  })

  it("treats anything unexpected under the key as no user at all", async () => {
    const repository = new MemoryRepository()
    await repository.saveSetting(ADMIN_USER_KEY, { vaya: true })

    expect(await readAdminUser(repository)).toBeNull()
  })
})

describe("validating a new user", () => {
  const valid = {
    username: "operador",
    password: "clave-larga-123",
    repeat: "clave-larga-123",
  }

  it("accepts a sane pair", () => {
    expect(validateNewUser(valid)).toBeNull()
  })

  it("names what is wrong with the rest", () => {
    expect(validateNewUser({ ...valid, username: "ab" })).toMatch(/usuario/i)
    expect(validateNewUser({ ...valid, username: "dos palabras" })).toMatch(
      /letras/i
    )
    expect(
      validateNewUser({ ...valid, password: "corta", repeat: "corta" })
    ).toMatch(/contraseña/i)
    expect(validateNewUser({ ...valid, repeat: "otra-clave-123" })).toMatch(
      /coinciden/i
    )
  })
})
