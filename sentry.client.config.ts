import * as Sentry from "@sentry/nextjs";

/**
 * Инициализация Sentry в браузере.
 *
 * Публичный DSN встраивается на этапе сборки (NEXT_PUBLIC_*). Без него SDK выключен.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
});
