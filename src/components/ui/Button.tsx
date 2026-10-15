import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "solid" | "light" | "ghost" | "outline";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap no-underline transition-all duration-200 ease-brand";

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5.5 text-sm",
  sm: "min-h-10 px-4 text-xs",
};

/**
 * Фирменные кнопки. Форма — пилюля, как в авторских одностраничниках Центра.
 * Обводка сделана через inset box-shadow: это точнее повторяет фирменную
 * верстку и не зависит от версии утилит Tailwind.
 */
const VARIANTS: Record<Variant, string> = {
  solid: "bg-navy text-white hover:bg-navy-deep hover:-translate-y-0.5",
  light: "bg-white text-navy hover:bg-sky-tint hover:-translate-y-0.5",
  ghost:
    "bg-transparent text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] hover:bg-white/10 hover:-translate-y-0.5",
  outline:
    "bg-white text-navy shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_rgba(34,63,154,0.4)] hover:-translate-y-0.5",
};

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

interface LinkProps extends CommonProps {
  href: string;
  external?: boolean;
}

function classes(variant: Variant, size: Size, className?: string) {
  return [BASE, SIZES[size], VARIANTS[variant], className].filter(Boolean).join(" ");
}

export function ButtonLink({
  href,
  children,
  variant = "solid",
  size = "md",
  className,
  external = false,
}: LinkProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes(variant, size, className)}
      >
        {children}
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <Link href={href} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}

export function ButtonAction({
  children,
  variant = "solid",
  size = "md",
  className,
  type = "button",
  onClick,
  disabled,
}: CommonProps & {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${classes(variant, size, className)} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
