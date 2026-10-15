/**
 * Типы для вендоренной библиотеки генерации QR (qrcode-generator, MIT,
 * Kazuhiko Arase). Пакет без зависимостей, положен рядом как исходник —
 * чтобы не тянуть сетевые модули и не менять lock-файл.
 */

export interface QRCodeInstance {
  addData(data: string, mode?: "Numeric" | "Alphanumeric" | "Byte" | "Kanji"): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
  /** Готовый data-URL картинки (GIF) — удобно вставлять в <img src>. */
  createDataURL(cellSize?: number, margin?: number): string;
  createSvgTag(options?: {
    cellSize?: number;
    margin?: number;
    scalable?: boolean;
    alt?: string;
    title?: string;
  }): string;
}

declare function qrcode(
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H",
): QRCodeInstance;

export default qrcode;
