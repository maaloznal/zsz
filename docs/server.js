const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Хранилище для кэша результатов
let cache = {
    inbounds: null,
    lastUpdate: null,
    updateInterval: 60000 // 1 минута
};

// --------------------------------------------------------------
// Функция для выполнения xui-manager.mjs
// --------------------------------------------------------------
async function getXUIStats() {
    return new Promise((resolve, reject) => {
        const child = spawn('node', ['xui-manager.mjs'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`xui-manager failed: ${stderr}`));
                return;
            }

            try {
                // Пытаемся прочитать сгенерированный JSON файл
                const fs = require('fs');
                if (fs.existsSync('inbounds_list.json')) {
                    const data = JSON.parse(fs.readFileSync('inbounds_list.json', 'utf8'));
                    resolve(data);
                } else {
                    // Парсим stdout если JSON файл не создан
                    const lines = stdout.split('\n');
                    const result = {
                        timestamp: new Date().toISOString(),
                        count: 0,
                        inbounds: []
                    };
                    
                    for (const line of lines) {
                        if (line.includes('Найдено inbound:')) {
                            result.count = parseInt(line.match(/\d+/)?.[0] || 0);
                        }
                    }
                    
                    resolve(result);
                }
            } catch (error) {
                reject(error);
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

// --------------------------------------------------------------
// API Routes
// --------------------------------------------------------------

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitor.html'));
});

// Проверка VLESS конфига через 3X UI
app.post('/api/check', async (req, res) => {
    try {
        const { vless } = req.body;
        
        if (!vless) {
            return res.status(400).json({ ok: false, error: 'VLESS URL required' });
        }

        // Парсим VLESS URL
        const parsed = parseVlessUrl(vless);
        if (!parsed) {
            return res.status(400).json({ ok: false, error: 'Invalid VLESS URL' });
        }

        // Получаем актуальные данные с 3X UI
        const stats = await getFreshStats();
        
        // Ищем matching inbound
        let matchingInbound = null;
        
        for (const inbound of stats.inbounds) {
            // Проверяем по порту
            if (inbound.port === parsed.port) {
                matchingInbound = inbound;
                break;
            }
            
            // Проверяем по имени в теге
            if (inbound.tag && inbound.tag.toLowerCase().includes(parsed.name.toLowerCase())) {
                matchingInbound = inbound;
                break;
            }
        }

        if (!matchingInbound) {
            return res.json({
                ok: true,
                alive: false,
                host: parsed.host,
                port: parsed.port,
                reason: 'Inbound not found in 3X UI',
                clients: 0,
                enabled: false
            });
        }

        // Проверяем количество клиентов и статус
        const clientsCount = matchingInbound.clientsCount || 0;
        const isEnabled = matchingInbound.enable !== false;
        
        // Конфиг считается активным, если inbound включен (независимо от количества клиентов)
        // 0 клиентов не означает, что конфиг не работает - просто никто не подключен
        const isAlive = isEnabled;
        
        // Дополнительная информация о трафике для определения реальной активности
        const hasTraffic = (matchingInbound.up > 0 || matchingInbound.down > 0);
        
        res.json({
            ok: true,
            alive: isAlive,
            host: parsed.host,
            port: parsed.port,
            name: parsed.name,
            inbound: {
                id: matchingInbound.id,
                tag: matchingInbound.tag,
                protocol: matchingInbound.protocol,
                enabled: isEnabled,
                clients: clientsCount,
                up: matchingInbound.up || 0,
                down: matchingInbound.down || 0,
                hasTraffic: hasTraffic
            },
            reason: !isEnabled ? 'Inbound disabled' : 
                    (hasTraffic ? 'Active with traffic' : 
                     (clientsCount > 0 ? `Active with ${clientsCount} clients` : 'Active (no current connections)'))
        });

    } catch (error) {
        console.error('Check error:', error);
        res.status(500).json({ 
            ok: false, 
            error: error.message 
        });
    }
});

// Получение всех inbound'ов
app.get('/api/inbounds', async (req, res) => {
    try {
        const stats = await getFreshStats();
        res.json({
            ok: true,
            ...stats
        });
    } catch (error) {
        console.error('Inbounds error:', error);
        res.status(500).json({ 
            ok: false, 
            error: error.message 
        });
    }
});

// Получение статистики
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await getFreshStats();
        
        // Агрегируем статистику
        const totalInbounds = stats.inbounds.length;
        const activeInbounds = stats.inbounds.filter(inb => inb.enable !== false).length;
        const totalClients = stats.inbounds.reduce((sum, inb) => sum + (inb.clientsCount || 0), 0);
        
        res.json({
            ok: true,
            timestamp: stats.timestamp,
            summary: {
                totalInbounds,
                activeInbounds,
                totalClients,
                lastUpdate: new Date().toISOString()
            },
            inbounds: stats.inbounds
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ 
            ok: false, 
            error: error.message 
        });
    }
});

// --------------------------------------------------------------
// Helper Functions
// --------------------------------------------------------------

function parseVlessUrl(vlessUrl) {
    try {
        const match = vlessUrl.match(/vless:\/\/[^@]+@([^:]+):(\d+)(\?.*)?#(.+)$/);
        if (!match) return null;
        
        return {
            host: match[1],
            port: parseInt(match[2]),
            name: decodeURIComponent(match[4]),
            raw: vlessUrl
        };
    } catch (error) {
        return null;
    }
}

async function getFreshStats() {
    const now = Date.now();
    
    // Проверяем кэш
    if (cache.inbounds && cache.lastUpdate && (now - cache.lastUpdate) < cache.updateInterval) {
        return cache.inbounds;
    }

    try {
        const stats = await getXUIStats();
        cache.inbounds = stats;
        cache.lastUpdate = now;
        return stats;
    } catch (error) {
        console.error('Failed to get fresh stats:', error);
        // Возвращаем кэшированные данные если есть
        if (cache.inbounds) {
            return cache.inbounds;
        }
        throw error;
    }
}

// --------------------------------------------------------------
// Запуск сервера
// --------------------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VLESS Monitor Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Open http://localhost:${PORT} for monitoring interface`);
    
    // Предварительная загрузка данных
    getFreshStats().then(() => {
        console.log('✅ Initial 3X UI data loaded');
    }).catch(error => {
        console.error('❌ Failed to load initial data:', error.message);
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
