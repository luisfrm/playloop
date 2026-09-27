import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("init", "routes/init.tsx"),
  route("game/:slug", "routes/play.tsx"),
  route("practice/:slug", "routes/practice.tsx"),
  route("room/:code", "routes/room.tsx"),
  route("ranking/:slug", "routes/ranking.tsx"),

  route("api/play", "routes/api-play.ts"),
  route("api/upload-url", "routes/api-upload-url.ts"),
  route("api/offline/:slug", "routes/api-offline.ts"),
  route("media/*", "routes/media.ts"),

  ...prefix("admin", [
    // Outside the guarded layout: this is the way in.
    route("login", "routes/admin-login.tsx"),
    layout("routes/admin-layout.tsx", [
      index("routes/admin-index.tsx"),
      route("new", "routes/admin-new.tsx"),
      route("games/:id", "routes/admin-instance.tsx"),
      route("moderation", "routes/admin-moderation.tsx"),
      route("settings", "routes/admin-settings.tsx"),
    ]),
  ]),
] satisfies RouteConfig
