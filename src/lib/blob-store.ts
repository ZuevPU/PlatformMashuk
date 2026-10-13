import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, s3ConfigFromEnv } from "./s3";
import { contentTypeFor } from "./mime";

/**
 * Хранилище файлов платформы: фотографии и авторские сборки программ.
 *
 * Драйвер выбирается переменными окружения: заданы S3_ENDPOINT и S3_BUCKET —
 * S3-совместимое хранилище, иначе локальный каталог STORAGE_DIR (./storage).
 * Остальной код работает только с ключами вида «uploads/2026-10/….png»
 * и не знает, где лежат файлы.
 */

export interface StoredFile {
  bytes: Uint8Array;
  contentType: string;
}

export interface BlobStore {
  readonly driver: "local" | "s3";
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  /** Удаляет все объекты с префиксом (каталог в локальном режиме) */
  deletePrefix(prefix: string): Promise<void>;
}

/** Ключ без «..», абсолютных путей и пустых сегментов. */
export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.startsWith("/") &&
    key.split("/").every((part) => part && part !== "." && part !== "..")
  );
}

class LocalStore implements BlobStore {
  readonly driver = "local" as const;

  constructor(private readonly root: string) {}

  private file(key: string): string {
    if (!isSafeKey(key)) throw new Error("Недопустимый путь файла");
    const file = path.join(this.root, ...key.split("/"));
    // Итоговый путь обязан остаться внутри хранилища
    if (!file.startsWith(this.root + path.sep)) throw new Error("Недопустимый путь файла");
    return file;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }

  async get(key: string): Promise<StoredFile | null> {
    if (!isSafeKey(key)) return null;
    try {
      const bytes = await readFile(this.file(key));
      return { bytes, contentType: contentTypeFor(key) ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.file(prefix.replace(/\/+$/, "")), { recursive: true, force: true });
  }
}

class S3Store implements BlobStore {
  readonly driver = "s3" as const;

  constructor(private readonly client: S3Client) {}

  put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    if (!isSafeKey(key)) throw new Error("Недопустимый путь файла");
    return this.client.put(key, bytes, contentType);
  }

  get(key: string): Promise<StoredFile | null> {
    return isSafeKey(key) ? this.client.get(key) : Promise.resolve(null);
  }

  async deletePrefix(prefix: string): Promise<void> {
    const keys = await this.client.list(prefix.endsWith("/") ? prefix : `${prefix}/`);
    await inParallel(keys, 8, (key) => this.client.delete(key));
  }
}

/** Выполняет задачи не больше limit одновременно. */
export async function inParallel<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  });
  await Promise.all(workers);
}

let store: BlobStore | null = null;

export function blobStore(): BlobStore {
  if (store) return store;
  const s3 = s3ConfigFromEnv();
  store = s3
    ? new S3Store(new S3Client(s3))
    : new LocalStore(
        // Каталог задаётся во время работы — сборщику не нужно трассировать его содержимое
        path.resolve(
          /*turbopackIgnore: true*/ process.env.STORAGE_DIR ??
            path.join(/*turbopackIgnore: true*/ process.cwd(), "storage"),
        ),
      );
  return store;
}
