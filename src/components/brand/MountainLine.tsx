/**
 * Фирменный графический якорь — линия горного хребта Машука.
 * Используется в hero-блоках на фирменном фоне (наследует цвет через currentColor).
 */
export function MountainLine({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `mountain-line ${className}` : "mountain-line"}
      viewBox="0 0 1200 260"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        d="M0 245L145 140l70 58 112-124 98 104 100-72 116 91 94-156 105 122 108-76 102 116 150-133"
      />
      <path
        fill="currentColor"
        fillOpacity={0.18}
        d="M0 245L145 140l70 58 112-124 98 104 100-72 116 91 94-156 105 122 108-76 102 116 150-133v190H0z"
      />
    </svg>
  );
}
