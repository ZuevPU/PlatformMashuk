"use client";

import { useActionState } from "react";
import { createProgramAction, updateProgramAction } from "@/lib/admin-actions";
import { DIRECTIONS } from "@/lib/types";
import type { Program } from "@/lib/types";
import { Button, Result, Select, TextArea, TextField } from "./ui";

/**
 * Основные сведения о программе: то, что видно на витрине и в шапке хаба.
 * Одна форма для создания и редактирования.
 */
export function ProgramForm({ program }: { program?: Program }) {
  const [state, action, pending] = useActionState(
    program ? updateProgramAction : createProgramAction,
    {},
  );
  // После ошибки React очищает форму — возвращаем введённое
  const v = (name: string, fallback?: string | number | null) =>
    state.values?.[name] ?? (fallback == null ? undefined : String(fallback));

  return (
    <form action={action} className="flex flex-col gap-8">
      {program && <input type="hidden" name="slug" value={program.slug} />}

      <fieldset className="m-0 grid gap-5 border-0 p-0 md:grid-cols-2">
        <legend className="mb-4 font-display text-body font-semibold text-navy">Главное</legend>
        <TextField
          label="Название"
          name="title"
          defaultValue={v("title", program?.title)}
          placeholder="Образование на высоте"
          required
        />
        <TextField
          label="Формат"
          name="subtitle"
          defaultValue={v("subtitle", program?.subtitle)}
          placeholder="Международный образовательный семинар"
          required
        />
        {!program && (
          <TextField
            label="Адрес страницы"
            name="slug"
            defaultValue={v("slug")}
            placeholder="obrazovanie-na-vysote"
            hint="Латиница и дефисы. Будет ссылка /programs/адрес — потом не меняется"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
        )}
        <TextField label="Поток" name="stream" defaultValue={v("stream", program?.stream)} placeholder="Поток 1" />
        <TextField label="Начало" name="startDate" type="date" defaultValue={v("startDate", program?.startDate)} required />
        <TextField label="Окончание" name="endDate" type="date" defaultValue={v("endDate", program?.endDate)} required />
        <TextField
          label="Место проведения"
          name="location"
          defaultValue={v("location", program?.location)}
          placeholder="Пятигорск, Центр знаний «Машук»"
          required
        />
        <Select label="Направление" name="direction" defaultValue={v("direction", program?.direction ?? "international")}>
          {DIRECTIONS.map((direction) => (
            <option key={direction.key} value={direction.key}>
              {direction.label}
            </option>
          ))}
        </Select>
        <Select
          label="Сезонная схема"
          name="season"
          defaultValue={v("season", program?.season ?? "")}
          hint="Цвет программы по брендбуку. По умолчанию — по дате начала"
        >
          <option value="">По дате начала</option>
          <option value="spring">Весна</option>
          <option value="summer">Лето</option>
          <option value="autumn">Осень</option>
          <option value="winter">Зима</option>
        </Select>
        <TextField
          label="Участников"
          name="participants"
          type="number"
          min={1}
          defaultValue={v("participants", program?.participants)}
          hint="Сколько человек ожидается — для витрины"
        />
      </fieldset>

      <fieldset className="m-0 grid gap-5 border-0 p-0">
        <legend className="mb-4 font-display text-body font-semibold text-navy">Описание</legend>
        <TextArea
          label="Коротко о программе"
          name="heroLead"
          defaultValue={v("heroLead", program?.hero.lead)}
          rows={3}
          hint="Абзац под названием на странице программы"
        />
        <TextArea label="О программе подробнее" name="aboutLead" defaultValue={v("aboutLead", program?.about.lead)} rows={4} />
        <TextArea
          label="Цифры в шапке"
          name="heroFacts"
          defaultValue={v("heroFacts", program?.hero.facts.map((fact) => `${fact.value} | ${fact.label}`).join("\n"))}
          rows={3}
          hint="По строке на цифру: «4 | дня программы»"
        />
        <TextArea label="Примечание к материалам" name="note" defaultValue={v("note", program?.note)} rows={2} />
      </fieldset>

      <fieldset className="m-0 grid gap-5 border-0 p-0 md:grid-cols-2">
        <legend className="mb-4 font-display text-body font-semibold text-navy">Ссылки</legend>
        <TextField
          label="Внешняя страница программы"
          name="landingUrl"
          type="url"
          defaultValue={v("landingUrl", program?.landing?.url)}
          placeholder="https://…"
          hint="Если сборка размещена на другом сайте. Загруженная сборка важнее"
        />
        <TextField
          label="Код доступа к внешней странице"
          name="landingCode"
          defaultValue={v("landingCode", program?.landing?.code)}
        />
        <TextField
          label="Общая папка с материалами"
          name="driveFolder"
          type="url"
          defaultValue={v("driveFolder", program?.driveFolder)}
          placeholder="https://…"
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : program ? "Сохранить изменения" : "Создать программу"}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}
