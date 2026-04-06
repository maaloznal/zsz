@echo off
echo 🚀 Запуск VLESS монитора с 3X UI интеграцией...
echo.

:: Проверяем наличие Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js не найден. Пожалуйста, установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

:: Проверяем наличие зависимостей
if not exist "node_modules" (
    echo 📦 Установка зависимостей...
    npm install
    if errorlevel 1 (
        echo ❌ Ошибка установки зависимостей
        pause
        exit /b 1
    )
)

:: Проверяем наличие xui-manager.mjs
if not exist "xui-manager.mjs" (
    echo ❌ Файл xui-manager.mjs не найден!
    echo Убедитесь, что файл находится в той же директории
    pause
    exit /b 1
)

:: Запускаем сервер
echo ✅ Запуск сервера...
echo.
echo 🌐 Мониторинг будет доступен по адресу: http://localhost:5000
echo 📊 Откройте браузер и перейдите по адресу выше
echo.
echo Для остановки нажмите Ctrl+C
echo.

node server.js

pause
