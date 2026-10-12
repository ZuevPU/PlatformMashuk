/**
 * Проверка записи в базу: пост в канале и сообщение в чате.
 *
 * Запуск: node scripts/write-check.mjs [baseUrl]
 * Сценарий выполняется в браузере после входа по персональной ссылке,
 * затем напечатанные маркеры сверяются с содержимым PostgreSQL.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4322").replace(/\/$/, "");
/** Токен сессии: передаётся аргументом, потому что headless-браузер
 *  не всегда сохраняет cookie, выставленную на редиректе. */
const SESSION_TOKEN = process.argv[3] ?? "";
const DEBUG_PORT = 9355;
const PROGRAM = "kinopedagogika";

const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const postMarker = `Пост автотеста ${Date.now()}`;
const messageMarker = `Сообщение автотеста ${Date.now()}`;

async function main() {
  const browser = BROWSERS.find((path) => existsSync(path));
  if (!browser) throw new Error("Не найден Chrome или Edge");

  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--user-data-dir=" + process.env.TEMP + "\\dsh-write-profile",
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
        throw new Error(result.exceptionDetails.exception?.description ?? "ошибка в браузере");
      }
      return result.result.value;
    };

    const waitFor = async (expression, attempts = 60) => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          if (await evaluate(expression)) return true;
        } catch {
          // страница перестраивается
        }
        await sleep(300);
      }
      return false;
    };

    const clickByText = (text) =>
      evaluate(`(() => {
        const node = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
        if (!node) return false;
        node.click();
        return true;
      })()`);

    const typeInto = async (selector, text) => {
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      })()`);
      await send("Input.insertText", { text });
      await sleep(300);
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");

    // Сессию ставим явно — так проверяется именно запись в базу
    if (SESSION_TOKEN) {
      await send("Network.setCookie", {
        name: "mashuk_session",
        value: SESSION_TOKEN,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
      });
    }

    // Открываем хаб программы, где модератор состоит в программе
    await send("Page.navigate", { url: `${BASE}/programs/${PROGRAM}/hub` });
    const loggedIn = await waitFor(
      "!!document.querySelector('[data-session-user]')?.getAttribute('data-session-user') && !!document.querySelector('.ProseMirror')",
    );
    const sessionUser = await evaluate(
      "document.querySelector('[data-session-user]')?.getAttribute('data-session-user') ?? ''",
    );
    const sessionRole = await evaluate(
      "document.querySelector('[data-session-role]')?.getAttribute('data-session-role') ?? ''",
    );
    console.log(`сессия: пользователь='${sessionUser}', роль='${sessionRole}'`);
    console.log(`модератор в программе: ${loggedIn ? "да" : "НЕТ"}`);

    // Пост в канале
    await typeInto('[data-placeholder="Текст поста для участников…"]', postMarker);
    await clickByText("Опубликовать");
    await sleep(1200);
    const postOk = await evaluate(
      `document.body.textContent.includes(${JSON.stringify(postMarker)})`,
    );
    console.log(`пост в интерфейсе: ${postOk ? "появился" : "НЕ ПОЯВИЛСЯ"}`);

    // Сообщение в чате
    await send("Page.navigate", { url: `${BASE}/programs/${PROGRAM}/hub?tab=chats` });
    await waitFor("document.body.textContent.includes('Чаты программы')");
    await sleep(1800);
    const clicked = await evaluate(`(() => {
      const node = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Трек'));
      if (!node) return false;
      node.click();
      return true;
    })()`);
    const composerReady = await waitFor("!!document.querySelector('.ProseMirror')");
    console.log(`беседа открыта: ${clicked}, композер: ${composerReady}`);
    if (composerReady) {
      await typeInto(".ProseMirror", messageMarker);
      await clickByText("Отправить");
      await sleep(1200);
      const messageOk = await evaluate(
        `document.body.textContent.includes(${JSON.stringify(messageMarker)})`,
      );
      console.log(`сообщение в интерфейсе: ${messageOk ? "появилось" : "НЕ ПОЯВИЛОСЬ"}`);
    }

    console.log(`МАРКЕР_ПОСТА=${postMarker}`);
    console.log(`МАРКЕР_СООБЩЕНИЯ=${messageMarker}`);

    ws.close();
  } finally {
    child.kill();
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
  throw new Error("Не удалось подключиться к браузеру");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
