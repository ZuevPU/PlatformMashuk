import { getDb } from "@/lib/db/client";
import { getProgramRole, getSessionUser } from "@/lib/auth";
import { subscribe } from "@/lib/events";
import type { LiveEvent } from "@/lib/events";

/**
 * Поток живых событий программы (Server-Sent Events).
 *
 * Открывается один раз на страницу: дальше сервер сам присылает изменения —
 * новое состояние опроса, счётчик ответов, новые сообщения. Браузер
 * переподключается автоматически, если соединение оборвалось.
 */
export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return new Response("Демонстрационный режим", { status: 503 });
  }

  const url = new URL(request.url);
  const programSlug = url.searchParams.get("program") ?? "";

  const user = await getSessionUser();
  if (!user) return new Response("Нужно войти", { status: 401 });

  const role = await getProgramRole(user.member.id, programSlug);
  if (!role) return new Response("Нет доступа к программе", { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: LiveEvent | { type: "ready" }) => {
        write(`data: ${JSON.stringify(event)}\n\n`);
      };

      send({ type: "ready" });

      const unsubscribe = subscribe((event) => {
        if (event.programSlug === programSlug) send(event);
      });

      // Комментарий-пинг не даёт прокси закрыть соединение при простое
      const heartbeat = setInterval(() => write(": ping\n\n"), 25_000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // поток уже закрыт
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
