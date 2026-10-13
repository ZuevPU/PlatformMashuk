import type { Member, MemberRole } from "@/lib/types";
import { MEMBER_ROLE_LABELS } from "@/lib/types";

/**
 * Фирменные тона аватаров: основной синий, бирюзовый, песочный, голубой.
 * Только тёмные тона — белые инициалы на них читаются (контраст ≥ 5:1).
 */
const TONES = [
  "var(--color-navy)",
  "var(--color-teal)",
  "var(--color-gold-ink)",
  "var(--color-sky-ink)",
  "var(--color-navy-deep)",
];

function toneIndex(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973;
  }
  return hash % TONES.length;
}

export function initials(name: string): string {
  const words = name.replace(/[«»"]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function Avatar({
  member,
  size = 42,
}: {
  member: Member | undefined;
  size?: number;
}) {
  const name = member?.name ?? "Участник";

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: TONES[toneIndex(name)],
        fontSize: Math.round(size * 0.36),
        letterSpacing: "0.02em",
      }}
    >
      {initials(name)}
    </span>
  );
}

const ROLE_STYLES: Record<MemberRole, string> = {
  admin: "bg-navy/10 text-navy",
  moderator: "bg-gold/14 text-gold-ink",
  participant: "bg-grey-brand/60 text-ink-soft",
};

export function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-micro font-semibold tracking-[0.06em] uppercase ${ROLE_STYLES[role]}`}
    >
      {MEMBER_ROLE_LABELS[role]}
    </span>
  );
}
