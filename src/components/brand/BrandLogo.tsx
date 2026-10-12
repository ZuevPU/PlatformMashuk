import { LOGOS } from "@/lib/brand";

type LogoVariant = keyof typeof LOGOS;

const SIZES: Record<LogoVariant, { width: number; height: number }> = {
  full: { width: 1920, height: 586 },
  fullWhite: { width: 1920, height: 586 },
  fullBlack: { width: 1920, height: 586 },
  simple: { width: 1080, height: 735 },
  simpleWhite: { width: 1080, height: 735 },
  compact: { width: 1080, height: 735 },
  compactWhite: { width: 1080, height: 735 },
  en: { width: 1920, height: 586 },
};

interface BrandLogoProps {
  variant?: LogoVariant;
  width?: number;
  className?: string;
  /** Осмысленная подпись: логотип не должен быть «декоративной картинкой» */
  alt?: string;
  priority?: boolean;
}

/**
 * Логотип АНО «Центр знаний «Машук» в одной из фирменных версий.
 * Пропорции фиксированы руководством и не изменяются (стр. 3–8).
 */
export function BrandLogo({
  variant = "full",
  width = 168,
  className,
  alt = "Центр знаний «Машук»",
  priority = false,
}: BrandLogoProps) {
  const size = SIZES[variant];
  const height = Math.round((width / size.width) * size.height);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- фирменный SVG отдаётся как есть, без оптимизации
    <img
      src={LOGOS[variant]}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
