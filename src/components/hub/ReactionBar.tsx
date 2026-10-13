"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { REACTION_SET } from "@/lib/types";
import type { ReactionSummary } from "@/lib/types";

interface ReactionBarProps {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  compact?: boolean;
}

export function ReactionBar({ reactions, onToggle, compact = false }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const size = compact ? 12 : 14;
  const padding = compact ? "px-2 py-0.5 text-micro" : "px-2.5 py-1 text-caption";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onToggle(reaction.emoji)}
          aria-pressed={reaction.mine}
          className={[
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 ease-brand",
            padding,
            reaction.mine
              ? "border-transparent"
              : "border-[var(--line)] bg-white text-ink-soft hover:-translate-y-0.5",
          ].join(" ")}
          style={
            reaction.mine
              ? {
                  background: "color-mix(in oklab, var(--accent) 12%, white)",
                  color: "var(--accent-ink)",
                }
              : undefined
          }
        >
          <span aria-hidden="true">{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-label="Добавить реакцию"
          onClick={() => setPickerOpen((value) => !value)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-ink-faint transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:text-navy"
        >
          <SmilePlus size={size} />
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-10 mb-2 flex gap-0.5 rounded-full border border-[var(--line)] bg-white p-1.5 shadow-[var(--shadow-brand)]">
            {REACTION_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                className="cursor-pointer rounded-full px-1.5 py-1 text-lead transition-transform duration-150 hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
