# Motor de juegos multi-tema — Especificación técnica final

## 1. Objetivo

Construir un **motor de juegos genérico**. El sistema debe permitir crear temas de contenido nuevos por completo desde el panel de administración — sin tocar código ni hacer un despliegue nuevo — sobre un conjunto de **tipos de juego** reutilizables.

**Regla de diseño no negociable**: en el modelo de datos, en el panel y en el código, no debe existir ningún nombre de campo, tabla, variable, ruta o componente que asuma un dominio de contenido específico. Todo debe nombrarse de forma abstracta (`item`, `label`, `theme`, `content`, `dictionary`, etc.), nunca con el nombre de una categoría concreta. El primer tema real se cargará como **datos**, después de que el sistema esté construido — el código no debe saber ni necesitar saber cuál es.

---

## 2. Stack técnico

- React Router v8 (framework mode, Vite plugin oficial de Cloudflare, SSR)
- TypeScript
- TailwindCSS (variables centralizadas para theming)
- Drizzle ORM
- Cloudflare D1 (datos relacionales)
- Cloudflare R2 (imágenes)
- Cloudflare KV (cache de solo-servidor)
- Durable Objects (estado autoritativo de partidas online/coop, con Alarms para limpieza de salas)
- Vite PWA plugin (manifest + service worker) para instalación y offline
- IndexedDB (vía `idb` o similar) para contenido descargado offline
- pnpm (monorepo)

## 3. Estructura del monorepo

```
apps/
  web/                  -> React Router v8: home público + panel admin
packages/
  ui/                   -> componentes shadcn + variantes (cva), sin lógica de negocio
  game-engine/          -> registro de tipos de juego, schemas Zod, validación server-side
  db/                   -> schemas Drizzle + queries
```

`game-engine` no conoce ningún dominio de contenido: solo trabaja con las entidades abstractas `GameType`, `GameInstance`, `ContentItem`, `Settings` y `DictionaryEntry`.

---

## 4. Sistema de tipos de juego (contrato genérico)

Cada `GameType` (el primero a implementar: `true_false`) declara, vía Zod:

- **Content schema**: forma de cada elemento de contenido. Para `true_false`: `{ label: string, imageUrl: string, description?: string, isTrue: boolean }`.
- **Settings schema**: forma de la configuración de ese tipo (modo, tiempos, vidas, etc.).

El panel renderiza formularios **dinámicamente** a partir de estos schemas. Agregar un `GameType` nuevo no debe requerir tocar el CRUD del panel — solo registrar su schema y validador en `game-engine`.

Cada `GameInstance` referencia un `GameType`, tiene su propio `theme` (para branding/estilo) y su propio conjunto de `ContentItem`. El `theme` es un dato configurable (nombre, colores, textos de UI), no una categoría hardcodeada.

---

## 5. Primer tipo de juego: True/False (tablero multiselección)

Un tablero único con todos los elementos de la instancia; el conteo de
verdaderos es dinámico (`isTrue`), nunca una constante. Cada selección es una
ronda con feedback inmediato: verdadero → +1 punto y la casilla se bloquea en
verde; falso → −1 vida y la casilla se bloquea en rojo. Re-marcar una casilla
bloqueada no suma ni resta. Victoria = marcar todos los verdaderos con vidas
restantes → +2 puntos extra; el timeout (o quedarse sin vidas) es derrota y se
conserva lo sumado, sin bonus. Publicar exige ≥1 verdadero, ≥1 falso y ≥2
elementos.

### Salas: turnos estrictos sobre el tablero compartido
Cada ronda cada miembro en pie elige una casilla en orden fijo de asientos, con
temporizador por turno (agotarlo cuesta una vida, sin revelar nada). Las
casillas resueltas se bloquean para todos. Puntuación: +1 por cada ronda
adicional que se empieza en pie (la primera da 0), +2 por ganar. La partida
termina cuando una ronda arrancaría con un solo jugador en pie (ese gana), con
ninguno (sin bonus), o al marcarse todos los verdaderos (ganan todos los en
pie, +2 cada uno). Al terminar se puede jugar otra dentro de la misma sala, con
marcador por partida y acumulado global.

### Diccionario (infraestructura, sin modo que lo use hoy)
Cada `GameInstance` puede tener un **diccionario** (`DictionaryEntry`): lista
curada de valores. La infra (tabla, importación CSV, validación) se conserva
para futuros tipos; el panel solo ofrece el modo experto y la sección de
diccionario a los tipos que declaran `requiresDictionary`.

### Regla no negociable (con matiz en la sección 7): validación server-side
En modo online/conectado, el cliente nunca decide si acertó. Envía el `id` seleccionado; el Worker/Durable Object resuelve contra el contenido real.

### Settings configurables por instancia
Tiempos límite (total, por pregunta, de selección) y número de vidas.

---

## 6. Modos de juego

### 6.1 Un jugador (online)
Sin login. Verificación server-side al enviar el resultado final, para que el score sea válido en el ranking.

### 6.2 Online (ranking)
Solo pide un nombre (usuario efímero). Ver sección 9 para el modelo de identidad y sección 10 para moderación.

### 6.3 Cooperativo (salas por código)
- El **Durable Object es la única autoridad del tiempo y del estado**. Ningún timer vive solo en el cliente.
- WebSocket Hibernation API para no consumir CPU con la sala inactiva.
- **TTL de salas**: usar **Durable Object Alarms**. Cada acción en la sala reprograma la alarma (ej. a 15 minutos desde la última actividad). Si la alarma se dispara sin actividad nueva, la sala se destruye y el código se libera. Si la partida termina y nadie la reinicia en una ventana corta (ej. 5 minutos), también se limpia.

---

## 7. Modo un jugador offline (PWA)

**Alcance**: solo el modo un jugador. Online y cooperativo requieren red por definición y no aplican aquí.

- App instalable (manifest + service worker vía Vite PWA plugin).
- El jugador puede "descargar" una `GameInstance` para jugarla sin conexión: el service worker cachea las imágenes y el contenido se guarda en IndexedDB.

**Trade-off de seguridad a aceptar conscientemente**: para que el juego corra 100% sin red, el cliente necesita tener localmente cuál es la respuesta correcta — esto rompe el principio de "nunca confiar en el cliente" que aplica al modo online.

**Decisión**: las partidas jugadas offline se resuelven y guardan **localmente**, se muestran en un historial personal del dispositivo, pero **no compiten en el ranking público**. Es, en la práctica, un modo práctica separado del modo con ranking. Si en el futuro se quiere que cuenten, deben resincronizarse y **revalidarse server-side** antes de aceptarse — nunca aceptar el resultado offline tal cual llega.

---

## 8. Identidad del jugador (con vista a futuro)

- Nombre cacheado en el cliente (localStorage/cookie), no en KV.
- Editable en cualquier momento desde un ícono de usuario en el TopNav.
- **Diseño con vista a cuentas persistentes futuras**: modelar desde ya una entidad `Player` (identificador estable, ej. UUID generado al primer uso) que es la que referencian los scores y el ranking. Cuando exista autenticación real, se agrega una entidad `Account` con relación opcional a `Player` (flujo de "reclamar" el historial de invitado al crear cuenta), en vez de rediseñar el modelo de scores desde cero.

---

## 9. Moderación de nombres en el ranking

1. **Filtro automático al momento de guardar el nombre**: normalizar (minúsculas, sin tildes, sustituciones tipo leetspeak básicas) y comparar contra una lista de palabras bloqueadas, configurable. Si coincide, se rechaza el nombre y se pide otro.
2. **Respaldo manual desde el panel**: vista de moderación donde el admin puede ocultar/banear un nombre específico del ranking si el filtro automático no lo detectó.

---

## 10. Ranking

El leaderboard se calcula **por `GameInstance`**, no de forma global entre instancias distintas.

---

## 11. Subida de imágenes a R2

Presigned URLs generadas por un endpoint del Worker (no binding directo desde el cliente):

1. El panel pide al Worker una URL firmada de expiración corta.
2. El navegador sube el binario directo a R2 con esa URL.
3. El Worker guarda la referencia final en D1.

---

## 12. Panel de administración

```
Juegos
  Tipos de juego         (GameType)
  Instancias de juego    (GameInstance — cada una con su propio theme y contenido)
  Contenido             (ContentItem: label, imagen, descripción, es verdadero)
  Diccionarios          (DictionaryEntry, solo para tipos que lo requieren)
Ranking / Moderación
Configuración
```

Al crear una instancia: `Nuevo juego > Tipo de juego > formulario dinámico (content schema) > settings dinámicos (settings schema) > datos del theme (nombre, colores, textos)`.

---

## 13. Home público

```
<TopNav full-width />
<Content>
  <GameList grid 4 columnas>
    <GameCard game={instance} />
  </GameList>
</Content>
```

Skeletons en loaders. Popup de nombre como primer elemento visible si no hay nombre en cache.

---

## 14. Reglas de código e UI

- Componentes de UI en `packages/ui`, manejados por variantes (cva/shadcn), sin `className` salvo casos puntuales.
- `lucide-react` para íconos, nunca `react-icons`.
- Complejidad ciclomática máxima por función: 15 (ESLint `complexity`).
- Un componente por modal, un componente por formulario.
- Variables de Tailwind centralizadas para theming.
- Shadcn UI con variantes listas desde el inicio.

---

## 15. Orden de implementación sugerido

1. Estructura del proyecto (monorepo, pnpm, dependencias, Tailwind con variables de tema).
2. Layout del panel admin (sidebar + shadcn admin layout).
3. Layout del home + TopNav (con el popover de nombre).
4. `GameList` + `GameCard` con skeletons.
5. `game-engine`: contrato de `GameType` (Zod schemas) + registro de `true_false`.
6. CRUD del panel para `GameInstance` y `ContentItem`, generado dinámicamente desde el schema.
7. Flujo de subida de imágenes a R2 (presigned URLs).
8. Runtime del juego modo un jugador (validación server-side al finalizar) + ranking por instancia.
9. Moderación de nombres (filtro automático + panel).
10. Modo cooperativo con Durable Objects (salas, timer autoritativo, Alarms para TTL, WebSockets).
11. Diccionarios + autocompletado para modo experto.
12. PWA + modo offline (modo práctica, sin ranking) para un jugador.

---

## 16. Decisiones de producto (cerradas)

| Tema | Decisión |
|---|---|
| Tolerancia de typos en modo experto | No aplica: autocompletado contra diccionario, el jugador selecciona, no escribe libre |
| Moderación de nombres | Filtro automático al guardar + panel de moderación manual como respaldo |
| Alcance del ranking | Por `GameInstance`, no global |
| TTL de salas coop | Durable Object Alarms; se destruyen tras inactividad y liberan el código |
| Cuentas persistentes | No existen aún, pero el modelo de `Player` se diseña para poder vincularse a una `Account` futura |
| PWA / offline | Solo modo un jugador; partidas offline no cuentan para el ranking (evita el vector de trampa de tener las respuestas en el cliente) |

---

## 17. Nota para quien implemente esto

Ningún ejemplo de este documento debe traducirse en nombres de tablas, rutas, componentes o variables. Si en algún punto de la implementación se necesita un ejemplo concreto para probar el flujo end-to-end, usar datos evidentemente ficticios y genéricos (p. ej. `"Tema de prueba"`, `"Elemento 1"`, `"Elemento 2"`) y nunca un dominio real — el contenido real se cargará después, como datos, a través del panel.