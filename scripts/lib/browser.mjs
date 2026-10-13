/**
 * Общий запуск headless Chrome/Edge через Chrome DevTools Protocol
 * для проверочных скриптов (smoke, shots).
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findBrowser() {
  const found = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error("Не найден Chrome или Edge: укажите путь в CHROME_PATH");
  return found;
}

async function waitForTarget(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
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

export async function openBrowser({ port, profile, args = [] }) {
  const tmp = process.env.TEMP ?? process.env.TMPDIR ?? "/tmp";
  const child = spawn(
    findBrowser(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tmp}/${profile}-${Date.now()}`,
      ...args,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const target = await waitForTarget(port);
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
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
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

  const navigate = async (url, readyExpression = "document.readyState === 'complete'") => {
    await send("Page.navigate", { url });
    const ready = await waitFor(readyExpression, 60);
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

  /** Заполнить поля формы по name и отправить её. */
  const submitForm = (fields, formSelector = "form") =>
    evaluate(`(() => {
      const fields = ${JSON.stringify(fields)};
      const form = [...document.querySelectorAll(${JSON.stringify(formSelector)})]
        .find((item) => Object.keys(fields).every((name) => item.querySelector('[name="' + name + '"]')));
      if (!form) return false;
      for (const [name, value] of Object.entries(fields)) form.querySelector('[name="' + name + '"]').value = value;
      form.querySelector('button[type=submit]').click();
      return true;
    })()`);

  await send("Page.enable");
  await send("Runtime.enable");

  return {
    send,
    evaluate,
    waitFor,
    navigate,
    clickByText,
    submitForm,
    close() {
      ws.close();
      child.kill();
    },
  };
}

/**
 * Тестовые входы: из переменных окружения или из файла, который пишет seed
 * (storage/seed-credentials.txt).
 */
export function readCredentials() {
  let text = "";
  try {
    text = readFileSync("storage/seed-credentials.txt", "utf8");
  } catch {
    // файла нет — нужны переменные окружения
  }
  const pick = (pattern) => text.match(pattern)?.[1];
  return {
    adminLogin: process.env.SMOKE_ADMIN_LOGIN ?? pick(/Администратор Центра: (\S+) \//) ?? "admin@mashuk.local",
    adminPassword: process.env.SMOKE_ADMIN_PASSWORD ?? pick(/Администратор Центра: \S+ \/ (\S+)/),
    programPassword: process.env.SMOKE_PROGRAM_PASSWORD ?? pick(/Пароль программы[^:]*: (\S+)/),
  };
}
