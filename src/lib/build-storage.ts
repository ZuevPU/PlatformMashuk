import { blobStore, inParallel } from "./blob-store";
import { contentTypeFor } from "./mime";

/**
 * Авторская сборка программы — HTML-страница со своими стилями, скриптами
 * и файлами, которую готовит команда Центра.
 *
 * Каждая загрузка ложится под своей версией: builds/<программа>/<версия>/…
 * Версия — момент загрузки (programs.build_uploaded_at). Новая сборка
 * сначала загружается целиком, затем в базе переключается версия,
 * и только после этого удаляется старая. Участники никогда не видят
 * наполовину загруженную сборку — ни на диске, ни в S3.
 */

export const BUILD_LIMITS = {
  files: 2000,
  fileBytes: 50 * 1024 * 1024,
  totalBytes: 200 * 1024 * 1024,
};

export { contentTypeFor };

function prefix(programId: number, version?: number): string {
  return version === undefined ? `builds/${programId}` : `builds/${programId}/${version}`;
}

/**
 * Безопасный относительный путь внутри сборки: без «..», абсолютных путей
 * и служебных файлов. null — путь отклонён.
 */
export function cleanBuildPath(raw: string): string | null {
  const parts = raw.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length === 0 || parts.length > 12) return null;
  for (const part of parts) {
    if (part === "." || part === ".." || part.startsWith(".") || part.length > 120) return null;
    if (!/^[\p{L}\p{N} ._()+@,-]+$/u.test(part)) return null;
  }
  return parts.join("/");
}

export interface IncomingBuildFile {
  path: string;
  bytes: Uint8Array;
}

/**
 * Загружает сборку под новой версией. Переключение версии в базе
 * и удаление прежней — на стороне вызывающего (см. /api/admin/build).
 */
export async function saveBuild(
  programId: number,
  incoming: IncomingBuildFile[],
): Promise<{ ok: true; files: number; version: number } | { ok: false; error: string }> {
  if (incoming.length === 0) return { ok: false, error: "Не выбрано ни одного файла" };
  if (incoming.length > BUILD_LIMITS.files) {
    return { ok: false, error: `Слишком много файлов: больше ${BUILD_LIMITS.files}` };
  }

  let files: IncomingBuildFile[] = [];
  let total = 0;
  for (const file of incoming) {
    const clean = cleanBuildPath(file.path);
    // Служебные и неподдерживаемые файлы (.DS_Store, исходники) пропускаем
    if (!clean || !contentTypeFor(clean)) continue;
    if (file.bytes.byteLength > BUILD_LIMITS.fileBytes) {
      return { ok: false, error: `Файл ${clean} больше 50 МБ` };
    }
    total += file.bytes.byteLength;
    files.push({ path: clean, bytes: file.bytes });
  }
  if (total > BUILD_LIMITS.totalBytes) return { ok: false, error: "Сборка больше 200 МБ" };

  // Выбрали папку целиком — у всех файлов общий первый каталог, снимаем его
  const hasRootIndex = files.some((file) => file.path.toLowerCase() === "index.html");
  if (!hasRootIndex) {
    const first = new Set(files.map((file) => file.path.split("/")[0]));
    if (first.size === 1 && files.every((file) => file.path.includes("/"))) {
      const cut = `${[...first][0]}/`.length;
      files = files.map((file) => ({ ...file, path: file.path.slice(cut) }));
    }
  }

  if (!files.some((file) => file.path.toLowerCase() === "index.html")) {
    return { ok: false, error: "В корне сборки нужен файл index.html" };
  }

  const version = Date.now();
  const store = blobStore();
  try {
    await inParallel(files, 8, (file) =>
      store.put(`${prefix(programId, version)}/${file.path}`, file.bytes, contentTypeFor(file.path)!),
    );
  } catch (error) {
    // Не получилось — убираем недогруженную версию, текущая остаётся как была
    await store.deletePrefix(prefix(programId, version)).catch(() => {});
    throw error;
  }

  return { ok: true, files: files.length, version };
}

/** Удаляет одну версию сборки. */
export async function removeBuildVersion(programId: number, version: number): Promise<void> {
  await blobStore().deletePrefix(prefix(programId, version));
}

/** Удаляет все версии сборки программы. */
export async function removeBuild(programId: number): Promise<void> {
  await blobStore().deletePrefix(prefix(programId));
}

/** Файл сборки для отдачи участнику; null — нет такого файла. */
export async function readBuildFile(
  programId: number,
  version: number,
  relative: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const clean = cleanBuildPath(relative);
  const contentType = clean ? contentTypeFor(clean) : null;
  if (!clean || !contentType) return null;

  const file = await blobStore().get(`${prefix(programId, version)}/${clean}`);
  return file ? { bytes: file.bytes, contentType } : null;
}
