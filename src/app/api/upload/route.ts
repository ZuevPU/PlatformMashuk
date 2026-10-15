import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";
import { UploadError, saveUpload, validateImage } from "@/lib/storage";

/**
 * Загрузка фотографии.
 *
 * Загружать может только вошедший участник: фото нужны в канале и чатах,
 * которые работают с базой данных.
 */
export async function POST(request: Request) {
  const user = hasDatabase() ? await getSessionUser() : null;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Войдите в программу, чтобы загрузить фото" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Файл не получен" }, { status: 400 });
  }

  const invalid = validateImage({ type: file.type, size: file.size });
  if (invalid) {
    return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
  }

  try {
    const saved = await saveUpload({
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, url: saved.url, size: saved.size });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    // Подробности ошибки хранилища — в лог сервера, пользователю — понятный текст
    console.error("upload:", error);
    return NextResponse.json({ ok: false, error: "Не удалось сохранить файл" }, { status: 500 });
  }
}
