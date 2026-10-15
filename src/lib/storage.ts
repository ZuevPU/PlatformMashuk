import { randomUUID } from "node:crypto";
import { blobStore } from "./blob-store";

/**
 * Фотографии из канала и чатов.
 *
 * Файл кладётся в хранилище (локальный каталог или S3 — см. blob-store.ts)
 * под ключом uploads/ГГГГ-ММ/<uuid>.<расширение> и отдаётся по адресу
 * /uploads/ГГГГ-ММ/… только вошедшим участникам.
 */

export interface SavedFile {
  url: string;
  size: number;
  contentType: string;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ — с запасом для фото с телефона

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
};

/** Сигнатуры форматов: тип файла проверяется по содержимому, а не по заявленному браузером. */
function sniff(bytes: Uint8Array): string | null {
  const head = (length: number) => Array.from(bytes.slice(0, length));
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (head(3).join() === "255,216,255") return "image/jpeg";
  if (head(8).join() === "137,80,78,71,13,10,26,10") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(ascii(8, 12))) return "image/heic";
  return null;
}

export function validateImage(file: { type: string; size: number }): string | null {
  if (!EXTENSIONS[file.type]) return "Поддерживаются только изображения";
  if (file.size > MAX_BYTES) return "Файл больше 8 МБ";
  return null;
}

export async function saveUpload(file: { name: string; type: string; bytes: Uint8Array }): Promise<SavedFile> {
  // Заявленный тип должен совпасть с содержимым: под видом картинки не загрузить HTML или скрипт
  const actual = sniff(file.bytes);
  if (!actual) throw new UploadError("Файл не похож на изображение");

  const now = new Date();
  const folder = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${randomUUID()}${EXTENSIONS[actual]}`;

  await blobStore().put(`uploads/${folder}/${name}`, file.bytes, actual);

  return { url: `/uploads/${folder}/${name}`, size: file.bytes.byteLength, contentType: actual };
}

export async function readUpload(folder: string, name: string) {
  if (!/^\d{4}-\d{2}$/.test(folder) || !/^[\w-]+\.[a-z0-9]{2,5}$/i.test(name)) return null;
  return blobStore().get(`uploads/${folder}/${name}`);
}

/** Ошибка, которую можно показать пользователю как есть. */
export class UploadError extends Error {}
