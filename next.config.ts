import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Сборка для Docker: рантайм берётся из .next/standalone (нужен только Node)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Явно фиксируем корень проекта: иначе Turbopack ищет его выше по дереву
  // и подхватывает служебные файлы из домашнего каталога.
  turbopack: {
    root: process.cwd(),
  },
  // Локальная разработка открывается и по 127.0.0.1, и по localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Индикатор разработки перекрывает содержимое на скриншотах
  devIndicators: false,
};

export default nextConfig;
