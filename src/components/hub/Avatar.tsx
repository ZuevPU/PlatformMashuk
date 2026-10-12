import type { Member, MemberRole } from "@/lib/types";
import { MEMBER_ROLE_LABELS } from "@/lib/types";

/** Фирменные тона аватаров: основной синий, бирюзовый, песочный, голубой. */
const TONES = ["#223F9A", "#0B4D4D", "#A2855F", "#246A99", "#192F78"];

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
  admin: "background: rgba(34,63,154,0.1); color: #223F9A;",
  moderator: "background: rgba(162,133,95,0.14); color: #7C6440;",
  participant: "background: rgba(220,222,221,0.6); color: #655D53;",
};

export function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase"
      style={Object.fromEntries(
        ROLE_STYLES[role]
          .split(";")
          .filter(Boolean)
          .map((rule) => {
            const [property, value] = rule.split(":");
            const camel = property
              .trim()
              .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
            return [camel, value.trim()];
          }),
      )}
    >
      {MEMBER_ROLE_LABELS[role]}
    </span>
  );
}
