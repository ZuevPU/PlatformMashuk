import { REACTION_SET } from "./types";
import type { Attachment, RichDoc } from "./types";

/**
 * Проверка данных, пришедших из браузера в серверные действия.
 * Серверное действие — публичная точка входа, поэтому каждое поле
 * проверяется так, будто его прислал кто угодно.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Идентификатор, созданный в браузере: «префикс-uuid». */
export function isClientId(prefix: string, value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^${prefix}-${UUID}$`).test(value);
}

/** Существующий идентификатор из базы: латиница, цифры и дефисы. */
export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[\w-]{1,120}$/.test(value);
}

const MAX_DOC_BYTES = 60_000;

export function isRichDoc(value: unknown): value is RichDoc {
  if (!value || typeof value !== "object") return false;
  const doc = value as { type?: unknown; content?: unknown };
  if (doc.type !== "doc" || !Array.isArray(doc.content)) return false;
  return JSON.stringify(value).length <= MAX_DOC_BYTES;
}

/**
 * Вложения: только файлы, загруженные на платформу, не больше десяти.
 * Недогруженные (локальное превью blob:) и чужие адреса просто отбрасываются.
 */
export function cleanAttachments(value: unknown): Attachment[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result: Attachment[] = [];
  for (const item of value.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const attachment = item as Record<string, unknown>;
    const url = attachment.url;
    if (typeof url !== "string" || !/^\/uploads\/\d{4}-\d{2}\/[\w-]+\.[a-z0-9]{2,5}$/i.test(url)) {
      continue;
    }
    result.push({
      id: typeof attachment.id === "string" ? attachment.id.slice(0, 80) : url,
      kind: "image",
      url,
      alt: typeof attachment.alt === "string" ? attachment.alt.slice(0, 200) : "",
    });
  }
  return result;
}

export function isReaction(value: unknown): value is string {
  return typeof value === "string" && (REACTION_SET as readonly string[]).includes(value);
}

export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}
