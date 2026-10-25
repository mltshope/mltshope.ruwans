# Puluwanda AI

A small web app that runs **on your own computer**, reads your WhatsApp chats and Outlook inbox, and uses Claude (AI) to give you an update: what's urgent, who is waiting for your reply, and a short summary of everything else. You can also ask it questions such as "Kawda mata salli ewanna kiwwe?"

Oyage computer eke run wena web app ekak. WhatsApp chats saha Outlook emails kiyawala, AI eken update ekak denawa: hadissi dewal, reply ekak balaporoththuwen inna aya, saha anith dewal wala short summary ekak. Prashna ahannath puluwan.

```
 Browser (http://localhost:3000)
        │
 Node.js server (your PC, localhost only)
   ├── WhatsApp Web  ── linked device (QR scan once)
   ├── Microsoft Graph ── Outlook inbox (read-only, Mail.Read)
   └── Claude API ── writes the update / answers questions
```

## 1. Requirements

- Windows, macOS or Linux with **Node.js 18 or newer** (https://nodejs.org)
- Google Chrome (installed automatically by `npm install`)
- A **Claude API key** – https://platform.claude.com → API keys
- For Outlook: a free **Microsoft app registration** (step 3)

## 2. Install

```bash
cd puluwanda-ai
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Open `.env` and set `ANTHROPIC_API_KEY`.

## 3. Outlook setup (one time, ~5 minutes)

Microsoft requires every app that reads mail to be registered. It's free:

1. Go to https://portal.azure.com → **App registrations** → **New registration**
   (sign in with the same Microsoft account as your Outlook if you don't have Azure).
2. Name: `Puluwanda AI`. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**. Leave Redirect URI empty → **Register**.
3. Copy the **Application (client) ID** into `.env` as `MS_CLIENT_ID`.
4. **Authentication** → *Advanced settings* → **Allow public client flows: Yes** → Save.
5. **API permissions** → Add → Microsoft Graph → Delegated → `Mail.Read` and `User.Read`.

If your Outlook is a work/school account, your IT admin may need to approve the app. Set `MS_TENANT` to your company's tenant ID if `common` doesn't work.

## 4. Run

```bash
npm start
```

Open **http://localhost:3000**:

- **WhatsApp**: a QR code appears. On your phone: WhatsApp → Settings → **Linked devices** → Link a device → scan. You only do this once.
- **Outlook**: click *Sign in to Outlook*, open the link shown, enter the code, sign in.
- Click **Update ekak denna**. Choose 6/12/24 hours or 3 days, and Sinhala / Singlish / English.
- Tick *Auto update every 30 min* to keep it refreshing while the page is open.

## Settings (`.env`)

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `MS_CLIENT_ID` / `MS_TENANT` | Outlook app registration (step 3) |
| `SUMMARY_LANGUAGE` | Default language: `Sinhala`, `Singlish`, `English` |
| `LOOKBACK_HOURS` | Default time window (24) |
| `PORT` | Web port (3000) |

## Privacy & important notes

- The server listens on **localhost only**; nobody else on your network can open it.
- WhatsApp login and the Outlook token are stored in the local `data/` folder (git-ignored). Delete that folder to log out of everything.
- Outlook access is **read-only**. The app never sends WhatsApp messages or emails.
- When you click *Update*, the recent messages are sent to the Claude API to be summarised. Each update costs a few cents of API usage, depending on how many messages you have.
- **WhatsApp warning:** WhatsApp has no official API for personal accounts. This app uses WhatsApp Web through the `whatsapp-web.js` library, which is unofficial. It only reads, but WhatsApp's terms don't allow automated clients and there is a small risk they restrict the number. Use at your own risk; if your number is for business, consider the official WhatsApp Business Platform instead.
- Your computer must be on and `npm start` running for the app to work.
