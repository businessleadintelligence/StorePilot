import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText || "Page not found"
    : error instanceof Error
      ? error.message
      : "Unexpected error";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>StorePilot — Error {status}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <main
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            margin: "2rem auto",
            maxWidth: "32rem",
            padding: "0 1rem",
          }}
        >
          <h1>Something went wrong</h1>
          <p>{message}</p>
          <p>
            <a href="/app">Return to StorePilot</a>
          </p>
        </main>
        <Scripts />
      </body>
    </html>
  );
}
