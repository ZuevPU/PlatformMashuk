"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  FileSpreadsheet,
  Flag,
  Image as ImageIcon,
  Play,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { ParticipantScreen } from "./ParticipantScreen";
import { PollBuilder } from "./PollBuilder";
import { PollPresentation } from "./PollPresentation";
import { PresenterScreen } from "./PresenterScreen";
import { QuestionResults } from "./QuestionResults";
import {
  activeQuestion,
  addResponse,
  createResponse,
  finishSession,
  nextQuestion,
  previousQuestion,
  responsesFor,
  setAccepting,
  setShowResults,
  startSession,
} from "@/lib/poll-actions";
import { localIsoNow } from "@/lib/dates";
import { submitPollResponseAction, createPollAction, updatePollSessionAction, moderateQaResponseAction, toggleQaVoteAction, deletePollAction } from "@/app/programs/[slug]/hub/actions";
import type { AnswerValue, Member, Poll, PollData, PollResponse, PollSession } from "@/lib/types";
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
  accentInk: string;
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
  accentInk,
}: PollsViewProps) {
  const [polls, setPolls] = useState<Poll[]>(data.polls);
  const [sessions, setSessions] = useState<PollSession[]>(data.sessions);
  /** Свои ответы, которые ещё не подтвердила база: не теряем их при обновлении данных */
  const pendingAnswers = useRef(new Map<string, { sessionId: string; response: PollResponse }>());
  const [view, setView] = useState<"list" | "session" | "builder">("list");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );
  const activePoll = useMemo(
    () => polls.find((poll) => poll.id === activeSession?.pollId),
    [activeSession?.pollId, polls],
  );
  const question = activePoll && activeSession ? activeQuestion(activeSession, activePoll) : undefined;

  /** Единственный активный опрос программы (если он есть). */
  const liveSession = sessions.find((item) => item.status === "live");

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
    if (canManage && activeSession) {
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
  };

  /**
   * Сервер — источник истины. Живые события обновляют данные хаба,
   * сюда они приходят пропсом; неподтверждённые свои ответы сохраняем.
   */
  useEffect(() => {
    setPolls(data.polls);
    setSessions(
      data.sessions.map((session) => {
        const pending = [...pendingAnswers.current.values()]
          .filter(
            (item) =>
              item.sessionId === session.id &&
              !session.responses.some(
                (stored) => stored.mine && stored.questionId === item.response.questionId,
              ),
          )
          .map((item) => item.response);
        return pending.length ? { ...session, responses: [...session.responses, ...pending] } : session;
      }),
    );
  }, [data]);

  /** Участник сразу видит вопрос, который ведущий только что запустил. */
  const autoOpened = useRef<string | null>(null);
  const liveSessionId = sessions.find((session) => session.status === "live")?.id ?? null;
  useEffect(() => {
    if (canManage || !liveSessionId || autoOpened.current === liveSessionId) return;
    autoOpened.current = liveSessionId;
    setActiveSessionId(liveSessionId);
    setView("session");
  }, [canManage, liveSessionId]);

  const updateSession = (updater: (session: PollSession) => PollSession) => {
    if (!activeSession) return;
    applySession(updater(activeSession));
  };

  const openSession = (poll: Poll) => {
    const existing = sessions.find((session) => session.pollId === poll.id);
    if (!existing) return;
    setActiveSessionId(existing.id);
    setView("session");
  };

  /** Удаление опроса вместе с сессией и ответами. */
  const deletePoll = (poll: Poll) => {
    if (!window.confirm(`Удалить опрос «${poll.title}»? Сессия и ответы тоже удалятся.`)) return;
    setPolls((previous) => previous.filter((item) => item.id !== poll.id));
    setSessions((previous) => previous.filter((item) => item.pollId !== poll.id));
    void deletePollAction({ programSlug, pollId: poll.id }).then((result) => {
      if (!result.ok) setPollError(result.error);
    });
  };

  /** Завершить опрос из списка: приём закрывается, результаты сохраняются. */
  const finishPoll = (poll: Poll) => {
    const session = sessions.find((item) => item.pollId === poll.id);
    if (!session) return;
    applySession(finishSession(session, localIsoNow()));
  };

  /** Модерация Q&A: скрыть вопрос или отметить отвеченным (команда программы). */
  const moderateQaResponse = (
    responseId: string,
    patch: { hidden?: boolean; answered?: boolean },
  ) => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    setSessions((previous) =>
      previous.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              responses: session.responses.map((response) =>
                response.id === responseId ? { ...response, ...patch } : response,
              ),
            }
          : session,
      ),
    );
    void moderateQaResponseAction({ programSlug, sessionId, responseId, patch }).then((result) => {
      if (!result.ok) setPollError(result.error);
    });
  };

  /** Голос за вопрос зала (Q&A) — один голос на участника. */
  const voteQa = (responseId: string) => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    setSessions((previous) =>
      previous.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              responses: session.responses.map((response) =>
                response.id === responseId
                  ? {
                      ...response,
                      voted: !response.voted,
                      votes: (response.votes ?? 0) + (response.voted ? -1 : 1),
                    }
                  : response,
              ),
            }
          : session,
      ),
    );
    void toggleQaVoteAction({ programSlug, sessionId, responseId }).then((result) => {
      if (!result.ok) setPollError(result.error);
    });
  };

  const submitAnswer = (value: AnswerValue) => {
    if (!activePoll || !activeSession || !question) return;
    const response = createResponse({
      questionId: question.id,
      memberId: activePoll.anonymous ? undefined : currentUser.id,
      value,
      createdAt: localIsoNow(),
    });
    const sessionId = activeSession.id;
    pendingAnswers.current.set(response.id, { sessionId, response });
    // Ответ виден сразу; состояние сессии на сервер при этом не отправляется
    setSessions((previous) =>
      previous.map((session) => (session.id === sessionId ? addResponse(session, response) : session)),
    );
    setPollError(null);

    void submitPollResponseAction({
      programSlug,
      sessionId,
      questionId: question.id,
      value,
    }).then((result) => {
      pendingAnswers.current.delete(response.id);
      if (!result.ok) {
        setPollError(result.error);
        setSessions((previous) =>
          previous.map((session) =>
            session.id === sessionId
              ? { ...session, responses: session.responses.filter((item) => item.id !== response.id) }
              : session,
          ),
        );
      }
    });
  };

  // Модуль выгрузки (canvas, CSV) нужен редко — загружается по клику, а не со страницей
  const exportCsv = async () => {
    if (!activePoll || !activeSession) return;
    const { buildPollCsv, downloadText } = await import("@/lib/export");
    downloadText(
      `${programSlug}-${activePoll.id}-results.csv`,
      buildPollCsv({ poll: activePoll, session: activeSession, members, programTitle }),
    );
  };

  const exportPng = async () => {
    if (!activePoll || !activeSession || !question) return;
    const { exportQuestionPng } = await import("@/lib/export");
    void exportQuestionPng({
      poll: activePoll,
      question,
      session: activeSession,
      members,
      accent,
      accentInk,
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

          void createPollAction({
            programSlug,
            title: poll.title,
            description: poll.description,
            anonymous: poll.anonymous,
            teamCount: poll.teamCount,
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
        {presenting && (
          <PollPresentation
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
            onExit={() => setPresenting(false)}
            onModerate={moderateQaResponse}
            onVote={voteQa}
          />
        )}
        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setView("list")}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 text-caption font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
            >
              <ChevronLeft size={14} />
              К списку опросов
            </button>
            <span className="rounded-full bg-[var(--color-sky-tint)] px-3 py-1.5 text-caption font-semibold text-sky-ink">
              {SESSION_LABELS[activeSession.status]}
            </span>
            {activePoll.anonymous && <span className="tag">анонимный</span>}
            <span className="text-caption text-ink-faint">
              Ответов на текущий вопрос: {responses}
            </span>
          </div>
        )}

        {canManage ? (
          <div className="flex flex-col gap-5">
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
              onExportCsv={exportCsv}
              onExportPng={exportPng}
              onPresent={() => setPresenting(true)}
              onModerate={moderateQaResponse}
              onVote={voteQa}
            />

            <div className="grid gap-4 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:items-start">
              {question ? (
                <ParticipantScreen
                  poll={activePoll}
                  question={question}
                  session={activeSession}
                  currentUser={currentUser}
                  secondsLeft={secondsLeft}
                  onSubmit={submitAnswer}
                  variant="preview"
                />
              ) : (
                <p className="m-0 text-meta text-ink-faint">В опросе нет вопросов.</p>
              )}
              <p className="m-0 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-caption leading-relaxed text-ink-faint">
                {pollError
                  ? `Не удалось сохранить ответ: ${pollError}`
                  : "Ответы участников появляются на экране в реальном времени. Слева — экран участника: можно ответить и самому."}
              </p>
            </div>
          </div>
        ) : question ? (
          <div className="mx-auto flex w-full max-w-130 flex-col gap-5">
            <ParticipantScreen
              poll={activePoll}
              question={question}
              session={activeSession}
              currentUser={currentUser}
              secondsLeft={secondsLeft}
              onSubmit={submitAnswer}
              variant="full"
            />

            {responses > 0 && (
              <details className="rounded-panel border border-[var(--line)] bg-white p-4">
                <summary className="cursor-pointer text-meta font-semibold text-navy">
                  Что отвечают другие
                </summary>
                <div className="mt-4">
                  <QuestionResults
                    poll={activePoll}
                    question={question}
                    session={activeSession}
                    members={members}
                    anonymous={activePoll.anonymous}
                    onVote={voteQa}
                  />
                </div>
              </details>
            )}

            {pollError && (
              <p role="alert" className="m-0 rounded-field bg-autumn/10 px-4 py-3 text-meta text-ink">
                Не удалось отправить ответ: {pollError}
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 text-meta text-ink-faint">В опросе нет вопросов.</p>
        )}
      </div>
    );
  }

  /* --- Участник: только активный опрос, иначе — плашка ------------------- */
  if (!canManage) {
    return (
      <section className="card grid min-h-45 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-sky-tint text-navy">
            <BarChart3 size={20} />
          </span>
          <p className="m-0 mb-1.5 font-display text-lead font-semibold text-navy">
            Нет активного опроса
          </p>
          <p className="m-0 text-meta leading-relaxed text-ink-faint">
            Когда ведущий запустит опрос, экран обновится сам.
          </p>
        </div>
      </section>
    );
  }

  /* --- Список опросов (команда программы) -------------------------------- */
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-155">
            <p className="eyebrow mb-2">Опросы и квизы</p>
            <h2 className="m-0 mb-3 font-display text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
              Живая обратная связь на программе
            </h2>
            <p className="m-0 text-ui leading-relaxed text-ink-soft">
              Ведущий запускает вопрос — участники отвечают с телефона по коду. Результаты
              появляются на экране в зале: столбцы, облако слов, шкалы или лидерборд квиза.
              Всё выгружается в таблицу и картинку.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setView("builder")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-ui font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep"
            >
              <Plus size={15} />
              Создать опрос
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3.5 py-1.5 text-caption font-semibold text-sky-ink">
            {polls.length} {polls.length === 1 ? "опрос" : polls.length < 5 ? "опроса" : "опросов"}
          </span>
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3.5 py-1.5 text-caption font-semibold text-sky-ink">
            {data.templates.length} шаблонов в библиотеке
          </span>
          <span className="rounded-full bg-[var(--color-sky-tint)] px-3.5 py-1.5 text-caption font-semibold text-sky-ink">
            участников в программе: {participantCount}
          </span>
          <span
            className="rounded-full px-3.5 py-1.5 text-caption font-semibold"
            style={
              liveSession
                ? { background: "color-mix(in oklab, var(--accent) 16%, white)", color: "var(--accent-ink)" }
                : { background: "color-mix(in oklab, var(--color-navy) 6%, transparent)", color: "var(--color-ink-soft)" }
            }
          >
            {liveSession
              ? `Идёт: ${polls.find((item) => item.id === liveSession.pollId)?.title ?? "опрос"}`
              : "Нет активного опроса"}
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
                      "rounded-full px-3 py-1 text-micro font-semibold",
                      session.status === "live"
                        ? "text-on-accent"
                        : session.status === "finished"
                          ? "bg-grey-brand/60 text-ink-soft"
                          : "bg-navy/8 text-navy",
                    ].join(" ")}
                    style={session.status === "live" ? { background: "var(--accent)" } : undefined}
                  >
                    {SESSION_LABELS[session.status]}
                  </span>
                )}
                {poll.anonymous && <span className="tag">анонимный</span>}
                {poll.source === "template" && <span className="tag">из шаблона</span>}
                {session && (
                  <span className="ml-auto text-caption text-ink-faint">код {session.code}</span>
                )}
              </div>

              <h3 className="m-0 mb-2.5 font-display text-[clamp(19px,2.2vw,24px)] leading-snug font-semibold tracking-[-0.03em] text-navy">
                {poll.title}
              </h3>
              {poll.description && (
                <p className="m-0 mb-4 text-meta leading-relaxed text-ink-soft">
                  {poll.description}
                </p>
              )}

              <dl className="m-0 mb-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4 text-caption">
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
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-navy px-4 text-meta font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep"
                >
                  {session?.status === "live" ? <Play size={14} /> : <BarChart3 size={14} />}
                  {canManage ? "Открыть" : "Ответить"}
                </button>

                {canManage && session && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const { buildPollCsv, downloadText } = await import("@/lib/export");
                        downloadText(
                          `${programSlug}-${poll.id}-results.csv`,
                          buildPollCsv({
                            poll,
                            session,
                            members,
                            programTitle,
                          }),
                        );
                      }}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-meta font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
                    >
                      <FileSpreadsheet size={14} />
                      Таблица
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Выгрузка картинки доступна на экране ведущего"
                      className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-meta font-semibold text-navy opacity-45"
                    >
                      <ImageIcon size={14} />
                      Картинка
                    </button>
                    {session.status === "live" && (
                      <button
                        type="button"
                        onClick={() => finishPoll(poll)}
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-meta font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
                      >
                        <Flag size={14} />
                        Завершить опрос
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePoll(poll)}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-autumn/40 bg-white px-4 text-meta font-semibold text-autumn-ink transition-all duration-200 ease-brand hover:-translate-y-0.5"
                    >
                      <Trash2 size={14} />
                      Удалить
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
          className="grid size-11 shrink-0 place-items-center rounded-full bg-navy/8 text-navy"
        >
          <Users size={18} />
        </span>
        <p className="m-0 max-w-180 text-meta leading-relaxed text-ink-soft">
          <b className="text-ink">Как это работает в зале.</b> Ведущий открывает опрос, называет
          код с экрана — участники вводят его на телефоне и отвечают. Приём ответов можно закрыть
          в любой момент, результаты показать или скрыть, а после программы выгрузить таблицу для
          отчёта или картинку для презентации.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setView("builder")}
            className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-meta font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
          >
            <Plus size={14} />
            Собрать из шаблона
          </button>
        )}
      </section>
    </div>
  );
}
