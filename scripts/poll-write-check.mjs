/**
 * Проверка записи ответа на опрос в базу.
 *
 * Запуск: node scripts/poll-write-check.mjs <baseUrl> <токенСессии> <текстОтвета>
 * Сессия ставится cookie напрямую: headless-браузер не всегда сохраняет
 * cookie, выставленную на редиректе приглашения.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4321").replace(/\/$/, "");
const TOKEN = process.argv[3] ?? "";
const ANSWER = process.argv[4] ?? `Ответ автотеста ${Date.now()}`;
const PROGRAM = "kinopedagogika";
const DEBUG_PORT = 9366;

const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

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
      "--user-data-dir=" + process.env.TEMP + "\\dsh-poll-profile",
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

    const clickByText = (text) =>
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

    const member = await evaluate(
      "document.querySelector('[data-session-user]')?.getAttribute('data-session-user') ?? ''",
    );
    const opened = await clickByText("Ответить");
    await sleep(1200);

    const textareaReady = await waitFor("!!document.querySelector('textarea')");
    console.log(`участник='${member}', сессия открыта=${opened}, поле ответа=${textareaReady}`);

    if (textareaReady) {
      await evaluate(`(() => {
        const el = document.querySelector('textarea');
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(ANSWER)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await sleep(300);
      const sent = await clickByText("Отправить ответ");
      await sleep(1200);
      const accepted = await evaluate("document.body.textContent.includes('Ответ принят')");
      console.log(`отправка=${sent}, подтверждение=${accepted}`);
    }

    console.log(`МАРКЕР_ОТВЕТА=${ANSWER}`);
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
