"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ParticipantScreen } from "./ParticipantScreen";
import { QuestionResults } from "./QuestionResults";
import {
  activeQuestion,
  addResponse,
  createResponse,
  setAccepting,
} from "@/lib/poll-actions";
import { submitPollResponseAction, toggleQaVoteAction } from "@/app/programs/[slug]/hub/actions";
import { localIsoNow } from "@/lib/dates";
import type { AnswerValue, Member, Poll, PollData, PollResponse, PollSession } from "@/lib/types";

interface PollJoinProps {
  programSlug: string;
  programTitle: string;
  poll: Poll;
  session: PollSession;
  members: Member[];
  currentUser: Member;
}

/**
 * Экран участника по ссылке или QR (/poll/<код>).
 *
 * Один поток событий (SSE) на страницу: ведущий меняет вопрос или открывает
 * результаты — телефон обновляется сам. Ответ уходит на сервер, а состояние
 * «ответ принят» показывается сразу.
 */
export function PollJoin({
  programSlug,
  programTitle,
  poll,
  session: initialSession,
  members,
  currentUser,
}: PollJoinProps) {
  const [session, setSession] = useState(initialSession);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionId = initialSession.id;
  const question = activeQuestion(session, poll);

  /** Свежие данные сессии: сервер — источник истины. */
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/hub/polls?program=${encodeURIComponent(programSlug)}&session=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const body = (await response.json()) as { ok: boolean; data?: PollData };
      const fresh = body.data?.sessions.find((item) => item.id === sessionId);
      if (body.ok && fresh) setSession(fresh);
    } catch {
      // сеть отвалилась — догоним при переподключении потока
    }
  }, [programSlug, sessionId]);

  /* --- Живое состояние: таймер и события --------------------------------- */
  useEffect(() => {
    if (session.status === "live" && session.accepting && question?.timeLimit) {
      setSecondsLeft(question.timeLimit);
    } else {
      setSecondsLeft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, session.currentIndex, session.accepting]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft((value) => (value ?? 1) - 1), 1000);
      return () => clearTimeout(timer);
    }
    // Время вышло — закрываем приём локально, пока ведущий не переключит вопрос
    setSession((previous) => setAccepting(previous, false));
    setSecondsLeft(null);
  }, [secondsLeft]);

  useEffect(() => {
    const source = new EventSource(`/api/events?program=${encodeURIComponent(programSlug)}`);
    let opened = false;

    source.onopen = () => {
      if (opened) void refresh();
      opened = true;
    };
    source.onmessage = (message) => {
      let event: { type?: string; sessionId?: string; status?: PollSession["status"]; currentIndex?: number; accepting?: boolean; showResults?: boolean };
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      if (event.sessionId !== sessionId) return;

      if (event.type === "poll-session" && event.status) {
        setSession((previous) => ({
          ...previous,
          status: event.status!,
          currentIndex: event.currentIndex ?? previous.currentIndex,
          accepting: event.accepting ?? previous.accepting,
          showResults: event.showResults ?? previous.showResults,
        }));
        // Новая вопросы/ответы — подтянем полное состояние
        void refresh();
      } else if (event.type === "poll-responses") {
        void refresh();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [programSlug, sessionId, refresh]);

  /* --- Голос за вопрос зала (Q&A) ---------------------------------------- */
  const vote = (responseId: string) => {
    setSession((previous) => ({
      ...previous,
      responses: previous.responses.map((item) =>
        item.id === responseId
          ? { ...item, voted: !item.voted, votes: (item.votes ?? 0) + (item.voted ? -1 : 1) }
          : item,
      ),
    }));
    void toggleQaVoteAction({ programSlug, sessionId, responseId });
  };

  /* --- Отправка ответа --------------------------------------------------- */
  const submit = (value: AnswerValue) => {
    if (!question) return;
    const response = createResponse({
      questionId: question.id,
      memberId: poll.anonymous ? undefined : currentUser.id,
      value,
      createdAt: localIsoNow(),
    });
    const responseId = response.id;
    setSession((previous) => addResponse(previous, response));
    setError(null);

    void submitPollResponseAction({
      programSlug,
      sessionId,
      questionId: question.id,
      value,
    }).then((result) => {
      if (!result.ok) {
        setSession((previous) => ({
          ...previous,
          responses: previous.responses.filter((item) => item.id !== responseId),
        }));
        setError(result.error);
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-120 px-4 py-6">
      {question ? (
        <ParticipantScreen
          poll={poll}
          question={question}
          session={session}
          currentUser={currentUser}
          secondsLeft={secondsLeft}
          onSubmit={submit}
          showHint={false}
          variant="full"
        />
      ) : (
        <div className="card p-7 text-center">
          <p className="m-0 font-display text-lead font-semibold text-navy">В опросе нет вопросов</p>
        </div>
      )}

      {question && session.responses.some((item) => item.questionId === question.id) && (
        <details className="mt-5 rounded-panel border border-[var(--line)] bg-white p-4">
          <summary className="cursor-pointer text-meta font-semibold text-navy">
            Что отвечают другие
          </summary>
          <div className="mt-4">
            <QuestionResults
              poll={poll}
              question={question}
              session={session}
              members={members}
              anonymous={poll.anonymous}
              onVote={vote}
            />
          </div>
        </details>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-field bg-autumn/10 px-4 py-3 text-meta text-ink">
          Не удалось отправить ответ: {error}
        </p>
      )}
    </div>
  );
}
