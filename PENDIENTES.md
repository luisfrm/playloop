# Pendientes

Lista de lo que falta por completar. Revisada el 2026-09-27 con
`pnpm typecheck` (ok), `pnpm lint` (0 errores), `pnpm test` (232 pasos) y
`pnpm --filter web test:e2e` (22 pasos, 0 fallos).

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

- [x] **2. Unit: `apps/web/test/admin-auth.test.ts`.** El matcher
  `rejects.toMatchObject({ headers: { Location } })` no matchea contra una
  instancia `Headers` (el redirect funciona bien; fallaba la aserción).
  Arreglado con un helper `redirectFrom` que atrapa la `Response` y afirma
  sobre `status` y `headers.get("Location")`.
- [x] **3. E2E: `e2e/panel-auth.spec.ts` ("wrong password").** Usaba
  `submit()`, que exige status < 400, pero la acción responde 401 a
  propósito con la contraseña errónea: el test nunca podía pasar.
  `submit()` acepta ahora el status esperado y el test pide 401.
- [x] **4. E2E: throttle de login.** `MAX_LOGIN_ATTEMPTS = 8` por 10 min
  por IP hacía que los ~15 logins del suite compartieran 429 en cascada
  (9 de los 10 fallos; el décimo era el 3). Quitado: la spec no lo pide y
  el único respaldo del límite era el comentario del código.
- [x] **5. E2E en verde.** `pnpm --filter web test:e2e` da 20/20. Además
  `play.spec.ts` elegía la opción errónea de la lista completa de ítems,
  cuando una ronda solo ofrece los que aún no se han preguntado
  (`nextRound` filtra `askedIds`): esperaba un botón que no estaba en
  pantalla y, mientras tanto, la ronda expiraba. La opción equivocada se
  elige ahora de los botones visibles.

## Especificación (`INITIAL_PROMPT_IMPROVED.md`)

- [x] **6. §14 — ESLint.** Nuevo `eslint.config.mjs` (flat, raíz) con
  `typescript-eslint` sin reglas con tipos, `eslint-config-prettier` y
  `complexity` máximo 15 por función; vetado `react-icons`. Script raíz
  `pnpm lint`. Para cumplirla se partieron `api-play` y `admin-instance`
  (handlers en `app/lib/admin-instance-save.server.ts`) y `play`/`sala`
  (subcomponentes `PlayStage`/`FeedbackStage`, `RoomNotice`/`RoomSection`).
- [x] **7. §13 — Popup de nombre en el Home.** Si no hay nombre en cache el
  Home abre un diálogo como primer elemento visible, que se cierra con
  Escape, con la X o con el fondo y vuelve a aparecer en la próxima visita
  hasta que se guarda un nombre. El disclosure del TopNav sigue ahí para
  editarlo después. Cubierto con tests unitarios y e2e.
- [ ] **8. §12 — Sección "Configuración" del panel.** La tabla
  `app_setting` existe pero nadie la lee ni la escribe; no hay ruta.
- [x] **9. §5 — Importación de diccionario por archivo CSV.** Solo había un
  textarea; `parseDictionaryText` ya soportaba el formato. Añadido
  `components/dictionary-import.tsx`: el archivo se copia al cuadro para
  revisarlo y se guarda por el mismo camino de siempre. Cubierto con test
  unitario y con un e2e que comprueba la entrada en D1 tras recargar.
- [ ] **10. §2/§7 — PWA.** La spec pide `vite-plugin-pwa` + `idb`; hay un
  service worker artesanal (`apps/web/public/service-worker.js`) e
  IndexedDB cruda. Funciona: decidir si se migra o se documenta la
  desviación.

## Infraestructura y repo

- [ ] **11. Despliegue.** `apps/web/wrangler.jsonc` con placeholders
  `REPLACE_WITH_D1_ID` / `REPLACE_WITH_KV_ID`; faltan los secrets
  (`R2_*`, `ADMIN_*`).
- [x] **12. `apps/web/Dockerfile`.** Usaba `npm ci` y `npm run start` en un
  repo pnpm (no hay `package-lock.json` ni script `start`) y su artefacto
  era un bundle de Workers, que no arranca en Node. Eliminado junto a
  `.dockerignore`: la spec despliega con `wrangler deploy` (ver 11).
- [x] **13. Tests de `packages/ui`.** El paquete no tenía tests ni script
  `test`. Añadidos `vitest.config.ts` (jsdom, alias `@playloop/ui`) y cinco
  suites (`badge`, `button`, `card`, `input`, `logo`, 15 pasos) que cubren
  variantes, slots y el `render` de base-ui.
- [x] **14. `DESIGN.md` vs `globals.css`.** `DESIGN.md` reescrito sobre el tema
  Volt real: oklch, escala de radios por rol y fuentes Outfit/Geist/JetBrains
  Mono. De paso, `globals.css` declaraba familias que no importaba y le
  faltaban los tokens de acento que ya usaban `Badge`, `game-card` y
  `character-mark` (`--accent-2`, `--accent-3`, `--mint`, `--lavender`), así que
  no pintaban: definidos en `:root`, `.dark` y `@theme`.
