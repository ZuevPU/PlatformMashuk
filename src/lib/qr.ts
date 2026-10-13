import qrcode from "./qrcode-generator.js";

/**
 * QR-код для ссылки-приглашения в опрос.
 *
 * Генерируется целиком в браузере (вендоренная библиотека, без сети):
 * так адрес опроса не уходит на сторонние сервисы картинок. Возвращается
 * data-URL — его можно отдать прямо в src у <img>.
 */
export function qrDataUrl(text: string, cellSize = 8): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize, 4);
}
