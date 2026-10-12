import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

/**
 * Хранилище файлов.
 *
 * Драйвер выбирается переменными окружения: пока их нет, файлы кладутся
 * в public/uploads и раздаются самим приложением. Для боевого сервера
 * достаточно задать S3_* — интерфейс saveUpload остаётся тем же,
 * менять вызовы в приложении не придётся.
 */

export interface SavedFile {
  url: string;
  size: number;
  contentType: string;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ — с запасом для фото с телефона
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];

export function uploadsEnabled(): boolean {
  return true;
}

export function storageDriver(): "s3" | "local" {
  return process.env.S3_BUCKET && process.env.S3_ENDPOINT ? "s3" : "local";
}

export function validateImage(file: { type: string; size: number }): string | null {
  if (!ALLOWED.includes(file.type)) return "Поддерживаются только изображения";
  if (file.size > MAX_BYTES) return "Файл больше 8 МБ";
  return null;
}

export async function saveUpload(file: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): Promise<SavedFile> {
  const extension = extensionFor(file.type, file.name);
  const now = new Date();
  const folder = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const fileName = `${randomUUID()}${extension}`;

  if (storageDriver() === "s3") {
    // Драйвер S3 подключается на этапе деплоя: интерфейс уже готов,
    // нужен только клиент хранилища и ключи доступа.
    throw new Error("Драйвер S3 не подключён: задайте ключи хранилища");
  }

  const directory = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), file.bytes);

  return {
    url: `/uploads/${folder}/${fileName}`,
    size: file.bytes.byteLength,
    contentType: file.type,
  };
}

function extensionFor(contentType: string, name: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/heic") return ".heic";
  if (contentType === "image/jpeg") return ".jpg";

  const fromName = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return /^\.[a-z0-9]{2,5}$/i.test(fromName) ? fromName.toLowerCase() : ".bin";
}
