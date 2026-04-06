#!/bin/bash

echo "🚀 Запуск VLESS монитора с 3X UI интеграцией..."
echo

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Пожалуйста, установите Node.js"
    exit 1
fi

# Проверяем наличие зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка установки зависимостей"
        exit 1
    fi
fi

# Проверяем наличие xui-manager.mjs
if [ ! -f "xui-manager.mjs" ]; then
    echo "❌ Файл xui-manager.mjs не найден!"
    echo "Убедитесь, что файл находится в той же директории"
    exit 1
fi

# Запускаем сервер
echo "✅ Запуск сервера..."
echo
echo "🌐 Мониторинг будет доступен по адресу: http://localhost:5000"
echo "📊 Откройте браузер и перейдите по адресу выше"
echo
echo "Для остановки нажмите Ctrl+C"
echo

node server.js
