import type { RichDoc, RichNode } from "./types";

/**
 * Конструкторы содержимого в формате TipTap JSON.
 * Нужны там, где текст задаётся кодом (демонстрационные данные, шаблоны постов),
 * и на сервере — при формировании стартового контента.
 */

type Item = string | RichNode;

function toNodes(items: Item[]): RichNode[] {
  return items.map((item) => (typeof item === "string" ? { type: "text", text: item } : item));
}

export function doc(...content: RichNode[]): RichDoc {
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

export function p(...items: Item[]): RichNode {
  return { type: "paragraph", content: toNodes(items) };
}

function marked(text: string, type: string, attrs?: Record<string, unknown>): RichNode {
  return { type: "text", text, marks: [{ type, ...(attrs ? { attrs } : {}) }] };
}

export const b = (text: string) => marked(text, "bold");
export const i = (text: string) => marked(text, "italic");
export const u = (text: string) => marked(text, "underline");
export const s = (text: string) => marked(text, "strike");
export const code = (text: string) => marked(text, "code");
export const link = (text: string, href: string) =>
  marked(text, "link", { href, target: "_blank", rel: "noopener noreferrer" });

/** Ненавязчивое упоминание участника: подсвечивается при рендере */
export const mention = (name: string) => marked(`@${name}`, "mention", { name });

export function h(level: 2 | 3, text: string): RichNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

export function ul(items: Item[][]): RichNode {
  return {
    type: "bulletList",
    content: items.map((items2) => ({ type: "listItem", content: [p(...items2)] })),
  };
}

export function ol(items: Item[][]): RichNode {
  return {
    type: "orderedList",
    content: items.map((items2) => ({ type: "listItem", content: [p(...items2)] })),
  };
}

export function quote(...items: Item[]): RichNode {
  return { type: "blockquote", content: [p(...items)] };
}

export function image(url: string, alt = ""): RichNode {
  return { type: "image", attrs: { src: url, alt } };
}

/** Извлекает простой текст документа — нужен для превью и поиска. */
export function docToText(node: RichNode | RichDoc): string {
  if ("text" in node && typeof node.text === "string") return node.text;
  const children = node.content ?? [];
  const separator = node.type === "doc" || node.type === "bulletList" || node.type === "orderedList" ? "\n" : "";
  return children.map(docToText).join(separator);
}
