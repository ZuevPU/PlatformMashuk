/**
 * Администратор Центра на рабочей базе — без очистки данных.
 *
 * Запуск:
 *   DATABASE_URL=postgres://... npm run admin:create -- admin@mashuk.ru "Имя Фамилия"
 *
 * Если человек с таким логином уже есть, он становится администратором Центра
 * и получает новый пароль. Пароль генерируется и печатается один раз;
 * свой можно передать переменной ADMIN_PASSWORD.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import * as schema from "../src/lib/db/schema";
import { generatePassword, hashPassword, passwordProblem } from "../src/lib/password";

function normalize(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && /^[78]/.test(digits)) return `+7${digits.slice(1)}`;
  return digits.length === 10 ? `+7${digits}` : null;
}

async function main() {
  // npm и pnpm по-разному передают разделитель «--» — пропускаем его
  const [rawContact, ...nameParts] = process.argv.slice(2).filter((arg) => arg !== "--");
  const contact = normalize(rawContact ?? "");
  const name = nameParts.join(" ").trim() || "Администратор Центра";
  if (!contact) {
    console.error("Укажите логин: npm run admin:create -- admin@mashuk.ru \"Имя Фамилия\"");
    process.exitCode = 1;
    return;
  }

  const password = process.env.ADMIN_PASSWORD || generatePassword();
  const weak = passwordProblem(password);
  if (weak) {
    console.error(weak);
    process.exitCode = 1;
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Задайте DATABASE_URL");
    process.exitCode = 1;
    return;
  }

  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema });
  const passwordHash = await hashPassword(password);

  const [existing] = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(eq(schema.members.contact, contact));

  if (existing) {
    await db
      .update(schema.members)
      .set({ role: "admin", passwordHash })
      .where(eq(schema.members.id, existing.id));
    // Старые входы с прежним паролем закрываются
    await db.delete(schema.authSessions).where(eq(schema.authSessions.memberId, existing.id));
  } else {
    await db.insert(schema.members).values({
      id: `m-${randomUUID()}`,
      name,
      role: "admin",
      contact,
      passwordHash,
    });
  }

  await client.end();
  console.log(`Администратор Центра: ${contact}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Пароль (показывается один раз): ${password}`);
  console.log("Вход: /join → /admin");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
