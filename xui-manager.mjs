import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs/promises";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const baseURL = "https://31.59.106.240:13404/OKZoKRqvzxvBDDw9QC";
const username = "rolZvuA9Iq";
const password = "TthJtGPEsY";

// API endpoints
const API = {
  login: "/login",
  inboundsList: "/panel/api/inbounds/list",
  inboundAdd: "/panel/api/inbounds/add",
  inboundUpdate: "/panel/api/inbounds/update",
  inboundDelete: "/panel/api/inbounds/del",
  clientAdd: "/panel/api/inbounds/addClient",
  clientUpdate: "/panel/api/inbounds/updateClient",
  clientDelete: "/panel/api/inbounds/delClient",
};

let client;

// --------------------------------------------------------------
// Аутентификация
// --------------------------------------------------------------
async function login() {
  const jar = new CookieJar();
  const cl = wrapper(axios.create({ jar, withCredentials: true, baseURL }));
  const res = await cl.post(API.login, { username, password });
  if (res.data?.success !== true)
    throw new Error("Ошибка входа: " + JSON.stringify(res.data));
  console.log("✅ Успешный вход");
  return cl;
}

// --------------------------------------------------------------
// Получить все inbound
// --------------------------------------------------------------
async function getInbounds() {
  const res = await client.get(API.inboundsList);
  if (res.data?.success !== true)
    throw new Error("Ошибка получения inbound: " + JSON.stringify(res.data));
  return res.data.obj;
}

// --------------------------------------------------------------
// Добавить inbound (универсальный)
// --------------------------------------------------------------
async function addInbound(inboundConfig) {
  const res = await client.post(API.inboundAdd, inboundConfig);
  if (res.data?.success !== true)
    throw new Error("Ошибка добавления inbound: " + JSON.stringify(res.data));
  console.log(
    `✅ Inbound "${inboundConfig.tag}" добавлен, ID: ${res.data.obj?.id}`,
  );
  await fs.writeFile(
    "last_added_inbound.json",
    JSON.stringify(res.data, null, 2),
  );
  return res.data;
}

// --------------------------------------------------------------
// Добавить клиента в inbound
// --------------------------------------------------------------
async function addClient(inboundId, clientData) {
  // Правильный payload для 3x-UI API
  const payload = { id: inboundId, settings: { clients: [clientData] } };
  const res = await client.post(API.clientAdd, payload);
  if (res.data?.success !== true)
    throw new Error("Ошибка добавления клиента: " + JSON.stringify(res.data));
  console.log(`✅ Клиент ${clientData.email} добавлен в inbound ${inboundId}`);
  await fs.writeFile(
    "last_added_client.json",
    JSON.stringify(res.data, null, 2),
  );
  return res.data;
}

// --------------------------------------------------------------
// Сохранить список inbound в файл
// --------------------------------------------------------------
async function saveInboundsToFile(inbounds) {
  const data = {
    timestamp: new Date().toISOString(),
    count: inbounds.length,
    inbounds: inbounds.map((inb) => ({
      id: inb.id,
      tag: inb.tag,
      port: inb.port,
      protocol: inb.protocol,
      enable: inb.enable,
      clientsCount: inb.settings?.clients?.length || 0,
    })),
  };
  await fs.writeFile("inbounds_list.json", JSON.stringify(data, null, 2));
  console.log("💾 Список inbound сохранён в inbounds_list.json");
}

// --------------------------------------------------------------
// Пример конфигурации для VLESS Reality
// --------------------------------------------------------------
function createRealityInbound(port, tag, sni, pbk, sid) {
  return {
    port,
    protocol: "vless",
    settings: {
      clients: [],
      decryption: "none",
      fallbacks: [],
    },
    streamSettings: {
      network: "tcp",
      security: "reality",
      realitySettings: {
        dest: `${sni}:443`,
        serverNames: [sni],
        privateKey: "",
        publicKey: pbk,
        shortIds: [sid],
        settings: {
          publicKey: pbk,
          shortId: sid,
        },
      },
    },
    tag,
    sniffing: {
      enabled: true,
      destOverride: ["http", "tls"],
    },
  };
}

// --------------------------------------------------------------
// Парсинг аргументов командной строки
// --------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = {};
  for (let i = 1; i < args.length; i++) {
    const [key, val] = args[i].split("=");
    if (key && val) params[key] = val;
  }
  return { command, params };
}

// --------------------------------------------------------------
// MAIN
// --------------------------------------------------------------
async function main() {
  const { command, params } = parseArgs();

  try {
    client = await login();

    // Если нет команды – просто показываем список и сохраняем
    if (!command) {
      const inbounds = await getInbounds();
      console.log(`\n📡 Найдено inbound: ${inbounds.length}`);
      for (const inb of inbounds) {
        console.log(`   - ${inb.tag} (порт ${inb.port}, ${inb.protocol})`);
      }
      await saveInboundsToFile(inbounds);
      console.log("\n✅ Скрипт выполнен. Файл inbounds_list.json создан.");
      return;
    }

    // Команда: add-inbound
    if (command === "add-inbound") {
      if (
        !params.port ||
        !params.tag ||
        !params.sni ||
        !params.pbk ||
        !params.sid
      ) {
        console.error(
          "❌ Использование: node xui-manager.mjs add-inbound port=20001 tag=myTag sni=yahoo.com pbk=ВАШ_PUBLIC_KEY sid=6ba85179e30d",
        );
        return;
      }
      const newInbound = createRealityInbound(
        parseInt(params.port),
        params.tag,
        params.sni,
        params.pbk,
        params.sid,
      );
      await addInbound(newInbound);
      return;
    }

    // Команда: add-client
    if (command === "add-client") {
      if (!params.inboundId || !params.email) {
        console.error(
          "❌ Использование: node xui-manager.mjs add-client inboundId=1 email=user@example.com totalGB=50 expiryDays=30",
        );
        return;
      }
      const clientData = {
        email: params.email,
        flow: "",
        enable: true,
        limitIp: 0,
        totalGB: (params.totalGB ? parseInt(params.totalGB) : 50) * 1024 ** 3,
        expiryTime:
          Date.now() +
          (params.expiryDays ? parseInt(params.expiryDays) : 30) * 86400000,
      };
      await addClient(parseInt(params.inboundId), clientData);
      return;
    }

    console.error(`❌ Неизвестная команда: ${command}`);
    console.log(
      "Доступные команды:\n  (без аргументов) - показать список inbound и сохранить в JSON\n  add-inbound ... - добавить inbound\n  add-client ... - добавить клиента",
    );
  } catch (err) {
    console.error("❌ Ошибка:", err.message);
  }
}

main();
