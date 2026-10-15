import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

/**
 * Фотографии из канала и чатов — только для вошедших участников.
 * Имя файла — случайный UUID, содержимое никогда не меняется,
 * поэтому браузер может хранить его сколько угодно.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folder: string; name: string }> },
) {
  if (!(await getSessionUser())) {
    return new NextResponse("Войдите, чтобы увидеть фото", { status: 401 });
  }

  const { folder, name } = await params;
  const file = await readUpload(folder, name);
  if (!file) return new NextResponse("Файл не найден", { status: 404 });

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
