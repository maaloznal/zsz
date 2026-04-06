import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs/promises";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const baseURL = "https://31.59.106.240:13404/OKZoKRqvzxvBDDw9QC";
const username = "rolZvuA9Iq";
const password = "TthJtGPEsY";

const API = {
  login: "/login",
  inboundsList: "/panel/api/inbounds/list",
};

let client;

async function login() {
  const jar = new CookieJar();
  const cl = wrapper(axios.create({ jar, withCredentials: true, baseURL }));
  const res = await cl.post(API.login, { username, password });
  if (res.data?.success !== true)
    throw new Error("Ошибка входа: " + JSON.stringify(res.data));
  console.log("✅ Успешный вход");
  return cl;
}

async function getInbounds() {
  const res = await client.get(API.inboundsList);
  if (res.data?.success !== true)
    throw new Error("Ошибка получения inbound: " + JSON.stringify(res.data));
  return res.data.obj;
}

function getClientStatus(lastOnline, currentTime = Date.now()) {
  if (!lastOnline || lastOnline === 0) {
    return { isOnline: false, statusText: "никогда не подключался" };
  }
  const fiveMinutesAgo = currentTime - 5 * 60 * 1000;
  if (lastOnline > fiveMinutesAgo) {
    const secondsAgo = Math.floor((currentTime - lastOnline) / 1000);
    return { isOnline: true, statusText: `активен ${secondsAgo} сек назад` };
  } else {
    const date = new Date(lastOnline);
    return {
      isOnline: false,
      statusText: `последний раз ${date.toLocaleString()}`,
    };
  }
}

async function getAllClientsWithStatus() {
  const inbounds = await getInbounds();
  const clients = [];

  // Отладка: выведем структуру первого inbound
  if (inbounds.length > 0) {
    console.log("\n🔍 ОТЛАДКА: структура первого inbound (ключи):");
    const first = inbounds[0];
    console.log("  Ключи inbound:", Object.keys(first));
    if (first.clientStats) {
      console.log(
        "  clientStats найден, количество записей:",
        first.clientStats.length,
      );
      if (first.clientStats.length > 0) {
        console.log(
          "  Пример clientStats[0]:",
          JSON.stringify(first.clientStats[0], null, 2),
        );
      }
    } else {
      console.log("  clientStats отсутствует в inbound");
    }
    if (first.settings) {
      console.log("  Тип settings:", typeof first.settings);
      if (typeof first.settings === "string") {
        console.log(
          "  settings (строка, первые 200 символов):",
          first.settings.substring(0, 200),
        );
      } else {
        console.log("  Ключи settings:", Object.keys(first.settings));
      }
    }
    console.log("");
  }

  for (const inbound of inbounds) {
    // Парсим settings (конфигурация клиентов)
    let settings = inbound.settings;
    if (typeof settings === "string") {
      try {
        settings = JSON.parse(settings);
      } catch (e) {
        console.error(
          `Ошибка парсинга settings для inbound ${inbound.tag}:`,
          e.message,
        );
        continue;
      }
    }

    // Получаем массив клиентов из настроек (email, totalGB и т.д.)
    const configClients = settings?.clients || [];

    // Получаем статистику клиентов (up, down, lastOnline) из clientStats, если есть
    const statsMap = new Map(); // email -> { up, down, lastOnline }
    if (inbound.clientStats && Array.isArray(inbound.clientStats)) {
      for (const stat of inbound.clientStats) {
        if (stat.email) {
          statsMap.set(stat.email, {
            up: stat.up || 0,
            down: stat.down || 0,
            lastOnline: stat.lastOnline || 0,
          });
        }
      }
    }

    // Объединяем данные
    for (const c of configClients) {
      const stats = statsMap.get(c.email) || { up: 0, down: 0, lastOnline: 0 };
      const usedBytes = (stats.up || 0) + (stats.down || 0);
      const usedGB = usedBytes / 1e9;
      const totalBytes = c.totalGB || 0;
      const status = getClientStatus(stats.lastOnline);

      clients.push({
        email: c.email,
        inboundId: inbound.id,
        inboundTag: inbound.tag,
        protocol: inbound.protocol,
        port: inbound.port,
        enable: c.enable,
        totalGB: totalBytes,
        usedGB: usedGB,
        usedBytes: usedBytes,
        expiryTime: c.expiryTime,
        lastOnline: stats.lastOnline,
        isOnline: status.isOnline,
        statusText: status.statusText,
      });
    }
  }
  return clients;
}

async function saveReport(clients, inbounds) {
  const now = new Date().toISOString();
  const onlineCount = clients.filter((c) => c.isOnline).length;
  const totalTrafficUsed = clients
    .reduce((sum, c) => sum + (c.usedGB || 0), 0)
    .toFixed(2);
  const report = {
    timestamp: now,
    summary: {
      totalInbounds: inbounds.length,
      totalClients: clients.length,
      onlineClients: onlineCount,
      offlineClients: clients.length - onlineCount,
      totalTrafficUsedGB: totalTrafficUsed,
    },
    inbounds: inbounds.map((inb) => {
      let clientsCount = 0;
      let settings = inb.settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch (e) {}
      }
      if (settings?.clients) clientsCount = settings.clients.length;
      return {
        id: inb.id,
        tag: inb.tag,
        port: inb.port,
        protocol: inb.protocol,
        enable: inb.enable,
        clientsCount: clientsCount,
      };
    }),
    clients,
  };
  await fs.writeFile("panel_report.json", JSON.stringify(report, null, 2));
  console.log("💾 Отчёт сохранён в panel_report.json");
}

function printSummary(clients, inbounds) {
  console.log(`\n📊 СТАТИСТИКА ПАНЕЛИ`);
  console.log(`   Всего inbound: ${inbounds.length}`);
  console.log(`   Всего клиентов: ${clients.length}`);
  const online = clients.filter((c) => c.isOnline).length;
  console.log(`   🟢 Онлайн: ${online}`);
  console.log(`   🔴 Офлайн: ${clients.length - online}`);
  const totalTraffic = clients
    .reduce((sum, c) => sum + (c.usedGB || 0), 0)
    .toFixed(2);
  console.log(`   📈 Общий использованный трафик: ${totalTraffic} ГБ\n`);

  const sample = clients.slice(0, 10);
  for (const c of sample) {
    const statusIcon = c.isOnline ? "🟢" : "🔴";
    const used = isNaN(c.usedGB) ? 0 : c.usedGB.toFixed(2);
    console.log(
      `${statusIcon} ${c.email} | ${c.protocol} | ${c.statusText} | использовано ${used} ГБ`,
    );
  }
  if (clients.length > 10)
    console.log(`   ... и ещё ${clients.length - 10} клиентов`);
}

async function main() {
  try {
    client = await login();
    const inbounds = await getInbounds();
    const clients = await getAllClientsWithStatus();
    printSummary(clients, inbounds);
    await saveReport(clients, inbounds);
    console.log("\n✅ Готово.");
  } catch (err) {
    console.error("❌ Ошибка:", err.message);
  }
}

main();
