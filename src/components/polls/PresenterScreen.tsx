"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Flag,
  Image as ImageIcon,
  Lock,
  LockOpen,
  MonitorPlay,
  Play,
  Timer,
} from "lucide-react";
import { AcceptingBadge, Leaderboard, QuestionResults } from "./QuestionResults";
import { SpinWheel } from "./SpinWheel";
import type { Member, Poll, PollSession } from "@/lib/types";
import { QUESTION_KIND_LABELS } from "@/lib/types";
import { activeQuestion, responsesFor } from "@/lib/poll-actions";
import { qrDataUrl } from "@/lib/qr";

interface PresenterScreenProps {
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
  onExportCsv: () => void;
  onExportPng: () => void;
  onPresent: () => void;
  onModerate?: (responseId: string, patch: { hidden?: boolean; answered?: boolean }) => void;
  onVote?: (responseId: string) => void;
}

/**
 * Экран ведущего: то, что видно на проекторе в зале.
 * Слева — вопрос и результаты, справа сверху — QR и ссылка для участников,
 * снизу — управление приёмом ответов, переходами и выгрузкой.
 */
export function PresenterScreen({
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
  onExportCsv,
  onExportPng,
  onPresent,
  onModerate,
  onVote,
}: PresenterScreenProps) {
  const question = activeQuestion(session, poll);
  const answers = question ? responsesFor(session, question.id).length : 0;
  const isLast = session.currentIndex >= poll.questions.length - 1;
  const isQuizQuestion = question?.kind === "quiz";
  const isQaQuestion = question?.kind === "qa";
  const isSpinnerQuestion = question?.kind === "spinner";
  const isDraft = session.status === "draft";

  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const joinUrl = origin ? `${origin}/poll/${session.code}` : "";
  const qr = useMemo(() => (joinUrl ? qrDataUrl(joinUrl) : ""), [joinUrl]);

  const copyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // буфер обмена недоступен — ссылку видно текстом
    }
  };

  return (
    <section className="overflow-hidden rounded-card border border-[var(--line)] bg-white shadow-[var(--shadow-brand)]">
      {/* ------------------------------------------------------- Шапка экрана */}
      <div className="mesh mesh--accent px-6 py-6 md:px-8">
        <div className="flex flex-col gap-5">
          <div className="min-w-0">
            <p className="eyebrow eyebrow--light mb-1.5">Экран ведущего</p>
            <h2 className="m-0 mb-2 font-display text-[clamp(22px,2.6vw,30px)] leading-tight font-semibold tracking-[-0.035em] text-white">
              {poll.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-caption text-white/70">
              <span>Вопросов: {poll.questions.length}</span>
              <span>Ответов всего: {session.responses.length}</span>
              <span>{poll.anonymous ? "Анонимный опрос" : "С ответами от имени участника"}</span>
            </div>
          </div>

          {/* Как присоединиться: QR + код + ссылка */}
          <div className="flex w-full items-center gap-4 rounded-2xl bg-white/12 p-3 backdrop-blur">
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element -- QR генерируется в браузере
              <img
                src={qr}
                alt={`QR-код для входа в опрос ${session.code}`}
                width={116}
                height={116}
                className="rounded-xl bg-white p-1.5"
              />
            )}
            <div className="min-w-0">
              <p className="m-0 mb-1 text-micro font-semibold tracking-[0.14em] text-sky-light uppercase">
                Код для участников
              </p>
              <p className="m-0 font-display text-display-sm leading-none font-semibold tracking-[0.08em] text-white">
                {session.code}
              </p>
              {joinUrl && (
                <>
                  <p className="m-0 mt-2 max-w-52 truncate text-micro text-white/70" title={joinUrl}>
                    {joinUrl.replace(/^https?:\/\//, "")}
                  </p>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="mt-2 inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/20 px-3 text-micro font-semibold text-white transition-colors duration-200 hover:bg-white/30"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Скопировано" : "Скопировать ссылку"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- Управление */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--line)] px-7 py-4">
        <button type="button" onClick={onPresent} className={accentButton}>
          <MonitorPlay size={14} />
          Режим презентации
        </button>
        <AcceptingBadge accepting={session.accepting} />

        {secondsLeft !== null && (
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-caption font-semibold text-white"
            style={{ background: secondsLeft <= 5 ? "var(--color-danger)" : "var(--color-navy)" }}
          >
            <Timer size={13} />
            {secondsLeft} с
          </span>
        )}

        <span className="rounded-full bg-[var(--color-sky-tint)] px-3 py-1.5 text-caption font-semibold text-sky-ink">
          Ответили: {answers} из {participantCount}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleAccepting}
            className={isDraft ? accentButton : toolButton}
          >
            {isDraft ? <Play size={14} /> : session.accepting ? <Lock size={14} /> : <LockOpen size={14} />}
            {isDraft ? "Запустить" : session.accepting ? "Закрыть приём" : "Открыть приём"}
          </button>
          <button type="button" onClick={onToggleResults} className={toolButton}>
            {session.showResults ? <EyeOff size={14} /> : <Eye size={14} />}
            {session.showResults ? "Скрыть ответы" : "Показать ответы"}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ Вопрос */}
      <div className="px-7 py-6">
        {question ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="font-display text-meta font-semibold tracking-[0.12em] text-gold-ink uppercase">
                Вопрос {session.currentIndex + 1} из {poll.questions.length}
              </span>
              <span className="tag">{QUESTION_KIND_LABELS[question.kind]}</span>
              {question.kind === "quiz" && (
                <span className="tag">
                  {question.points} очков · {question.timeLimit} с на ответ
                </span>
              )}
              {question.kind === "open" && (
                <span className="tag">
                  {question.visual === "cloud" ? "облако слов" : "список ответов"}
                </span>
              )}
            </div>

            <h3 className="m-0 mb-2 font-display text-[clamp(24px,3.2vw,38px)] leading-[1.1] font-semibold tracking-[-0.04em] text-navy">
              {question.title}
            </h3>
            {question.hint && <p className="m-0 mb-5 text-ui text-ink-soft">{question.hint}</p>}

            <div className="mt-6">
              {isSpinnerQuestion ? (
                <SpinWheel options={question.options} />
              ) : session.showResults || isQaQuestion ? (
                <div className="flex flex-col gap-4">
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
                  {isQuizQuestion && <Leaderboard poll={poll} session={session} members={members} />}
                </div>
              ) : (
                <div className="grid min-h-50 place-items-center rounded-panel border border-dashed border-[var(--line)] bg-navy/2 px-6 text-center">
                  <div>
                    <p className="m-0 mb-1.5 font-display text-lg font-semibold text-navy">
                      {isDraft
                        ? "Опрос ещё не запущен"
                        : session.accepting
                          ? "Идёт приём ответов"
                          : "Ответы скрыты на экране"}
                    </p>
                    <p className="m-0 text-meta text-ink-faint">
                      {isDraft
                        ? "Нажмите «Запустить», чтобы открыть приём ответов и показать код участникам."
                        : session.accepting
                          ? "Участники отвечают с телефона по QR-коду или ссылке наверху. Нажмите «Показать ответы», когда будете готовы обсудить."
                          : "Нажмите «Показать ответы», чтобы вывести результаты в зал."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="m-0 text-sm text-ink-soft">В этом опросе пока нет вопросов.</p>
        )}
      </div>

      {/* ------------------------------------------------------- Нижняя панель */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-[var(--line)] bg-[var(--color-sky-pale)] px-7 py-4">
        <button
          type="button"
          onClick={onPrevious}
          disabled={session.currentIndex === 0}
          className={toolButton}
        >
          <ChevronLeft size={14} />
          Назад
        </button>
        <button type="button" onClick={onNext} className={accentButton}>
          {isLast ? "К результатам" : "Следующий вопрос"}
          <ChevronRight size={14} />
        </button>
        <button type="button" onClick={onFinish} className={toolButton}>
          <Flag size={14} />
          Завершить опрос
        </button>

        <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />

        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onExportCsv} className={toolButton}>
            <FileSpreadsheet size={14} />
            Таблица (CSV)
          </button>
          <button type="button" onClick={onExportPng} className={toolButton}>
            <ImageIcon size={14} />
            Картинка (PNG)
          </button>
        </div>
      </div>
    </section>
  );
}

const toolButton =
  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 text-caption font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40";

const accentButton =
  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-navy bg-navy px-3.5 text-caption font-semibold text-white transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:bg-navy-deep";
