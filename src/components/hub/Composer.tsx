"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AtSign,
  Bold,
  Check,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Send,
  Strikethrough,
  Underline,
  X,
} from "lucide-react";
import type { Attachment, Member, RichDoc } from "@/lib/types";
import { MEMBER_ROLE_LABELS } from "@/lib/types";

export interface ComposerPayload {
  title?: string;
  body: RichDoc;
  attachments: Attachment[];
}

interface ComposerProps {
  mode: "post" | "comment";
  members: Member[];
  placeholder?: string;
  onSubmit: (payload: ComposerPayload) => void;
  onCancel?: () => void;
  compact?: boolean;
  autoFocus?: boolean;
  /** Подпись кнопки отправки: в чате это «Отправить», в комментариях — «Ответить» */
  submitLabel?: string;
}

/**
 * Редактор сообщения: простое форматирование, ссылки, упоминания участников
 * и загрузка фотографий. Содержимое сохраняется как документ TipTap JSON.
 */
/**
 * Загрузка изображения на сервер.
 * Сразу показываем локальное превью, затем подменяем адрес на постоянный:
 * после перезагрузки фотография остаётся на месте.
 */
async function uploadImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file);

  try {
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const data = (await response.json()) as { ok: boolean; url?: string; error?: string };
    if (!data.ok || !data.url) {
      return { ok: false, error: data.error ?? "Не удалось загрузить файл" };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Сервер не принял файл" };
  }
}

export function Composer({
  mode,
  members,
  placeholder,
  onSubmit,
  onCancel,
  compact = false,
  autoFocus = false,
  submitLabel,
}: ComposerProps) {
  const [title, setTitle] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? (mode === "post" ? "Текст поста для участников…" : "Написать комментарий…"),
      }),
    ],
    content: "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    autofocus: autoFocus,
    editorProps: {
      attributes: { class: "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy" },
    },
  });

  const mentionCandidates = useMemo(() => {
    const order = { admin: 0, moderator: 1, participant: 2 } as const;
    return [...members].sort((a, b) => order[a.role] - order[b.role]).slice(0, 10);
  }, [members]);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;

    for (const file of images) {
      counter.current += 1;
      const localId = `local-${counter.current}`;

      setAttachments((previous) => [
        ...previous,
        { id: localId, kind: "image" as const, url: URL.createObjectURL(file), alt: file.name },
      ]);

      void uploadImage(file).then((result) => {
        if (!result.ok) {
          setUploadError(result.error);
          setAttachments((previous) => previous.filter((item) => item.id !== localId));
          return;
        }
        setAttachments((previous) =>
          previous.map((item) => (item.id === localId ? { ...item, url: result.url } : item)),
        );
      });
    }
  }, []);

  const canSubmit = Boolean(editor) && (!editor?.isEmpty || attachments.length > 0);

  const submit = useCallback(() => {
    if (!editor) return;
    if (editor.isEmpty && attachments.length === 0) return;

    onSubmit({
      title: mode === "post" ? title.trim() || undefined : undefined,
      body: editor.getJSON() as RichDoc,
      attachments,
    });

    editor.commands.clearContent(true);
    setTitle("");
    setAttachments([]);
    setLinkOpen(false);
    setMentionsOpen(false);
  }, [attachments, editor, mode, onSubmit, title]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) {
      setLinkOpen(false);
      return;
    }
    const normalized = /^https?:\/\//i.test(href) ? href : `https://${href}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    setLinkUrl("");
    setLinkOpen(false);
  }, [editor, linkUrl]);

  if (!editor) {
    return <div className="min-h-35 rounded-soft border border-[var(--line)] bg-white" />;
  }

  return (
    <div
      className={[
        "rounded-soft border border-[var(--line)] bg-white transition-shadow duration-200",
        "focus-within:shadow-[var(--shadow-soft)]",
        compact ? "editor editor--compact" : "editor",
      ].join(" ")}
      onDrop={(event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }
      }}
      onPaste={(event) => {
        if (event.clipboardData?.files?.length) addFiles(event.clipboardData.files);
      }}
    >
      {mode === "post" && (
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Заголовок поста (необязательно)"
          className="w-full rounded-t-soft border-b border-[var(--line)] bg-transparent px-4 py-3 font-display text-lead font-semibold tracking-[-0.02em] text-navy outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy placeholder:font-body placeholder:text-body placeholder:font-normal placeholder:text-ink-faint"
        />
      )}

      <div className="px-3 pt-2">
        <EditorContent editor={editor} />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5 px-4 pb-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- локальное превью до загрузки на сервер */}
              <img
                src={attachment.url}
                alt={attachment.alt}
                className="size-21 rounded-xl border border-[var(--line)] object-cover"
              />
              <button
                type="button"
                aria-label={`Убрать ${attachment.alt}`}
                onClick={() =>
                  setAttachments((previous) => previous.filter((item) => item.id !== attachment.id))
                }
                className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-white text-ink-soft transition-colors duration-200 hover:text-navy"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <p className="m-0 px-4 pb-3 text-caption text-danger">
          Фотография не загрузилась: {uploadError}
        </p>
      )}

      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                insertLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
            placeholder="Адрес ссылки: example.ru"
            className="min-h-9 min-w-60 flex-1 rounded-full border border-[var(--line)] bg-white px-3.5 text-meta outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus:border-navy"
          />
          <button
            type="button"
            onClick={insertLink}
            className="tool"
            data-active="true"
            aria-label="Вставить ссылку"
            title="Вставить ссылку"
          >
            <Check size={15} />
          </button>
        </div>
      )}

      {mentionsOpen && (
        <div className="mx-4 mb-3 max-h-55 overflow-auto rounded-field border border-[var(--line)] bg-white p-2">
          {mentionCandidates.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                editor.chain().focus().insertContent(`@${member.name.split(" ")[0]} `).run();
                setMentionsOpen(false);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-chip px-3 py-2 text-left transition-colors duration-150 hover:bg-sky-tint"
            >
              <span className="text-meta font-medium text-ink">{member.name}</span>
              <span className="text-micro text-ink-faint">
                {MEMBER_ROLE_LABELS[member.role]}
                {member.position ? ` · ${member.position}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 border-t border-[var(--line)] px-3 py-2.5">
        <button type="button" className="tool" data-active={editor.isActive("bold")} title="Жирный" onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </button>
        <button type="button" className="tool" data-active={editor.isActive("italic")} title="Курсив" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </button>
        <button type="button" className="tool" data-active={editor.isActive("underline")} title="Подчёркнутый" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline size={15} />
        </button>
        <button type="button" className="tool" data-active={editor.isActive("strike")} title="Зачёркнутый" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--line)]" />
        <button type="button" className="tool" data-active={editor.isActive("bulletList")} title="Список" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </button>
        <button type="button" className="tool" data-active={editor.isActive("orderedList")} title="Нумерованный список" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </button>
        <button type="button" className="tool" data-active={editor.isActive("blockquote")} title="Цитата" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--line)]" />
        <button type="button" className="tool" data-active={editor.isActive("link")} title="Ссылка" onClick={() => setLinkOpen((value) => !value)}>
          <Link2 size={15} />
        </button>
        <button type="button" className="tool" data-active={mentionsOpen} title="Упомянуть участника" onClick={() => setMentionsOpen((value) => !value)}>
          <AtSign size={15} />
        </button>
        <button type="button" className="tool" title="Прикрепить фотографию" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={15} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-9 cursor-pointer rounded-full px-3.5 text-meta text-ink-soft transition-colors duration-200 hover:text-navy"
            >
              Отмена
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-navy px-4 text-meta font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} />
            {submitLabel ?? (mode === "post" ? "Опубликовать" : "Ответить")}
          </button>
        </div>
      </div>
    </div>
  );
}
