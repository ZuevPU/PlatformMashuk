# Чек-лист оптимизации: Next.js 16 / React 19 / Drizzle

## Ленивая загрузка тяжёлых клиентских модулей

```tsx
// Было: TipTap попадает в First Load JS каждого экрана хаба
import { Composer } from "@/components/hub/Composer";

// Стало: редактор грузится, когда реально нужен
import dynamic from "next/dynamic";
const Composer = dynamic(() => import("@/components/hub/Composer").then((m) => m.Composer), {
  ssr: false,
  loading: () => <div className="h-[120px] rounded-[18px] bg-paper-warm" />,
});
```

```ts
// Экспорт по клику, а не в бандле страницы
async function onExport() {
  const { exportCsv } = await import("@/lib/export");
  exportCsv(data);
}
```

## Граница server/client

```tsx
// Серверный компонент готовит данные и статичную разметку
export default async function Page({ params }) {
  const { slug } = await params;
  const program = await getProgram(slug);
  return (
    <>
      <ProgramHero title={program.title} season={program.season} />  {/* серверный */}
      <ScheduleTabs days={program.days.map(({ id, label, items }) => ({ id, label, items }))} /> {/* клиентский, только нужные поля */}
    </>
  );
}
```

Признаки проблемы: `"use client"` в файле, где нет хуков/обработчиков; клиентский компонент импортирует `src/lib/mock/*` или `src/lib/db/*`.

## Drizzle: N+1 → один запрос

```ts
// Было
for (const post of posts) post.comments = await db.select().from(comments).where(eq(comments.postId, post.id));

// Стало
const all = await db.select().from(comments).where(inArray(comments.postId, posts.map((p) => p.id)));
const byPost = Map.groupBy(all, (c) => c.postId);
```

Индексы — в `schema.ts` через третий аргумент `pgTable(..., (t) => [index().on(t.programId, t.createdAt)])`, затем `npm run db:generate`.

## React 19

- Производные значения — без `useEffect`:
  ```tsx
  const visible = useMemo(() => items.filter(match), [items, query]); // или просто вычислить, если список мал
  ```
- Формы — `useActionState` / `useFormStatus` вместо ручных флагов загрузки.
- Оптимистичные реакции/сообщения — `useOptimistic`.
- Списки: `key={item.id}`, не индекс.

## Server Actions

- Первая строка — проверка сессии и роли (`src/lib/auth.ts`), затем валидация входа.
- Возвращать минимум данных. Хаб не перерисовывается через `revalidatePath`: действие публикует адресное событие (`publish`), а `useLiveHub` подтягивает только изменившуюся часть.

## Как проверить эффект

- `npm run build`, затем `ALLOW_INSECURE_COOKIES=1 npx next start -p 4400` и замер JS первой загрузки:

  ```bash
  node -e '(async()=>{const b="http://127.0.0.1:4400",c={cookie:"mashuk_session=<токен>"};for(const u of ["/","/programs/obrazovanie-na-vysote/hub"]){const h=await (await fetch(b+u,{headers:c})).text();const s=[...new Set([...h.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map(m=>m[1]))];let t=0;for(const x of s)t+=(await (await fetch(b+x)).arrayBuffer()).byteLength;console.log(u,Math.round(t/1024),"КБ")}})()'
  ```
- Время ответа: `npm run smoke` выводит статусы; для конкретного маршрута — `curl -w "%{time_total}\n" -o /dev/null -s http://127.0.0.1:4321/...`.
