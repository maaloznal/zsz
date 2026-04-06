# 🔗 VLESS Monitor with 3X UI Integration

[![Node.js](https://img.shields.io/badge/Node.js-14%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![3X UI](https://img.shields.io/badge/3X%20UI-Integration-orange.svg)](https://github.com/MHSanaei/3x-ui)

> Продвинутый мониторинг VLESS конфигураций с прямой интеграцией с 3X UI панелью для получения реальной статистики и статуса клиентов.

## ✨ Возможности

- 🎯 **Точная проверка статуса** через 3X UI API
- 📊 **Реальная статистика** - количество клиентов, трафик, статус inbound'ов
- 🔄 **Автоматическое обновление** с настраиваемым интервалом (5-120 минут)
- 💾 **Локальное сохранение** конфигов в браузере
- 🌐 **Современный интерфейс** с адаптивным дизайном
- ⚡ **Быстрое развертывание** на любом VPS
- 🛡️ **Безопасная работа** с учетными данными 3X UI
- 📱 **Мобильная поддержка** - работает на любых устройствах

## 🚀 Быстрый старт

### Требования

- Node.js 14+
- Доступ к 3X UI панели
- Файл `xui-manager.mjs` (включен в проект)

### Установка и запуск

#### Windows
```bash
# Клонируйте репозиторий
git clone https://github.com/maaloznal/zsz.git
cd zsz

# Запустите установщик
start.bat
```

#### Linux/Mac
```bash
# Клонируйте репозиторий
git clone https://github.com/maaloznal/zsz.git
cd zsz

# Сделайте скрипт исполняемым и запустите
chmod +x start.sh
./start.sh
```

#### Ручной запуск
```bash
# Установка зависимостей
npm install

# Запуск сервера
npm start
```

Откройте в браузере: **http://localhost:5000**

## 📋 Скриншоты

### Главный интерфейс
![Главный интерфейс](https://via.placeholder.com/800x400/667eea/ffffff?text=VLESS+Monitor+Interface)

### Статистика 3X UI
![Статистика](https://via.placeholder.com/400x200/10b981/ffffff?text=3X+UI+Stats)

### Таблица конфигов
![Таблица](https://via.placeholder.com/800x300/764ba2/ffffff?text=Configs+Table)

## 🔧 Конфигурация

### Настройка 3X UI

Отредактируйте файл `xui-manager.mjs`:

```javascript
const baseURL = "https://YOUR_VPS:PORT/PATH";
const username = "your_username";
const password = "your_password";
```

### Настройка порта сервера

Измените порт в `server.js`:

```javascript
const PORT = 5000; // Измените на нужный порт
```

## 📊 API Эндпоинты

### Проверка VLESS конфига
```http
POST /api/check
Content-Type: application/json

{
  "vless": "vless://...@ip:port?...#name"
}
```

### Получение статистики
```http
GET /api/stats
```

### Получение всех inbound'ов
```http
GET /api/inbounds
```

## 🎯 Как это работает

### 1. Парсинг VLESS ссылки
- Извлечение хоста, порта, имени
- Валидация формата

### 2. Интеграция с 3X UI
- Поиск inbound по порту или имени
- Получение реальной статистики
- Определение статуса по количеству клиентов

### 3. Определение статуса
- 🟢 **Работает**: inbound включен + есть активные клиенты
- 🔴 **Не работает**: inbound выключен или нет клиентов
- ⏳ **Проверка**: идет запрос к 3X UI

## 🏗️ Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Веб-интерфейс │    │  Node.js Сервер  │    │   3X UI Панель   │
│  (monitor.html) │◄──►│   (server.js)    │◄──►│  (xui-manager)  │
│                 │    │                  │    │                 │
│ - Добавление    │    │ - API эндпоинты  │    │ - Управление     │
│ - Отображение   │    │ - Кэширование    │    │ - Статистика     │
│ - Настройки     │    │ - CORS           │    │ - Клиенты        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Развертывание в Production

### С помощью PM2
```bash
# Установка PM2
npm install -g pm2

# Запуск
pm2 start server.js --name vless-monitor

# Автозапуск
pm2 startup
pm2 save
```

### С Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### С Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔒 Безопасность

- ✅ Учетные данные 3X UI хранятся только на сервере
- ✅ Используются HTTPS соединения
- ✅ Защита от CORS атак
- ✅ Кэширование для уменьшения нагрузки
- ✅ Валидация всех входных данных

## 🐛 Troubleshooting

### Ошибка "xui-manager failed"
```bash
# Проверьте права доступа
ls -la xui-manager.mjs

# Проверьте Node.js версию
node --version

# Протестируйте отдельно
node xui-manager.mjs
```

### Ошибка подключения к 3X UI
```bash
# Проверьте доступность
curl -k https://your-3xui-url/login

# Проверьте учетные данные в xui-manager.mjs
```

### Порт занят
```bash
# Измените порт в server.js
const PORT = 5001;

# Или найдите процесс
sudo lsof -i :5000
```

## 📈 Особенности

### В сравнении с другими решениями

| Характеристика | TCP Ping | 3X UI API | VLESS Monitor |
|----------------|----------|-----------|---------------|
| **Точность** | ❌ Низкая | ✅ Высокая | ✅ Высокая |
| **Скорость** | ✅ Быстрая | 🔄 Средняя | ✅ Быстрая |
| **Информация** | ⚠️ Базовая | ✅ Полная | ✅ Полная |
| **Надежность** | ⚠️ Средняя | ✅ Высокая | ✅ Высокая |
| **Установка** | ✅ Простая | ⚠️ Сложная | ✅ Простая |

### Преимущества

1. **Реальные данные** - не эмуляция, а настоящая статистика с 3X UI
2. **Простота** - не требует сложной настройки
3. **Масштабируемость** - работает с любым количеством конфигов
4. **Безопасность** - данные не передаются на сторонние сервисы
5. **Кроссплатформенность** - работает везде где есть Node.js

## 🤝 Вклад в проект

Вы можете внести свой вклад:

1. **Сообщить о проблеме** - создайте issue
2. **Предложить улучшение** - создайте feature request
3. **Отправить код** - сделайте fork и pull request
4. **Улучшить документацию** - исправьте ошибки или добавьте примеры

### Разработка
```bash
# Клонируйте репозиторий
git clone https://github.com/maaloznal/zsz.git
cd zsz

# Установите зависимости
npm install

# Запустите в режиме разработки
npm run dev
```

## 📝 Лицензия

Этот проект распространяется под лицензией MIT. Подробности в файле [LICENSE](LICENSE).

## 🙏 Благодарности

- [3X UI](https://github.com/MHSanaei/3x-ui) - отличная панель управления
- [Express.js](https://expressjs.com/) - веб-фреймворк
- [Axios](https://axios-http.com/) - HTTP клиент

## 📞 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [Troubleshooting](#-troubleshooting)
2. Поищите в [Issues](https://github.com/maaloznal/zsz/issues)
3. Создайте новый issue с подробным описанием

---

**⭐ Если проект вам помог, поставьте звезду!**

Made with ❤️ for VLESS community
