# Платформа «Машук» — заметки для Claude

Цифровая экосистема сопровождения слушателей АНО «Центр знаний «Машук» (не LMS). Интерфейс и тексты — на русском.
На платформе одна программа — «Образование на высоте»; новые заводятся в админке.

## Стек
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 (`@theme` в `globals.css`) · Drizzle ORM + PostgreSQL · TipTap · lucide-react. Порт dev — 4321.

## Команды
- `npm run dev` — dev-сервер; `npm run typecheck`; `npm run build`
- `npm run smoke` — сквозная проверка (нужны dev-сервер и seed; пароли — `storage/seed-credentials.txt`)
- `npm run admin:create -- логин "Имя"` — администратор Центра; `db:seed` очищает базу
- `npm run shots` — скриншоты в `docs/screenshots` (Chrome/Edge)
- `npm run audit:design` — аудит токенов, доступности и контраста
- `npm run db:generate` / `db:migrate` / `db:seed`

## Карта
- `src/app/` — маршруты: `/` (витрина), `/programs/[slug]` (программа), `/enter` (вход по паролю программы), `/hub` (канал, расписание, сборка, чаты, опросы, участники), `/build/*` (сборка только участникам), `/join` (личный вход), `/admin/*`, `api/*` (events SSE, hub/[part], upload, admin/build, health)
- `src/components/{site,programs,hub,polls,chat,brand,ui}` — UI по зонам
- `src/lib/` — домен: `auth*.ts`, `admin*.ts`, `password.ts`, `rate-limit.ts`, `hub-data.ts`, `validate.ts`, `events.ts`, `build-storage.ts`, `db/{schema,queries,client}.ts`, `brand.ts`, `types.ts`; серверные действия хаба — `src/app/programs/[slug]/hub/actions.ts`
- `src/lib/mock/*` — программа и демо-данные для витрины без базы и для seed
- `drizzle/` — миграции; `deploy/` — Caddy, Postgres, бэкапы, мониторинг
- Брендбук: `../guideline_text.txt`, выжимка — `.claude/skills/design-audit/references/brand-rules.md`

## Принципы кода
- Данные хаба читаются от имени смотрящего (`Viewer`): только свои беседы, `mine` у реакций и ответов.
- Каждое серверное действие: сессия → роль в программе → принадлежность объекта программе → `validate.ts`.
- Новые объекты получают id в браузере (`префикс-uuid`), сервер проверяет формат через `isClientId`.
- После записи — `publish()` адресного события; клиент (`useLiveHub`) подтягивает только нужную часть.

## Правила
- Цвета, шрифты, радиусы — только через токены; акцент программы — `data-season` + `seasonStyle()` из `brand.ts`.
- Шрифт — шкала `text-micro|caption|meta|ui|body|lead|subtitle|title-sm|title|title-lg|heading|display-sm|display` (11–56px), не `text-[13px]`.
- Радиусы — `rounded-chip|xl|field|2xl|soft|panel|3xl|card|4xl`; отступы и ширины — шаг сетки (`p-4.5`, `max-w-195`), не `[18px]`.
- Текст на акцентной заливке — `text-on-accent` (не белый); акцент как текст — `text-accent-ink`; золото как текст — `text-gold-ink`.
- Шрифты: Geologica (UI), Noto Serif (длинные тексты). Без линейных градиентов в декоре.
- Файлы — только через `blob-store.ts` (локально или S3), не в `public/`.

## Скилы проекта
- `/code-optimize` — производительность, бандл, БД, рефакторинг
- `/design-audit` — брендбук, доступность, адаптив
- `/token-economy` — правила экономного контекста

## Экономия контекста
Не читать `../_*.txt`, PDF, `../.brand`, lock-файлы, `drizzle/meta`. Большие файлы — `Grep` + `Read` с диапазоном. Не перечитывать файл после правки.
