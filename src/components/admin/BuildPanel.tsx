"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderUp, Trash2, Upload } from "lucide-react";
import { deleteProgramAction } from "@/lib/admin-actions";
import { Button, Result, TextField } from "./ui";

/**
 * Загрузка авторской сборки: папка с index.html, стилями, скриптами и файлами.
 * Сборка открывается участникам внутри хаба и закрыта для всех остальных.
 */
export function BuildPanel({
  slug,
  uploadedAt,
}: {
  slug: string;
  uploadedAt: string | null;
}) {
  const router = useRouter();
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ error?: string; ok?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);

  const upload = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const form = new FormData();
    for (const file of Array.from(list)) {
      form.append("files", file);
      // У файлов из выбранной папки есть путь внутри неё: style/main.css
      form.append("paths", (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    }

    // XMLHttpRequest — ради прогресса загрузки: сборка может весить десятки мегабайт
    const request = new XMLHttpRequest();
    request.open("POST", `/api/admin/build?program=${encodeURIComponent(slug)}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      setProgress(null);
      try {
        const body = JSON.parse(request.responseText) as { ok: boolean; error?: string; files?: number };
        if (body.ok) {
          setStatus({ ok: `Сборка загружена: файлов — ${body.files}. Участники уже видят новую версию.` });
          router.refresh();
        } else {
          setStatus({ error: body.error ?? "Сборка не загрузилась" });
        }
      } catch {
        setStatus({ error: "Сервер не принял сборку. Проверьте размер — до 200 МБ" });
      }
    };
    request.onerror = () => {
      setProgress(null);
      setStatus({ error: "Нет связи с сервером" });
    };
    setStatus({});
    setProgress(0);
    request.send(form);
  };

  const remove = async () => {
    if (!confirm("Удалить сборку? Участники перестанут её видеть.")) return;
    const response = await fetch(`/api/admin/build?program=${encodeURIComponent(slug)}`, { method: "DELETE" });
    const body = (await response.json()) as { ok: boolean; error?: string };
    setStatus(body.ok ? { ok: "Сборка удалена" } : { error: body.error });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-paper-warm px-5 py-4 text-ui">
        {uploadedAt ? (
          <>
            <span className="text-ink">
              Загружена {new Date(uploadedAt).toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })}
            </span>
            <a
              href={`/programs/${slug}/build/index.html`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-semibold text-navy"
            >
              Открыть
              <ExternalLink size={13} />
            </a>
            <Button tone="danger" size="sm" className="ml-auto" onClick={remove}>
              <Trash2 size={13} />
              Удалить сборку
            </Button>
          </>
        ) : (
          <span className="text-ink-soft">Сборка ещё не загружена.</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          // Выбор папки целиком: так сохраняется структура сборки
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(event) => upload(event.target.files)}
        />
        <input
          ref={filesRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => upload(event.target.files)}
        />
        <Button onClick={() => folderRef.current?.click()} disabled={progress !== null}>
          <FolderUp size={15} />
          {uploadedAt ? "Заменить папкой" : "Загрузить папку"}
        </Button>
        <Button tone="quiet" onClick={() => filesRef.current?.click()} disabled={progress !== null}>
          <Upload size={15} />
          Выбрать файлы
        </Button>
      </div>

      {progress !== null && (
        <div className="flex items-center gap-3" role="status">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sky-tint">
            <div className="h-full rounded-full bg-navy transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <span className="w-12 text-right text-meta text-ink-soft tabular-nums">{progress}%</span>
        </div>
      )}

      <Result state={status} />

      <ul className="m-0 grid gap-1.5 pl-5 text-meta leading-relaxed text-ink-soft">
        <li>В корне папки — <code>index.html</code>; ссылки на стили, скрипты и картинки — относительные.</li>
        <li>До 200 МБ и 2000 файлов; поддерживаются HTML, CSS, JS, шрифты, изображения, видео, PDF.</li>
        <li>Новая загрузка полностью заменяет прежнюю сборку.</li>
      </ul>
    </div>
  );
}

/** Удаление программы — только администратор Центра, с подтверждением адресом. */
export function DeleteProgram({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(deleteProgramAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <p className="m-0 text-ui leading-relaxed text-ink-soft">
        Удалятся расписание, материалы, сборка, чаты, опросы и состав. Вернуть не получится.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <TextField label={`Введите адрес программы: ${slug}`} name="confirm" autoComplete="off" required />
        </div>
        <Button type="submit" tone="danger" disabled={pending}>
          <Trash2 size={15} />
          Удалить программу
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}
