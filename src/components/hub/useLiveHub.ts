"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HubPart, HubParts } from "@/lib/hub-data";
import type { PollSession } from "@/lib/types";

/**
 * Живые данные хаба.
 *
 * Один поток событий (SSE) на страницу. Событие говорит, что изменилось,
 * и браузер подтягивает только эту часть через /api/hub/[part] — с короткой
 * задержкой, чтобы пачка событий (например, 30 ответов на опрос за секунду)
 * превратилась в один запрос. Состояние сессии опроса приходит прямо
 * в событии: участникам не нужно ничего запрашивать.
 */

type LiveMessage =
  | { type: "ready" }
  | { type: "program" }
  | { type: "channel" }
  | { type: "message"; conversationId: string }
  | { type: "conversation"; conversationId: string }
  | { type: "polls" }
  | {
      type: "poll-session";
      sessionId: string;
      status: PollSession["status"];
      currentIndex: number;
      accepting: boolean;
      showResults: boolean;
    }
  | { type: "poll-responses"; sessionId: string; questionId: string };

const DELAY: Record<HubPart, number> = {
  chats: 250,
  channel: 600,
  polls: 500,
  members: 1000,
};

export function useLiveHub(programSlug: string, initial: HubParts, staff: boolean) {
  const router = useRouter();
  const [parts, setParts] = useState<HubParts>(initial);
  const [connected, setConnected] = useState(true);
  const timers = useRef(new Map<HubPart, ReturnType<typeof setTimeout>>());
  const partsRef = useRef(parts);
  partsRef.current = parts;

  /**
   * Свежие ответы одной живой сессии — без прошлых опросов программы.
   * Ведущему быстро, участникам с разбросом: 150 телефонов в зале
   * не должны обращаться к серверу в одну и ту же секунду.
   */
  const sessionTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const refreshSession = useCallback(
    (sessionId: string) => {
      if (sessionTimers.current.has(sessionId)) return;
      const delay = staff ? 400 : 1200 + Math.random() * 1500;
      const timer = setTimeout(async () => {
        sessionTimers.current.delete(sessionId);
        try {
          const response = await fetch(
            `/api/hub/polls?program=${encodeURIComponent(programSlug)}&session=${encodeURIComponent(sessionId)}`,
            { cache: "no-store" },
          );
          const body = (await response.json()) as { ok: boolean; data?: HubParts["polls"] };
          const fresh = body.data?.sessions[0];
          if (!body.ok || !fresh) return;
          setParts((previous) => ({
            ...previous,
            polls: {
              ...previous.polls,
              sessions: previous.polls.sessions.map((item) => (item.id === fresh.id ? fresh : item)),
            },
          }));
        } catch {
          // сеть недоступна — догоним при переподключении потока
        }
      }, delay);
      sessionTimers.current.set(sessionId, timer);
    },
    [programSlug, staff],
  );

  const refresh = useCallback(
    (part: HubPart) => {
      if (timers.current.has(part)) return;
      const timer = setTimeout(async () => {
        timers.current.delete(part);
        try {
          const response = await fetch(
            `/api/hub/${part}?program=${encodeURIComponent(programSlug)}`,
            { cache: "no-store" },
          );
          if (response.status === 403) {
            // Сессия закончилась или доступ отозван — на страницу входа
            router.refresh();
            return;
          }
          const body = (await response.json()) as { ok: boolean; data?: HubParts[HubPart] };
          if (body.ok && body.data) {
            setParts((previous) => ({ ...previous, [part]: body.data }));
          }
        } catch {
          // сеть недоступна — догоним при переподключении потока
        }
      }, DELAY[part]);
      timers.current.set(part, timer);
    },
    [programSlug, router],
  );

  useEffect(() => {
    const source = new EventSource(`/api/events?program=${encodeURIComponent(programSlug)}`);
    let opened = false;

    source.onopen = () => {
      setConnected(true);
      // Переподключение после обрыва: могли пропустить события — сверяемся
      if (opened) (["channel", "chats", "polls", "members"] as HubPart[]).forEach(refresh);
      opened = true;
    };

    source.onerror = () => setConnected(false);

    source.onmessage = (message) => {
      let event: LiveMessage;
      try {
        event = JSON.parse(message.data) as LiveMessage;
      } catch {
        return;
      }

      switch (event.type) {
        case "channel":
          refresh("channel");
          break;
        case "message":
        case "conversation":
          refresh("chats");
          break;
        case "polls":
          refresh("polls");
          break;
        case "program":
          refresh("members");
          router.refresh();
          break;
        case "poll-session": {
          const before = partsRef.current.polls.sessions.find((item) => item.id === event.sessionId);
          setParts((previous) => ({
            ...previous,
            polls: {
              ...previous.polls,
              sessions: previous.polls.sessions.map((session) =>
                session.id === event.sessionId
                  ? {
                      ...session,
                      status: event.status,
                      currentIndex: event.currentIndex,
                      accepting: event.accepting,
                      showResults: event.showResults,
                    }
                  : session,
              ),
            },
          }));
          // Новая для участника сессия или открытые результаты — нужны вопросы и ответы
          // Новая для участника сессия — нужны вопросы опроса; открытые результаты — только ответы
          if (!before) refresh("polls");
          else if (event.showResults && !before.showResults) refreshSession(event.sessionId);
          break;
        }
        case "poll-responses": {
          const session = partsRef.current.polls.sessions.find((item) => item.id === event.sessionId);
          if (staff || session?.showResults) refreshSession(event.sessionId);
          break;
        }
      }
    };

    // Вкладка вернулась из фона — подтягиваем всё, что могло измениться
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        (["channel", "chats", "polls"] as HubPart[]).forEach(refresh);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const pending = timers.current;
    const pendingSessions = sessionTimers.current;
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
      for (const timer of pending.values()) clearTimeout(timer);
      for (const timer of pendingSessions.values()) clearTimeout(timer);
      pending.clear();
      pendingSessions.clear();
    };
  }, [programSlug, refresh, refreshSession, router, staff]);

  return { parts, connected, refresh };
}
