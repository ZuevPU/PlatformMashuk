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
  /** Изменилась программа: расписание, сборка, состав — страницы перечитывают её */
  | { type: "program"; programSlug: string }
  /** Новый пост, комментарий, реакция или закреп в канале */
  | { type: "channel"; programSlug: string }
  /** Новое сообщение или реакция в беседе — только участникам беседы */
  | { type: "message"; programSlug: string; conversationId: string; memberIds: string[] }
  /** Создана беседа — только её участникам */
  | { type: "conversation"; programSlug: string; conversationId: string; memberIds: string[] }
  /** Создан опрос */
  | { type: "polls"; programSlug: string }
  /** Ведущий изменил состояние живой сессии опроса */
  | {
      type: "poll-session";
      programSlug: string;
      sessionId: string;
      status: string;
      currentIndex: number;
      accepting: boolean;
      showResults: boolean;
    }
  /** Пришёл ответ на вопрос опроса */
  | {
      type: "poll-responses";
      programSlug: string;
      sessionId: string;
      questionId: string;
    };

/** Кому адресовано событие: для бесед — только их участникам. */
export function isAddressedTo(event: LiveEvent, memberId: string): boolean {
  if (event.type === "message" || event.type === "conversation") {
    return event.memberIds.includes(memberId);
  }
  return true;
}

/** Событие без служебных полей — то, что уходит в браузер. */
export function toClient(event: LiveEvent): Record<string, unknown> {
  if (event.type === "message" || event.type === "conversation") {
    const { memberIds: _omit, ...rest } = event;
    return rest;
  }
  return event;
}

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
