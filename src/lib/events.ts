import { EventEmitter } from "node:events";

/**
 * Шина событий внутри приложения.
 *
 * Платформа работает на одном сервере, поэтому живое состояние передаётся
 * через процесс: серверные действия публикуют событие, а открытые страницы
 * получают его потоком (Server-Sent Events). Второй процесс и внешняя шина
 * не нужны.
 *
 * Когда понадобится несколько экземпляров приложения, достаточно заменить
 * publish/subscribe на Redis pub/sub — остальной код не изменится.
 */

export type LiveEvent =
  /** Что-то изменилось в программе: страницы перечитывают состояние */
  | { type: "program-changed"; programSlug: string }
  | {
      type: "poll-session";
      programSlug: string;
      sessionId: string;
      status: string;
      currentIndex: number;
      accepting: boolean;
      showResults: boolean;
    }
  | {
      type: "poll-responses";
      programSlug: string;
      sessionId: string;
      questionId: string;
      total: number;
    }
  | { type: "post"; programSlug: string; postId: string }
  | { type: "message"; programSlug: string; conversationId: string };

const CHANNEL = "live";

interface Bus {
  emitter: EventEmitter;
}

// В разработке модуль перезагружается — шину держим в globalThis,
// иначе открытые потоки теряли бы подписки при каждом изменении файла.
const globalForBus = globalThis as unknown as { __mashukLiveBus?: Bus };

function bus(): Bus {
  if (!globalForBus.__mashukLiveBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForBus.__mashukLiveBus = { emitter };
  }
  return globalForBus.__mashukLiveBus;
}

export function publish(event: LiveEvent): void {
  bus().emitter.emit(CHANNEL, event);
}

export function subscribe(handler: (event: LiveEvent) => void): () => void {
  const { emitter } = bus();
  emitter.on(CHANNEL, handler);
  return () => {
    emitter.off(CHANNEL, handler);
  };
}
