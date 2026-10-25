require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const whatsapp = require("./whatsapp");
const outlook = require("./outlook");
const ai = require("./ai");

const PORT = Number(process.env.PORT) || 3000;
const LOOKBACK_HOURS = Number(process.env.LOOKBACK_HOURS) || 24;
const LANGUAGE = process.env.SUMMARY_LANGUAGE || "Sinhala";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/status", async (req, res) => {
  let outlookStatus;
  try {
    outlookStatus = await outlook.getStatus();
  } catch (err) {
    outlookStatus = { status: "error", error: err.message };
  }
  res.json({
    whatsapp: whatsapp.getStatus(),
    outlook: outlookStatus,
    ai: { configured: Boolean(process.env.ANTHROPIC_API_KEY) },
    language: LANGUAGE,
    lookbackHours: LOOKBACK_HOURS,
  });
});

app.post("/api/outlook/login", async (req, res) => {
  try {
    await outlook.startLogin();
    res.json(await outlook.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/outlook/logout", async (req, res) => {
  await outlook.signOut();
  res.json({ ok: true });
});

// Collect from both sources; a source that isn't connected is skipped, not fatal.
async function collect(lookbackHours) {
  const errors = [];
  const [wa, mail] = await Promise.allSettled([
    whatsapp.getRecentMessages({ lookbackHours }),
    outlook.getRecentEmails({ lookbackHours }),
  ]);
  if (wa.status === "rejected") errors.push(`WhatsApp: ${wa.reason.message}`);
  if (mail.status === "rejected") errors.push(`Outlook: ${mail.reason.message}`);
  return {
    whatsapp: wa.status === "fulfilled" ? wa.value : null,
    outlook: mail.status === "fulfilled" ? mail.value : null,
    errors,
  };
}

app.post("/api/update", async (req, res) => {
  const lookbackHours = Number(req.body.lookbackHours) || LOOKBACK_HOURS;
  const language = req.body.language || LANGUAGE;
  try {
    const data = await collect(lookbackHours);
    if (!data.whatsapp && !data.outlook) {
      return res.status(400).json({ error: "Nothing connected yet.", details: data.errors });
    }
    const text = await ai.ask({ data, question: req.body.question, language });
    res.json({
      text,
      counts: {
        whatsappChats: data.whatsapp?.length ?? 0,
        emails: data.outlook?.length ?? 0,
      },
      errors: data.errors,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[update]", err);
    const message =
      err instanceof Anthropic.AuthenticationError
        ? "Claude API key is invalid - check ANTHROPIC_API_KEY in .env"
        : err instanceof Anthropic.RateLimitError
          ? "Claude API rate limit reached - try again in a minute"
          : err.message;
    res.status(500).json({ error: message });
  }
});

// Bind to localhost only: this server can read your private messages.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Puluwanda AI running at http://localhost:${PORT}`);
});

if (process.env.DISABLE_WHATSAPP !== "1") whatsapp.start();
