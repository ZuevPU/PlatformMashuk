"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  FileSpreadsheet,
  Image as ImageIcon,
  Play,
  Plus,
  Users,
} from "lucide-react";
import { ParticipantScreen } from "./ParticipantScreen";
import { PollBuilder } from "./PollBuilder";
import { PresenterScreen } from "./PresenterScreen";
import { Leaderboard, QuestionResults } from "./QuestionResults";
import {
  activeQuestion,
  addResponse,
  addResponses,
  createResponse,
  createSession,
  finishSession,
  nextQuestion,
  previousQuestion,
  responsesFor,
  setAccepting,
  setShowResults,
  simulateResponses,
  startSession,
} from "@/lib/poll-actions";
import { buildPollCsv, downloadText, exportQuestionPng } from "@/lib/export";
import { localIsoNow } from "@/lib/dates";
import { submitPollResponseAction, createPollAction, updatePollSessionAction } from "@/app/programs/[slug]/hub/actions";
import { SIMULATED_PHRASES } from "@/lib/phrases";
import type { AnswerValue, Member, Poll, PollData, PollSession } from "@/lib/types";
import { QUESTION_KIND_LABELS } from "@/lib/types";

interface PollsViewProps {
  programSlug: string;
  programTitle: string;
  data: PollData;
  members: Member[];
  participantCount: number;
  currentUser: Member;
  canManage: boolean;
  accent: string;
  /** Запись в базу доступна вошедшему участнику */
  persist?: boolean;
}

const SESSION_LABELS: Record<PollSession["status"], string> = {
  draft: "Черновик",
  live: "Идёт сейчас",
  finished: "Завершён",
};

export function PollsView({
  programSlug,
  programTitle,
  data,
  members,
  participantCount,
  currentUser,
  canManage,
  accent,
  persist = false,
}: PollsViewProps) {
  const [polls, setPolls] = useState<Poll[]>(data.polls);
  const [sessions, setSessions] = useState<PollSession[]>(data.sessions);
  const [view, setView] = useState<"list" | "session" | "builder">("list");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );
  const activePoll = useMemo(
    () => polls.find((poll) => poll.id === activeSession?.pollId),
    [activeSession?.pollId, polls],
  );
  const question = activePoll && activeSession ? activeQuestion(activeSession, activePoll) : undefined;

  /* --- Таймер вопроса ---------------------------------------------------- */
  useEffect(() => {
    if (
      view === "session" &&
      activeSession?.status === "live" &&
      activeSession.accepting &&
      question?.timeLimit
    ) {
      setSecondsLeft(question.timeLimit);
    } else {
      setSecondsLeft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeSessionId, activeSession?.currentIndex, activeSession?.accepting, activeSession?.status]);

  useEffect(() => {
    if (secondsLeft === null) return;

    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft((value) => (value ?? 1) - 1), 1000);
      return () => clearTimeout(timer);
    }

    // Время вышло — закрываем приём ответов
    setSessions((previous) =>
      previous.map((session) =>
        session.id === activeSessionId ? setAccepting(session, false) : session,
      ),
    );
    if (persist && activeSession) {
      void updatePollSessionAction({
        programSlug,
        sessionId: activeSession.id,
        status: activeSession.status,
        currentIndex: activeSession.currentIndex,
        accepting: false,
        showResults: activeSession.showResults,
      });
    }
    setSecondsLeft(null);
  }, [activeSessionId, secondsLeft]);

  /**
   * Состояние сессии меняется локально сразу, а в базу уходит следом.
   * Ведущий и участники видят одно и то же: сервер — источник истины.
   */
  const applySession = (next: PollSession) => {
    setSessions((previous) =>
      previous.map((session) => (session.id === next.id ? next : session)),
    );
    if (persist) {
      void updatePollSessionAction({
        programSlug,
        sessionId: next.id,
        status: next.status,
        currentIndex: next.currentIndex,
        accepting: next.accepting,
        showResults: next.showResults,
      }).then((result) => {
        if (!result.ok) setPollError(result.error);
      });
    }
  };

  /**
   * Живое состояние сессии.
   *
   * Пока используется короткий опрос сервера: ведущий меняет состояние,
   * участники узнают об этом за пару секунд, без перезагрузки страницы.
   * Интерфейс не зависит от транспорта — Socket.IO заменит опрос внутри.
   */
  useEffect(() => {
    if (!persist || view !== "session" || !activeSessionId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/poll-state?program=${encodeURIComponent(programSlug)}&session=${encodeURIComponent(activeSessionId)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as {
          ok: boolean;
          status?: PollSession["status"];
          currentIndex?: number;
          accepting?: boolean;
          showResults?: boolean;
        };
        if (cancelled || !data.ok) return;

        setSessions((previous) =>
          previous.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  status: data.status ?? session.status,
                  currentIndex: data.currentIndex ?? session.currentIndex,
                  accepting: data.accepting ?? session.accepting,
                  showResults: data.showResults ?? session.showResults,
                }
              : session,
          ),
        );
      } catch {
        // сеть недоступна — повторим на следующем тике
      }
    };

    void poll();
    // Резервная сверка: если поток событий недоступен, состояние всё равно обновится
    const timer = setInterval(poll, 15000);

    // Основной канал — поток событий с сервера: обновляемся сразу, как только
    // ведущий что-то изменил, без ожидания следующего тика
    const source = new EventSource(`/api/events?program=${encodeURIComponent(programSlug)}`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { type?: string };
        if (event.type && event.type !== "ready") void poll();
      } catch {
        // некорректное сообщение пропускаем
      }
    };

    return () => {
      cancelled = true;
      clearInterval(timer);
      source.close();
    };
  }, [persist, view, activeSessionId, programSlug]);

  const updateSession = (updater: (session: PollSession) => PollSession) => {
    if (!activeSession) return;
    applySession(updater(activeSession));
  };

  const openSession = (poll: Poll) => {
    const existing = sessions.find((session) => session.pollId === poll.id);
    if (existing) {
      setActiveSessionId(existing.id);
    } else {
      const created = createSession(poll);
      setSessions((previous) => [...previous, created]);
      setActiveSessionId(created.id);
    }
    setView("session");
  };

  const submitAnswer = (value: AnswerValue) => {
    if (!activePoll || !activeSession || !question) return;
    updateSession((session) =>
      addResponse(
        session,
        createResponse({
          questionId: question.id,
          memberId: activePoll.anonymous ? undefined : currentUser.id,
          value,
          createdAt: localIsoNow(),
        }),
      ),
    );

    if (persist) {
      void submitPollResponseAction({
        programSlug,
        sessionId: activeSession.id,
        questionId: question.id,
        anonymous: activePoll.anonymous,
        value,
      }).then((result) => {
        if (!result.ok) setPollError(result.error);
      });
    }
  };

  const simulate = (count: number) => {
    if (!activePoll || !activeSession || !question) return;
    const answered = responsesFor(activeSession, question.id)
      .map((response) => response.memberId)
      .filter((memberId): memberId is string => Boolean(memberId));

    const generated = simulateResponses({
      question,
      members,
      count,
      phrases: SIMULATED_PHRASES,
      createdAt: localIsoNow(),
      anonymous: activePoll.anonymous,
      exclude: answered,
    });
    updateSession((session) => addResponses(session, generated));
  };

  const exportCsv = () => {
    if (!activePoll || !activeSession) return;
    downloadText(
      `${programSlug}-${activePoll.id}-results.csv`,
      buildPollCsv({ poll: activePoll, session: activeSession, members, programTitle }),
    );
  };

  const exportPng = () => {
    if (!activePoll || !activeSession || !question) return;
    void exportQuestionPng({
      poll: activePoll,
      question,
      session: activeSession,
      members,
      accent,
      fileName: `${programSlug}-${activePoll.id}-q${activeSession.currentIndex + 1}.png`,
    });
  };

  /* --- Конструктор ------------------------------------------------------- */
  if (view === "builder") {
    return (
      <PollBuilder
        templates={data.templates}
        programSlug={programSlug}
        createdAt={localIsoNow()}
        onCancel={() => setView("list")}
        onSave={(poll) => {
          if (!persist) {
            const created = createSession(poll);
            setPolls((previous) => [poll, ...previous]);
            setSessions((previous) => [created, ...previous]);
            setActiveSessionId(created.id);
            setView("list");
            return;
          }

          void createPollAction({
            programSlug,
            title: poll.title,
            description: poll.description,
            anonymous: poll.anonymous,
            source: poll.source,
            templateKey: poll.templateKey,
            questions: poll.questions.map((question) => ({
              kind: question.kind,
              title: question.title,
              hint: question.hint,
              options: question.options,
              scaleLabels: question.scaleLabels,
              visual: question.visual,
              timeLimit: question.timeLimit,
              points: question.points,
            })),
          }).then((result) => {
            if (!result.ok) {
              setPollError(result.error);
              return;
            }

            // Идентификаторы приходят из базы — интерфейс работает с ними же
            const stored: Poll = {
              ...poll,
              id: result.pollId,
              questions: poll.questions.map((question, index) => ({
                ...question,
                id: result.questionIds[index] ?? question.id,
              })),
            };
            const created: PollSession = {
              id: result.sessionId,
              pollId: stored.id,
              programSlug,
              code: result.code,
              status: "draft",
              currentIndex: 0,
              accepting: false,
              showResults: false,
              responses: [],
            };

            setPolls((previous) => [stored, ...previous]);
            setSessions((previous) => [created, ...previous]);
            setActiveSessionId(created.id);
            setView("list");
          });
        }}
      />
    );
  }

  /* --- Сессия ------------------------------------------------------------ */
  if (view === "session" && activePoll && activeSession) {
    const responses = question ? responsesFor(activeSession, question.id).length : 0;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setView("list")}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 text-[12px] font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
          >
            <ChevronLeft size={14} />
            К списку опросов
          </button>
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3 py-1.5 text-[12px] font-semibold text-sky-ink">
            {SESSION_LABELS[activeSession.status]}
          </span>
          {activePoll.anonymous && <span className="tag">анонимный</span>}
          <span className="text-[12px] text-ink-faint">
            Ответов на текущий вопрос: {responses}
          </span>
        </div>

        <div
          className={[
            "grid gap-5",
            canManage ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "",
          ].join(" ")}
        >
          {canManage ? (
            <PresenterScreen
              poll={activePoll}
              session={activeSession}
              members={members}
              participantCount={participantCount}
              secondsLeft={secondsLeft}
              onToggleAccepting={() =>
                updateSession((session) => {
                  const starting = !session.accepting;
                  const next = starting ? startSession(session, localIsoNow()) : session;
                  return setAccepting(next, starting);
                })
              }
              onToggleResults={() =>
                updateSession((session) => setShowResults(session, !session.showResults))
              }
              onNext={() => updateSession((session) => nextQuestion(session, activePoll))}
              onPrevious={() => updateSession((session) => previousQuestion(session))}
              onFinish={() => updateSession((session) => finishSession(session, localIsoNow()))}
              onSimulate={simulate}
              onExportCsv={exportCsv}
              onExportPng={exportPng}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {question && (
                <section className="card p-6">
                  <p className="eyebrow mb-2">Вопрос {activeSession.currentIndex + 1}</p>
                  <h2 className="m-0 mb-4 font-display text-[clamp(20px,2.6vw,28px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
                    {question.title}
                  </h2>
                  {activeSession.showResults ? (
                    <QuestionResults
                      poll={activePoll}
                      question={question}
                      session={activeSession}
                      members={members}
                      anonymous={activePoll.anonymous}
                    />
                  ) : (
                    <p className="m-0 text-[13px] text-ink-faint">
                      Результаты появятся на экране, когда ведущий их откроет.
                    </p>
                  )}
                </section>
              )}
              {question?.kind === "quiz" && activeSession.showResults && (
                <Leaderboard poll={activePoll} session={activeSession} members={members} compact />
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {question ? (
              <ParticipantScreen
                poll={activePoll}
                question={question}
                session={activeSession}
                currentUser={currentUser}
                secondsLeft={secondsLeft}
                onSubmit={submitAnswer}
              />
            ) : (
              <p className="m-0 text-[13px] text-ink-faint">В опросе нет вопросов.</p>
            )}

            <p className="m-0 rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 text-[12px] leading-relaxed text-ink-faint">
              {pollError
                ? `Не удалось сохранить ответ: ${pollError}`
                : canManage
                  ? "Демонстрационный режим: ответ из правой колонки сразу попадает в результаты на экране ведущего. Ответы остальных участников добавляются кнопкой «Сымитировать ответы» — на волне 5 их заменит настоящий реалтайм."
                  : "Ваш ответ отправляется ведущему и появляется на экране в зале."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* --- Список опросов ---------------------------------------------------- */
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-[620px]">
            <p className="eyebrow mb-2">Опросы и квизы</p>
            <h2 className="m-0 mb-3 font-display text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
              Живая обратная связь на программе
            </h2>
            <p className="m-0 text-[14px] leading-relaxed text-ink-soft">
              Ведущий запускает вопрос — участники отвечают с телефона по коду. Результаты
              появляются на экране в зале: столбцы, облако слов, шкалы или лидерборд квиза.
              Всё выгружается в таблицу и картинку.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setView("builder")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-[14px] font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep"
            >
              <Plus size={15} />
              Создать опрос
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3.5 py-1.5 text-[12px] font-semibold text-sky-ink">
            {polls.length} {polls.length === 1 ? "опрос" : polls.length < 5 ? "опроса" : "опросов"}
          </span>
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3.5 py-1.5 text-[12px] font-semibold text-sky-ink">
            {data.templates.length} шаблонов в библиотеке
          </span>
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3.5 py-1.5 text-[12px] font-semibold text-sky-ink">
            участников в программе: {participantCount}
          </span>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {polls.map((poll) => {
          const session = sessions.find((item) => item.pollId === poll.id);
          const responses = session?.responses.length ?? 0;
          const kinds = [...new Set(poll.questions.map((item) => QUESTION_KIND_LABELS[item.kind]))];

          return (
            <article key={poll.id} className="card p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                {session && (
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-[11px] font-semibold",
                      session.status === "live"
                        ? "text-white"
                        : session.status === "finished"
                          ? "bg-[rgba(220,222,221,0.6)] text-ink-soft"
                          : "bg-[rgba(34,63,154,0.08)] text-navy",
                    ].join(" ")}
                    style={session.status === "live" ? { background: "var(--accent)" } : undefined}
                  >
                    {SESSION_LABELS[session.status]}
                  </span>
                )}
                {poll.anonymous && <span className="tag">анонимный</span>}
                {poll.source === "template" && <span className="tag">из шаблона</span>}
                {session && (
                  <span className="ml-auto text-[12px] text-ink-faint">код {session.code}</span>
                )}
              </div>

              <h3 className="m-0 mb-2.5 font-display text-[clamp(19px,2.2vw,24px)] leading-snug font-semibold tracking-[-0.03em] text-navy">
                {poll.title}
              </h3>
              {poll.description && (
                <p className="m-0 mb-4 text-[13px] leading-relaxed text-ink-soft">
                  {poll.description}
                </p>
              )}

              <dl className="m-0 mb-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4 text-[12px]">
                <div>
                  <dt className="text-ink-faint">Вопросы</dt>
                  <dd className="m-0 font-semibold text-ink">{poll.questions.length}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Ответы</dt>
                  <dd className="m-0 font-semibold text-ink">{responses}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Типы</dt>
                  <dd className="m-0 font-semibold text-ink">{kinds.length}</dd>
                </div>
              </dl>

              <p className="m-0 mb-5 flex flex-wrap gap-1.5">
                {kinds.map((kind) => (
                  <span key={kind} className="tag">
                    {kind}
                  </span>
                ))}
              </p>

              <div className="mt-auto flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => openSession(poll)}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-navy px-4 text-[13px] font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep"
                >
                  {session?.status === "live" ? <Play size={14} /> : <BarChart3 size={14} />}
                  {canManage ? (session?.status === "live" ? "Открыть сессию" : "Запустить") : "Ответить"}
                </button>

                {canManage && session && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        downloadText(
                          `${programSlug}-${poll.id}-results.csv`,
                          buildPollCsv({
                            poll,
                            session,
                            members,
                            programTitle,
                          }),
                        )
                      }
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-[13px] font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
                    >
                      <FileSpreadsheet size={14} />
                      Таблица
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Выгрузка картинки доступна на экране ведущего"
                      className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-[13px] font-semibold text-navy opacity-45"
                    >
                      <ImageIcon size={14} />
                      Картинка
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="card flex flex-wrap items-center gap-5 p-6">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full"
          style={{ background: "rgba(34,63,154,0.08)", color: "#223F9A" }}
        >
          <Users size={18} />
        </span>
        <p className="m-0 max-w-[720px] text-[13px] leading-relaxed text-ink-soft">
          <b className="text-ink">Как это работает в зале.</b> Ведущий открывает опрос, называет
          код с экрана — участники вводят его на телефоне и отвечают. Приём ответов можно закрыть
          в любой момент, результаты показать или скрыть, а после программы выгрузить таблицу для
          отчёта или картинку для презентации.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setView("builder")}
            className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-[13px] font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
          >
            <Plus size={14} />
            Собрать из шаблона
          </button>
        )}
      </section>
    </div>
  );
}
