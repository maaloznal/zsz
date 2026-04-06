class VLESSMonitor {
    constructor() {
        this.configs = [];
        this.settings = {
            checkInterval: 10,
            autoCheck: true,
            use3XUI: false,
            xuiUrl: '',
            xuiUsername: 'admin',
            xuiPassword: '',
            xuiToken: null
        };
        this.checkIntervalId = null;
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.renderConfigs();
        this.updateStats();
        this.startAutoCheck();
    }

    setupEventListeners() {
        // Форма добавления конфига
        document.getElementById('addConfigForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addConfig();
        });

        // Настройки
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Переключатель 3X UI
        document.getElementById('use3XUI').addEventListener('change', (e) => {
            const xuiSettings = document.getElementById('xuiSettings');
            xuiSettings.style.display = e.target.checked ? 'block' : 'none';
        });

        // Кнопки управления
        document.getElementById('checkAllBtn').addEventListener('click', () => {
            this.checkAllConfigs();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите удалить все конфиги?')) {
                this.clearAllConfigs();
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportConfigs();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            this.showImportModal();
        });

        // Модальное окно импорта
        const modal = document.getElementById('importModal');
        const closeBtn = modal.querySelector('.close');
        
        closeBtn.addEventListener('click', () => {
            this.hideImportModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideImportModal();
            }
        });

        document.getElementById('confirmImport').addEventListener('click', () => {
            this.importConfigs();
        });
    }

    // Парсер VLESS ссылок
    parseVLESSUrl(vlessUrl) {
        try {
            const url = new URL(vlessUrl);
            
            if (url.protocol !== 'vless:') {
                throw new Error('Неверный протокол. Ожидался vless://');
            }

            const uuid = url.username;
            const [host, port] = url.host.split(':');
            const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : 'Без имени';
            
            // Парсим параметры
            const params = new URLSearchParams(url.search);
            
            return {
                id: this.generateId(),
                name: name,
                uuid: uuid,
                host: host,
                port: parseInt(port),
                type: params.get('type') || 'tcp',
                encryption: params.get('encryption') || 'none',
                security: params.get('security') || 'none',
                pbk: params.get('pbk') || '',
                fp: params.get('fp') || 'chrome',
                sni: params.get('sni') || '',
                sid: params.get('sid') || '',
                spx: params.get('spx') || '',
                url: vlessUrl,
                status: 'unknown',
                lastCheck: null,
                responseTime: null
            };
        } catch (error) {
            throw new Error(`Ошибка парсинга VLESS ссылки: ${error.message}`);
        }
    }

    addConfig() {
        const vlessUrl = document.getElementById('vlessUrl').value.trim();
        
        if (!vlessUrl) {
            this.showNotification('Введите VLESS ссылку', 'error');
            return;
        }

        try {
            const config = this.parseVLESSUrl(vlessUrl);
            
            // Проверяем на дубликаты
            if (this.configs.some(c => c.url === config.url)) {
                this.showNotification('Такой конфиг уже существует', 'warning');
                return;
            }

            this.configs.push(config);
            this.saveToStorage();
            this.renderConfigs();
            this.updateStats();
            
            // Очищаем форму
            document.getElementById('vlessUrl').value = '';
            
            this.showNotification('Конфигурация добавлена', 'success');
            
            // Сразу проверяем статус
            this.checkConfig(config.id);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async checkConfig(configId) {
        const config = this.configs.find(c => c.id === configId);
        if (!config) return;

        // Обновляем статус на "проверка"
        config.status = 'checking';
        this.renderConfigs();

        try {
            const startTime = Date.now();
            let isOnline = false;

            if (this.settings.use3XUI && this.settings.xuiUrl && this.settings.xuiToken) {
                // Используем 3X UI API
                const result = await this.testConnectionVia3XUI(
                    this.settings.xuiUrl, 
                    this.settings.xuiToken, 
                    config.name
                );
                isOnline = result.isOnline;
                config.traffic = result.traffic;
            } else {
                // Используем стандартную проверку
                isOnline = await this.testConnection(config.host, config.port);
            }

            const responseTime = Date.now() - startTime;
            config.status = isOnline ? 'online' : 'offline';
            config.responseTime = isOnline ? responseTime : null;
            config.lastCheck = new Date().toISOString();
        } catch (error) {
            config.status = 'offline';
            config.responseTime = null;
            config.lastCheck = new Date().toISOString();
        }

        this.saveToStorage();
        this.renderConfigs();
        this.updateStats();
    }

    async testConnection(host, port, timeout = 5000) {
        // Для VLESS Reality конфигов используем TCP проверку
        return this.testTcpConnection(host, port, timeout);
    }

    async testTcpConnection(host, port, timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            // Используем fetch для проверки доступности
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            fetch(`http://${host}:${port}`, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            })
            .then(() => {
                clearTimeout(timeoutId);
                resolve(true);
            })
            .catch(() => {
                clearTimeout(timeoutId);
                // Если fetch не сработал, пробуем WebSocket
                this.testWebSocketConnection(host, port, timeout).then(resolve);
            });
        });
    }

    async testWebSocketConnection(host, port, timeout = 5000) {
        return new Promise((resolve) => {
            try {
                const socket = new WebSocket(`ws://${host}:${port}`);
                
                const timer = setTimeout(() => {
                    socket.close();
                    resolve(false);
                }, timeout);

                socket.onopen = () => {
                    clearTimeout(timer);
                    socket.close();
                    resolve(true);
                };

                socket.onerror = () => {
                    clearTimeout(timer);
                    resolve(false);
                };

                socket.onclose = () => {
                    clearTimeout(timer);
                };
            } catch (error) {
                resolve(false);
            }
        });
    }

    async testConnectionVia3XUI(apiUrl, apiKey, inboundTag) {
        try {
            const response = await fetch(`${apiUrl}/api/stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const stats = await response.json();
            
            // Проверяем статистику по inbound
            const inboundStats = stats.find(s => s.tag === inboundTag || s.link?.includes(inboundTag));
            
            if (inboundStats) {
                return {
                    isOnline: inboundStats.uplink > 0 || inboundStats.downlink > 0,
                    traffic: {
                        uplink: inboundStats.uplink,
                        downlink: inboundStats.downlink
                    }
                };
            }

            return { isOnline: false, traffic: null };
        } catch (error) {
            console.error('3X UI API error:', error);
            return { isOnline: false, traffic: null };
        }
    }

    async checkAllConfigs() {
        const promises = this.configs.map(config => this.checkConfig(config.id));
        await Promise.all(promises);
        this.showNotification('Все конфиги проверены', 'success');
    }

    deleteConfig(configId) {
        if (confirm('Удалить эту конфигурацию?')) {
            this.configs = this.configs.filter(c => c.id !== configId);
            this.saveToStorage();
            this.renderConfigs();
            this.updateStats();
            this.showNotification('Конфигурация удалена', 'success');
        }
    }

    clearAllConfigs() {
        this.configs = [];
        this.saveToStorage();
        this.renderConfigs();
        this.updateStats();
        this.showNotification('Все конфиги удалены', 'success');
    }

    renderConfigs() {
        const tbody = document.getElementById('configsTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.getElementById('configsTable');

        if (this.configs.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        emptyState.style.display = 'none';

        tbody.innerHTML = this.configs.map(config => `
            <tr>
                <td>
                    <strong>${this.escapeHtml(config.name)}</strong>
                    <br>
                    <small style="color: #666;">${config.uuid.substring(0, 8)}...</small>
                </td>
                <td>${this.escapeHtml(config.host)}</td>
                <td>${config.port}</td>
                <td>
                    <span class="status ${config.status}">
                        <span class="status-indicator"></span>
                        ${this.getStatusText(config.status)}
                    </span>
                </td>
                <td>
                    ${config.lastCheck ? 
                        this.formatDate(config.lastCheck) : 
                        'Не проверялся'
                    }
                </td>
                <td>
                    ${config.responseTime ? 
                        `<span class="response-time">${config.responseTime}ms</span>` : 
                        '-'
                    }
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-primary" onclick="monitor.checkConfig('${config.id}')">
                            Проверить
                        </button>
                        <button class="btn-small btn-danger" onclick="monitor.deleteConfig('${config.id}')">
                            Удалить
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateStats() {
        const total = this.configs.length;
        const online = this.configs.filter(c => c.status === 'online').length;
        const offline = this.configs.filter(c => c.status === 'offline').length;

        document.getElementById('totalCount').textContent = total;
        document.getElementById('onlineCount').textContent = online;
        document.getElementById('offlineCount').textContent = offline;
    }

    saveSettings() {
        const interval = parseInt(document.getElementById('checkInterval').value);
        const autoCheck = document.getElementById('autoCheck').checked;
        const use3XUI = document.getElementById('use3XUI').checked;

        if (interval < 1 || interval > 60) {
            this.showNotification('Интервал должен быть от 1 до 60 минут', 'error');
            return;
        }

        this.settings.checkInterval = interval;
        this.settings.autoCheck = autoCheck;
        this.settings.use3XUI = use3XUI;

        if (use3XUI) {
            this.settings.xuiUrl = document.getElementById('xuiUrl').value.trim();
            this.settings.xuiUsername = document.getElementById('xuiUsername').value.trim();
            this.settings.xuiPassword = document.getElementById('xuiPassword').value;

            // Проверяем подключение к 3X UI
            this.test3XUIConnection();
        }

        this.saveToStorage();
        this.startAutoCheck();
        this.showNotification('Настройки сохранены', 'success');
    }

    async test3XUIConnection() {
        try {
            const token = await this.get3XUIToken();
            if (token) {
                this.settings.xuiToken = token;
                this.showNotification('Подключение к 3X UI успешно', 'success');
            } else {
                this.showNotification('Ошибка подключения к 3X UI', 'error');
                this.settings.use3XUI = false;
                document.getElementById('use3XUI').checked = false;
                document.getElementById('xuiSettings').style.display = 'none';
            }
        } catch (error) {
            this.showNotification('Ошибка подключения к 3X UI: ' + error.message, 'error');
            this.settings.use3XUI = false;
            document.getElementById('use3XUI').checked = false;
            document.getElementById('xuiSettings').style.display = 'none';
        }
    }

    async get3XUIToken() {
        try {
            const response = await fetch(`${this.settings.xuiUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: this.settings.xuiUsername,
                    password: this.settings.xuiPassword
                })
            });

            if (!response.ok) {
                throw new Error('Неверные данные для входа');
            }

            const data = await response.json();
            return data.token || data.session;
        } catch (error) {
            throw new Error('Не удалось получить токен: ' + error.message);
        }
    }

    startAutoCheck() {
        // Останавливаем предыдущий интервал
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
        }

        // Запускаем новый интервал если включен
        if (this.settings.autoCheck && this.configs.length > 0) {
            this.checkIntervalId = setInterval(() => {
                this.checkAllConfigs();
            }, this.settings.checkInterval * 60 * 1000);
        }
    }

    exportConfigs() {
        const data = {
            configs: this.configs,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `vless-configs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Конфиги экспортированы', 'success');
    }

    showImportModal() {
        document.getElementById('importModal').classList.add('show');
    }

    hideImportModal() {
        document.getElementById('importModal').classList.remove('show');
        document.getElementById('importData').value = '';
    }

    importConfigs() {
        const importData = document.getElementById('importData').value.trim();
        
        if (!importData) {
            this.showNotification('Введите данные для импорта', 'error');
            return;
        }

        try {
            const data = JSON.parse(importData);
            
            if (data.configs && Array.isArray(data.configs)) {
                // Проверяем валидность конфигов
                const validConfigs = data.configs.filter(config => {
                    try {
                        this.parseVLESSUrl(config.url);
                        return true;
                    } catch {
                        return false;
                    }
                });

                if (validConfigs.length === 0) {
                    throw new Error('Нет валидных конфигураций');
                }

                // Добавляем конфиги
                this.configs = [...this.configs, ...validConfigs];
                
                // Импортируем настройки если есть
                if (data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                    document.getElementById('checkInterval').value = this.settings.checkInterval;
                    document.getElementById('autoCheck').checked = this.settings.autoCheck;
                }

                this.saveToStorage();
                this.renderConfigs();
                this.updateStats();
                this.startAutoCheck();
                this.hideImportModal();
                
                this.showNotification(`Импортировано ${validConfigs.length} конфигов`, 'success');
            } else {
                throw new Error('Неверный формат данных');
            }
        } catch (error) {
            this.showNotification(`Ошибка импорта: ${error.message}`, 'error');
        }
    }

    // Вспомогательные методы
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatusText(status) {
        const statusMap = {
            'online': 'Работает',
            'offline': 'Не работает',
            'checking': 'Проверка...',
            'unknown': 'Неизвестно'
        };
        return statusMap[status] || 'Неизвестно';
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Стили для уведомления
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '300px',
            wordWrap: 'break-word',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        // Цвета для разных типов
        const colors = {
            success: 'linear-gradient(135deg, #28a745, #20c997)',
            error: 'linear-gradient(135deg, #dc3545, #e74c3c)',
            warning: 'linear-gradient(135deg, #ffc107, #ff9800)',
            info: 'linear-gradient(135deg, #17a2b8, #138496)'
        };
        
        notification.style.background = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Анимация появления
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Автоматическое скрытие
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Методы для работы с localStorage
    saveToStorage() {
        localStorage.setItem('vless-configs', JSON.stringify(this.configs));
        localStorage.setItem('vless-settings', JSON.stringify(this.settings));
    }

    loadFromStorage() {
        try {
            const configsData = localStorage.getItem('vless-configs');
            const settingsData = localStorage.getItem('vless-settings');

            if (configsData) {
                this.configs = JSON.parse(configsData);
            }

            if (settingsData) {
                this.settings = { ...this.settings, ...JSON.parse(settingsData) };
                document.getElementById('checkInterval').value = this.settings.checkInterval;
                document.getElementById('autoCheck').checked = this.settings.autoCheck;
                document.getElementById('use3XUI').checked = this.settings.use3XUI;
                document.getElementById('xuiUrl').value = this.settings.xuiUrl || '';
                document.getElementById('xuiUsername').value = this.settings.xuiUsername || 'admin';
                document.getElementById('xuiPassword').value = this.settings.xuiPassword || '';
                
                // Показываем настройки 3X UI если включены
                if (this.settings.use3XUI) {
                    document.getElementById('xuiSettings').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }
}

// Добавляем тестовые конфиги при первом запуске
function addTestConfigs() {
    const testConfigs = [
        'vless://e91a3775-3f8f-4bd5-9e82-37b365b5c060@31.59.106.240:19007?type=tcp&encryption=none&security=reality&pbk=AO1YrOTPmjxttp04HNai9_rDhjhg3X2uG60DuIOVe0Y&fp=chrome&sni=aws.amazon.com&sid=f76d35fb89&spx=%2F#dastamlf',
        'vless://5ae96a0f-eba0-467b-8d6e-2ae4d5348e3b@31.59.106.240:19007?type=tcp&encryption=none&security=reality&pbk=AO1YrOTPmjxttp04HNai9_rDhjhg3X2uG60DuIOVe0Y&fp=chrome&sni=aws.amazon.com&sid=f76d35fb89&spx=%2F#openwrt_01'
    ];

    // Проверяем первый запуск
    if (!localStorage.getItem('vless-first-run')) {
        testConfigs.forEach(configUrl => {
            try {
                const config = monitor.parseVLESSUrl(configUrl);
                monitor.configs.push(config);
            } catch (error) {
                console.error('Ошибка добавления тестового конфига:', error);
            }
        });
        
        if (monitor.configs.length > 0) {
            monitor.saveToStorage();
            localStorage.setItem('vless-first-run', 'true');
            monitor.showNotification('Добавлены тестовые конфиги', 'success');
        }
    }
}

// Инициализация приложения
let monitor;
document.addEventListener('DOMContentLoaded', () => {
    monitor = new VLESSMonitor();
    
    // Добавляем тестовые конфиги при первом запуске
    setTimeout(() => {
        addTestConfigs();
        monitor.renderConfigs();
        monitor.updateStats();
        monitor.startAutoCheck();
    }, 1000);
});
