# Настройка 3X UI API для мониторинга

## 🔧 Подготовка 3X UI панели

### 1. Включение API в 3X UI

Подключитесь к вашему VPS серверу:

```bash
ssh root@YOUR_VPS_IP
```

Проверьте статус 3X UI:

```bash
# Если 3X UI установлена через docker
docker ps | grep 3x-ui

# Если установлена напрямую
systemctl status 3x-ui
```

### 2. Настройка порта API

По умолчанию 3X UI работает на порту `20580`. Убедитесь, что порт доступен:

```bash
# Проверьте открытые порты
netstat -tuln | grep 20580

# Если порт закрыт, добавьте в файрвол
ufw allow 20580
# или для iptables
iptables -A INPUT -p tcp --dport 20580 -j ACCEPT
```

### 3. Получение данных для входа

Получите ваши учетные данные для 3X UI:

```bash
# Если используете docker, посмотрите логи для пароля
docker logs 3x-ui

# Или сбросьте пароль
docker exec -it 3x-ui /app/3x-ui -reset admin
```

## 🌐 Настройка веб-монитора

### 1. Включите 3X UI API в интерфейсе

1. Откройте `index.html`
2. В разделе "Настройки мониторинга" поставьте галочку "Использовать 3X UI API"
3. Заполните поля:
   - **URL 3X UI панели**: `http://YOUR_VPS_IP:20580`
   - **Имя пользователя**: `admin` (или ваш логин)
   - **Пароль**: ваш пароль от 3X UI

### 2. Тестирование подключения

Нажмите "Сохранить настройки" - система автоматически проверит подключение к 3X UI.

## 📡 API Endpoints 3X UI

### Основные эндпоинты:

```bash
# Авторизация
POST /api/login
Body: {"username":"admin","password":"your_password"}

# Получение inbound'ов
GET /api/inbounds
Headers: Authorization: Bearer YOUR_TOKEN

# Получение статистики
GET /api/stats
Headers: Authorization: Bearer YOUR_TOKEN

# Получение информации о системе
GET /api/server
Headers: Authorization: Bearer YOUR_TOKEN
```

### Пример запросов:

```bash
# 1. Получаем токен
TOKEN=$(curl -s -X POST "http://localhost:20580/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' | \
  jq -r '.token')

# 2. Получаем статистику
curl -s -X GET "http://localhost:20580/api/stats" \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Получаем inbound'ы
curl -s -X GET "http://localhost:20580/api/inbounds" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 🔍 Структура ответов API

### Ответ статистики:
```json
{
  "obj": [
    {
      "name": "dastamlf",
      "tag": "inbound-19007",
      "link": "vless://...",
      "uplink": 1024000,
      "downlink": 2048000,
      "total": 3072000
    }
  ]
}
```

### Ответ inbound'ов:
```json
{
  "obj": [
    {
      "id": 1,
      "port": 19007,
      "protocol": "vless",
      "settings": "...",
      "tag": "inbound-19007",
      "remark": "dastamlf"
    }
  ]
}
```

## 🛠️ Устранение проблем

### 1. Ошибка подключения

**Проблема**: "Не удалось подключиться к 3X UI"

**Решения**:
```bash
# Проверьте, что 3X UI запущена
docker ps | grep 3x-ui

# Проверьте порт
netstat -tuln | grep 20580

# Проверьте логи
docker logs 3x-ui
```

### 2. Неверные учетные данные

**Проблема**: "Неверные данные для входа"

**Решения**:
```bash
# Сбросьте пароль admin
docker exec -it 3x-ui /app/3x-ui -reset admin

# Или создайте нового пользователя
docker exec -it 3x-ui /app/3x-ui -add newuser newpassword
```

### 3. CORS ошибки

**Проблема**: Браузер блокирует запросы к API

**Решения**:
1. Используйте HTTPS для 3X UI панели
2. Настройте прокси на сервере
3. Используйте серверное приложение вместо прямых запросов

### 4. Firewall блокирует

**Проблема**: Порт 20580 недоступен извне

**Решения**:
```bash
# Для UFW
ufw allow 20580/tcp

# Для iptables
iptables -A INPUT -p tcp --dport 20580 -j ACCEPT

# Для firewalld
firewall-cmd --add-port=20580/tcp --permanent
firewall-cmd --reload
```

## 🔒 Безопасность

### Рекомендации по безопасности:

1. **Измените пароль по умолчанию**:
   ```bash
   docker exec -it 3x-ui /app/3x-ui -reset admin
   ```

2. **Используйте HTTPS**:
   ```bash
   # Настройте SSL сертификат для 3X UI
   # или используйте reverse proxy с nginx
   ```

3. **Ограничьте доступ к API**:
   ```bash
   # Разрешите доступ только с определенных IP
   iptables -A INPUT -p tcp --dport 20580 -s YOUR_IP -j ACCEPT
   iptables -A INPUT -p tcp --dport 20580 -j DROP
   ```

4. **Регулярно обновляйте 3X UI**:
   ```bash
   docker pull ghcr.io/mhsanaei/3x-ui:latest
   docker stop 3x-ui
   docker rm 3x-ui
   # Запустите контейнер заново
   ```

## 📊 Альтернативные методы мониторинга

Если 3X UI API недоступен, можно использовать:

### 1. Прямая проверка портов:
```bash
# Проверка доступности порта
nc -zv YOUR_VPS_IP 19007

# Проверка через telnet
telnet YOUR_VPS_IP 19007
```

### 2. Мониторинг через systemd:
```bash
# Проверка статуса сервиса
systemctl is-active xray

# Проверка логов
journalctl -u xray -f
```

### 3. Мониторинг через docker:
```bash
# Проверка статуса контейнера
docker ps | grep 3x-ui

# Проверка логов контейнера
docker logs -f 3x-ui
```

---

**После настройки 3X UI API мониторинг будет показывать реальный статус конфигов на основе трафика!** 🚀
