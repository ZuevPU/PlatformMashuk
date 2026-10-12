import type { ReactNode } from "react";
import type { RichDoc, RichMark, RichNode } from "@/lib/types";

interface RichTextProps {
  content: RichDoc | RichNode;
  /** Имена участников: их упоминания подсвечиваются в тексте */
  mentionNames?: string[];
  compact?: boolean;
  className?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionRegex(names: string[]): RegExp | null {
  if (names.length === 0) return null;
  const alternation = names
    .filter(Boolean)
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join("|");
  return alternation ? new RegExp(`@(?:${alternation})`, "g") : null;
}

interface TextPart {
  text: string;
  mention: boolean;
}

function splitMentions(text: string, regex: RegExp | null): TextPart[] {
  if (!regex || text.length === 0) return [{ text, mention: false }];

  const parts: TextPart[] = [];
  let lastIndex = 0;
  regex.lastIndex = 0;

  let match = regex.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), mention: false });
    }
    parts.push({ text: match[0], mention: true });
    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), mention: false });
  return parts.length > 0 ? parts : [{ text, mention: false }];
}

/** Оборачивает содержимое узла применимыми marks (жирный, курсив, ссылка и т. д.). */
function withMarks(children: ReactNode, marks: RichMark[], key: string): ReactNode {
  return marks.reduce<ReactNode>((acc, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong>{acc}</strong>;
      case "italic":
        return <em>{acc}</em>;
      case "underline":
        return <u>{acc}</u>;
      case "strike":
        return <s>{acc}</s>;
      case "code":
        return <code>{acc}</code>;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {acc}
          </a>
        );
      }
      case "mention":
        return <span className="mention">{acc}</span>;
      default:
        return acc;
    }
  }, children);
}

function renderTextNode(node: RichNode, regex: RegExp | null, key: string): ReactNode {
  const marks = node.marks ?? [];
  const isMention = marks.some((mark) => mark.type === "mention");
  const parts = splitMentions(node.text ?? "", regex);

  const children = parts.map((part, index) =>
    part.mention || isMention ? (
      <span key={index} className="mention">
        {part.text}
      </span>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );

  const inlineMarks = marks.filter((mark) => mark.type !== "mention" || !isMention);
  return (
    <span key={key}>{withMarks(children, inlineMarks, key)}</span>
  );
}

function renderNode(node: RichNode, regex: RegExp | null, key: string): ReactNode {
  const children = () =>
    (node.content ?? []).map((child, index) => renderNode(child, regex, `${key}-${index}`));

  switch (node.type) {
    case "doc":
      return <div key={key}>{children()}</div>;
    case "paragraph":
      return <p key={key}>{children()}</p>;
    case "heading": {
      const level = Number(node.attrs?.level ?? 3);
      return level >= 4 ? <h4 key={key}>{children()}</h4> : <h3 key={key}>{children()}</h3>;
    }
    case "text":
      return renderTextNode(node, regex, key);
    case "bulletList":
      return <ul key={key}>{children()}</ul>;
    case "orderedList":
      return <ol key={key}>{children()}</ol>;
    case "listItem":
      return <li key={key}>{children()}</li>;
    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children()}</code>
        </pre>
      );
    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      // Изображения приходят только из загруженных вложений; внешние не рендерим
      if (!src) return null;
      // eslint-disable-next-line @next/next/no-img-element -- превью загруженного файла
      return <img key={key} src={src} alt={alt} loading="lazy" />;
    }
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    default:
      return <div key={key}>{children()}</div>;
  }
}

/**
 * Рендер содержимого постов и комментариев.
 * Документ описывается структурой TipTap JSON и превращается в React-узлы:
 * произвольная разметка извне попасть в страницу не может.
 */
export function RichText({ content, mentionNames = [], compact, className }: RichTextProps) {
  const regex = buildMentionRegex(mentionNames);

  return (
    <div className={["rich", compact ? "rich--compact" : "", className].filter(Boolean).join(" ")}>
      {renderNode(content as RichNode, regex, "r")}
    </div>
  );
}
