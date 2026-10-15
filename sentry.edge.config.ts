import * as Sentry from "@sentry/nextjs";

/** Инициализация Sentry на edge-рантайме; включается только при заданном DSN. */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
});
