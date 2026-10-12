/**
 * Дымовая проверка платформы через Chrome DevTools Protocol.
 *
 * Запуск: node scripts/smoke.mjs [baseUrl]
 * Проверяет два раздела:
 *   – канал программы: редактор, публикация поста, реакции, закреп, роли;
 *   – опросы: библиотека шаблонов, конструктор, экран ведущего, ответ участника,
 *     имитация ответов, выгрузка таблицы (CSV) и картинки (PNG).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4321").replace(/\/$/, "");
const PROGRAM = "kinopedagogika";
const DEBUG_PORT = 9333;

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "google-chrome",
  "chromium",
];

function findBrowser() {
  const found = CHROME_CANDIDATES.find((path) => (path.includes("\\") ? existsSync(path) : true));
  if (!found) throw new Error("Не найден Chrome или Edge для проверки");
  return found;
}

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = findBrowser();
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--user-data-dir=" + process.env.TEMP + "\\dsh-smoke-profile",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const target = await waitForTarget();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let messageId = 0;
    const pending = new Map();
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id && pending.has(payload.id)) {
        const { resolve, reject } = pending.get(payload.id);
        pending.delete(payload.id);
        payload.error ? reject(new Error(JSON.stringify(payload.error))) : resolve(payload.result);
      }
    });

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        messageId += 1;
        pending.set(messageId, { resolve, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });

    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? "Ошибка в браузере");
      }
      return result.result.value;
    };

    const waitFor = async (expression, attempts = 40) => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          if (await evaluate(expression)) return true;
        } catch {
          // страница ещё перестраивается
        }
        await sleep(250);
      }
      return false;
    };

    const navigate = async (url, readyExpression) => {
      await send("Page.navigate", { url });
      const ready = await waitFor(readyExpression, 50);
      // Ждём гидратацию: до неё клики по интерактивным элементам ничего не делают
      await sleep(1200);
      return ready;
    };

    const clickByText = (text, selector = "button") =>
      evaluate(`(() => {
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
        const node = nodes.find((item) => item.textContent.trim().includes(${JSON.stringify(text)}));
        if (!node) return false;
        node.click();
        return true;
      })()`);

    await send("Page.enable");
    await send("Runtime.enable");

    /* ======================= Канал программы ======================= */
    console.log("\n— Канал программы —");
    const hubReady = await navigate(
      `${BASE}/programs/${PROGRAM}/hub`,
      "!!document.querySelector('.ProseMirror')",
    );
    check("Редактор TipTap гидратировался", hubReady === true);

    const postsCount = await evaluate("document.querySelectorAll('article.card').length");
    check("Посты канала отрисованы", postsCount >= 3, `постов: ${postsCount}`);

    const before = await evaluate(
      "(document.querySelector('article.card button[aria-pressed]')?.textContent ?? '')",
    );
    await evaluate("document.querySelector('article.card button[aria-pressed]')?.click()");
    await sleep(200);
    const after = await evaluate(
      "(document.querySelector('article.card button[aria-pressed]')?.textContent ?? '')",
    );
    const mine = await evaluate(
      "document.querySelector('article.card button[aria-pressed]')?.getAttribute('aria-pressed')",
    );
    check(
      "Реакция переключается",
      before !== after && mine === "true",
      `было «${before.trim()}», стало «${after.trim()}»`,
    );

    const postComposerReady = await evaluate(
      "!!document.querySelector('[data-placeholder=\"Текст поста для участников…\"]')",
    );
    check("Модератор видит редактор поста", postComposerReady === true);

    if (postComposerReady) {
      const marker = "Проверка публикации из автотеста";
      await evaluate(`(() => {
        const el = document.querySelector('[data-placeholder="Текст поста для участников…"]');
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      })()`);
      await send("Input.insertText", { text: marker });
      await sleep(300);
      const publishClicked = await clickByText("Опубликовать");
      check("Кнопка публикации активна", publishClicked === true);
      await sleep(500);
      check(
        "Пост опубликован и появился в канале",
        (await evaluate(`document.body.textContent.includes(${JSON.stringify(marker)})`)) === true,
      );
    }

    const pinClicked = await clickByText("Закрепить");
    await sleep(300);
    const pinnedCount = await evaluate(
      "[...document.querySelectorAll('article.card')].filter((a) => a.textContent.includes('Закреплено')).length",
    );
    check("Пост закрепляется", pinClicked === true && pinnedCount >= 2, `закреплено: ${pinnedCount}`);

    await clickByText("Участник");
    await sleep(300);
    check(
      "У участника нет редактора поста",
      (await evaluate(
        "!!document.querySelector('[data-placeholder=\"Текст поста для участников…\"]')",
      )) === false,
    );

    await clickByText("Модератор");
    await sleep(300);
    check(
      "У модератора редактор поста снова доступен",
      (await evaluate(
        "!!document.querySelector('[data-placeholder=\"Текст поста для участников…\"]')",
      )) === true,
    );

    /* ========================== Опросы ============================ */
    console.log("\n— Опросы и квизы —");
    const pollsReady = await navigate(
      `${BASE}/programs/${PROGRAM}/hub?tab=polls`,
      "document.body.textContent.includes('Живая обратная связь')",
    );
    check("Раздел опросов открывается", pollsReady === true);

    const pollCards = await evaluate("document.querySelectorAll('article.card').length");
    check("Список опросов программы отрисован", pollCards >= 2, `карточек: ${pollCards}`);

    // Конструктор: библиотека шаблонов
    await clickByText("Создать опрос");
    await sleep(500);
    const templatesShown = await evaluate(
      "document.body.textContent.includes('Шаблон или опрос с нуля')",
    );
    const templateCards = await evaluate(`(() => {
      const heading = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Квиз: проверка знаний'));
      return heading ? 1 : 0;
    })()`);
    check(
      "Библиотека шаблонов доступна в конструкторе",
      templatesShown === true && templateCards === 1,
    );

    // Берём шаблон «Рефлексия дня» и сохраняем опрос
    const templateClicked = await evaluate(`(() => {
      const node = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Рефлексия дня'));
      if (!node) return false;
      node.click();
      return true;
    })()`);
    await sleep(400);
    const editorShown = await evaluate(
      "document.body.textContent.includes('Настройки опроса') && [...document.querySelectorAll('input')].some((input) => input.value.length > 0)",
    );
    check("Шаблон подставился в конструктор", templateClicked === true && editorShown === true);

    const saved = await clickByText("Сохранить опрос");
    await sleep(600);
    const savedVisible = await evaluate("document.body.textContent.includes('Рефлексия дня')");
    check("Опрос сохраняется и появляется в списке", saved === true && savedVisible === true);

    // Открываем живую сессию
    const sessionOpened = await clickByText("Открыть сессию");
    if (!sessionOpened) await clickByText("Запустить");
    await sleep(700);
    const presenterShown = await evaluate("document.body.textContent.includes('Экран ведущего')");
    const participantShown = await evaluate(
      "document.body.textContent.includes('Экран участника')",
    );
    check(
      "Экран ведущего и экран участника открылись",
      presenterShown === true && participantShown === true,
    );

    // Имитация ответов: счётчик должен вырасти
    const counterBefore = await evaluate(`(() => {
      const node = [...document.querySelectorAll('span')].find((s) => s.textContent.startsWith('Ответили:'));
      return node ? node.textContent : '';
    })()`);
    await clickByText("Сымитировать 8 ответов");
    await sleep(600);
    const counterAfter = await evaluate(`(() => {
      const node = [...document.querySelectorAll('span')].find((s) => s.textContent.startsWith('Ответили:'));
      return node ? node.textContent : '';
    })()`);
    check(
      "Имитация ответов увеличивает счётчик",
      counterBefore !== counterAfter,
      `было «${counterBefore}», стало «${counterAfter}»`,
    );

    // Ответ участника: текущий вопрос опроса «Кинопедагогика» — открытый
    const isOpen = await evaluate("!!document.querySelector('textarea')");
    if (isOpen) {
      await evaluate("document.querySelector('textarea').focus()");
      await send("Input.insertText", { text: "проверка" });
      await sleep(200);
    } else {
      await evaluate(`(() => {
        const button = document.querySelector('.mx-auto button.rounded-\\\\[14px\\\\]') ??
          [...document.querySelectorAll('button')].find((b) => b.className.includes('rounded-[14px]'));
        button?.click();
      })()`);
      await sleep(200);
    }
    const answerSent = await clickByText("Отправить ответ");
    await sleep(500);
    const accepted = await evaluate("document.body.textContent.includes('Ответ принят')");
    check("Ответ участника принят", answerSent === true && accepted === true);

    // Переход к следующему вопросу
    await clickByText("Следующий вопрос");
    await sleep(500);
    const questionMoved = await evaluate(
      "document.body.textContent.includes('Вопрос 2 из 2') || document.body.textContent.includes('Вопрос 2 из 3')",
    );
    check("Переход к следующему вопросу работает", questionMoved === true);

    // Выгрузка CSV: перехватываем Blob и читаем содержимое
    const csvResult = await evaluate(`(async () => {
      let captured = null;
      const original = URL.createObjectURL;
      URL.createObjectURL = (blob) => { captured = blob; return original.call(URL, blob); };
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Таблица (CSV)'));
      if (!button) { URL.createObjectURL = original; return { ok: false, reason: 'кнопка не найдена' }; }
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      URL.createObjectURL = original;
      if (!captured) return { ok: false, reason: 'файл не сформирован' };
      const text = await captured.text();
      return {
        ok: true,
        size: captured.size,
        type: captured.type,
        hasSummary: text.includes('Сводка по вопросам'),
        hasAnswers: text.includes('Все ответы'),
        rows: text.split('\\r\\n').length,
      };
    })()`);
    check(
      "Таблица CSV выгружается с данными",
      csvResult?.ok === true && csvResult.hasSummary && csvResult.hasAnswers && csvResult.rows > 10,
      csvResult?.ok
        ? `${csvResult.size} байт, строк: ${csvResult.rows}`
        : (csvResult?.reason ?? "ошибка"),
    );

    // Выгрузка PNG: проверяем тип и размер картинки
    const pngResult = await evaluate(`(async () => {
      let captured = null;
      const original = URL.createObjectURL;
      URL.createObjectURL = (blob) => { captured = blob; return original.call(URL, blob); };
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Картинка (PNG)'));
      if (!button) { URL.createObjectURL = original; return { ok: false, reason: 'кнопка не найдена' }; }
      button.click();
      for (let attempt = 0; attempt < 30 && !captured; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      URL.createObjectURL = original;
      if (!captured) return { ok: false, reason: 'картинка не сформирована' };
      return { ok: true, size: captured.size, type: captured.type };
    })()`);
    check(
      "Картинка PNG выгружается",
      pngResult?.ok === true && pngResult.type === "image/png" && pngResult.size > 20000,
      pngResult?.ok ? `${pngResult.type}, ${pngResult.size} байт` : (pngResult?.reason ?? "ошибка"),
    );

    /* =========================== Чаты ============================= */
    console.log("\n— Чаты программы —");
    const chatsReady = await navigate(
      `${BASE}/programs/${PROGRAM}/hub?tab=chats`,
      "document.body.textContent.includes('Чаты программы')",
    );
    check("Раздел чатов открывается", chatsReady === true);

    const conversationCount = await evaluate(
      "document.querySelectorAll('aside button').length",
    );
    check(
      "Список бесед отрисован",
      conversationCount >= 3,
      `бесед в списке: ${conversationCount}`,
    );

    const unreadShown = await evaluate(
      "document.body.textContent.includes('непрочитанных')",
    );
    check("Непрочитанные сообщения посчитаны", unreadShown === true);

    // Открываем группу «Трек» и проверяем ленту сообщений
    const groupOpened = await evaluate(`(() => {
      const button = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Трек'));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await sleep(500);
    const feedShown = await evaluate(
      "document.body.textContent.includes('собираем сценарии занятий')",
    );
    check("Лента сообщений беседы открывается", groupOpened === true && feedShown === true);

    // Отправка сообщения в чат
    const chatMarker = "Проверка сообщения из автотеста";
    const chatComposerReady = await waitFor("!!document.querySelector('.ProseMirror')");
    check("Композер чата доступен", chatComposerReady === true);

    if (chatComposerReady) {
      await evaluate(`(() => {
        const el = document.querySelector('.ProseMirror');
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      })()`);
      await send("Input.insertText", { text: chatMarker });
      await sleep(250);
      await clickByText("Отправить");
      await sleep(500);
    }
    check(
      "Сообщение отправляется в чат",
      chatComposerReady === true &&
        (await evaluate(`document.body.textContent.includes(${JSON.stringify(chatMarker)})`)) === true,
    );

    // Ответ на сообщение
    const replyStarted = await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((b) => b.textContent.trim() === 'Ответить');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await sleep(300);
    const replyBanner = await evaluate("!!document.querySelector('[data-reply-banner]')");
    check("Ответ на сообщение запускается", replyStarted === true && replyBanner === true);

    // Создание группы
    const groupDialogOpened = await evaluate(`(() => {
      const button = document.querySelector('button[title="Создать группу по направлению"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await sleep(400);
    const groupTitle = "Проверочная группа";
    await evaluate(`(() => {
      const inputs = [...document.querySelectorAll('[role="dialog"] input')];
      const titleInput = inputs[0];
      if (!titleInput) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(titleInput, ${JSON.stringify(groupTitle)});
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    await evaluate(`(() => {
      const rows = [...document.querySelectorAll('[role="dialog"] button')].filter((b) => b.querySelector('span'));
      const candidate = rows.find((b) => b.textContent.includes('Участник'));
      candidate?.click();
    })()`);
    await sleep(250);
    const groupCreated = await clickByText("Создать группу");
    await sleep(500);
    const groupVisible = await evaluate(
      `document.body.textContent.includes(${JSON.stringify(groupTitle)})`,
    );
    check(
      "Группа создаётся и открывается",
      groupDialogOpened === true && groupCreated === true && groupVisible === true,
    );

    // Личный диалог
    const directDialogOpened = await evaluate(`(() => {
      const button = document.querySelector('button[title="Новый личный диалог"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await sleep(400);
    const directStarted = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('[role="dialog"] button')].filter((b) => b.textContent.includes('Участник'));
      const candidate = rows.find((b) => b.textContent.includes('Полина')) ?? rows[0];
      if (!candidate) return false;
      candidate.click();
      return true;
    })()`);
    await sleep(500);
    const directOpen = await evaluate("document.body.textContent.includes('Личный диалог')");
    check(
      "Личный диалог открывается",
      directDialogOpened === true && directStarted === true && directOpen === true,
    );

    ws.close();
  } finally {
    child.kill();
  }

  const failed = results.filter((item) => !item.passed);
  console.log(`\nИтог: ${results.length - failed.length}/${results.length} проверок пройдено`);
  if (failed.length > 0) {
    console.log("Провалено: " + failed.map((item) => item.name).join("; "));
    process.exitCode = 1;
  }
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // браузер ещё поднимается
    }
    await sleep(400);
  }
  throw new Error("Не удалось подключиться к браузеру по CDP");
}

await main();
