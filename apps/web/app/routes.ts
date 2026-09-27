import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("juego/:slug", "routes/play.tsx"),
  route("practica/:slug", "routes/practice.tsx"),
  route("sala/:code", "routes/sala.tsx"),
  route("ranking/:slug", "routes/ranking.tsx"),

  route("api/play", "routes/api-play.ts"),
  route("api/upload-url", "routes/api-upload-url.ts"),
  route("api/offline/:slug", "routes/api-offline.ts"),
  route("archivos/*", "routes/archivos.ts"),

  ...prefix("admin", [
    // Outside the guarded layout: this is the way in.
    route("entrar", "routes/admin-login.tsx"),
    layout("routes/admin-layout.tsx", [
      index("routes/admin-index.tsx"),
      route("nuevo", "routes/admin-new.tsx"),
      route("juego/:id", "routes/admin-instance.tsx"),
      route("moderacion", "routes/admin-moderation.tsx"),
    ]),
  ]),
] satisfies RouteConfig
