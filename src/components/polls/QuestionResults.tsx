"use client";

import { ArrowUp, CheckCircle2, Clock3, Eye, EyeOff, MessageSquareCheck, MessageSquareText } from "lucide-react";
import type { Member, Poll, PollResponse, PollSession, Question } from "@/lib/types";
import { QUESTION_KIND_LABELS } from "@/lib/types";
import {
  cloudWords,
  leaderboard,
  openAnswers,
  rankStats,
  responsesFor,
  scaleStats,
  tallyOptions,
  teamLeaderboard,
} from "@/lib/poll-actions";
import { formatTime } from "@/lib/dates";

// Цвета слов облака — только тона, читаемые на белом (контраст ≥ 5:1)
const CLOUD_PALETTE = [
  "var(--accent-ink)",
  "var(--color-navy)",
  "var(--color-teal)",
  "var(--color-sky-ink)",
  "var(--color-gold-ink)",
];

interface ResultsProps {
  poll: Poll;
  question: Question;
  session: PollSession;
  members: Member[];
  anonymous: boolean;
  /** Команда программы: показывает управление модерацией Q&A */
  staff?: boolean;
  onModerate?: (responseId: string, patch: { hidden?: boolean; answered?: boolean }) => void;
  /** Голос за вопрос зала (Q&A) */
  onVote?: (responseId: string) => void;
}

/** Визуализация результатов текущего вопроса. */
export function QuestionResults({
  poll,
  question,
  session,
  members,
  anonymous,
  staff = false,
  onModerate,
  onVote,
}: ResultsProps) {
  const responses = responsesFor(session, question.id);

  if (responses.length === 0) {
    return (
      <div className="grid min-h-55 place-items-center rounded-panel border border-dashed border-[var(--line)] bg-white/60 px-6 text-center">
        <div>
          <p className="m-0 mb-1.5 font-display text-lg font-semibold text-navy">
            Ждём первые ответы
          </p>
          <p className="m-0 text-meta text-ink-faint">
            Ответы появятся здесь сразу, как только участники начнут отвечать.
          </p>
        </div>
      </div>
    );
  }

  if (question.kind === "spinner") return null;

  if (question.kind === "rank") {
    const rows = rankStats(question, responses);
    return (
      <div className="rounded-panel border border-[var(--line)] bg-white p-6">
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {rows.map((row, index) => (
            <li key={row.optionId} className="flex items-center gap-3">
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full text-caption font-semibold"
                style={{
                  background: "color-mix(in oklab, var(--color-navy) 8%, transparent)",
                  color: "var(--color-navy)",
                }}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-ui text-ink">{row.text}</span>
              <span className="font-display text-body font-semibold text-navy">
                {row.count ? row.avg.toFixed(1).replace(".", ",") : "—"}
              </span>
              <span className="w-14 text-right text-micro text-ink-faint">ср. место</span>
            </li>
          ))}
        </ol>
        <p className="m-0 mt-4 text-caption text-ink-faint">
          Средняя позиция по ответам зала: чем меньше, тем выше вариант в зачёте.
        </p>
      </div>
    );
  }

  if (question.kind === "cloud") {
    return <WordCloud responses={responses} />;
  }

  if (question.kind === "open") {
    return question.visual === "cloud" ? (
      <WordCloud responses={responses} />
    ) : (
      <OpenList responses={responses} members={members} anonymous={anonymous} />
    );
  }

  if (question.kind === "qa") {
    // Живой список вопросов зала — как «Ask me anything» в AhaSlides
    return (
      <QaList
        responses={responses}
        members={members}
        anonymous={anonymous}
        staff={staff}
        onModerate={onModerate}
        onVote={onVote}
      />
    );
  }

  if (question.kind === "scale") {
    const stats = scaleStats(responses);
    return (
      <div className="rounded-panel border border-[var(--line)] bg-white p-6">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <span className="font-display text-display leading-none font-semibold tracking-[-0.04em] text-navy">
            {stats.average.toFixed(1).replace(".", ",")}
          </span>
          <span className="pb-1.5 text-meta text-ink-soft">
            средний балл из 5 · ответов {stats.total}
          </span>
          {question.scaleLabels && (
            <span className="ml-auto pb-1.5 text-caption text-ink-faint">
              {question.scaleLabels.min} → {question.scaleLabels.max}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          {stats.counts.map((count, index) => {
            const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={index} className="grid grid-cols-[28px_1fr_74px] items-center gap-3">
                <span className="text-ui font-semibold text-ink">{index + 1}</span>
                <span className="h-6 overflow-hidden rounded-full bg-navy/8">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500 ease-brand"
                    style={{ width: `${percent}%`, background: "var(--accent)" }}
                  />
                </span>
                <span className="text-right text-meta text-ink-soft">
                  {count} · {percent}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const tallies = tallyOptions(question, responses);
  const max = Math.max(...tallies.map((tally) => tally.count), 1);

  return (
    <div className="rounded-panel border border-[var(--line)] bg-white p-6">
      <div className="flex flex-col gap-4">
        {tallies.map((tally) => (
          <div key={tally.optionId}>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-ui font-medium text-ink">{tally.text}</span>
              {question.kind === "quiz" && tally.correct && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-micro font-semibold tracking-[0.06em] text-white uppercase">
                  <CheckCircle2 size={11} />
                  верный
                </span>
              )}
              <span className="ml-auto text-meta font-semibold text-navy">
                {tally.count} · {tally.percent}%
              </span>
            </div>
            <span className="block h-8 overflow-hidden rounded-chip bg-navy/8">
              <span
                className="block h-full rounded-chip transition-[width] duration-500 ease-brand"
                style={{
                  width: `${(tally.count / max) * 100}%`,
                  background: tally.correct ? "var(--color-teal)" : "var(--accent)",
                }}
              />
            </span>
          </div>
        ))}
      </div>

      {question.kind === "multiple" && (
        <p className="m-0 mt-4 text-caption text-ink-faint">
          Участники могли отметить несколько вариантов, поэтому сумма больше 100%.
        </p>
      )}
    </div>
  );
}

function WordCloud({ responses }: { responses: PollResponse[] }) {
  const words = cloudWords(responses);

  return (
    <div className="rounded-panel border border-[var(--line)] bg-white p-7">
      <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2">
        {words.map((word, index) => (
          <span
            key={word.text}
            title={`${word.count} ответ(ов)`}
            className="leading-none"
            style={{
              fontSize: `${15 + word.weight * 7}px`,
              fontWeight: index % 3 === 0 ? 600 : 500,
              color: CLOUD_PALETTE[index % CLOUD_PALETTE.length],
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
      <p className="m-0 mt-6 text-center text-caption text-ink-faint">
        Размер слова — как часто оно встречается в ответах
      </p>
    </div>
  );
}

function OpenList({
  responses,
  members,
  anonymous,
  question = false,
}: {
  responses: PollResponse[];
  members: Member[];
  anonymous: boolean;
  /** Q&A: вопросов от зала может быть много, список длиннее */
  question?: boolean;
}) {
  const answers = openAnswers(responses, members).slice(0, question ? 40 : 12);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {answers.map((answer) => (
        <article
          key={answer.id}
          className="rounded-soft border border-[var(--line)] bg-white px-5 py-4"
        >
          <p className="m-0 mb-2.5 text-ui leading-relaxed text-ink">{answer.text}</p>
          <p className="m-0 text-micro text-ink-faint">
            {anonymous || !answer.authorName ? "анонимно" : answer.authorName} ·{" "}
            {formatTime(answer.createdAt)}
          </p>
        </article>
      ))}
    </div>
  );
}

/** Список вопросов зала (Q&A) с модерацией: скрыть и отметить отвеченным. */
function QaList({
  responses,
  members,
  anonymous,
  staff,
  onModerate,
  onVote,
}: {
  responses: PollResponse[];
  members: Member[];
  anonymous: boolean;
  staff: boolean;
  onModerate?: (responseId: string, patch: { hidden?: boolean; answered?: boolean }) => void;
  onVote?: (responseId: string) => void;
}) {
  const items = responses
    .map((response) => ({
      id: response.id,
      text: (response.value.text ?? "").trim(),
      authorName: response.memberId
        ? members.find((member) => member.id === response.memberId)?.name
        : undefined,
      createdAt: response.createdAt,
      hidden: Boolean(response.hidden),
      answered: Boolean(response.answered),
      votes: response.votes ?? 0,
      voted: Boolean(response.voted),
    }))
    .filter((item) => item.text.length > 0)
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        Number(a.hidden) - Number(b.hidden) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  if (items.length === 0) {
    return (
      <div className="grid min-h-40 place-items-center rounded-panel border border-dashed border-[var(--line)] bg-white/60 px-6 py-8 text-center">
        <p className="m-0 text-meta text-ink-faint">
          Пока вопросов нет — зал задаёт их с телефона по QR или ссылке.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className={[
            "rounded-soft border px-5 py-4",
            item.hidden
              ? "border-dashed border-[var(--line)] bg-white/50 opacity-70"
              : item.answered
                ? "border-[var(--line)]"
                : "border-[var(--line)] bg-white",
          ].join(" ")}
          style={item.answered && !item.hidden ? { background: "color-mix(in oklab, var(--color-teal) 8%, white)" } : undefined}
        >
          <p className="m-0 mb-2.5 text-ui leading-relaxed text-ink">{item.text}</p>
          <div className="flex flex-wrap items-center gap-2 text-micro text-ink-faint">
            <span>
              {anonymous || !item.authorName ? "анонимно" : item.authorName} ·{" "}
              {formatTime(item.createdAt)}
            </span>
            {onVote && (
              <button
                type="button"
                onClick={() => onVote(item.id)}
                title="Голосовать за вопрос"
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-micro font-semibold transition-colors duration-150",
                  item.voted
                    ? "border-navy bg-navy text-white"
                    : "border-[var(--line)] bg-white text-navy hover:bg-sky-tint",
                ].join(" ")}
              >
                <ArrowUp size={12} />
                {item.votes}
              </button>
            )}
            {item.answered && (
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{ background: "color-mix(in oklab, var(--color-teal) 14%, white)", color: "var(--color-teal)" }}
              >
                отвечен
              </span>
            )}
            {item.hidden && (
              <span className="rounded-full bg-grey-brand/50 px-2 py-0.5 font-semibold text-ink-soft">
                скрыт
              </span>
            )}
            {staff && onModerate && (
              <span className="ml-auto flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onModerate(item.id, { answered: !item.answered })}
                  className={qaButton}
                  title="Отметить отвеченным"
                >
                  {item.answered ? <MessageSquareCheck size={13} /> : <MessageSquareText size={13} />}
                  {item.answered ? "Снять" : "Отвечен"}
                </button>
                <button
                  type="button"
                  onClick={() => onModerate(item.id, { hidden: !item.hidden })}
                  className={qaButton}
                  title="Скрыть из зала"
                >
                  {item.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  {item.hidden ? "Показать" : "Скрыть"}
                </button>
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

const qaButton =
  "inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-micro font-semibold text-navy transition-colors duration-150 hover:bg-sky-tint";

/** Таблица лидеров квиза: считается по всем вопросам квиза в сессии. */
export function Leaderboard({
  poll,
  session,
  members,
  compact = false,
}: {
  poll: Poll;
  session: PollSession;
  members: Member[];
  compact?: boolean;
}) {
  if (poll.teamCount > 1) {
    return <TeamLeaderboard poll={poll} session={session} members={members} />;
  }

  const rows = leaderboard(poll, session, members);

  if (rows.length === 0) {
    return (
      <div className="rounded-panel border border-dashed border-[var(--line)] bg-white/60 px-6 py-8 text-center">
        <p className="m-0 text-meta text-ink-faint">
          Итоги квиза появятся после первых верных ответов.
        </p>
      </div>
    );
  }

  const quizTotal = poll.questions.filter((question) => question.kind === "quiz").length;

  return (
    <div className="overflow-hidden rounded-panel border border-[var(--line)] bg-white">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <span className="font-display text-body font-semibold tracking-[-0.02em] text-navy">
          Лидерборд
        </span>
        <span className="text-caption text-ink-faint">
          {quizTotal} {quizTotal === 1 ? "вопрос" : quizTotal < 5 ? "вопроса" : "вопросов"} · очки за
          верные ответы
        </span>
      </div>

      <ol className="m-0 list-none p-0">
        {rows.slice(0, compact ? 5 : 20).map((row, index) => (
          <li
            key={row.memberId}
            className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-3 last:border-b-0"
            style={
              index === 0
                ? { background: "color-mix(in oklab, var(--accent) 12%, white)" }
                : undefined
            }
          >
            <span
              className={[
                "grid size-8 shrink-0 place-items-center rounded-full text-meta font-semibold",
                index === 0 ? "text-on-accent" : "text-navy",
              ].join(" ")}
              style={
                index === 0
                  ? { background: "var(--accent)" }
                  : { background: "color-mix(in oklab, var(--color-navy) 8%, transparent)" }
              }
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-medium text-ink">{row.name}</span>
              <span className="block text-micro text-ink-faint">
                верных ответов: {row.correct} из {row.totalQuiz}
                {row.firstCorrectAt ? ` · первый верный в ${formatTime(row.firstCorrectAt)}` : ""}
              </span>
            </span>
            <span className="font-display text-subtitle font-semibold tracking-[-0.02em] text-navy">
              {row.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Командный зачёт: сумма очков участников по командам. */
function TeamLeaderboard({
  poll,
  session,
  members,
}: {
  poll: Poll;
  session: PollSession;
  members: Member[];
}) {
  const rows = teamLeaderboard(poll, session, members);

  return (
    <div className="overflow-hidden rounded-panel border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <span className="font-display text-body font-semibold tracking-[-0.02em] text-navy">
          Командный зачёт
        </span>
        <span className="text-caption text-ink-faint">
          {rows.length} команд · очки за верные ответы
        </span>
      </div>
      <ol className="m-0 list-none p-0">
        {rows.map((row, index) => (
          <li
            key={row.team}
            className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-3 last:border-b-0"
            style={
              index === 0
                ? { background: "color-mix(in oklab, var(--accent) 12%, white)" }
                : undefined
            }
          >
            <span
              className={[
                "grid size-8 shrink-0 place-items-center rounded-full text-meta font-semibold",
                index === 0 ? "text-on-accent" : "text-navy",
              ].join(" ")}
              style={
                index === 0
                  ? { background: "var(--accent)" }
                  : { background: "color-mix(in oklab, var(--color-navy) 8%, transparent)" }
              }
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-medium text-ink">{row.name}</span>
              <span className="block text-micro text-ink-faint">
                участников: {row.players} · верных ответов: {row.correct}
              </span>
            </span>
            <span className="font-display text-subtitle font-semibold tracking-[-0.02em] text-navy">
              {row.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Компактная плашка о состоянии приёма ответов. */
export function AcceptingBadge({ accepting }: { accepting: boolean }) {  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-caption font-semibold",
        accepting ? "text-on-accent" : "text-ink-soft",
      ].join(" ")}
      style={
        accepting
          ? { background: "var(--accent)" }
          : { background: "color-mix(in oklab, var(--color-grey-brand) 60%, transparent)" }
      }
    >
      {accepting ? <span className="size-1.5 rounded-full bg-on-accent motion-safe:animate-pulse" /> : <Clock3 size={12} />}
      {accepting ? "Приём ответов открыт" : "Приём ответов закрыт"}
    </span>
  );
}
