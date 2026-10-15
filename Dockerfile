# Образ приложения «Центр знаний «Машук»».
# Сборка: multi-stage, рантайм — из .next/standalone (нужен только Node.js).

# --- 1. Зависимости ---------------------------------------------------------
FROM node:22-alpine AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- 2. Сборка приложения ---------------------------------------------------
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Публичный DSN Sentry встраивается на этапе сборки (для клиентской части)
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN pnpm build

# --- 3. Рантайм -------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4321
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# standalone-сервер + статика + публичные файлы
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Каталоги загрузок и сборок (перекрываются томами), владелец — непривилегированный
RUN mkdir -p /app/public/uploads /app/storage   && chown -R nextjs:nodejs /app/public/uploads /app/storage

USER nextjs
EXPOSE 4321
CMD ["node", "server.js"]
