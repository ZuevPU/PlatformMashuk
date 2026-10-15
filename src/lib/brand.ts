import type { SeasonKey } from "./types";

/**
 * Фирменная палитра — значения из «Руководства по использованию
 * фирменного стиля» АНО «Центр знаний «Машук» (стр. 10–14).
 *
 * Здесь собраны только те значения, которые нужны в JS/TS-коде
 * (метатеги, инлайновые SVG, генерация превью). Интерфейс использует
 * CSS-переменные из globals.css.
 */
export const BRAND = {
  navy: "#223F9A",
  teal: "#0B4D4D",
  grey: "#DCDEDD",
  ink: "#332D24",
  black: "#0A1014",
  sky: "#54A4DB",
  gold: "#A2855F",
  paper: "#FAFAFA",
  white: "#FFFFFF",
} as const;

export interface SeasonScheme {
  key: SeasonKey;
  label: string;
  /** Дополнительный (акцентный) цвет схемы */
  accent: string;
  /** Второй основной цвет схемы — используется в логотипе и шапках */
  strong: string;
  /** Производный светлый тон акцента для подложек */
  tint: string;
  /** Тёмный тон акцента для текста на светлом фоне (контраст ≥ 5:1) */
  ink: string;
  /** Однотонный логотип сезона */
  logo: string;
  /** Месяцы сезона (1–12) */
  months: number[];
}

export const SEASONS: Record<SeasonKey, SeasonScheme> = {
  spring: {
    key: "spring",
    label: "Весна",
    accent: "#3AD754",
    strong: "#0B4D4D",
    tint: "#E6F8EA",
    ink: "#18712E",
    logo: "/brand/logo/seasonal/logo_full_spring.svg",
    months: [3, 4, 5],
  },
  summer: {
    key: "summer",
    label: "Лето",
    accent: "#FF5B00",
    strong: "#F18300",
    tint: "#FFEDE1",
    ink: "#B84100",
    logo: "/brand/logo/seasonal/logo_full_summer.svg",
    months: [6, 7, 8],
  },
  autumn: {
    key: "autumn",
    label: "Осень",
    accent: "#F24559",
    strong: "#F68E9A",
    tint: "#FDE9EC",
    ink: "#B02A3C",
    logo: "/brand/logo/seasonal/logo_full_autumn.svg",
    months: [9, 10, 11],
  },
  winter: {
    key: "winter",
    label: "Зима",
    accent: "#4582F2",
    strong: "#D6E3FB",
    tint: "#E8F0FE",
    ink: "#2A5BBD",
    logo: "/brand/logo/seasonal/logo_full_winter.svg",
    months: [12, 1, 2],
  },
};

/**
 * CSS-переменные акцента программы для style={…}. Задают все токены сезона
 * сразу, чтобы ни один не остался от другого сезона.
 */
export function seasonStyle(season: SeasonKey): Record<string, string> {
  const scheme = SEASONS[season];
  return {
    "--accent": scheme.accent,
    "--accent-strong": scheme.strong,
    "--accent-ink": scheme.ink,
  };
}

export const SEASON_ORDER: SeasonKey[] = ["spring", "summer", "autumn", "winter"];

/** Логотипы: основная, упрощённая и компактная версии (руководство, стр. 3–6). */
export const LOGOS = {
  full: "/brand/logo/logo_full_color.svg",
  fullWhite: "/brand/logo/logo_full_white.svg",
  fullBlack: "/brand/logo/logo_full_black.svg",
  simple: "/brand/logo/logo_simple_color.svg",
  simpleWhite: "/brand/logo/logo_simple_white.svg",
  compact: "/brand/logo/logo_compact_color.svg",
  compactWhite: "/brand/logo/logo_compact_white.svg",
  en: "/brand/logo/logo_en_color.svg",
} as const;

/** Набор фирменных иконок (руководство, стр. 17–18). */
export const ICONS = {
  cap: "/brand/icons/Icon_cap.svg",
  bells: "/brand/icons/icon_bell.svg",
  forest: "/brand/icons/icon_forest.svg",
  mountains: "/brand/icons/icon_mountains.svg",
  fox: "/brand/icons/icon_fox.svg",
} as const;

export const MASCOT = {
  front: "/brand/mascot/maskot_front_3_4.png",
} as const;
