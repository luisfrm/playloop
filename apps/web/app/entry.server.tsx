import { isbot } from "isbot"
import { renderToReadableStream } from "react-dom/server"
import { ServerRouter, type EntryContext } from "react-router"

/**
 * Server entry for the Workers runtime.
 *
 * React Router's built-in server entry targets Node (`renderToPipeableStream`
 * over `node:stream`), which cannot run in workerd. Here we render with Web
 * Streams instead, which the Worker can return directly.
 */
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
): Promise<Response> {
  let status = responseStatusCode

  function onError(error: unknown): void {
    status = 500
    console.error(error)
  }

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    { onError }
  )

  // Bots and SPA mode wait for the whole document so crawlers never index a
  // half-streamed shell. React's Web Streams renderer exposes readiness as an
  // `allReady` promise instead of the `onAllReady` callback Node uses.
  const userAgent = request.headers.get("user-agent") ?? ""
  if (isbot(userAgent) || routerContext.isSpaMode) {
    await body.allReady
  }

  responseHeaders.set("Content-Type", "text/html")

  return new Response(body, {
    headers: responseHeaders,
    status,
  })
}
