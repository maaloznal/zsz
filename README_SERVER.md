# VLESS Мониторинг с 3X UI интеграцией

## 🚀 Обзор

Это полноценное серверное решение для мониторинга VLESS конфигураций с прямой интеграцией с 3X UI панелью. Система получает **реальные данные** о количестве клиентов и статусе inbound'ов.

### ✨ Возможности

- 🎯 **Точная проверка статуса** через 3X UI API
- 📊 **Реальная статистика** - количество клиентов, трафик
- 🔄 **Автоматическое обновление** с настраиваемым интервалом
- 💾 **Сохранение конфигов** в браузере
- 🌐 **Современный интерфейс** с адаптивным дизайном
- ⚡ **Быстрое развертывание** на любом VPS

## 📋 Требования

- Node.js 14+ 
- Доступ к 3X UI панели
- Ваш `xui-manager.mjs` файл в той же директории

## 🛠️ Установка и запуск

### 1. Подготовка файлов

Убедитесь, что в одной директории находятся:
- `server.js` - основной сервер
- `monitor.html` - веб-интерфейс  
- `xui-manager.mjs` - ваш модуль для 3X UI
- `package.json` - зависимости

### 2. Установка зависимостей

```bash
# Установка Node.js зависимостей
npm install

# Или одной командой
npm run install-deps
```

### 3. Настройка xui-manager.mjs

Убедитесь, что в `xui-manager.mjs` указаны правильные данные:
```javascript
const baseURL = "https://31.59.106.240:13404/OKZoKRqvzxvBDDw9QC";
const username = "rolZvuA9Iq";
const password = "TthJtGPEsY";
```

### 4. Запуск сервера

```bash
# Запуск в режиме разработки
npm start

# Или напрямую
node server.js
```

Сервер запустится на порту `5000`. Откройте в браузере:
- Локально: `http://localhost:5000`
- С VPS: `http://ВАШ_IP:5000`

## 🔧 Конфигурация

### Настройка порта сервера

Измените порт в `server.js`:
```javascript
const PORT = 5000; // Измените на нужный порт
```

### Настройка интервала обновления

В веб-интерфейсе используйте слайдер "Интервал авто-проверки" (5-120 минут).

## 📊 API Эндпоинты

### Проверка VLESS конфига
```http
POST /api/check
Content-Type: application/json

{
  "vless": "vless://...@ip:port?...#name"
}
```

**Ответ:**
```json
{
  "ok": true,
  "alive": true,
  "host": "31.59.106.240",
  "port": 19007,
  "name": "dastamlf",
  "inbound": {
    "id": 1,
    "tag": "inbound-19007",
    "protocol": "vless",
    "enabled": true,
    "clients": 5
  },
  "reason": "Active with clients"
}
```

### Получение статистики 3X UI
```http
GET /api/stats
```

**Ответ:**
```json
{
  "ok": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "summary": {
    "totalInbounds": 3,
    "activeInbounds": 2,
    "totalClients": 12,
    "lastUpdate": "2024-01-01T12:00:00.000Z"
  },
  "inbounds": [...]
}
```

### Получение всех inbound'ов
```http
GET /api/inbounds
```

## 🎯 Как работает мониторинг

### 1. Парсинг VLESS ссылки
- Извлекает хост, порт, имя из ссылки
- Проверяет формат валидации

### 2. Поиск в 3X UI
- Ищет inbound по порту или имени
- Получает актуальную статистику

### 3. Определение статуса
- **🟢 Работает**: inbound включен + есть клиенты
- **🔴 Не работает**: inbound выключен или нет клиентов
- **⏳ Проверка**: идет запрос к 3X UI

### 4. Кэширование
- Данные кэшируются на 1 минуту
- Уменьшает нагрузку на 3X UI

## 🔒 Безопасность

### Защита от CORS
Сервер разрешает запросы с любого домена для удобства разработки.

### Безопасность 3X UI
- Используются HTTPS соединения
- Данные аутентификации хранятся только на сервере
- Пароли не передаются на фронтенд

### Рекомендации
1. **Измените порт** по умолчанию на нестандартный
2. **Используйте reverse proxy** с HTTPS
3. **Ограничьте доступ** по IP если возможно
4. **Регулярно обновляйте** Node.js и зависимости

## 🚀 Развертывание в production

### 1. Использование PM2
```bash
# Установка PM2
npm install -g pm2

# Запуск с PM2
pm2 start server.js --name vless-monitor

# Автозапуск при загрузке
pm2 startup
pm2 save
```

### 2. Настройка Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Настройка HTTPS с Let's Encrypt
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com
```

### 4. Systemd сервис
Создайте файл `/etc/systemd/system/vless-monitor.service`:
```ini
[Unit]
Description=VLESS Monitor Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/vless-monitor
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Запуск сервиса:
```bash
sudo systemctl enable vless-monitor
sudo systemctl start vless-monitor
sudo systemctl status vless-monitor
```

## 🐛 Troubleshooting

### Ошибка "xui-manager failed"
```bash
# Проверьте права доступа к файлу
ls -la xui-manager.mjs

# Проверьте Node.js версию
node --version  # должна быть 14+

# Протестируйте xui-manager вручную
node xui-manager.mjs
```

### Ошибка подключения к 3X UI
```bash
# Проверьте доступность 3X UI
curl -k https://31.59.106.240:13404/OKZoKRqvzxvBDDw9QC/login

# Проверьте учетные данные
# Убедитесь, что username и password правильные
```

### Порт уже занят
```bash
# Найдите процесс
sudo lsof -i :5000

# Измените порт в server.js
const PORT = 5001;  # или другой свободный порт
```

### CORS ошибки
Проверьте, что сервер запущен и доступен:
```bash
curl http://localhost:5000/api/stats
```

## 📈 Мониторинг работы сервера

### Логи PM2
```bash
pm2 logs vless-monitor
pm2 monit
```

### Логи systemd
```bash
sudo journalctl -u vless-monitor -f
```

### Проверка нагрузки
```bash
# Использование памяти
pm2 show vless-monitor

# Нагрузка на CPU
top -p $(pgrep -f "node server.js")
```

## 🔄 Обновление

```bash
# Остановите сервис
pm2 stop vless-monitor

# Обновите файлы
git pull  # или скопируйте новые версии

# Обновите зависимости
npm install

# Запустите снова
pm2 start vless-monitor
```

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Убедитесь, что `xui-manager.mjs` работает отдельно
3. Проверьте доступность 3X UI панели
4. Проверьте версию Node.js

---

**Готово к использованию!** 🎉 Система начнет показывать реальный статус ваших VLESS конфигов на основе данных с 3X UI панели.
