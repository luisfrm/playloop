# Pendientes

Lista de lo que falta por completar. Revisada el 2026-09-27 con
`pnpm typecheck` (ok), `pnpm test` (2 fallos, ver 2) y
`pnpm --filter web test:e2e` (10 fallos / 10 pasos: ver 3 y 4).

## Bug de producto

- [x] **1. No se podían guardar los ajustes de una instancia.** `SchemaForm`
  solo renderizaba su botón de envío si recibía `onSubmit`
  (`apps/web/app/components/schema-form.tsx`), y en
  `apps/web/app/routes/admin-instance.tsx` no se pasaba: el botón
  "Guardar ajustes" no existía en el DOM, así que "Publicado" y "Modo
  experto" no se podían guardar. Además `SchemaForm` dibujaba un `<form>`
  anidado dentro del `<Form>` de React Router, lo que impedía el envío.
  Reproducido en e2e (`e2e/helpers.ts` → `publishGame`).
- Correcciones que hizo falta encadenar para que el flujo de juego cuadre:
  `workers/room-do.ts` avanza de ronda cuando todos responden (antes
  terminaba la sala), `app/routes/sala.tsx` acepta `already_joined` al
  recargar (el creador ya es miembro), `app/root.tsx` muestra el mensaje
  del loader en el `ErrorBoundary` y `e2e/coop.spec.ts` comprueba la ronda
  en las dos pantallas.

## Tests

- [ ] **2. Unit: `apps/web/test/admin-auth.test.ts:147,158`.** El matcher
  `rejects.toMatchObject({ headers: { Location } })` no matchea contra una
  instancia `Headers` (el redirect funciona bien; falla la aserción).
- [ ] **3. E2E: `e2e/panel-auth.spec.ts` ("wrong password").** Usa
  `submit()`, que exige status < 400, pero la acción responde 401 a
  propósito con la contraseña errónea: el test nunca puede pasar.
- [ ] **4. E2E: throttle de login.** `MAX_LOGIN_ATTEMPTS = 8` por 10 min
  por IP (`app/lib/admin-auth.server.ts:20`) y el suite completo hace ~15
  logins desde la misma IP → 429 en cascada (9 de los 10 fallos actuales;
  el décimo es el 3).
- [ ] **5. E2E en verde.** Dejar `pnpm --filter web test:e2e` en 0 fallos
  una vez resueltos 1, 3 y 4.

## Especificación (`INITIAL_PROMPT_IMPROVED.md`)

- [ ] **6. §14 — ESLint.** No existe ni script `lint`; falta la regla
  `complexity` máximo 15 por función.
- [ ] **7. §13 — Popup de nombre en el Home.** Si no hay nombre en cache
  debería mostrarse como primer elemento visible; hoy solo está el
  disclosure del TopNav y hay que clicar.
- [ ] **8. §12 — Sección "Configuración" del panel.** La tabla
  `app_setting` existe pero nadie la lee ni la escribe; no hay ruta.
- [ ] **9. §5 — Importación de diccionario por archivo CSV.** Solo hay un
  textarea; `parseDictionaryText` ya soporta el formato, falta el
  `<input type="file">`.
- [ ] **10. §2/§7 — PWA.** La spec pide `vite-plugin-pwa` + `idb`; hay un
  service worker artesanal (`apps/web/public/service-worker.js`) e
  IndexedDB cruda. Funciona: decidir si se migra o se documenta la
  desviación.

## Infraestructura y repo

- [ ] **11. Despliegue.** `apps/web/wrangler.jsonc` con placeholders
  `REPLACE_WITH_D1_ID` / `REPLACE_WITH_KV_ID`; faltan los secrets
  (`R2_*`, `ADMIN_*`).
- [ ] **12. `apps/web/Dockerfile`.** Usa `npm ci` y `npm run start` en un
  repo pnpm, y el script `start` no existe.
- [ ] **13. Tests de `packages/ui`.** El paquete no tiene tests ni script
  `test`.
- [ ] **14. `DESIGN.md` vs `globals.css`.** Divergen en formato de tokens
  (HSL vs oklch), tipografías (Inter/Space Grotesk vs Outfit/Geist) y
  radios de botón (`rounded-full` vs `rounded-lg`).
