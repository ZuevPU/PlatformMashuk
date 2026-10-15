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
  /** Подпись «так это выглядит на телефоне» — на экране ведущего она уместна,
   * на отдельной странице входа в опрос — нет. */
  showHint?: boolean;
  /** preview — карточка-телефон рядом с ведущим; full — крупный экран участника. */
  variant?: "preview" | "full";
}

/**
 * Экран участника: то, что человек видит на телефоне после входа в опрос.
 * Типы «облако слов» и «список» — свободный текст; Q&A позволяет задавать
 * вопросы много раз, поэтому форма не блокируется после отправки.
 */
export function ParticipantScreen({
  poll,
  question,
  session,
  currentUser,
  secondsLeft,
  onSubmit,
  showHint = true,
  variant = "preview",
}: ParticipantScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [scale, setScale] = useState<number | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [sentCount, setSentCount] = useState(0);

  const isQa = question.kind === "qa";
  const isRank = question.kind === "rank";
  const isSpinner = question.kind === "spinner";
  const isText = question.kind === "open" || question.kind === "cloud" || isQa;
  const full = variant === "full";

  useEffect(() => {
    setSelected([]);
    setText("");
    setScale(null);
    setOrder([]);
    setSentCount(0);
  }, [question.id]);

  const answered = !isQa && !isSpinner && hasAnswered(session, question.id, currentUser.id);

  const value: AnswerValue | null = (() => {
    if (isRank) return order.length === question.options.length ? { optionIds: order } : null;
    if (isText) return text.trim() ? { optionIds: [], text: text.trim() } : null;
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

  const toggleRank = (optionId: string) => {
    setOrder((previous) =>
      previous.includes(optionId)
        ? previous.filter((id) => id !== optionId)
        : [...previous, optionId],
    );
  };

  const submit = () => {
    if (!value) return;
    onSubmit(value);
    if (isQa) {
      setText("");
      setSentCount((count) => count + 1);
    }
  };

  const body = (
    <>
      {session.status !== "live" ? (
        <State
          title={session.status === "draft" ? "Опрос ещё не начался" : "Опрос завершён"}
          text={
            session.status === "draft"
              ? "Ведущий запустит вопросы — экран обновится автоматически."
              : "Спасибо за участие. Результаты уже собраны ведущим."
          }
        />
      ) : isSpinner ? (
        <State
          title="Колесо на экране ведущего"
          text="Смотрите на большой экран — ведущий крутит колесо."
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
          {full ? (
            secondsLeft !== null && (
              <p className="m-0 mb-2 text-micro font-semibold tracking-[0.12em] text-gold-ink uppercase">
                Осталось {secondsLeft} с
              </p>
            )
          ) : (
            <p className="m-0 mb-1 text-micro font-semibold tracking-[0.12em] text-gold-ink uppercase">
              {QUESTION_KIND_LABELS[question.kind]}
              {secondsLeft !== null ? ` · ${secondsLeft} с` : ""}
            </p>
          )}
          <h3
            className={[
              "m-0 mb-4 font-display leading-snug font-semibold tracking-[-0.03em] text-navy",
              full ? "text-[clamp(22px,5vw,34px)]" : "text-subtitle",
            ].join(" ")}
          >
            {question.title}
          </h3>

          {isText ? (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={full ? 3 : 4}
              placeholder={question.hint ?? (isQa ? "Ваш вопрос" : "Ваш ответ")}
              className="w-full resize-none rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-ui leading-relaxed outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus:border-navy"
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
                      "grid flex-1 cursor-pointer place-items-center rounded-field border font-semibold transition-all duration-200 ease-brand",
                      full ? "h-16 text-title" : "h-14 text-subtitle",
                      scale === value2
                        ? "border-transparent text-on-accent"
                        : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
                    ].join(" ")}
                    style={scale === value2 ? { background: "var(--accent)" } : undefined}
                  >
                    {value2}
                  </button>
                ))}
              </div>
              {question.scaleLabels && (
                <div className="mt-2.5 flex justify-between text-micro text-ink-faint">
                  <span>{question.scaleLabels.min}</span>
                  <span>{question.scaleLabels.max}</span>
                </div>
              )}
            </div>
          ) : isRank ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 mb-1 text-micro text-ink-faint">
                Нажимайте варианты по порядку: 1 — важнее всего
              </p>
              {question.options.map((option) => {
                const rank = order.indexOf(option.id);
                const active = rank >= 0;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleRank(option.id)}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-field border px-4 text-left leading-snug transition-all duration-200 ease-brand",
                      full ? "py-4 text-lead" : "py-3 text-ui",
                      active
                        ? "border-transparent text-on-accent"
                        : "border-[var(--line)] bg-white text-ink hover:-translate-y-0.5",
                    ].join(" ")}
                    style={active ? { background: "var(--color-navy)" } : undefined}
                  >
                    <span
                      className={[
                        "grid size-7 shrink-0 place-items-center rounded-full text-caption font-semibold",
                        active ? "bg-white/25 text-white" : "bg-sky-tint text-sky-ink",
                      ].join(" ")}
                    >
                      {active ? rank + 1 : ""}
                    </span>
                    {option.text}
                  </button>
                );
              })}
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
                      "cursor-pointer rounded-field border px-4 text-left leading-snug transition-all duration-200 ease-brand",
                      full ? "py-4 text-lead" : "py-3 text-ui",
                      active
                        ? "border-transparent text-on-accent"
                        : "border-[var(--line)] bg-white text-ink hover:-translate-y-0.5",
                    ].join(" ")}
                    style={active ? { background: "var(--color-navy)" } : undefined}
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
            onClick={submit}
            className={[
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-navy font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40",
              full ? "mt-4 min-h-12 w-full text-lead" : "mt-5 min-h-12 w-full text-ui",
            ].join(" ")}
          >
            <Send size={15} />
            {isQa ? "Задать вопрос" : "Ответить"}
          </button>

          {isQa && sentCount > 0 && (
            <p className="m-0 mt-3 text-center text-micro font-semibold text-sky-ink">
              Отправлено: {sentCount}
            </p>
          )}

          {!full && (
            <p className="m-0 mt-3 text-center text-micro text-ink-faint">
              {poll.anonymous
                ? "Ответ анонимный: ведущий не увидит, кто его отправил"
                : `Ответ от имени ${currentUser.name}`}
            </p>
          )}
        </>
      )}
    </>
  );

  if (full) {
    return (
      <div className="mx-auto w-full max-w-130">
        <div className="flex flex-col">{body}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-95">
      {showHint && (
        <div className="mb-3 flex items-center gap-2 px-1 text-caption text-ink-faint">
          <Smartphone size={14} />
          Экран участника — так это выглядит на телефоне
        </div>
      )}

      <div className="overflow-hidden rounded-4xl border border-[var(--line)] bg-white shadow-[var(--shadow-brand)]">
        <div className="mesh mesh--accent px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-micro font-semibold tracking-[0.14em] text-sky-light uppercase">
              Опрос программы
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-micro font-semibold text-white">
              код {session.code}
            </span>
          </div>
          <p className="m-0 text-ui leading-snug font-medium text-white">{poll.title}</p>
        </div>

        <div className="flex min-h-95 flex-col p-5">{body}</div>
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
              ? { background: "color-mix(in oklab, var(--accent) 16%, white)", color: "var(--accent-ink)" }
              : { background: "color-mix(in oklab, var(--color-navy) 8%, transparent)", color: "var(--color-navy)" }
          }
        >
          {success ? <CheckCheck size={22} /> : <Smartphone size={20} />}
        </span>
        <p className="m-0 mb-1.5 font-display text-lead font-semibold text-navy">{title}</p>
        <p className="m-0 text-meta leading-relaxed text-ink-faint">{text}</p>
      </div>
    </div>
  );
}
