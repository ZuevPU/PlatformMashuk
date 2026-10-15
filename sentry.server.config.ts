import * as Sentry from "@sentry/nextjs";

/**
 * Инициализация Sentry на сервере (Node.js).
 *
 * Включается только если задан SENTRY_DSN: без него SDK молчит и не шлёт данные.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
});
