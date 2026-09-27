/** Provided by the React Router Vite plugin at build time. */
declare module "virtual:react-router/server-build" {
  import type { ServerBuild } from "react-router"

  export const routes: ServerBuild["routes"]
  export const assets: ServerBuild["assets"]
  export const assetsBuildDirectory: ServerBuild["assetsBuildDirectory"]
  export const basename: ServerBuild["basename"]
  export const entry: ServerBuild["entry"]
  export const future: ServerBuild["future"]
  export const publicPath: ServerBuild["publicPath"]
  export const ssr: ServerBuild["ssr"]
  export const isSpaMode: ServerBuild["isSpaMode"]
}
