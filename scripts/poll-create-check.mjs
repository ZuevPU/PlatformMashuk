/**
 * Проверка сохранения опроса и запуска сессии.
 *
 * Запуск: node scripts/poll-create-check.mjs <baseUrl> <токенСессии> <названиеОпроса>
 * Возвращает идентификаторы, созданные сервером, — по ним проверяется база.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4321").replace(/\/$/, "");
const TOKEN = process.argv[3] ?? "";
const TITLE = process.argv[4] ?? `Опрос автотеста ${Date.now()}`;
const PROGRAM = "kinopedagogika";
const DEBUG_PORT = 9377;

async function main() {
  const browser = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((path) => existsSync(path));
  if (!browser) throw new Error("Не найден Chrome или Edge");

  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--user-data-dir=" + process.env.TEMP + "\\dsh-pollcreate-profile",
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

    let id = 0;
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
        id += 1;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
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

    const click = (text) =>
      evaluate(`(() => {
        const node = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}));
        if (!node) return false;
        node.click();
        return true;
      })()`);

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Network.setCookie", {
      name: "mashuk_session",
      value: TOKEN,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
    });

    await send("Page.navigate", { url: `${BASE}/programs/${PROGRAM}/hub?tab=polls` });
    await waitFor("document.body.textContent.includes('Живая обратная связь')");
    await sleep(1500);

    console.log(`создание опроса: ${await click("Создать опрос")}`);
    await waitFor("document.body.textContent.includes('Шаблон или опрос с нуля')");
    await sleep(500);
    console.log(`шаблон выбран: ${await click("Рефлексия дня")}`);
    await waitFor("document.body.textContent.includes('Настройки опроса')");
    await sleep(500);

    // Подставляем своё название, чтобы найти опрос в базе
    await evaluate(`(() => {
      const input = [...document.querySelectorAll('input')].find((i) => i.placeholder && i.placeholder.includes('Например'));
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(TITLE)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(300);

    console.log(`сохранение: ${await click("Сохранить опрос")}`);
    await sleep(2000);
    const saved = await evaluate(`document.body.textContent.includes(${JSON.stringify(TITLE)})`);
    console.log(`опрос в списке: ${saved}`);

    console.log(`запуск сессии: ${await click("Запустить")}`);
    await sleep(1800);
    const live = await evaluate("document.body.textContent.includes('Экран ведущего')");
    console.log(`экран ведущего: ${live}`);

    // Открытие приёма ответов переводит сессию в состояние «идёт»
    console.log(`открытие приёма: ${await click("Открыть приём")}`);
    await sleep(1800);
    const accepting = await evaluate("document.body.textContent.includes('Приём ответов открыт')");
    console.log(`приём ответов открыт: ${accepting}`);

    console.log(`МАРКЕР_ОПРОСА=${TITLE}`);
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
