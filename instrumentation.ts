import * as Sentry from "@sentry/nextjs";

/**
 * Инструментирование Next.js: подключает Sentry к серверу и edge,
 * а также ловит ошибки запросов (App Router).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
