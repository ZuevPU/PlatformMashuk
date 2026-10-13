/**
 * Снимки экранов платформы через Chrome DevTools Protocol.
 *
 * Запуск: node scripts/shots.mjs [baseUrl]
 * Кладёт PNG в docs/screenshots. Скрипт нужен, чтобы проверять вёрстку
 * без ручных действий в браузере.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { readCredentials } from "./lib/browser.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:4321").replace(/\/$/, "");
const OUT = "docs/screenshots";
const DEBUG_PORT = 9344;
const WIDTH = 1440;

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "google-chrome",
  "chromium",
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = CHROME_CANDIDATES.find((path) => (path.includes("\\") ? existsSync(path) : true));
  if (!browser) throw new Error("Не найден Chrome или Edge");

  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--force-device-scale-factor=1",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--user-data-dir=" + process.env.TEMP + "\\dsh-shots-profile",
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
      return result.result?.value;
    };

    const setViewport = (height) =>
      send("Emulation.setDeviceMetricsOverride", {
        width: WIDTH,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });

    const shoot = async (name, { height = 1000, full = false } = {}) => {
      await setViewport(height);
      await sleep(600);
      let clip;
      if (full) {
        const metrics = await send("Page.getLayoutMetrics");
        const contentHeight = Math.min(Math.ceil(metrics.cssContentSize.height), 9000);
        clip = { x: 0, y: 0, width: WIDTH, height: contentHeight, scale: 1 };
      }
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: full,
        ...(clip ? { clip } : {}),
      });
      await writeFile(`${OUT}/${name}.png`, Buffer.from(shot.data, "base64"));
      console.log(`saved ${name}.png`);
    };

    const go = async (url, ready, wait = 1400) => {
      await send("Page.navigate", { url });
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await sleep(350);
        if (await evaluate(ready)) break;
      }
      await sleep(wait);
    };

    await send("Page.enable");
    await send("Runtime.enable");

    await go(`${BASE}/`, "!!document.querySelector('h1')");
    await shoot("01-home-hero", { height: 900 });
    await shoot("02-home-full", { height: 1200, full: true });

    await go(`${BASE}/programs/obrazovanie-na-vysote`, "!!document.querySelector('h1')");
    await shoot("03-program-hero", { height: 900 });

    // Хаб закрыт: входим тестовым администратором из seed
    const { adminLogin, adminPassword } = readCredentials();
    await go(`${BASE}/join`, "!!document.querySelector('input[name=contact]')");
    await evaluate(`(() => {
      document.querySelector('input[name=contact]').value = ${JSON.stringify(adminLogin)};
      document.querySelector('input[name=password]').value = ${JSON.stringify(adminPassword ?? "")};
      document.querySelector('form button[type=submit]').click();
    })()`);
    await sleep(4000);
    await go(`${BASE}/admin/programs/obrazovanie-na-vysote/schedule`, "document.body.innerText.includes('Добавить день')");
    await shoot("13-admin-schedule", { height: 1000 });

    await go(
      `${BASE}/programs/obrazovanie-na-vysote/hub`,
      "!!document.querySelector('.ProseMirror')",
      2200,
    );
    await shoot("05-hub-channel", { height: 1000 });

    await go(
      `${BASE}/programs/obrazovanie-na-vysote/hub?tab=members`,
      "document.body.textContent.includes('Кто в программе')",
    );
    await shoot("06-hub-members", { height: 1000 });

    await go(
      `${BASE}/programs/obrazovanie-na-vysote/hub?tab=polls`,
      "document.body.textContent.includes('Живая обратная связь')",
    );
    await shoot("08-polls-list", { height: 1100 });

    // Экран ведущего вместе с экраном участника
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Открыть сессию'));
      button?.click();
    })()`);
    await sleep(1200);
    await shoot("09-polls-presenter", { height: 1250 });

    // Конструктор: библиотека шаблонов
    await evaluate(`(() => {
      const back = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('К списку опросов'));
      back?.click();
    })()`);
    await sleep(700);
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Создать опрос'));
      button?.click();
    })()`);
    await sleep(900);
    await shoot("10-polls-templates", { height: 1250 });

    // Чаты: список бесед с непрочитанными и открытая группа
    await go(
      `${BASE}/programs/obrazovanie-na-vysote/hub?tab=chats`,
      "document.body.textContent.includes('Чаты программы')",
      2200,
    );
    await shoot("11-chats-list", { height: 1100 });

    await evaluate(`(() => {
      const button = [...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Трек'));
      button?.click();
    })()`);
    await sleep(1600);
    await shoot("12-chats-conversation", { height: 1200 });

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

await main();
