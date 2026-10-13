import { createHash, createHmac } from "node:crypto";

/**
 * Обезличенный ключ отвечающего в опросе.
 *
 * HMAC от участника и сессии: по ключу нельзя восстановить, кто ответил,
 * но можно не принять второй ответ на тот же вопрос и показать человеку,
 * что он уже ответил, — в том числе в анонимном опросе.
 */

function secret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  // Без заданного секрета ключ выводится из адреса базы: он стабилен
  // для установки и не хранится рядом с ответами.
  return createHash("sha256").update(`mashuk:${process.env.DATABASE_URL ?? ""}`).digest("hex");
}

export function respondentKey(memberId: string, sessionId: string): string {
  return createHmac("sha256", secret()).update(`${memberId}:${sessionId}`).digest("base64url");
}
