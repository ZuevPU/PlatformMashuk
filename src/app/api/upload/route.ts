import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";
import { saveUpload, validateImage } from "@/lib/storage";

/**
 * Загрузка фотографии.
 *
 * В режиме с базой загружать может только вошедший участник; в демонстрационном
 * режиме вход не требуется, чтобы платформу можно было смотреть без настройки.
 */
export async function POST(request: Request) {
  if (hasDatabase()) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Нужно войти по приглашению" }, { status: 401 });
    }
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
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Не удалось сохранить файл" },
      { status: 500 },
    );
  }
}
