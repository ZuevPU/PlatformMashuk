import localFont from "next/font/local";

/**
 * Основной фирменный шрифт — Geologica (свободная лицензия, SIL OFL).
 * Подключается локально: без Google Fonts CDN, как требует руководство
 * по фирменному стилю и требования к обработке персональных данных.
 */
export const geologica = localFont({
  src: [
    { path: "../assets/fonts/geologica/Geologica-Light.ttf", weight: "300", style: "normal" },
    { path: "../assets/fonts/geologica/Geologica-Regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/geologica/Geologica-Medium.ttf", weight: "500", style: "normal" },
    { path: "../assets/fonts/geologica/Geologica-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../assets/fonts/geologica/Geologica-Bold.ttf", weight: "700", style: "normal" },
    { path: "../assets/fonts/geologica/Geologica-Light-Italic.ttf", weight: "300", style: "italic" },
  ],
  variable: "--font-geologica",
  display: "swap",
  fallback: ["Verdana", "Arial", "sans-serif"],
});

/**
 * Дополнительный шрифт — Noto Serif.
 * Применяется для методических, аналитических и образовательных материалов,
 * а также для вводных абзацев (lead) — по руководству, стр. 22.
 */
export const notoSerif = localFont({
  src: [
    { path: "../assets/fonts/noto-serif/NotoSerif-Light.ttf", weight: "300", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-Italic.ttf", weight: "400", style: "italic" },
    { path: "../assets/fonts/noto-serif/NotoSerif-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-noto-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
