"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookTemplate,
  Check,
  FilePlus2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { Poll, PollTemplate, Question, QuestionKind } from "@/lib/types";
import { QUESTION_KIND_HINTS, QUESTION_KIND_LABELS } from "@/lib/types";

interface PollBuilderProps {
  templates: PollTemplate[];
  programSlug: string;
  createdAt: string;
  onSave: (poll: Poll) => void;
  onCancel: () => void;
}

const KINDS: QuestionKind[] = ["single", "multiple", "open", "cloud", "qa", "scale", "quiz"];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankQuestion(kind: QuestionKind): Question {
  const id = uid("q");
  const base = { id, kind, title: "", options: [], timeLimit: 0, points: 0 } as Question;

  if (kind === "open") {
    return { ...base, visual: "list", hint: "Короткий ответ" };
  }
  if (kind === "cloud") {
    return { ...base, visual: "cloud", hint: "Одно слово или короткая фраза" };
  }
  if (kind === "qa") {
    return { ...base, hint: "Ваш вопрос ведущему" };
  }
  if (kind === "scale") {
    return { ...base, scaleLabels: { min: "совсем нет", max: "полностью да" } };
  }
  if (kind === "quiz") {
    return {
      ...base,
      timeLimit: 30,
      points: 10,
      options: [
        { id: uid("o"), text: "", correct: true },
        { id: uid("o"), text: "" },
        { id: uid("o"), text: "" },
      ],
    };
  }
  return {
    ...base,
    options: [
      { id: uid("o"), text: "" },
      { id: uid("o"), text: "" },
    ],
  };
}

export function PollBuilder({
  templates,
  programSlug,
  createdAt,
  onSave,
  onCancel,
}: PollBuilderProps) {
  const [step, setStep] = useState<"template" | "editor">("template");
  const [source, setSource] = useState<"template" | "custom">("custom");
  const [templateKey, setTemplateKey] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);

  const applyTemplate = (template: PollTemplate) => {
    setTitle(template.title);
    setDescription(template.description);
    setAnonymous(template.anonymous);
    setQuestions(template.questions.map((question) => ({ ...question, options: [...question.options] })));
    setSource("template");
    setTemplateKey(template.key);
    setTeamCount(0);
    setStep("editor");
  };

  const startEmpty = () => {
    setTitle("");
    setDescription("");
    setAnonymous(false);
    setQuestions([blankQuestion("single")]);
    setSource("custom");
    setTemplateKey(undefined);
    setTeamCount(0);
    setStep("editor");
  };

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((previous) =>
      previous.map((question, position) =>
        position === index ? { ...question, ...patch } : question,
      ),
    );
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const canSave =
    title.trim().length > 0 && questions.some((question) => question.title.trim().length > 0);

  const save = () => {
    if (!canSave) return;
    onSave({
      id: uid("poll"),
      programSlug,
      title: title.trim(),
      description: description.trim() || undefined,
      questions,
      anonymous,
      teamCount,
      createdAt,
      source,
      templateKey,
    });
  };

  if (step === "template") {
    return (
      <section className="card p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Новый опрос</p>
            <h2 className="m-0 font-display text-[clamp(22px,2.8vw,30px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
              Шаблон или опрос с нуля
            </h2>
            <p className="m-0 mt-2 max-w-140 text-meta leading-relaxed text-ink-soft">
              Готовые шаблоны уже собраны под типовые ситуации программы. Любой из них можно
              изменить под себя — вопросы, варианты и настройки останутся вашими.
            </p>
          </div>
          <button type="button" onClick={onCancel} className={ghostButton}>
            <X size={14} />
            Отмена
          </button>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => applyTemplate(template)}
              className="cursor-pointer rounded-panel border border-[var(--line)] bg-white p-5 text-left transition-all duration-200 ease-brand hover:-translate-y-1 hover:shadow-[var(--shadow-brand)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="tag">{template.purpose}</span>
                <BookTemplate size={16} className="text-ink-faint" />
              </div>
              <h3 className="m-0 mb-2 font-display text-lead leading-snug font-semibold tracking-[-0.02em] text-navy">
                {template.title}
              </h3>
              <p className="m-0 text-meta leading-relaxed text-ink-soft">
                {template.description}
              </p>
              <p className="m-0 mt-3 text-micro text-ink-faint">
                {template.questions.length}{" "}
                {template.questions.length === 1 ? "вопрос" : "вопроса"} ·{" "}
                {template.anonymous ? "анонимный" : "с именами"} ·{" "}
                {template.questions.map((question) => QUESTION_KIND_LABELS[question.kind]).join(", ")}
              </p>
            </button>
          ))}

          <button
            type="button"
            onClick={startEmpty}
            className="cursor-pointer rounded-panel border border-dashed border-[var(--line)] bg-white/60 p-5 text-left transition-all duration-200 ease-brand hover:-translate-y-1 hover:border-navy"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="tag">С нуля</span>
              <FilePlus2 size={16} className="text-ink-faint" />
            </div>
            <h3 className="m-0 mb-2 font-display text-lead leading-snug font-semibold tracking-[-0.02em] text-navy">
              Свой опрос
            </h3>
            <p className="m-0 text-meta leading-relaxed text-ink-soft">
              Пустой опрос: добавляйте вопросы любого типа и настраивайте показ результатов.
            </p>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="card p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Настройки опроса</p>
            <h2 className="m-0 font-display text-[clamp(22px,2.8vw,30px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
              {step === "editor" ? "Опрос" : ""}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep("template")} className={ghostButton}>
              <BookTemplate size={14} />
              Из шаблона
            </button>
            <button type="button" onClick={onCancel} className={ghostButton}>
              <X size={14} />
              Отмена
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Название опроса</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Рефлексия второго дня"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Описание для команды</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Когда запускаем и зачем"
              className={inputClass}
            />
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] p-4">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
            className="mt-0.5 size-4 accent-navy"
          />
          <span>
            <span className="block text-ui font-medium text-ink">Анонимные ответы</span>
            <span className="block text-caption leading-relaxed text-ink-faint">
              Ведущий видит только сводку, без имён. Для квиза недоступно: лидерборд требует имён.
            </span>
          </span>
        </label>

        <label className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] p-4">
          <input
            type="checkbox"
            checked={teamCount > 0}
            onChange={(event) => setTeamCount(event.target.checked ? 4 : 0)}
            className="size-4 accent-navy"
          />
          <span className="text-ui font-medium text-ink">Командный квиз</span>
          <span className="text-caption text-ink-faint">
            Очки участников складываются в общий зачёт команды
          </span>
          {teamCount > 0 && (
            <label className="ml-auto flex items-center gap-2 text-meta text-ink-soft">
              Команд:
              <select
                value={teamCount}
                onChange={(event) => setTeamCount(Number(event.target.value))}
                className="min-h-8 cursor-pointer rounded-full border border-[var(--line)] bg-white px-3 text-caption font-semibold text-navy outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                {[2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          )}
        </label>
      </div>

      {questions.map((question, index) => (
        <article key={question.id} className="card p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="font-display text-meta font-semibold tracking-[0.12em] text-gold-ink uppercase">
              Вопрос {index + 1}
            </span>

            <select
              value={question.kind}
              onChange={(event) => {
                const kind = event.target.value as QuestionKind;
                const reset = blankQuestion(kind);
                updateQuestion(index, {
                  ...reset,
                  id: question.id,
                  title: question.title,
                  hint: question.hint,
                });
              }}
              className="min-h-9 cursor-pointer rounded-full border border-[var(--line)] bg-white px-3 text-caption font-semibold text-navy outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {QUESTION_KIND_LABELS[kind]}
                </option>
              ))}
            </select>

            <span className="text-caption text-ink-faint">{QUESTION_KIND_HINTS[question.kind]}</span>

            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                onClick={() => moveQuestion(index, -1)}
                disabled={index === 0}
                className={iconButton}
                title="Выше"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveQuestion(index, 1)}
                disabled={index === questions.length - 1}
                className={iconButton}
                title="Ниже"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuestions((previous) => previous.filter((_, position) => position !== index))
                }
                className={iconButton}
                title="Удалить вопрос"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <input
            value={question.title}
            onChange={(event) => updateQuestion(index, { title: event.target.value })}
            placeholder="Текст вопроса"
            className={`${inputClass} mb-3`}
          />

          <input
            value={question.hint ?? ""}
            onChange={(event) => updateQuestion(index, { hint: event.target.value })}
            placeholder="Подсказка под вопросом (необязательно)"
            className={`${inputClass} mb-4`}
          />

          {(question.kind === "single" ||
            question.kind === "multiple" ||
            question.kind === "quiz") && (
            <div className="flex flex-col gap-2">
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className="flex items-center gap-2">
                  {question.kind === "quiz" && (
                    <button
                      type="button"
                      title="Отметить как верный"
                      onClick={() =>
                        updateQuestion(index, {
                          options: question.options.map((item, position) => ({
                            ...item,
                            correct: position === optionIndex,
                          })),
                        })
                      }
                      className={[
                        "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors duration-200",
                        option.correct
                          ? "border-transparent bg-teal text-white"
                          : "border-[var(--line)] bg-white text-ink-faint",
                      ].join(" ")}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <input
                    value={option.text}
                    onChange={(event) =>
                      updateQuestion(index, {
                        options: question.options.map((item, position) =>
                          position === optionIndex ? { ...item, text: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder={`Вариант ${optionIndex + 1}`}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestion(index, {
                        options: question.options.filter((_, position) => position !== optionIndex),
                      })
                    }
                    disabled={question.options.length <= 2}
                    className={iconButton}
                    title="Удалить вариант"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  updateQuestion(index, {
                    options: [...question.options, { id: uid("o"), text: "" }],
                  })
                }
                className={`${ghostButton} self-start`}
              >
                <Plus size={14} />
                Добавить вариант
              </button>
            </div>
          )}

          {question.kind === "scale" && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Подпись «1»</span>
                <input
                  value={question.scaleLabels?.min ?? ""}
                  onChange={(event) =>
                    updateQuestion(index, {
                      scaleLabels: {
                        min: event.target.value,
                        max: question.scaleLabels?.max ?? "",
                      },
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Подпись «5»</span>
                <input
                  value={question.scaleLabels?.max ?? ""}
                  onChange={(event) =>
                    updateQuestion(index, {
                      scaleLabels: {
                        min: question.scaleLabels?.min ?? "",
                        max: event.target.value,
                      },
                    })
                  }
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {question.kind === "quiz" && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Время на ответ, секунд</span>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={question.timeLimit}
                  onChange={(event) =>
                    updateQuestion(index, { timeLimit: Number(event.target.value) })
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Очки за верный ответ</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={question.points}
                  onChange={(event) =>
                    updateQuestion(index, { points: Number(event.target.value) })
                  }
                  className={inputClass}
                />
              </label>
            </div>
          )}
        </article>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setQuestions((previous) => [...previous, blankQuestion("single")])}
          className={ghostButton}
        >
          <Plus size={14} />
          Добавить вопрос
        </button>

        <span className="text-caption text-ink-faint">
          {questions.length}{" "}
          {questions.length === 1 ? "вопрос" : questions.length < 5 ? "вопроса" : "вопросов"} ·
          сохранение создаст черновик сессии
        </span>

        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-ui font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={15} />
          Сохранить опрос
        </button>
      </div>
    </section>
  );
}

const inputClass =
  "min-h-11 w-full rounded-field border border-[var(--line)] bg-white px-4 text-ui text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy transition-colors duration-200 focus:border-navy";
const labelClass = "text-caption font-semibold tracking-[0.06em] text-ink-faint uppercase";
const ghostButton =
  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 text-caption font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5";
const iconButton =
  "grid size-8 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-white text-ink-faint transition-colors duration-200 hover:text-navy disabled:cursor-not-allowed disabled:opacity-40";
