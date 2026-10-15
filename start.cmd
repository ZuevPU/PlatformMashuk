@echo off
chcp 65001 >nul
title Центр знаний «Машук» — цифровая платформа
cd /d "%~dp0"

echo.
echo   Цифровая экосистема Центра знаний «Машук»
echo   -----------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js не найден.
  echo.
  echo   Установите Node.js версии 20 или новее с сайта https://nodejs.org
  echo   и запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo   Node.js: %NODE_VERSION%

if not exist "node_modules\next" (
  echo.
  echo   Первый запуск: устанавливаю зависимости.
  echo   Это займёт несколько минут, окно закроется само.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Не удалось установить зависимости.
    echo   Проверьте подключение к интернету и запустите файл снова.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   Открываю платформу в браузере: http://localhost:4321
echo   Чтобы остановить — закройте это окно или нажмите Ctrl+C.
echo.

call npm run dev -- --open
pause
