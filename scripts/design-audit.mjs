/**
 * Автоматический аудит дизайна по токенам фирменного стиля.
 *
 * Запуск: node scripts/design-audit.mjs [--all]
 * Проверяет src/ на хардкод цветов вне токенов, произвольные значения Tailwind,
 * посторонние шрифты и базовую доступность; считает контраст пар токенов (WCAG).
 * Вывод компактный: «файл:строка — проблема», по умолчанию до 15 строк на правило
 * (--all — без ограничения).
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = "src";
const SHOW_ALL = process.argv.includes("--all");
const LIMIT = 15;

/** Файлы, где цвета и шрифты задавать можно: источники токенов. */
const TOKEN_SOURCES = new Set(["src/app/globals.css", "src/lib/brand.ts", "src/lib/fonts.ts"]);

/** Файлы, где хардкод цвета оправдан (рисование на canvas, генерация картинок). */
const CANVAS_FILES = new Set(["src/lib/export.ts"]);

const RULES = [
  {
    id: "hex-color",
    title: "Хардкод цвета вместо токена",
    test: /#[0-9a-fA-F]{3,8}\b(?![\w-])/g,
    skip: (file) => TOKEN_SOURCES.has(file) || CANVAS_FILES.has(file) || file.endsWith(".svg"),
    lineFilter: (line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && !/href=|id=|#[a-z-]+"/.test(line),
  },
  {
    id: "rgb-color",
    title: "rgb()/hsl() в компонентах вместо токена",
    test: /\b(rgba?|hsla?)\(/g,
    skip: (file) => TOKEN_SOURCES.has(file) || CANVAS_FILES.has(file),
  },
  {
    id: "tw-arbitrary-color",
    title: "Произвольный цвет Tailwind (text-[#..], bg-[rgb..])",
    test: /\b[a-z-]+-\[(#|rgb|hsl)[^\]]*\]/g,
  },
  {
    id: "tw-arbitrary-size",
    title: "Произвольный размер Tailwind (p-[13px]) — проверить, нет ли токена",
    test: /\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap|text|rounded|w|h|max-w|min-h)-\[\d+(\.\d+)?px\]/g,
    summary: true,
  },
  {
    id: "foreign-font",
    title: "Посторонний шрифт (брендбук: Geologica, Noto Serif, fallback Verdana)",
    test: /font-family\s*:|fontFamily\s*[:=]|\b(Inter|Roboto|Arial|Helvetica|Open Sans|Montserrat)\b/g,
    skip: (file) => TOKEN_SOURCES.has(file) || CANVAS_FILES.has(file),
  },
  {
    id: "linear-gradient",
    title: "Линейный градиент (брендбук рекомендует mesh/радиальные)",
    test: /linear-gradient|bg-gradient-to-|bg-linear-/g,
    // 1px-сетка фирменного паттерна рисуется linear-gradient — это линии, а не цветовой переход
    lineFilter: (line) => !line.includes(" 1px"),
  },
  {
    id: "img-no-alt",
    title: "<img>/<Image> без alt",
    test: /<(img|Image)\b(?![^>]*\balt=)[^>]*>/g,
  },
  {
    id: "icon-button-no-label",
    title: "Кнопка без текста и aria-label (проверить вручную)",
    test: /<button\b(?![^>]*aria-label)[^>]*>\s*<[A-Z]\w*[^>]*\/>\s*<\/button>/g,
    multiline: true,
  },
  {
    id: "outline-none",
    title: "Убран фокус (outline-none) — нужен видимый focus-visible",
    test: /\boutline-none\b(?![^"'`]*focus-visible)/g,
  },
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (/\.(tsx?|css|mjs)$/.test(entry.name)) out.push(path);
  }
  return out;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

// --- Контраст (WCAG 2.x) ---------------------------------------------------

function luminance(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function parseTokens(css) {
  const tokens = {};
  for (const m of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2];
  return tokens;
}

/** Пары «текст на фоне», которые реально встречаются в интерфейсе. */
const PAIRS = [
  ["ink", "paper", "основной текст"],
  ["ink-soft", "paper", "вторичный текст"],
  ["ink-muted", "paper", "приглушённый текст"],
  ["ink-faint", "paper", "самый бледный текст"],
  ["navy", "paper", "ссылки/заголовки"],
  ["sky-ink", "sky-pale", "текст на голубой подложке"],
  ["paper", "navy", "белый на navy (кнопки)"],
  ["paper", "teal", "белый на teal"],
  ["gold-ink", "paper", "золото как текст (eyebrow, время)"],
  ["danger", "paper", "текст ошибки"],
];

/** Токены сезонов из globals.css: акцент, текст на акценте и акцент как текст. */
function parseSeasons(css) {
  const block = (selector) => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
  };
  const value = (text, name) => text.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  const root = block(":root");
  const blocks = { "по умолчанию": root };
  for (const key of ["spring", "summer", "autumn", "winter"]) blocks[key] = block(`[data-season="${key}"]`);
  return Object.entries(blocks).map(([key, text]) => ({
    key,
    accent: value(text, "accent"),
    ink: value(text, "accent-ink"),
    onAccent: value(text, "on-accent") ?? value(root, "on-accent"),
  }));
}

async function main() {
  const files = await walk(ROOT);
  const findings = new Map(RULES.map((r) => [r.id, []]));

  for (const path of files) {
    const file = relative(".", path).replaceAll("\\", "/");
    const text = await readFile(path, "utf8");
    const lines = text.split("\n");
    for (const rule of RULES) {
      if (rule.skip?.(file)) continue;
      for (const m of text.matchAll(rule.test)) {
        const line = lineOf(text, m.index);
        const src = lines[line - 1] ?? "";
        if (rule.lineFilter && !rule.lineFilter(src)) continue;
        findings.get(rule.id).push(`${file}:${line} — ${m[0].replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }
  }

  let total = 0;
  console.log("# Аудит дизайна: код\n");
  for (const rule of RULES) {
    const list = findings.get(rule.id);
    total += list.length;
    if (!list.length) continue;
    console.log(`## ${rule.title} [${rule.id}] — ${list.length}`);
    if (rule.summary && !SHOW_ALL) {
      const byFile = new Map();
      for (const item of list) {
        const file = item.slice(0, item.lastIndexOf(":", item.indexOf(" — ")));
        byFile.set(file, (byFile.get(file) ?? 0) + 1);
      }
      const top = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8);
      for (const [file, count] of top) console.log(`  ${String(count).padStart(4)}  ${file}`);
      console.log("  (сводка по файлам; подробно — --all)\n");
      continue;
    }
    for (const item of SHOW_ALL ? list : list.slice(0, LIMIT)) console.log(`  ${item}`);
    if (!SHOW_ALL && list.length > LIMIT) console.log(`  … ещё ${list.length - LIMIT} (запустите с --all)`);
    console.log();
  }
  if (!total) console.log("Нарушений по правилам кода не найдено.\n");

  const css = await readFile("src/app/globals.css", "utf8");
  const tokens = parseTokens(css);
  console.log("# Контраст пар токенов (WCAG AA: 4.5 текст, 3.0 крупный текст/иконки)\n");
  for (const [fg, bg, note] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) continue;
    const ratio = contrast(tokens[fg], tokens[bg]);
    const mark = ratio >= 4.5 ? "OK " : ratio >= 3 ? "LG " : "FAIL";
    console.log(`  ${mark} ${ratio.toFixed(2).padStart(5)}  ${fg} на ${bg} — ${note}`);
  }

  console.log("\n# Сезоны: текст на акцентной заливке (on-accent) и акцент как текст (accent-ink)\n");
  const mark = (ratio) => (ratio >= 4.5 ? "OK " : ratio >= 3 ? "LG " : "FAIL");
  for (const season of parseSeasons(css)) {
    if (!season.accent || !season.onAccent || !season.ink) continue;
    const onAccent = contrast(season.onAccent, season.accent);
    const ink = contrast(season.ink, tokens.paper);
    console.log(`  ${mark(onAccent)} ${onAccent.toFixed(2).padStart(5)}  on-accent на акценте — ${season.key}`);
    console.log(`  ${mark(ink)} ${ink.toFixed(2).padStart(5)}  accent-ink на paper — ${season.key}`);
  }

  console.log("\nБелый текст на акцентной заливке не используем: для него есть text-on-accent.");
  console.log("LG — годится только для крупного текста (от 24px или 19px bold) и иконок.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
