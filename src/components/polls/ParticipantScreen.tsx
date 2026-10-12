"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Send, Smartphone } from "lucide-react";
import type { AnswerValue, Member, Poll, PollSession, Question } from "@/lib/types";
import { QUESTION_KIND_LABELS } from "@/lib/types";
import { hasAnswered } from "@/lib/poll-actions";

interface ParticipantScreenProps {
  poll: Poll;
  question: Question;
  session: PollSession;
  currentUser: Member;
  secondsLeft: number | null;
  onSubmit: (value: AnswerValue) => void;
}

/**
 * Экран участника: то, что человек видит на телефоне после ввода кода.
 * В демонстрационном режиме показывается рядом с экраном ведущего —
 * ответ отсюда сразу попадает в результаты.
 */
export function ParticipantScreen({
  poll,
  question,
  session,
  currentUser,
  secondsLeft,
  onSubmit,
}: ParticipantScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    setSelected([]);
    setText("");
    setScale(null);
  }, [question.id]);

  const answered = hasAnswered(session, question.id, currentUser.id);

  const value: AnswerValue | null = (() => {
    if (question.kind === "open") return text.trim() ? { optionIds: [], text: text.trim() } : null;
    if (question.kind === "scale") return scale ? { optionIds: [], scale } : null;
    return selected.length > 0 ? { optionIds: selected } : null;
  })();

  const toggleOption = (optionId: string) => {
    if (question.kind === "multiple") {
      setSelected((previous) =>
        previous.includes(optionId)
          ? previous.filter((id) => id !== optionId)
          : [...previous, optionId],
      );
      return;
    }
    setSelected([optionId]);
  };

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="mb-3 flex items-center gap-2 px-1 text-[12px] text-ink-faint">
        <Smartphone size={14} />
        Экран участника — так это выглядит на телефоне
      </div>

      <div className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-white shadow-[var(--shadow-brand)]">
        <div className="mesh mesh--accent px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-sky-light uppercase">
              Опрос программы
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
              код {session.code}
            </span>
          </div>
          <p className="m-0 text-[14px] leading-snug font-medium text-white">{poll.title}</p>
        </div>

        <div className="flex min-h-[380px] flex-col p-5">
          {session.status !== "live" ? (
            <State
              title={session.status === "draft" ? "Опрос ещё не начался" : "Опрос завершён"}
              text={
                session.status === "draft"
                  ? "Ведущий запустит вопросы — экран обновится автоматически."
                  : "Спасибо за участие. Результаты уже собраны ведущим."
              }
            />
          ) : answered ? (
            <State
              title="Ответ принят"
              text="Можно отложить телефон и вернуться к обсуждению."
              success
            />
          ) : !session.accepting ? (
            <State title="Приём ответов закрыт" text="Ведущий закрыл вопрос — ждём следующий." />
          ) : (
            <>
              <p className="m-0 mb-1 text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                {QUESTION_KIND_LABELS[question.kind]}
                {secondsLeft !== null ? ` · ${secondsLeft} с` : ""}
              </p>
              <h3 className="m-0 mb-4 font-display text-[19px] leading-snug font-semibold tracking-[-0.02em] text-navy">
                {question.title}
              </h3>

              {question.kind === "open" ? (
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={4}
                  placeholder={question.hint ?? "Ваш ответ"}
                  className="w-full resize-none rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-navy"
                />
              ) : question.kind === "scale" ? (
                <div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((value2) => (
                      <button
                        key={value2}
                        type="button"
                        onClick={() => setScale(value2)}
                        className={[
                          "grid h-14 flex-1 cursor-pointer place-items-center rounded-[14px] border text-[18px] font-semibold transition-all duration-200 ease-brand",
                          scale === value2
                            ? "border-transparent text-white"
                            : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
                        ].join(" ")}
                        style={scale === value2 ? { background: "var(--accent)" } : undefined}
                      >
                        {value2}
                      </button>
                    ))}
                  </div>
                  {question.scaleLabels && (
                    <div className="mt-2.5 flex justify-between text-[11px] text-ink-faint">
                      <span>{question.scaleLabels.min}</span>
                      <span>{question.scaleLabels.max}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {question.options.map((option) => {
                    const active = selected.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleOption(option.id)}
                        className={[
                          "cursor-pointer rounded-[14px] border px-4 py-3 text-left text-[14px] leading-snug transition-all duration-200 ease-brand",
                          active
                            ? "border-transparent text-white"
                            : "border-[var(--line)] bg-white text-ink hover:-translate-y-0.5",
                        ].join(" ")}
                        style={active ? { background: "var(--navy)" } : undefined}
                      >
                        {option.text}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                disabled={!value}
                onClick={() => value && onSubmit(value)}
                className="mt-5 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-navy text-[14px] font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} />
                Отправить ответ
              </button>

              <p className="m-0 mt-3 text-center text-[11px] text-ink-faint">
                {poll.anonymous
                  ? "Ответ анонимный: ведущий не увидит, кто его отправил"
                  : `Ответ от имени ${currentUser.name}`}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function State({
  title,
  text,
  success = false,
}: {
  title: string;
  text: string;
  success?: boolean;
}) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <span
          className="mx-auto mb-4 grid size-12 place-items-center rounded-full"
          style={
            success
              ? { background: "color-mix(in oklab, var(--accent) 16%, white)", color: "var(--accent-strong)" }
              : { background: "rgba(34,63,154,0.08)", color: "#223F9A" }
          }
        >
          {success ? <CheckCheck size={22} /> : <Smartphone size={20} />}
        </span>
        <p className="m-0 mb-1.5 font-display text-[17px] font-semibold text-navy">{title}</p>
        <p className="m-0 text-[13px] leading-relaxed text-ink-faint">{text}</p>
      </div>
    </div>
  );
}
