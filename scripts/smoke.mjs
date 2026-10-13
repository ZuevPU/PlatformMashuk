/**
 * Дымовая проверка платформы в настоящем браузере (Chrome/Edge, headless).
 *
 * Запуск: npm run smoke [-- baseUrl]
 * Нужны запущенный сервер с базой и тестовые входы из seed
 * (storage/seed-credentials.txt) или переменные SMOKE_ADMIN_PASSWORD
 * и SMOKE_PROGRAM_PASSWORD.
 *
 * Сценарий: витрина → закрытый хаб → неверный пароль программы →
 * регистрация участника → общий чат → свои беседы → вход администратора →
 * живой опрос → разделы админки.
 */

import { setTimeout as sleep } from "node:timers/promises";
import { openBrowser, readCredentials } from "./lib/browser.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4321").replace(/\/$/, "");
const PROGRAM = "obrazovanie-na-vysote";
const HUB = `${BASE}/programs/${PROGRAM}/hub`;

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const credentials = readCredentials();
  if (!credentials.adminPassword || !credentials.programPassword) {
    console.error("Нет тестовых паролей: запустите npm run db:seed или задайте SMOKE_* переменные");
    process.exitCode = 1;
    return;
  }

  const page = await openBrowser({ port: 9333, profile: "mashuk-smoke" });
  const { evaluate, waitFor, navigate, clickByText, submitForm } = page;
  const api = (part) =>
    evaluate(`fetch('/api/hub/${part}?program=${PROGRAM}').then((r) => r.json())`);

  try {
    console.log("\n— Публичная часть —");
    check("Витрина открывается", await navigate(`${BASE}/`, "!!document.querySelector('h1')"));
    check(
      "Страница программы открывается",
      await navigate(`${BASE}/programs/${PROGRAM}`, "document.body.innerText.includes('Войти в программу')"),
    );

    console.log("\n— Вход по паролю программы —");
    await navigate(HUB, "location.pathname.endsWith('/enter')");
    check("Хаб без входа ведёт на вход", await evaluate("location.pathname.endsWith('/enter')"));

    const contact = `smoke-${Date.now()}@demo.mashuk`;
    const profile = { name: "Проверка Smoke", contact, password: "smoke-pass-123", passwordRepeat: "smoke-pass-123" };

    await submitForm({ ...profile, programPassword: "wrong-password" });
    const wrong = await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Неверный пароль')");
    check("Неверный пароль программы отклонён", wrong);
    check(
      "Введённое не стирается после ошибки",
      await evaluate(`document.querySelector('input[name=contact]').value === ${JSON.stringify(contact)}`),
    );

    // Пароль программы знают все — через него нельзя занять чужую запись
    await submitForm({ ...profile, contact: "u-p-01@demo.mashuk", programPassword: credentials.programPassword });
    check(
      "Чужой логин через пароль программы не занять",
      await waitFor("document.querySelector('[role=alert]')?.textContent.includes('уже зарегистрирован')"),
    );

    await submitForm({ ...profile, programPassword: credentials.programPassword });
    check("Регистрация ведёт в хаб", await waitFor("location.pathname.endsWith('/hub')", 60));
    await sleep(1500);

    console.log("\n— Чаты —");
    const chats = await api("chats");
    const general = chats.data?.conversations.find((item) => item.title === "Общий чат программы");
    check("Новый участник сразу в общем чате", Boolean(general));
    const me = await evaluate("document.querySelector('[data-session-user]')?.dataset.sessionUser");
    check(
      "В браузер приходят только свои беседы",
      chats.data?.conversations.every((item) => item.memberIds.includes(me)),
      `${chats.data?.conversations.length ?? 0} бесед`,
    );

    await navigate(`${HUB}?tab=chats`, "!!document.querySelector('[data-session-user]')");
    await clickByText("Общий чат программы");
    await waitFor("!!document.querySelector('.ProseMirror')", 40);
    const text = `Smoke ${Date.now()}`;
    await evaluate(`(() => {
      const editor = document.querySelector('.ProseMirror');
      editor.focus();
      document.execCommand('insertText', false, ${JSON.stringify(text)});
    })()`);
    await sleep(400);
    await clickByText("Отправить");
    await sleep(2000);
    const after = await api("chats");
    check("Сообщение сохранено в базе", after.data?.messages.some((item) => JSON.stringify(item.body).includes(text)));

    console.log("\n— Вход администратора —");
    await clickByText("Выйти");
    await sleep(2000);
    await navigate(`${BASE}/join`, "!!document.querySelector('input[name=contact]')");
    await submitForm({ contact: credentials.adminLogin, password: "wrong-password" });
    check(
      "Неверный пароль — общая ошибка без подсказок",
      await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Неверный логин или пароль')"),
    );
    await submitForm({ contact: credentials.adminLogin, password: credentials.adminPassword });
    check("Администратор попадает в админку", await waitFor("location.pathname === '/admin'", 60));

    console.log("\n— Живой опрос —");
    await navigate(`${HUB}?tab=polls`, "document.body.innerText.includes('Создать опрос')");
    await clickByText("Создать опрос");
    await sleep(800);
    await clickByText("Ожидания от программы");
    await sleep(800);
    await clickByText("Сохранить опрос");
    await sleep(2500);
    await clickByText("Запустить");
    await sleep(1000);
    await clickByText("Открыть приём");
    await sleep(1500);
    const polls = await api("polls");
    const live = polls.data?.sessions.find((item) => item.status === "live" && item.accepting);
    check("Ведущий запустил приём ответов", Boolean(live));

    await evaluate(`(() => {
      const field = document.querySelector('textarea, input[placeholder*="слов"]');
      if (!field) return false;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
      setter.call(field, 'вдохновение');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(300);
    await clickByText("Отправить ответ");
    await sleep(2000);
    const answered = await api("polls");
    const session = answered.data?.sessions.find((item) => item.id === live?.id);
    check("Ответ записан и помечен как свой", session?.responses.some((item) => item.mine));

    if (live) {
      await clickByText("Завершить опрос");
      await sleep(1000);
    }

    console.log("\n— Админка —");
    for (const [path, marker] of [
      ["", "Основное"],
      ["/schedule", "Добавить день"],
      ["/materials", "Добавить материал"],
      ["/people", "Пароль программы"],
      ["/build", "Сборка программы"],
    ]) {
      const ok = await navigate(
        `${BASE}/admin/programs/${PROGRAM}${path}`,
        `document.body.innerText.includes(${JSON.stringify(marker)})`,
      );
      check(`Раздел админки ${path || "/"} открывается`, ok);
    }
  } finally {
    page.close();
  }

  const failed = results.filter((item) => !item.passed);
  console.log(`\nИтог: ${results.length - failed.length}/${results.length} проверок пройдено`);
  if (failed.length > 0) {
    console.log("Провалено: " + failed.map((item) => item.name).join("; "));
    process.exitCode = 1;
  }
}

await main();
