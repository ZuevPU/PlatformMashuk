"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Hand,
  Lock,
  LockOpen,
  Timer,
  Users,
  X,
} from "lucide-react";
import { Leaderboard, QuestionResults } from "./QuestionResults";
import { SpinWheel } from "./SpinWheel";
import { activeQuestion, responsesFor } from "@/lib/poll-actions";
import { qrDataUrl } from "@/lib/qr";
import { QUESTION_KIND_LABELS } from "@/lib/types";
import type { Member, Poll, PollSession } from "@/lib/types";

interface PollPresentationProps {
  poll: Poll;
  session: PollSession;
  members: Member[];
  participantCount: number;
  secondsLeft: number | null;
  onToggleAccepting: () => void;
  onToggleResults: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onFinish: () => void;
  onExit: () => void;
  onModerate?: (responseId: string, patch: { hidden?: boolean; answered?: boolean }) => void;
  onVote?: (responseId: string) => void;
}

/**
 * Режим презентации: опрос на весь экран, как слайд.
 *
 * Слева тёмная панель с QR и адресом — участники подключаются с телефона;
 * в центре крупный вопрос и живой результат; снизу — управление показом.
 * По стрелкам ← → переключаются вопросы, Esc выходит из режима.
 */
export function PollPresentation({
  poll,
  session,
  members,
  participantCount,
  secondsLeft,
  onToggleAccepting,
  onToggleResults,
  onNext,
  onPrevious,
  onFinish,
  onExit,
  onModerate,
  onVote,
}: PollPresentationProps) {
  const question = activeQuestion(session, poll);
  const answers = question ? responsesFor(session, question.id).length : 0;
  const isLast = session.currentIndex >= poll.questions.length - 1;
  const isQuiz = question?.kind === "quiz";
  const isQa = question?.kind === "qa";
  const isSpinner = question?.kind === "spinner";

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = origin ? `${origin}/poll/${session.code}` : `…/poll/${session.code}`;
  const qr = useMemo(() => (origin ? qrDataUrl(joinUrl, 10) : ""), [origin, joinUrl]);

  // Полный экран и горячие клавиши ведущего
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === " ") {
        event.preventDefault();
        onToggleAccepting();
      }
    };
    window.addEventListener("keydown", onKey);
    void document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [onExit, onNext, onPrevious, onToggleAccepting]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0d1020] text-white">
      {/* Верхняя строка */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <button
          type="button"
          onClick={onExit}
          aria-label="Выйти из режима презентации"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X size={18} />
        </button>
        <p className="m-0 mx-auto truncate text-center text-meta text-white/80">
          Войти: <b className="font-semibold text-white">{joinUrl.replace(/^https?:\/\//, "")}</b>
        </p>
        <span className="shrink-0 text-meta font-semibold tracking-[-0.02em] text-white/60">
          Центр знаний «Машук»
        </span>
      </header>

      {/* Тело: панель с QR + слайд */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 flex-col items-center justify-center gap-7 bg-[#1a1f38] p-8 md:flex">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- QR генерируется в браузере
            <img src={qr} alt={`QR для входа: код ${session.code}`} className="w-full max-w-60 rounded-2xl bg-white p-3" />
          )}
          <div className="text-center">
            <p className="m-0 mb-1.5 text-meta text-white/60">Подключиться:</p>
            <p className="m-0 font-display text-[clamp(20px,2.4vw,30px)] leading-tight font-semibold break-all">
              {joinUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="m-0 mt-4 font-display text-[clamp(40px,5vw,64px)] leading-none font-semibold tracking-[0.12em]" style={{ color: "var(--accent-strong)" }}>
              {session.code}
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-white px-6 py-8 text-ink md:px-12">
          {question ? (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="font-display text-lead font-semibold tracking-[0.1em] text-gold-ink uppercase">
                  Вопрос {session.currentIndex + 1} из {poll.questions.length}
                </span>
                <span className="tag">{QUESTION_KIND_LABELS[question.kind]}</span>
                {secondsLeft !== null && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold text-white"
                    style={{ background: secondsLeft <= 5 ? "var(--color-danger)" : "var(--color-navy)" }}
                  >
                    <Timer size={13} />
                    {secondsLeft} с
                  </span>
                )}
              </div>
              <h2 className="m-0 mb-3 font-display text-[clamp(30px,4.4vw,64px)] leading-[1.05] font-semibold tracking-[-0.045em] text-navy">
                {question.title}
              </h2>
              {question.hint && <p className="m-0 mb-6 text-lead text-ink-soft">{question.hint}</p>}

              <div className="mt-4 flex-1">
                {isSpinner ? (
                  <SpinWheel options={question.options} />
                ) : session.showResults || isQa ? (
                  <div className="flex flex-col gap-6">
                    <QuestionResults
                      poll={poll}
                      question={question}
                      session={session}
                      members={members}
                      anonymous={poll.anonymous}
                      staff
                      onModerate={onModerate}
                      onVote={onVote}
                    />
                    {isQuiz && <Leaderboard poll={poll} session={session} members={members} />}
                  </div>
                ) : (
                  <div className="grid h-full min-h-60 place-items-center rounded-panel border border-dashed border-[var(--line)] bg-navy/2 px-6 text-center">
                    <div>
                      <p className="m-0 mb-2 font-display text-[clamp(22px,2.6vw,34px)] font-semibold text-navy">
                        {session.accepting ? "Отсканируйте QR и отвечайте" : "Ответы скрыты"}
                      </p>
                      <p className="m-0 mx-auto max-w-125 text-ui text-ink-faint">
                        {session.accepting
                          ? "Наведите камеру телефона на QR-код слева или откройте ссылку на любом устройстве."
                          : "Нажмите «Показать ответы», чтобы вывести результат на экран."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="m-0 text-ui text-ink-soft">В этом опросе нет вопросов.</p>
          )}
        </main>
      </div>

      {/* Нижняя панель управления */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
        <button type="button" onClick={onPrevious} disabled={session.currentIndex === 0} className={pill}>
          <ChevronLeft size={16} />
        </button>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-meta font-semibold">
          {session.currentIndex + 1} / {poll.questions.length}
        </span>
        <button type="button" onClick={onNext} className={lightPill}>
          {isLast ? "К результатам" : "Далее"}
          <ChevronRight size={16} />
        </button>

        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />

        <button type="button" onClick={onToggleAccepting} className={pill}>
          {session.accepting ? <Lock size={15} /> : <LockOpen size={15} />}
          {session.accepting ? "Закрыть приём" : "Открыть приём"}
        </button>
        <button type="button" onClick={onToggleResults} className={pill}>
          {session.showResults ? <EyeOff size={15} /> : <Eye size={15} />}
          {session.showResults ? "Скрыть ответы" : "Показать ответы"}
        </button>
        <button type="button" onClick={onFinish} className={pill}>
          <Flag size={15} />
          Завершить
        </button>

        <div className="ml-auto flex items-center gap-3 text-meta text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <Hand size={16} />
            {answers}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={16} />
            {answers}/{participantCount}
          </span>
        </div>
      </footer>
    </div>
  );
}

const pill =
  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 text-meta font-semibold text-white transition-colors duration-150 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40";

const lightPill =
  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-white bg-white px-3.5 text-meta font-semibold text-navy transition-colors duration-150 hover:bg-sky-tint disabled:cursor-not-allowed disabled:opacity-40";
