// WhatsApp connection via WhatsApp Web (the same thing as "Linked devices" on your phone).
// The session is stored locally in data/wwebjs so you only scan the QR code once.
const path = require("path");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const state = {
  status: "starting", // starting | qr | ready | disconnected | error
  qrDataUrl: null,
  error: null,
};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, "..", "data", "wwebjs") }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", async (qr) => {
  state.status = "qr";
  state.qrDataUrl = await QRCode.toDataURL(qr);
});
client.on("ready", () => {
  state.status = "ready";
  state.qrDataUrl = null;
  console.log("[whatsapp] ready");
});
client.on("auth_failure", (msg) => {
  state.status = "error";
  state.error = `Authentication failed: ${msg}`;
});
client.on("disconnected", (reason) => {
  state.status = "disconnected";
  state.error = `Disconnected: ${reason}`;
});

function start() {
  client.initialize().catch((err) => {
    state.status = "error";
    state.error = err.message;
    console.error("[whatsapp] failed to start:", err);
  });
}

function getStatus() {
  return { ...state };
}

/**
 * Collect recent messages from chats that had activity in the last `lookbackHours`.
 * Returns a compact list of chats, each with its recent messages, for the AI to read.
 */
async function getRecentMessages({ lookbackHours = 24, maxChats = 25, perChat = 30 } = {}) {
  if (state.status !== "ready") throw new Error("WhatsApp is not connected yet");
  const since = Date.now() / 1000 - lookbackHours * 3600;

  const chats = (await client.getChats())
    .filter((c) => c.timestamp && c.timestamp >= since && !c.archived)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxChats);

  const result = [];
  for (const chat of chats) {
    const messages = await chat.fetchMessages({ limit: perChat });
    const recent = messages
      .filter((m) => m.timestamp >= since)
      .map((m) => ({
        time: new Date(m.timestamp * 1000).toISOString(),
        from: m.fromMe ? "Me" : m._data?.notifyName || m.author || m.from,
        text: m.body || `[${m.type}]`,
      }));
    if (recent.length === 0) continue;
    result.push({
      chat: chat.name || chat.id.user,
      isGroup: chat.isGroup,
      unread: chat.unreadCount,
      messages: recent,
    });
  }
  return result;
}

module.exports = { start, getStatus, getRecentMessages };
