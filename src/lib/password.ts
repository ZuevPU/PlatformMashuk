import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

/**
 * Пароли: scrypt из стандартной библиотеки Node, без внешних зависимостей.
 *
 * Формат хеша: scrypt$N$r$p$соль$хеш (base64url). Параметры хранятся рядом
 * с хешем, поэтому их можно усилить позже — старые пароли продолжат работать.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export const MIN_PASSWORD_LENGTH = 8;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    // Считаем хеш впустую, чтобы время ответа не выдавало, есть ли пароль
    await derive(password, DUMMY_SALT, { N, r: R, p: P });
    return false;
  }
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const DUMMY_SALT = randomBytes(16);

/** Алфавит без похожих символов (0/O, 1/l/I): пароль диктуют голосом и переписывают с экрана. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Пароль для выдачи участнику: три группы по четыре символа, например «k7mp-2xqa-9fte». */
export function generatePassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
  }
  if (password.length > 200) return "Слишком длинный пароль";
  return null;
}
