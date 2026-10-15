import type { MetadataRoute } from "next";
import { getAllPrograms } from "@/lib/data";

/** Карта сайта: главная и страницы программ. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUBLIC_URL?.replace(/\/$/, "") || "https://109.71.247.90.sslip.io";
  const programs = await getAllPrograms();

  return [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...programs.map((program) => ({
      url: `${base}/programs/${program.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
